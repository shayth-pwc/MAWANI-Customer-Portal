'use strict';
const cds = require('@sap/cds');
const DynamicLists = require('./core/services/dynamic-list.service');
const AdminGuard = require('./core/security/admin.guard');
const { safeError } = require('./core/utils/errors');
module.exports = cds.service.impl(function () {
  const svc = new DynamicLists();
  const guard = new AdminGuard();
  const log = cds.log('mawani-admin-lists');
  this.before('*', async req => {
    try { await guard.authorize(req); }
    catch (err) {
      const e = safeError(err);
      if (e.status >= 500) log.error(`Admin lists guard failed (code=${err.code || 'unknown'})`);
      return req.reject(e.status, e.message);
    }
  });
  const handlers = {
    getDefinitions: data => svc.getDefinitions(data),
    getDefinition: data => svc.getDefinition(data),
    saveDefinition: (data, req) => svc.saveDefinition(data, req),
    saveItem: (data, req) => svc.saveItem(data, req),
    setDefinitionActive: (data, req) => svc.setDefinitionActive(data, req),
    setItemActive: (data, req) => svc.setItemActive(data, req)
  };
  for (const [name, handler] of Object.entries(handlers)) {
    this.on(name, async req => {
      try { return await handler(req.data, req); }
      catch (err) {
        const e = safeError(err);
        if (e.status >= 500) log.error(`Dynamic lists ${name} failed (code=${err.code || 'unknown'})`);
        return req.reject(e.status, e.message);
      }
    });
  }
});
