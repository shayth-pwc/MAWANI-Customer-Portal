'use strict';
const cds = require('@sap/cds');
const UserController = require('./core/controllers/user.controller');
const IasController = require('./core/controllers/ias.controller');
const GroupController = require('./core/controllers/group.controller');
const AdminGuard = require('./core/security/admin.guard');
const { safeError } = require('./core/utils/errors');

module.exports = cds.service.impl(function () {
  const users = new UserController();
  const ias = new IasController();
  const groups = new GroupController();
  const guard = new AdminGuard();
  const log = cds.log('mawani-admin');

  // Read-only admin requests MUST NOT create or link portal records.
  // The verified IAS group guard permits admins without an existing profile;
  // first-login provisioning occurs only on POST /profile/provision.
  this.before('*', async req => {
    try {
      await guard.authorize(req);
    }
    catch (err) {
      const e = safeError(err);
      if (e.status >= 500) log.error(`Admin authorization failed (code=${err.code || 'unknown'})`);
      return req.reject(e.status, e.message);
    }
  });

  const handlers = {
    getUsers: data => users.getUsers(data),
    getUser: data => users.getUser(data),
    updatePortalUser: (data, req) => users.updatePortalUser(data, req),
    createPortalUser: (data, req) => users.createPortalUser(data, req),
    listIasGroups: data => groups.listIasGroups(data),
    getIasGroup: data => groups.getIasGroup(data),
    listIasUsers: data => ias.listIasUsers(data),
    getIasUser: data => ias.getIasUser(data),
    createIasUser: (data, req) => ias.createIasUser(data, req),
    syncIasUserToPortal: (data, req) => ias.syncIasUserToPortal(data, req),
    reconcileIasUserToPortal: (data, req) => ias.reconcileIasUserToPortal(data, req),
    updateIasUser: (data, req) => ias.updateIasUser(data, req),
    setIasUserActive: (data, req) => ias.setIasUserActive(data, req)
  };
  for (const [name, handler] of Object.entries(handlers)) {
    this.on(name, async req => {
      try { return await handler(req.data, req); }
      catch (err) {
        const e = safeError(err);
        if (e.status >= 500) log.error(`Operation ${name} failed (code=${err.code || 'unknown'})`);
        return req.reject(e.status, e.message);
      }
    });
  }
});
