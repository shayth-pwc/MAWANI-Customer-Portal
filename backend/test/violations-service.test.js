'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createViolationsService } = require('../srv/core/violations/violations-service');
const { createViolationsC4cClient } = require('../srv/core/violations/c4c-client');

const USER = '9c9664ef-acf6-4c0b-89ab-7f45f60ea565';
const CR = { CR_NATIONAL_NUMBER: '7000000000', IS_TEST_DATA: false };
const fine = {
  ID: '9001', ObjectID: 'ORDER1', ApprovalStatusCode: '4', CRNationalNumber_KUT: '7000000000',
  SalesOrganisationID: 'JED', BTP_FInestatus_KUT: 'NOT_PAID', Role1_KUT: 'ZSA010',
  ProcessingTypeCode: 'FINE', BuyerPartyID: 'BUYER1', SadadNumber_KUT: '1234',
  ObjectionExpiryDate: '2099-01-01T00:00:00'
};

function definition(code, items) { return { app: 'PORTAL', code, active: true, items }; }
function item(key, title, titleAr, uiColor = '') { return { key, title, titleAr, uiColor, active: true }; }

function makeService(c4c = {}) {
  const definitions = {
    PORTS: definition('PORTS', [item('JED', 'Jeddah', 'جدة', 'Success')]),
    FINE_STATUS: definition('FINE_STATUS', [item('NOT_PAID', 'Not Paid', 'غير مدفوعة', 'Error')]),
    LICENSE_TYPE: definition('LICENSE_TYPE', [item('ZSA010', 'Ship Supplier', 'مورد سفن')]),
    FINE_TYPE: definition('FINE_TYPE', [item('FINE', 'Fine', 'مخالفة', 'Warning')]),
    REQUEST_STATUS: definition('REQUEST_STATUS', [item('OPEN', 'Open', 'مفتوح', 'Information')])
  };
  return createViolationsService({
    crs: { listForUser: async uuid => { assert.equal(uuid, USER); return [CR]; } },
    c4c: {
      customerOrdersForCr: async national => { assert.equal(national, CR.CR_NATIONAL_NUMBER); return [fine]; },
      customerOrderById: async id => id === fine.ID ? [fine] : [],
      objectionsForFine: async () => [],
      attachments: async () => [],
      createObjection: async () => ({ ID: 'OBJ1', ObjectID: 'REQUEST1' }),
      addObjectionAttachment: async () => {},
      ...c4c
    },
    loadList: async code => definitions[code]
  });
}

test('violations are scoped to authenticated CRs and enriched with the existing list definitions', async () => {
  const rows = await makeService().getMyFines(USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].PORT_TEXT, 'Jeddah');
  assert.equal(rows[0].BTP_FInestatus_KUTText_AR, 'غير مدفوعة');
  assert.equal(rows[0].Role1_KUTText, 'Ship Supplier');
  assert.equal(rows[0].ProcessingTypeCode_UICOLORSTATUS, 'Warning');
});

test('reference list reads are serialized for CAP request-scoped PostgreSQL clients', async () => {
  let active = 0;
  let maxActive = 0;
  // Replace the service with a loader that detects overlapping calls. A real
  // ListService inherits the same request-scoped pg client as ViolationsService.
  const definitions = {
    PORTS: definition('PORTS', [item('JED', 'Jeddah', 'جدة')]),
    FINE_STATUS: definition('FINE_STATUS', [item('NOT_PAID', 'Not Paid', 'غير مدفوعة')]),
    LICENSE_TYPE: definition('LICENSE_TYPE', [item('ZSA010', 'Ship Supplier', 'مورد سفن')]),
    FINE_TYPE: definition('FINE_TYPE', [item('FINE', 'Fine', 'مخالفة')]),
    REQUEST_STATUS: definition('REQUEST_STATUS', [item('OPEN', 'Open', 'مفتوح')])
  };
  const serialApi = createViolationsService({
    crs: { listForUser: async () => [CR] },
    c4c: { customerOrdersForCr: async () => [fine] },
    loadList: async code => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      return definitions[code];
    }
  });
  await serialApi.getMyFines(USER);
  assert.equal(maxActive, 1);
});

test('unavailable optional display lists do not hide authorized C4C violations', async () => {
  const api = createViolationsService({
    crs: { listForUser: async () => [CR] },
    c4c: { customerOrdersForCr: async () => [fine] },
    loadList: async () => { throw new Error('optional list unavailable'); }
  });
  const rows = await api.getMyFines(USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ID, fine.ID);
  assert.equal(rows[0].BTP_FInestatus_KUT, 'NOT_PAID');
  assert.equal(rows[0].BTP_FInestatus_KUTText, undefined);
});

test('a fine by ID is not leaked when it is outside the authenticated CR scope', async () => {
  const api = makeService({ customerOrderById: async () => [{ ...fine, CRNationalNumber_KUT: 'OTHER' }] });
  assert.deepEqual(await api.getFineById(USER, fine.ID), []);
});

test('objections are joined only to the caller\'s fine and receive their legacy list fields', async () => {
  const api = makeService({ objectionsForFine: async id => [{ ID: 'OBJ1', ObjectID: 'O1', SalesOrderID: id, ProcessingTypeCode: 'ZOBJ', ServiceRequestUserLifeCycleStatusCode: 'OPEN' }] });
  const rows = await api.getMyObjectionRequests(USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].BTP_SadadNumber, '1234');
  assert.equal(rows[0].ServiceRequestUserLifeCycleStatusCodeText_AR, 'مفتوح');
});

test('C4C violations client uses the existing destination and preserves the server filter when paging', async () => {
  const calls = [];
  const client = createViolationsC4cClient({ executeHttpRequest: async (destination, request) => {
    calls.push({ destination, request });
    return request.url.includes('$skiptoken=next')
      ? { status: 200, data: { d: { results: [{ ...fine }] } } }
      : { status: 200, data: { d: { results: [{ ...fine }], __next: 'https://untrusted.example/?$skiptoken=next' } } };
  }});
  assert.equal((await client.customerOrdersForCr(CR.CR_NATIONAL_NUMBER)).length, 2);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.destination.destinationName === 'C4C_DES'));
  assert.ok(calls.every(call => decodeURIComponent(call.request.url).includes("CRNationalNumber_KUT eq '7000000000'")));
});
