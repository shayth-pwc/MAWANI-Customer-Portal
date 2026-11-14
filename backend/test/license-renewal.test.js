'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRenewalSubmitter } = require('../srv/core/licenses/renewal-service');
const { buildRenewalQuotePayload } = require('../srv/core/licenses/submission-c4c');

const CR = { CR_NUMBER: '1002003001', CR_NATIONAL_NUMBER: '7002612567', IS_TEST_DATA: false,
  BTP_ACTIVE_STATUS: 'ACTIVE', CR_STATUS: 'APPROVED', CR_NAME: 'Company', STREET: 'Road' };
const ACCOUNT = { AccountID: 'A1', ObjectID: 'OBJ1', RoleCode: 'ZSA010', LicenseNumber_KUT: 'LIC-1', LicenseStatus_KUT: '111' };
const CONFIG = { writesEnabled: true, contractReviewed: true, space: 'DEV', allowedSpace: 'DEV',
  salesOrg: 'S1600', salesUnit: 'S1600', allowedStatuses: new Set(['APPROVED']), createContacts: true };
const INPUT = JSON.stringify({ clientRequestId: '9c9664ef-acf6-4c0b-89ab-7f45f60ea565', accountId: 'A1', licenseNumber: 'LIC-1',
  licenseType: 'ZSA010', crNumber: CR.CR_NUMBER, crNationalNumber: CR.CR_NATIONAL_NUMBER,
  applicant: { name: 'Applicant', id: '123', documentType: '1', mobile: '0500000000', email: 'a@example.com' }, address: {}, attachments: [] });

test('renewal updates the scoped account/contact and creates the legacy S1600 quote', async () => {
  const calls = [];
  const service = createRenewalSubmitter({
    crs: { requireOwned: async () => CR },
    c4c: { findAccountsForCr: async () => [ACCOUNT], findQuotesForAccount: async () => [] },
    operations: { claimRenewal: async () => 'OP1', mark: async (_id, value) => calls.push(['mark', value.stage]) },
    writer: {
      patchAccount: async (id, cr) => calls.push(['account', id, cr.CR_NUMBER]),
      findMatchingContacts: async () => [], createContact: async id => calls.push(['contact', id]),
      createRenewalQuote: async id => { calls.push(['quote', id]); return { quoteID: 'Q1', quoteObjectID: 'OQ1' }; },
      uploadAttachment: async () => {},
    }, config: CONFIG,
  });
  const result = await service.submit({ actorUuid: 'actor', identity: { issuer: 'issuer', subject: 'subject' }, rawPayload: INPUT });
  assert.equal(result.status, 'SUCCEEDED');
  assert.deepEqual(calls.filter(call => call[0] !== 'mark'), [['account', 'OBJ1', CR.CR_NUMBER], ['contact', 'A1'], ['quote', 'A1']]);
});

test('renewal quote preserves the confirmed three-year S1600 contract', () => {
  const payload = buildRenewalQuotePayload('A1', 'ZSA010', {
    applicant: { name: 'Applicant', id: '123', documentType: '1', mobile: '500000000', email: 'a@example.com' }, address: {}
  }, CONFIG);
  assert.equal(payload.RequestType_KUT, 'RENEW');
  assert.equal(payload.SalesOrganisationID, 'S1600');
  assert.equal(payload.SalesUnitPartyID, 'S1600');
  assert.equal(payload.ZMOBIL_KUT, '0500000000');
  assert.match(payload.LicenseStartDate_KUT, /^\d{4}-\d{2}-\d{2}T00:00:00$/);
  assert.match(payload.LicenseEndDate_KUT, /^\d{4}-\d{2}-\d{2}T00:00:00$/);
});
