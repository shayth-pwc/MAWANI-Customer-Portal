'use strict';
const cds = require('@sap/cds');
const UserProvisioningService = require('./core/services/user-provisioning.service');
const { safeError, safeProvisioningDiagnostic } = require('./core/utils/errors');

module.exports = cds.service.impl(function () {
  const provisioning = new UserProvisioningService();
  const log = cds.log('mawani-profile');
  const shape = ({ profile, created }) => ({
    UUID: profile.UUID,
    IAS_ID: profile.IAS_ID,
    EMAIL: profile.EMAIL,
    ACCOUNT_TYPE: profile.ACCOUNT_TYPE,
    FNAME: profile.FNAME,
    LNAME: profile.LNAME,
    ACTIVE_STATUS: profile.ACTIVE_STATUS,
    created
  });
  async function handle(req, operation) {
    try { return shape(await operation(req)); }
    catch (err) {
      const e = safeError(err);
      if (e.status >= 500) log.error(`Profile operation failed (${safeProvisioningDiagnostic(err)})`);
      return req.reject(e.status, e.message);
    }
  }
  this.on('me', req => handle(req, r => provisioning.read(r)));
  this.on('provision', req => handle(req, r => provisioning.ensure(r)));
});
