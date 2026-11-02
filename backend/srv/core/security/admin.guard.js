'use strict';
const UserRepository = require('../repositories/user.repository');
const IasClient = require('../clients/ias.client');
const { trustedIdentity, trustedGlobalUserId } = require('./identity');
const { AppError } = require('../utils/errors');

/**
 * Portal-wide identity administration is granted only by the explicitly
 * configured IAS SCIM group ID (not by the DB ACCOUNT_TYPE classification).
 * No user is created in PostgreSQL during login or on admin requests.
 */
class AdminGuard {
  constructor(userRepository = new UserRepository(), iasClient = new IasClient(), env = process.env) {
    this.users = userRepository;
    this.ias = iasClient;
    this.env = env;
  }
  async authorize(req) {
    const { issuer, subject } = trustedIdentity(req);
    const globalUserId = trustedGlobalUserId(req);
    if (!globalUserId) throw new AppError(403, 'Verified IAS Global User ID is required');

    const adminGroupId = this.env.MAWANI_PORTAL_ADMIN_GROUP_ID;
    if (!adminGroupId || !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(adminGroupId))
      throw new AppError(503, 'Portal admin group ID is not configured');

    // Use SCIM user ID from the validated IAS user_uuid claim; never substitute
    // email or sub, which may be a different pairwise identifier.
    const profile = await this.ias.request('GET',
      `/Users/${encodeURIComponent(globalUserId)}?attributes=id,active,groups`);

    // Fail closed if SCIM returned an incomplete, inactive or mismatched user.
    if (!profile || profile.id !== globalUserId || profile.active !== true ||
        !Array.isArray(profile.groups) ||
        !profile.groups.some(group => group && group.value === adminGroupId))
      throw new AppError(403, 'Mawani Portal administrator group membership required');

    // Database is never the source of admin privileges, but local account
    // restrictions still apply to records created before the first login.
    // Check both token linkage and verified IAS ID without creating or linking.
    const byIdentity = await this.users.findByIdentity(issuer, subject);
    const byIasId = await this.users.findByIasId(globalUserId);
    if (byIdentity && byIasId && byIdentity.UUID !== byIasId.UUID)
      throw new AppError(409, 'Conflicting portal identity mappings');
    const actor = byIdentity || byIasId;
    if (actor && ((actor.IAS_ID && actor.IAS_ID !== globalUserId) ||
      (actor.IAS_ISSUER && actor.IAS_ISSUER !== issuer) ||
      (actor.IAS_SUBJECT && actor.IAS_SUBJECT !== subject)))
      throw new AppError(403, 'Portal identity linkage does not match IAS login');
    if (actor && actor.ACTIVE_STATUS !== true)
      throw new AppError(403, 'Portal account is inactive');

    const today = new Date().toISOString().slice(0, 10);
    const day = date => {
      if (!date) return null;
      const value = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new AppError(403, 'Invalid account validity date');
      return value;
    };
    if (actor) {
      const beginning = day(actor.BEGDA);
      const ending = day(actor.ENDDA);
      if ((beginning && beginning > today) || (ending && ending < today))
        throw new AppError(403, 'Portal account is outside its validity period');
    }

    // Audit can still record the SCIM actor ID even if there is no portal row.
    req.mawaniActor = actor || null;
    req.mawaniIdentity = { issuer, subject, globalUserId };
    return actor;
  }
}
module.exports = AdminGuard;
