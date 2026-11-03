'use strict';
const cds = require('@sap/cds');
const DynamicLists = require('./core/services/dynamic-list.service');
const { safeError } = require('./core/utils/errors');
module.exports = cds.service.impl(function () {
  const svc = new DynamicLists();
  this.on('getList', async req => {
    try { return await svc.getList(req.data); }
    catch (err) { const e = safeError(err); return req.reject(e.status, e.message); }
  });
});
