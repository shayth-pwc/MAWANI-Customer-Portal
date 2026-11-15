'use strict';

const cds = require('@sap/cds');
const UserProvisioningService = require('./core/services/user-provisioning.service');
const { createCrRepository } = require('./core/licenses/cr-repository');
const { createPermitsC4cClient } = require('./core/permits/c4c-client');
const { createPermitsService } = require('./core/permits/permits-service');
const { parseDefinition, LIST_APP } = require('./core/licenses/reference-lists');
const { LicenseError } = require('./core/licenses/errors');
const { AppError } = require('./core/utils/errors');

function safeReject(req, error) {
  if (error instanceof LicenseError || error instanceof AppError) return req.reject(error.status, error.message);
  const stages = new Set(['profile', 'database-connect', 'reference-lists', 'cr-scope', 'c4c-permits']);
  const stage = stages.has(error?.permitsStage) ? error.permitsStage : 'unknown';
  const code = typeof error?.code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(error.code) ? error.code : 'unknown';
  const type = ['Error', 'TypeError', 'RangeError', 'ReferenceError'].includes(error?.name) ? error.name : 'OtherError';
  cds.log('mawani-permits').error(`Permits operation failed: stage=${stage}, type=${type}, code=${code}`);
  return req.reject(503, 'Permits service temporarily unavailable');
}

module.exports = cds.service.impl(function () {
  let dbPromise; const db = () => (dbPromise ||= cds.connect.to('db')); const provisioning = new UserProvisioningService();
  async function service(req) {
    let stage = 'profile';
    try {
      const actor = (await provisioning.read(req)).profile;
      stage = 'database-connect'; const database = await db();
      stage = 'reference-lists'; const listService = await cds.connect.to('ListService');
      return { actor, api: createPermitsService({ crs: createCrRepository(database), c4c: createPermitsC4cClient({ executeHttpRequest: require('@sap-cloud-sdk/http-client').executeHttpRequest }), loadList: async code => parseDefinition(await listService.send('getList', { app: LIST_APP, code }), code, LIST_APP) }) };
    } catch (error) { error.permitsStage = error.permitsStage || stage; throw error; }
  }
  const operations = {
    getMyLicenses: (api, uuid) => api.getMyLicenses(uuid),
    getMyPermitRequests: (api, uuid) => api.getMyPermitRequests(uuid),
    getLicenseAttachments: (api, uuid, data) => api.getLicenseAttachments(uuid, data.accountId),
    getPermitAttachments: (api, uuid, data) => api.getPermitAttachments(uuid, data.requestId),
    submitPermit: (api, uuid, data) => api.submitPermit(uuid, data.payload)
  };
  for (const [name, operation] of Object.entries(operations)) this.on(name, async req => {
    try { const context = await service(req); return await operation(context.api, context.actor.UUID, req.data); }
    catch (error) { return safeReject(req, error); }
  });
});
