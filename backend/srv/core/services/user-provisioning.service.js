'use strict';
const cds = require('@sap/cds');
const IasClient = require('../clients/ias.client');
const UserRepository = require('../repositories/user.repository');
const AuditService = require('./audit.service');
const { trustedIdentity, trustedGlobalUserId } = require('../security/identity');
const { AppError } = require('../utils/errors');

/**
 * Idempotent, audit-tracked portal profile provisioning on the first authenticated
 * CAP request. IAS is the identity source; existing PostgreSQL profile settings
 * remain authoritative for portal-local enablement and business attributes.
 * This is NOT user/role provisioning inside IAS.
 */
class UserProvisioningService {
  constructor({
    ias = new IasClient(),
    users = new UserRepository(),
    audit = new AuditService(),
    getDb = () => cds.connect.to('db')
  } = {}) {
    this.ias = ias;
    this.users = users;
    this.audit = audit;
    this.getDb = getDb;
  }

  static assertUsable(profile) {
    // A local account disabled by an administrator MUST NOT be re-enabled by login.
    if (profile.ACTIVE_STATUS !== true) throw new AppError(403, 'Portal account is inactive');
    const today = new Date().toISOString().slice(0, 10);
    for (const [field, direction] of [['BEGDA', 'start'], ['ENDDA', 'end']]) {
      const raw = profile[field];
      if (raw == null) continue;
      const date = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(403, 'Invalid account validity date');
      if (direction === 'start' && date > today || direction === 'end' && date < today)
        throw new AppError(403, 'Portal account is outside its validity period');
    }
  }

  /** Re-check the *authenticated* directory user; never accept an IAS ID from the browser. */
  async verifyIasUser(globalUserId) {
    const iasUser = await this.ias.request('GET', `/Users/${encodeURIComponent(globalUserId)}`);
    if (!iasUser || iasUser.id !== globalUserId || iasUser.active !== true)
      throw new AppError(403, 'Active IAS directory account required');
    return iasUser;
  }

  /** Read-only profile lookup. GET must never link identities, insert rows or log changes. */
  async read(req) {
    const { issuer, subject } = trustedIdentity(req);
    if (req.user.is?.('system-user')) throw new AppError(403, 'Human IAS user required');
    const globalUserId = trustedGlobalUserId(req);
    if (!globalUserId || issuer.length > 255 || subject.length > 255)
      throw new AppError(403, 'Verified IAS identity required');
    await this.verifyIasUser(globalUserId);
    const db = await this.getDb();
    const byIdentity = await this.users.findByIdentity(issuer, subject, db);
    const byIasId = await this.users.findByIasId(globalUserId, db);
    if (byIdentity && byIasId && byIdentity.UUID !== byIasId.UUID)
      throw new AppError(409, 'Conflicting portal identity mappings');
    const profile = byIdentity || byIasId;
    if (!profile) throw new AppError(404, 'Portal profile not yet provisioned; call POST /profile/provision');
    if ((profile.IAS_ID && profile.IAS_ID !== globalUserId) ||
        (profile.IAS_ISSUER && profile.IAS_ISSUER !== issuer) ||
        (profile.IAS_SUBJECT && profile.IAS_SUBJECT !== subject))
      throw new AppError(403, 'Portal identity linkage does not match IAS login');
    UserProvisioningService.assertUsable(profile);
    req.mawaniActor = profile;
    req.mawaniIdentity = { issuer, subject, globalUserId };
    return { profile, created: false };
  }

  async ensure(req) {
    // This is a diagnostic stage label only. Never log token contents,
    // SQL parameters, SCIM response payloads, or authenticated user PII.
    let stage = 'verified-identity';
    try {
      const { issuer, subject } = trustedIdentity(req);
      if (req.user.is?.('system-user')) throw new AppError(403, 'Human IAS user required');
      const globalUserId = trustedGlobalUserId(req);
      if (!globalUserId) throw new AppError(403, 'Verified IAS Global User ID required');
      if (issuer.length > 255 || subject.length > 255)
        throw new AppError(403, 'IAS identity exceeds supported portal identifier size');

      stage = 'scim-user-lookup';
      const iasUser = await this.verifyIasUser(globalUserId);
      stage = 'database-connect';
      const db = await this.getDb();
      req.mawaniIdentity = { issuer, subject, globalUserId };

      stage = 'database-transaction';
      const result = await db.tx(async tx => {
        stage = 'advisory-lock';
        // Make parameter types explicit for PostgreSQL raw SQL.
        await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [globalUserId]);

        stage = 'lookup-by-token-identity';
        const byIdentity = await this.users.findByIdentity(issuer, subject, tx);
        stage = 'lookup-by-ias-id';
        const byIasId = await this.users.findByIasId(globalUserId, tx);

        if (byIdentity && byIasId && byIdentity.UUID !== byIasId.UUID)
          throw new AppError(409, 'Conflicting portal identity mappings');
        const current = byIdentity || byIasId;
        if (current) {
          if (current.IAS_ID && current.IAS_ID !== globalUserId ||
              current.IAS_ISSUER && current.IAS_ISSUER !== issuer ||
              current.IAS_SUBJECT && current.IAS_SUBJECT !== subject)
            throw new AppError(403, 'Portal identity linkage does not match IAS login');
          UserProvisioningService.assertUsable(current);
          const needsLink = !current.IAS_ID || !current.IAS_ISSUER || !current.IAS_SUBJECT;
          stage = 'link-existing-profile';
          const profile = needsLink
            ? await this.users.bindVerifiedIdentity(current.UUID, { globalUserId, issuer, subject }, tx)
            : current;
          if (!profile) throw new AppError(409, 'Portal identity linkage changed unexpectedly');
          req.mawaniActor = profile;
          if (needsLink) {
            stage = 'audit-identity-link';
            await this.audit.record(req, 'PORTAL_USER_IDENTITY_LINK', 'BTP_TBL_USERS', profile.UUID,
              'SUCCESS', 'Linked an existing portal profile to a verified IAS identity', tx);
          }
          stage = 'database-commit';
          return { profile, created: false };
        }

        stage = 'insert-new-profile';
        const profile = await this.users.createFromVerifiedLogin(
          { iasUser, globalUserId, issuer, subject }, tx);
        if (!profile?.UUID) throw new Error('Profile insert did not return a UUID');
        req.mawaniActor = profile;
        stage = 'audit-profile-create';
        await this.audit.record(req, 'PORTAL_USER_AUTO_CREATE', 'BTP_TBL_USERS', profile.UUID,
          'SUCCESS', 'Created portal profile from validated IAS login and verified SCIM user', tx);
        stage = 'database-commit';
        return { profile, created: true };
      });
      return result;
    } catch (err) {
      if (err && typeof err === 'object' && Object.isExtensible(err))
        err.provisioningStage ||= stage;
      throw err;
    }
  }
}
module.exports = UserProvisioningService;
