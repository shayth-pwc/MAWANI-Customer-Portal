'use strict';
const cds = require('@sap/cds');
const { createC4cClient } = require('./core/licenses/c4c-client');
const { createLicenseOrchestrator } = require('./core/licenses/license-orchestrator');
const { createOperationStore } = require('./core/licenses/operation-store');
const authorization = require('./core/licenses/authorization');
const { LicenseError } = require('./core/licenses/errors');
const { validateInput } = require('./core/licenses/payloads');
const { createExistingListValidator, LIST_APP } = require('./core/licenses/reference-lists');

function translateError(req, err) {
  if (err instanceof LicenseError) return req.reject(err.status, err.message);
  // Do not reveal SAP Cloud SDK or DB connection details to clients.
  return req.reject(502, 'License service temporarily unavailable');
}

module.exports = function () {
  let orchestrator;
  let dbConnection;
  async function getDb() { if (!dbConnection) dbConnection = await cds.connect.to('db'); return dbConnection; }
  async function getOrchestrator() {
    if (!orchestrator) {
      const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
      const db = await getDb();
      const c4c = createC4cClient({ executeHttpRequest });
      orchestrator = createLicenseOrchestrator({ c4c, operations: createOperationStore(db),
        authorizeCR: authorization.authorizeCR, authorizedCRs: authorization.authorizedCRs });
    }
    return orchestrator;
  }

  this.on('getMyLicenses', async req => {
    try { return (await getOrchestrator()).myLicenses(req); }
    catch (err) { return translateError(req, err); }
  });
  this.on('getMyRequests', async req => {
    try { return (await getOrchestrator()).myRequests(req); }
    catch (err) { return translateError(req, err); }
  });
  for (const [event, operation] of [['submitLicense', 'NEW'], ['renewLicense', 'RENEW']]) {
    this.on(event, async req => {
      try {
        if (typeof req.data.payload !== 'string' || req.data.payload.length > 15_000_000) {
          throw new LicenseError('INVALID_INPUT', 'Expected a JSON payload (maximum 15MB)');
        }
        let parsed;
        try { parsed = JSON.parse(req.data.payload); }
        catch (_) { throw new LicenseError('INVALID_INPUT', 'Invalid JSON payload'); }
        validateInput(parsed, operation);
        if (operation === 'NEW') {
          // Reuse the existing CAP ListService internally for server-side validation.
          // No new list API or database tables are introduced by LicenseService.
          const existingLists = await cds.connect.to('ListService');
          const validator = createExistingListValidator({
            loadList: (code, app) => existingLists.tx(req).send('getList', { app, code }),
            app: LIST_APP
          });
          await validator.validateSubmission(parsed, operation);
        }
        const output = await (await getOrchestrator()).submit(req, parsed, operation);
        return JSON.stringify(output);
      } catch (err) { return translateError(req, err); }
    });
  }
};
