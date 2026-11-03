'use strict';
const IasService = require('../services/ias.service');
const AuditService = require('../services/audit.service');
const UserService = require('../services/user.service');
const IasPasswordService = require('../services/ias-password.service');
const { AppError } = require('../utils/errors');

class IasController {
  constructor({ ias = new IasService(), audit = new AuditService(), users = new UserService(), password = new IasPasswordService() } = {}) {
    this.ias = ias; this.audit = audit; this.users = users; this.password = password;
  }
  listIasUsers(data) { return this.ias.listUsers(data); }
  getIasUser(data) { return this.ias.getUser(data.id); }
  async createIasUser(data, req) {
    let createdUser;
    try {
      createdUser = await this.ias.createUser(data);
    } catch (err) {
      if (err.code === 'IAS_RESULT_UNCERTAIN')
        await this.audit.uncertain(req, 'IAS_USER_CREATE', 'IAS_USER', data.userName);
      else await this.audit.failure(req, 'IAS_USER_CREATE', 'IAS_USER', data.userName);
      throw err;
    }

    // IAS has already committed. Never retry IAS POST or delete its account if
    // the subsequent PostgreSQL transaction fails. Offer explicit reconciliation.
    try {
      const rawUser = await this.ias.getRawUser(createdUser.id);
      const { profile, created } = await this.users.ensureFromAdministrativeIas(rawUser, req,
        { auditIasCreate: true });
      return { ...createdUser, portalUserUuid: profile.UUID, portalCreated: created };
    } catch (err) {
      await this.audit.uncertain(req, 'IAS_USER_CREATE_PROFILE_PENDING', 'IAS_USER', createdUser.id);
      throw new AppError(503,
        'IAS user was created, but its portal profile could not be confirmed. Do not retry user creation; use syncIasUserToPortal with the IAS user ID.',
        'IAS_PORTAL_SYNC_PENDING');
    }
  }
  async syncIasUserToPortal(data, req) {
    // Reconcile an IAS identity created before this version or after a partial
    // failure, without creating or changing the IAS user again.
    const rawUser = await this.ias.getRawUser(data.id);
    return this.users.ensureFromAdministrativeIas(rawUser, req);
  }
  async executeAndSync(req, action, target, mutation) {
    let verified;
    try {
      verified = await mutation();
    } catch (err) {
      if (err.code === 'IAS_RESULT_UNCERTAIN')
        await this.audit.uncertain(req, action, 'IAS_USER', target);
      else await this.audit.failure(req, action, 'IAS_USER', target);
      throw err;
    }
    // IAS is now committed and independently confirmed. Do not retry remote
    // PATCH when the next DB transaction fails; reconciliation is separate.
    try {
      const locallySynced = verified.fields.filter(field =>
        ['email', 'givenName', 'familyName', 'active', 'mobile'].includes(field));
      if (locallySynced.length) {
        await this.users.applyVerifiedIasChange(verified.raw, locallySynced, req, action);
      } else {
        await this.audit.afterExternalWrite(req, action, target, 'Verified IAS metadata updated');
      }
      return verified.user;
    } catch (err) {
      await this.audit.uncertain(req, `${action}_PROFILE_PENDING`, 'IAS_USER', target);
      throw new AppError(503,
        'IAS update was verified but PostgreSQL synchronization failed. Do not repeat the IAS change; use reconcileIasUserToPortal for this user.',
        'IAS_PORTAL_SYNC_PENDING');
    }
  }
  updateIasUser(data, req) {
    return this.executeAndSync(req, 'IAS_USER_UPDATE', data.id, () => this.ias.updateUser(data));
  }
  setIasUserActive(data, req) {
    return this.executeAndSync(req, 'IAS_USER_STATUS', data.id, () => this.ias.setUserActive(data));
  }
  async requestIasPasswordReset(data, req) {
    const raw = await this.ias.getRawUser(data.id);
    if (raw.active !== true) throw new AppError(400, 'Inactive IAS users cannot request password reset emails');
    const email = raw.emails?.find(e => e.primary)?.value || raw.emails?.[0]?.value;
    let result;
    try { result = await this.password.requestReset(email); }
    catch (error) {
      if (error.code === 'IAS_RESULT_UNCERTAIN')
        await this.audit.uncertain(req, 'IAS_PASSWORD_RESET_REQUEST', 'IAS_USER', data.id);
      else await this.audit.failure(req, 'IAS_PASSWORD_RESET_REQUEST', 'IAS_USER', data.id);
      throw error;
    }
    try {
      await this.audit.record(req, 'IAS_PASSWORD_RESET_REQUEST', 'IAS_USER', data.id,
        'REQUESTED', 'IAS password reset request accepted; delivery not confirmed');
    } catch {
      // IAS has already accepted a potentially non-idempotent request. Do not
      // invite a blind second email request when our audit DB is unavailable.
      throw new AppError(503,
        'IAS accepted the reset request, but portal audit logging failed. Do not retry until its status has been checked',
        'IAS_RESULT_UNCERTAIN');
    }
    return result;
  }
  async reconcileIasUserToPortal(data, req) {
    const raw = await this.ias.getRawUser(data.id);
    const fields = ['email', 'givenName', 'familyName', 'active'];
    if (typeof raw.phoneNumbers?.find(p => p?.type === 'mobile')?.value === 'string')
      fields.push('mobile');
    return this.users.applyVerifiedIasChange(raw, fields, req, null);
  }

}
module.exports = IasController;
