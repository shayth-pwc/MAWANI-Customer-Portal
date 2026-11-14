'use strict';

const cds = require('@sap/cds');
const UserProvisioningService = require('./core/services/user-provisioning.service');
const { createCrRepository } = require('./core/licenses/cr-repository');
const { createVisitsC4cClient } = require('./core/visits/c4c-client');
const { createVisitsService } = require('./core/visits/visits-service');
const { parseDefinition, LIST_APP } = require('./core/licenses/reference-lists');
const { LicenseError } = require('./core/licenses/errors');
const { AppError } = require('./core/utils/errors');

function safeReject(req, error) {
  if (error instanceof LicenseError || error instanceof AppError) return req.reject(error.status, error.message);
  const stages = new Set(['profile', 'database-connect', 'cr-scope', 'c4c-accounts', 'c4c-visits', 'reference-lists']);
  const stage = stages.has(error?.visitsStage) ? error.visitsStage : 'unknown';
  const code = typeof error?.code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(error.code) ? error.code : 'unknown';
  const type = ['Error', 'TypeError', 'RangeError', 'ReferenceError'].includes(error?.name) ? error.name : 'OtherError';
  cds.log('mawani-visits').error(`Visits operation failed: stage=${stage}, type=${type}, code=${code}`);
  return req.reject(503, 'Visits service temporarily unavailable');
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
        api: createVisitsService({
          crs: createCrRepository(database),
          c4c: createVisitsC4cClient({ executeHttpRequest: require('@sap-cloud-sdk/http-client').executeHttpRequest }),
          loadList: async code => parseDefinition(await listService.send('getList', { app: LIST_APP, code }), code, LIST_APP)
        })
      };
    } catch (error) {
      error.visitsStage = error.visitsStage || stage;
      throw error;
    }
  }

  const reads = {
    getMyVisits: (api, data) => api.getMyVisits(data.actor),
    getVisitById: (api, data) => api.getVisitById(data.actor, data.request.visitId),
    getVisitAttachments: (api, data) => api.getVisitAttachments(data.actor, data.request.visitId)
  };
  for (const [name, operation] of Object.entries(reads)) {
    this.on(name, async req => {
      try {
        const context = await service(req);
        return await operation(context.api, { actor: context.actor.UUID, request: req.data });
      } catch (error) {
        return safeReject(req, error);
      }
    });
  }
});
