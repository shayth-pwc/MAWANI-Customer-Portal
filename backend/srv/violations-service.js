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
  const allowedStages = new Set(['profile', 'database-connect', 'cr-scope', 'c4c-fines', 'reference-lists']);
  const stage = allowedStages.has(error?.violationsStage) ? error.violationsStage : 'unknown';
  const code = typeof error?.code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(error.code)
    ? error.code : 'unknown';
  const type = ['Error', 'TypeError', 'RangeError', 'ReferenceError'].includes(error?.name)
    ? error.name : 'OtherError';
  // Keep provider/database messages out of client responses and logs; the
  // stage, class and SQLSTATE-style code are enough for safe troubleshooting.
  cds.log('mawani-violations').error(`Violations operation failed: stage=${stage}, type=${type}, code=${code}`);
  return req.reject(503, 'Violations service temporarily unavailable');
}

module.exports = cds.service.impl(function () {
  let dbPromise;
  const db = () => (dbPromise ||= cds.connect.to('db'));
  const provisioning = new UserProvisioningService();

  async function service(req) {
    let stage = 'profile';
    try {
      const actor = (await provisioning.read(req)).profile;
      stage = 'database-connect';
      const database = await db();
      stage = 'reference-lists';
      const listService = await cds.connect.to('ListService');
      return {
        actor,
        api: createViolationsService({
          crs: createCrRepository(database),
          c4c: createViolationsC4cClient({ executeHttpRequest: require('@sap-cloud-sdk/http-client').executeHttpRequest }),
          loadList: async code => parseDefinition(await listService.send('getList', { app: LIST_APP, code }), code, LIST_APP)
        })
      };
    } catch (error) {
      error.violationsStage = error.violationsStage || stage;
      throw error;
    }
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
      } catch (error) {
        error.violationsStage = error.violationsStage || (name === 'getMyFines' ? 'cr-scope' : 'unknown');
        return safeReject(req, error);
      }
    });
  }
});
