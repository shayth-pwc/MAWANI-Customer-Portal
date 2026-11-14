'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVisitsService } = require('../srv/core/visits/visits-service');
const { createVisitsC4cClient } = require('../srv/core/visits/c4c-client');

const USER = '9c9664ef-acf6-4c0b-89ab-7f45f60ea565';
const CR = { CR_NATIONAL_NUMBER: '7000000000', IS_TEST_DATA: false };
const ACCOUNT = { AccountID: '10110', CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER };
const visit = {
  ID: '3460', ObjectID: 'VISIT1', MainAccountPartyID: ACCOUNT.AccountID, AccountPartyName: 'Mawani Customer',
  Status: '3', ActualStartDateTime: '2026-11-14T08:00:00', SalesOrganisationID: 'JED', VisitType: 'SUDDEN'
};

function definition(code, items) { return { app: 'PORTAL', code, active: true, items }; }
function item(key, title, titleAr) { return { key, title, titleAr, active: true }; }

function makeService(c4c = {}) {
  const definitions = {
    PORTS: definition('PORTS', [item('JED', 'Jeddah Islamic Port', 'ميناء جدة الإسلامي')]),
    VISITTYPE: definition('VISITTYPE', [item('SUDDEN', 'Sudden', 'مفاجئة')])
  };
  return createVisitsService({
    crs: { listForUser: async uuid => { assert.equal(uuid, USER); return [CR]; } },
    c4c: {
      accountsForCr: async national => { assert.equal(national, CR.CR_NATIONAL_NUMBER); return [ACCOUNT]; },
      visitsForAccounts: async ids => { assert.deepEqual(ids, [ACCOUNT.AccountID]); return [visit]; },
      visitById: async id => id === visit.ID ? [visit] : [],
      attachments: async objectId => { assert.equal(objectId, visit.ObjectID); return [{ Name: 'visit.pdf' }]; },
      ...c4c
    },
    loadList: async code => definitions[code]
  });
}

test('visits use the caller CRs, C4C corporate accounts, and legacy list labels', async () => {
  const rows = await makeService().getMyVisits(USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].BTP_PORT_TEXT_EN, 'Jeddah Islamic Port');
  assert.equal(rows[0].BTP_VisitTypeText_AR, 'مفاجئة');
});

test('unavailable optional display lists do not hide authorized visits', async () => {
  const api = createVisitsService({
    crs: { listForUser: async () => [CR] },
    c4c: { accountsForCr: async () => [ACCOUNT], visitsForAccounts: async () => [visit] },
    loadList: async () => { throw new Error('optional list unavailable'); }
  });
  const rows = await api.getMyVisits(USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ID, visit.ID);
  assert.equal(rows[0].BTP_PORT_TEXT_EN, undefined);
});

test('a visit is not leaked when its C4C account is outside the authenticated CR scope', async () => {
  const api = makeService({ visitById: async () => [{ ...visit, MainAccountPartyID: 'OTHER' }] });
  assert.deepEqual(await api.getVisitById(USER, visit.ID), []);
});

test('visit attachments are retrieved only after the visit is scoped to the caller', async () => {
  const attachments = await makeService().getVisitAttachments(USER, visit.ID);
  assert.deepEqual(attachments, [{ Name: 'visit.pdf' }]);
});

test('C4C visits client preserves the status and account scope filters', async () => {
  const calls = [];
  const client = createVisitsC4cClient({ executeHttpRequest: async (destination, request) => {
    calls.push({ destination, request });
    return { status: 200, data: { d: { results: [visit] } } };
  }});
  assert.equal((await client.visitsForAccounts([ACCOUNT.AccountID])).length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].destination.destinationName, 'C4C_DES');
  assert.match(decodeURIComponent(calls[0].request.url), /Status eq '3'/);
  assert.match(decodeURIComponent(calls[0].request.url), /MainAccountPartyID eq '10110'/);
  assert.match(decodeURIComponent(calls[0].request.url), /\$orderby=ID asc/);
});
