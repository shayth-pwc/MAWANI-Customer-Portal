'use strict';

const cds = require('@sap/cds');
const UserProvisioningService = require('./core/services/user-provisioning.service');
const { createCrRepository } = require('./core/licenses/cr-repository');
const { createViolationsC4cClient } = require('./core/violations/c4c-client');
const { createViolationsService } = require('./core/violations/violations-service');
const { parseDefinition, LIST_APP } = require('./core/licenses/reference-lists');
const { LicenseError } = require('./core/licenses/errors');
const { AppError } = require('./core/utils/errors');

function safeReject(req, error) {
  if (error instanceof LicenseError || error instanceof AppError) return req.reject(error.status, error.message);
  cds.log('mawani-violations').error('Violations operation failed (internal details withheld)');
  return req.reject(503, 'Violations service temporarily unavailable');
}

module.exports = cds.service.impl(function () {
  let dbPromise;
  const db = () => (dbPromise ||= cds.connect.to('db'));
  const provisioning = new UserProvisioningService();

  async function service(req) {
    const actor = (await provisioning.read(req)).profile;
    const listService = await cds.connect.to('ListService');
    return {
      actor,
      api: createViolationsService({
        crs: createCrRepository(await db()),
        c4c: createViolationsC4cClient({ executeHttpRequest: require('@sap-cloud-sdk/http-client').executeHttpRequest }),
        loadList: async code => parseDefinition(await listService.send('getList', { app: LIST_APP, code }), code, LIST_APP)
      })
    };
  }

  const reads = {
    getMyFines: (api, data) => api.getMyFines(data.actor.UUID),
    getFineById: (api, data) => api.getFineById(data.actor.UUID, data.request.fineId),
    getMyObjectionRequests: (api, data) => api.getMyObjectionRequests(data.actor.UUID),
    getFineAttachments: (api, data) => api.getFineAttachments(data.actor.UUID, data.request.fineId),
    getObjectionAttachments: (api, data) => api.getObjectionAttachments(data.actor.UUID, data.request.requestId),
    submitObjection: (api, data) => api.submitObjection(data.actor.UUID, data.request.payload)
  };
  for (const [name, operation] of Object.entries(reads)) {
    this.on(name, async req => {
      try {
        const context = await service(req);
        return await operation(context.api, { actor: context.actor, request: req.data });
      } catch (error) { return safeReject(req, error); }
    });
  }
});
