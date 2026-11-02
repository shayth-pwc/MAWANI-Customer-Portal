'use strict';
const UserService = require('../services/user.service');
const IasService = require('../services/ias.service');
const AuditService = require('../services/audit.service');
const { AppError } = require('../utils/errors');

class UserController {
  constructor({ users = new UserService(), ias = new IasService(), audit = new AuditService() } = {}) {
    this.users = users;
    this.ias = ias;
    this.audit = audit;
  }
  getUsers(data) { return this.users.listUsers(data); }
  getUser(data) { return this.users.getUser(data.uuid); }
  async updatePortalUser(data, req) {
    try { return await this.users.updateUser(data, req); }
    catch (err) {
      await this.audit.failure(req, 'PORTAL_USER_UPDATE', 'BTP_TBL_USERS', data.uuid);
      throw err;
    }
  }
  async createPortalUser(data, req) {
    try {
      const user = await this.ias.getUser(data.iasId);
      if (!user.id) throw new AppError(502, 'IAS did not supply the directory ID');
      return await this.users.createFromIas(user, req);
    } catch (err) {
      await this.audit.failure(req, 'PORTAL_USER_CREATE', 'BTP_TBL_USERS', data.iasId);
      throw err;
    }
  }
}
module.exports = UserController;
