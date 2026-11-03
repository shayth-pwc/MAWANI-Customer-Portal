'use strict';
const cds = require('@sap/cds');
const UserRepository = require('../repositories/user.repository');
const AuditService = require('./audit.service');
const { int, uuid } = require('../utils/validation');
const { AppError } = require('../utils/errors');

const PROFILE_FIELDS = Object.freeze([
  'FNAME', 'SNAME', 'TNAME', 'LNAME', 'MOBILE_KEY', 'MOBILE_NUMBER', 'CCODE', 'ACTIVE_STATUS'
]);
class UserService {
  constructor({ users = new UserRepository(), audit = new AuditService(), getDb = () => cds.connect.to('db') } = {}) {
    this.users = users;
    this.audit = audit;
    this.getDb = getDb;
  }
  listUsers({ limit, offset } = {}) {
    return this.users.findAll(int(limit, 'limit', 50, 1, 100), int(offset, 'offset', 0, 0, 10000000));
  }
  async getUser(userUuid) {
    const user = await this.users.findById(uuid(userUuid));
    if (!user) throw new AppError(404, 'Portal user not found');
    return user;
  }
  async updateUser(data, req) {
    const userUuid = uuid(data.uuid);
    const changes = {};
    for (const field of PROFILE_FIELDS) {
      if (data[field] !== undefined && data[field] !== null) changes[field] = data[field];
    }
    const db = await this.getDb();
    return db.tx(async tx => {
      const result = await this.users.updateProfile(userUuid, changes, tx);
      if (!result) throw new AppError(404, 'Portal user not found');
      // Never audit raw personal data; log the changed field names only.
      await this.audit.record(req, 'PORTAL_USER_UPDATE', 'BTP_TBL_USERS', userUuid,
        'SUCCESS', `Updated fields: ${Object.keys(changes).join(', ')}`, tx);
      return result;
    });
  }
  /**
   * Administrators synchronize an existing SCIM user to PostgreSQL immediately.
   * This operation is idempotent and shares the same per-IAS-ID advisory lock as
   * the verified first-login provisioner, preventing a race with that flow.
   * The IAS create audit and profile-create audit are committed together.
   */
  async ensureFromAdministrativeIas(iasUser, req, { auditIasCreate = false } = {}) {
    const iasId = require('../utils/validation').text(iasUser?.id, 'IAS user ID',
      { max: 150, required: true });
    if (typeof iasUser.active !== 'boolean')
      throw new AppError(502, 'IAS user activation state is unavailable');
    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [iasId]);
      const existing = await this.users.findByIasId(iasId, tx);
      let profile = existing;
      let created = false;
      if (!profile) {
        profile = await this.users.createFromAdministrativeIas(iasUser, tx);
        created = true;
        await this.audit.record(req, 'PORTAL_USER_ADMIN_CREATE', 'BTP_TBL_USERS', profile.UUID,
          'SUCCESS', 'Administrator created portal profile for verified IAS directory user', tx);
      }
      if (auditIasCreate) {
        await this.audit.record(req, 'IAS_USER_CREATE', 'IAS_USER', iasId,
          'SUCCESS', 'IAS user created and portal profile verified', tx);
      }
      return { profile, created };
    });
  }

  /**
   * Synchronize only independently VERIFIED IAS fields to an existing profile.
   * If the user has no portal profile, create it in the same transaction.
   * A successful remote IAS PATCH cannot be rolled back by PostgreSQL, so
   * callers must report a reconciliation requirement if this method fails.
   *
   * Explicit administrator operations may adjust ACTIVE_STATUS; implicit
   * login and the idempotent syncIasUserToPortal action never reactivate an
   * already disabled local account.
   */
  async applyVerifiedIasChange(rawUser, fields, req, auditAction) {
    const { text, email } = require('../utils/validation');
    const iasId = text(rawUser?.id, 'IAS user ID', { max: 150, required: true });
    const allowed = new Set(['email', 'givenName', 'familyName', 'active', 'mobile']);
    if (!Array.isArray(fields) || !fields.length || fields.some(field => !allowed.has(field)))
      throw new AppError(400, 'Invalid IAS synchronization field selection');
    const changes = {};
    if (fields.includes('email')) {
      changes.EMAIL = email(rawUser.emails?.find(item => item?.primary)?.value ||
        rawUser.emails?.[0]?.value);
    }
    if (fields.includes('givenName')) changes.FNAME = text(rawUser.name?.givenName,
      'IAS givenName', { max: 100, required: true });
    if (fields.includes('familyName')) changes.LNAME = text(rawUser.name?.familyName,
      'IAS familyName', { max: 100, required: true });
    if (fields.includes('mobile')) {
      const number = rawUser.phoneNumbers?.find(p => p?.type === 'mobile')?.value;
      changes.MOBILE_NUMBER = text(number, 'IAS mobile', { max: 25, required: true });
    }
    if (fields.includes('active')) {
      if (typeof rawUser.active !== 'boolean') throw new AppError(502, 'IAS status missing');
      changes.ACTIVE_STATUS = rawUser.active;
    }

    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [iasId]);
      let profile = await this.users.findByIasId(iasId, tx);
      let created = false;
      if (!profile) {
        profile = await this.users.createFromAdministrativeIas(rawUser, tx);
        created = true;
        // Administrative IAS provisioning creates name/email/status. Apply
        // the separately-verified mobile in this same transaction when present.
        if (Object.hasOwn(changes, 'MOBILE_NUMBER'))
          profile = await this.users.updateVerifiedIasFields(profile.UUID,
            { MOBILE_NUMBER: changes.MOBILE_NUMBER }, tx);
        await this.audit.record(req, 'PORTAL_USER_ADMIN_CREATE', 'BTP_TBL_USERS', profile.UUID,
          'SUCCESS', 'Created missing profile while reconciling verified IAS state', tx);
      } else {
        profile = await this.users.updateVerifiedIasFields(profile.UUID, changes, tx);
        await this.audit.record(req, 'PORTAL_USER_IAS_SYNC', 'BTP_TBL_USERS', profile.UUID,
          'SUCCESS', `Verified IAS fields synchronized: ${Object.keys(changes).join(', ')}`, tx);
      }
      if (auditAction) {
        await this.audit.record(req, auditAction, 'IAS_USER', iasId, 'SUCCESS',
          'IAS operation verified and portal profile synchronized', tx);
      } else {
        await this.audit.record(req, 'IAS_USER_RECONCILE', 'IAS_USER', iasId, 'SUCCESS',
          'Administrator reconciled the portal with current IAS state', tx);
      }
      return { profile, created };
    });
  }

  async createFromIas(iasUser, req) {
    const db = await this.getDb();
    return db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))', [iasUser.id]);
      const exists = await this.users.findByIasId(iasUser.id, tx);
      if (exists) throw new AppError(409, 'IAS user already has a portal profile');
      const profile = await this.users.createFromIas(iasUser, tx);
      await this.audit.record(req, 'PORTAL_USER_CREATE', 'BTP_TBL_USERS', profile.UUID,
        'SUCCESS', 'Admin explicitly created a disabled portal profile linked by IAS_ID', tx);
      return profile;
    });
  }
}
module.exports = UserService;
