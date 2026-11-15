'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPermitsService } = require('../srv/core/permits/permits-service');
const { createPermitsC4cClient } = require('../srv/core/permits/c4c-client');

const USER = '9c9664ef-acf6-4c0b-89ab-7f45f60ea565';
const CR = { CR_NUMBER: '7000000000', CR_NATIONAL_NUMBER: '7000000000', CR_ADDRESS: 'Mawani Street', IS_TEST_DATA: false };
const ACCOUNT = { AccountID: '10110', ObjectID: 'ACCOUNT1', CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER, CommercialRegisterNumber_KUT: CR.CR_NUMBER, LicenseNumber_KUT: 'LIC-1', LicenseStatus_KUT: '101', LicenseValidTo_KUT: '2030-12-31', RoleCode: 'ZLIC', Port3_KUT: 'S1700', BusinessPartnerFormattedName: 'Mawani Customer' };
const REQUEST = { ID: 'SR-1', ObjectID: 'REQUEST1', BuyerPartyID: ACCOUNT.AccountID, ProcessingTypeCode: 'ZMZW', Port3_KUT: 'S1700', Place_KUT: '111', ServiceRequestUserLifeCycleStatusCode: 'Y1' };

function definition(code, key, title) { return { app: 'PORTAL', code, active: true, items: [{ key, title, titleAr: title, active: true }] }; }
function make(c4c = {}) {
  const definitions = { LICENSE_TYPE: definition('LICENSE_TYPE', 'ZLIC', 'License'), PERMIT_TYPE: definition('PERMIT_TYPE', 'ZMZW', 'Activity in Port'), PORTS: definition('PORTS', 'S1700', 'Jeddah'), REQUEST_STATUS: definition('REQUEST_STATUS', 'Y1', 'Approved') };
  return createPermitsService({
    crs: { listForUser: async uuid => { assert.equal(uuid, USER); return [CR]; } },
    c4c: { accountsForCr: async cr => { assert.equal(cr.CR_NUMBER, CR.CR_NUMBER); return [ACCOUNT]; }, permitsForAccounts: async ids => { assert.deepEqual(ids, [ACCOUNT.AccountID]); return [REQUEST]; }, quotesForAccount: async () => [], salesQuoteAttachments: async () => [], permitAttachments: async id => [{ Name: `${id}.pdf` }], createPermit: async payload => ({ ID: 'SR-2', ObjectID: 'REQUEST2', payload }), addPermitAttachment: async () => {}, ...c4c },
    loadList: async code => definitions[code]
  });
}

test('permits only return C4C licenses and requests within the signed-in user CR scope', async () => {
  const api = make();
  const licenses = await api.getMyLicenses(USER);
  assert.equal(licenses.length, 1); assert.equal(licenses[0].LicenseTypeText, 'License');
  const permits = await api.getMyPermitRequests(USER);
  assert.equal(permits.length, 1); assert.equal(permits[0].ProcessingTypeText, 'Activity in Port');
});

test('permit submission validates an eligible license and sends the legacy C4C fields', async () => {
  let created;
  const api = make({ permitsForAccounts: async () => [], createPermit: async payload => { created = payload; return { ID: 'SR-2', ObjectID: 'REQUEST2' }; } });
  const result = await api.submitPermit(USER, JSON.stringify({ accountId: ACCOUNT.AccountID, permitType: 'ZMZW', port: 'S1700', place: '111', disclaimerAccepted: true, attachments: [] }));
  assert.equal(result.ID, 'SR-2'); assert.equal(created.BuyerPartyID, ACCOUNT.AccountID); assert.equal(created.ServiceSupportTeamPartyID, 'S1700'); assert.equal(created.CRAddress1_KUT, 'Mawani Street');
});

test('permit C4C client keeps all account IDs in its server-side filter', async () => {
  const calls = [];
  const client = createPermitsC4cClient({ executeHttpRequest: async (destination, request) => { calls.push({ destination, request }); return { status: 200, data: { d: { results: [REQUEST] } } }; } });
  assert.equal((await client.permitsForAccounts([ACCOUNT.AccountID])).length, 1);
  assert.equal(calls[0].destination.destinationName, 'C4C_DES');
  assert.match(decodeURIComponent(calls[0].request.url), /BuyerPartyID eq '10110'/);
});
