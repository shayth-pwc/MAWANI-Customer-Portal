'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSubmission, assertCommercialRegistration } = require('../srv/core/licenses/submission-input');
const { buildAccountPayload, buildQuotePayload, createC4cWriter } = require('../srv/core/licenses/submission-c4c');
const { createLicenseSubmitter } = require('../srv/core/licenses/submission-service');
const { createSubmissionOperations, payloadHash } = require('../srv/core/licenses/submission-operations');

function submission(overrides = {}) {
  return {
    clientRequestId: '49e8a5f5-7cea-4bfb-adcf-32c9c5c8d150',
    crNationalNumber: '7002612567', crNumber: '1002003001',
    licenseTypes: ['TEST03'], serviceTypes: ['ZSA011'], investorType: 'INV1',
    applicant: { name: 'Test Applicant', id: '1200000000', documentType: '1', mobile: '0500000000', email: 'test@example.org' },
    address: { cityCode: 'RUH' }, attachments: [], ...overrides
  };
}
function cr(overrides = {}) {
  return { CR_NUMBER: '1002003001', CR_NATIONAL_NUMBER: '7002612567',
    CR_NAME_AR: 'Example Company', CR_NAME: 'Example Company',
    IS_TEST_DATA: false, CR_STATUS: 'APPROVED', BTP_ACTIVE_STATUS: 'ACTIVE', ...overrides };
}
const identity = { issuer: 'https://ias.example.invalid', subject: 'u-1' };
const config = {
  writesEnabled: true, contractReviewed: true, space: 'DEV', allowedSpace: 'DEV',
  salesOrg: 'SVERIFIED', salesUnit: 'SVERIFIED', allowedStatuses: new Set(['APPROVED']),
  createAccounts: true, createContacts: false, uploadAttachments: true
};
function fakeOperations() {
  const saved = new Map();
  let claims = 0;
  return {
    saved, get claims() { return claims; },
    async find(_id, input, type) { return saved.get(`${input.clientRequestId}:${type}`) || null; },
    async claim(_id, input, type, hash) {
      claims++;
      const key = `${input.clientRequestId}:${type}`;
      if (saved.has(key)) throw Error('duplicate');
      saved.set(key, { ID: key, STATUS: 'PENDING', REQUEST_SHA256: hash });
      return key;
    },
    async mark(id, record) {
      const entry = saved.get(id);
      if (!entry) throw Error('missing tracked operation');
      if (record.status) entry.STATUS = record.status;
      if (record.result) entry.RESULT_JSON = record.result;
      if (record.accountID) entry.ACCOUNT_ID = record.accountID;
      if (record.quoteID) entry.QUOTE_ID = record.quoteID;
      entry.STAGE = record.stage;
    }
  };
}
function fixture({ accounts = [{ AccountID: '10001', RoleCode: 'TEST03', LicenseNumber_KUT: '' }],
    quotes = [], operation = fakeOperations(), writerOverrides = {}, configOverrides = {} } = {}) {
  const calls = [];
  const writer = {
    async createAccount(_cr, _input, type) { calls.push(['account', type]); return { accountID: '10002' }; },
    async createContact() { calls.push(['contact']); return { contactID: 'C1' }; },
    async findMatchingContacts() { return []; },
    async createQuote(accountID, type, input, options) {
      calls.push(['quote', accountID, type, input.serviceTypes[0], options.salesOrg]);
      return { quoteID: 'Q100', quoteObjectID: 'O100' };
    },
    async uploadAttachment(_quote, file) { calls.push(['attachment', file.name]); return { name: file.name, status: 'SUCCEEDED' }; },
    ...writerOverrides
  };
  const c4c = {
    async findAccountsForCr() { calls.push(['read-accounts']); return accounts; },
    async findQuotesForAccount(id) { calls.push(['read-quotes', id]); return quotes; }
  };
  const submitter = createLicenseSubmitter({
    crs: { async requireOwned(id) { assert.equal(id, 'user-uuid'); return cr(); } },
    c4c, writer,
    operations: operation,
    pricing: { async quote(services) { assert.deepEqual(services, ['ZSA011']); return { currency: 'SAR', totalHalalas: '325000' }; } },
    getEnabledKeys: async () => new Set(['TEST03','ZSA011','INV1','NEXT01']),
    config: { ...config, ...configOverrides }
  });
  const call = async raw => submitter.submit({ actorUuid: 'user-uuid', identity, rawPayload: JSON.stringify(raw || submission()) });
  return { submitter, call, calls, operation };
}

test('parses current React payload and checks one selected C4C service', () => {
  const value = parseSubmission(JSON.stringify(submission()));
  assert.equal(value.licenseTypes[0], 'TEST03');
  assert.deepEqual(value.serviceTypes, ['ZSA011']);
});
test('invalid JSON and a plain scalar service are rejected', () => {
  assert.throws(() => parseSubmission('not json'), e => e.code === 'INVALID_SUBMISSION');
  assert.throws(() => parseSubmission(JSON.stringify(submission({ serviceTypes: 'ZSA011' }))), e => e.status === 400);
});
test('multiple distinct services are never silently omitted from the C4C quote', () => {
  assert.throws(() => parseSubmission(JSON.stringify(submission({ serviceTypes: ['ZSA011', 'TEST05'] }))), e => e.code === 'MULTI_SERVICE_CONTRACT_PENDING' && e.status === 422);
});
test('attachment validates extension, MIME and magic bytes', () => {
  const bytes = Buffer.concat([Buffer.from('%PDF-'), Buffer.from('test')]);
  const parsed = parseSubmission(JSON.stringify(submission({ attachments: [{ name: 'proof.pdf', mimeType: 'application/pdf', contentBase64: bytes.toString('base64') }] })));
  assert.equal(parsed.attachments[0].byteLength, 9);
  const unsafe = submission({ attachments: [{ name: '../proof.pdf', mimeType: 'application/pdf', contentBase64: bytes.toString('base64') }] });
  assert.throws(() => parseSubmission(JSON.stringify(unsafe)));
  const wrongMagic = submission({ attachments: [{ name: 'proof.png', mimeType: 'image/png', contentBase64: bytes.toString('base64') }] });
  assert.throws(() => parseSubmission(JSON.stringify(wrongMagic)));
});
test('CR status and synthetic flag are enforced server-side', () => {
  assert.throws(() => assertCommercialRegistration(cr({ CR_STATUS: 'TEST' }), new Set(['APPROVED'])), e => e.code === 'CR_STATUS_NOT_APPROVED');
  assert.throws(() => assertCommercialRegistration(cr({ IS_TEST_DATA: true }), new Set(['APPROVED'])), e => e.code === 'UNVERIFIED_CR');
  assert.doesNotThrow(() => assertCommercialRegistration(cr(), new Set(['APPROVED'])));
});
test('account and quote C4C mappings use verified CR and runtime sales unit', () => {
  const input = parseSubmission(JSON.stringify(submission()));
  const account = buildAccountPayload(cr(), input, 'TEST03');
  const quote = buildQuotePayload('10003953', 'TEST03', input, config);
  assert.equal(account.CRNationalNumber_KUT, '7002612567');
  assert.equal(account.RoleCode, 'TEST03');
  assert.equal(quote.BuyerPartyID, '10003953');
  assert.equal(quote.Type1_KUT, 'ZSA011');
  assert.equal(quote.ZAPPLICANT_ID_TYPE_KUT, 'NAT');
  assert.equal(quote.SalesOrganisationID, 'SVERIFIED');
});
test('writer uses C4C_DES and SDK CSRF for C4C POST; no credentials in payload', async () => {
  const calls = [];
  const writer = createC4cWriter({ executeHttpRequest: async (...args) => {
    calls.push(args);
    return { status: 201, data: { d: { ID: 'Q1', ObjectID: 'OBJ1' } } };
  } });
  const input = parseSubmission(JSON.stringify(submission()));
  assert.deepEqual(await writer.createQuote('10001', 'TEST03', input, config), { quoteID: 'Q1', quoteObjectID: 'OBJ1' });
  assert.equal(calls[0][0].destinationName, 'C4C_DES');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].url, '/c4codataapi/SalesQuoteCollection');
  assert.equal(calls[0][2].fetchCsrfToken, true);
  assert.equal(calls[0][1].data.RequestType_KUT, 'NEW');
});
test('successful C4C quote persists result and replay does not POST again', async () => {
  const ctx = fixture();
  const a = await ctx.call();
  assert.equal(a.results[0].status, 'SUCCEEDED');
  assert.equal(a.results[0].quoteID, 'Q100');
  const b = await ctx.call();
  assert.equal(b.results[0].status, 'ALREADY_SUCCEEDED');
  assert.equal(ctx.calls.filter(x => x[0] === 'quote').length, 1);
  assert.equal(ctx.operation.claims, 1);
});
test('when no account exists, one is created first then one C4C quote', async () => {
  const ctx = fixture({ accounts: [] });
  const r = await ctx.call();
  assert.equal(r.results[0].status, 'SUCCEEDED');
  assert.deepEqual(ctx.calls.filter(x => ['account','quote'].includes(x[0])).map(x => x[0]), ['account','quote']);
});
test('existing C4C license blocks NEW creation and does not reserve an operation', async () => {
  const ctx = fixture({ accounts: [{ AccountID: '10003953', RoleCode: 'TEST03', LicenseNumber_KUT: '331501-0003' }] });
  const r = await ctx.call();
  assert.equal(r.results[0].status, 'LICENSE_ALREADY_EXISTS');
  assert.equal(ctx.operation.claims, 0);
  assert.equal(ctx.calls.filter(x => x[0] === 'quote').length, 0);
});
test('old matching quote blocks repeated NEW even if license number is not yet assigned', async () => {
  const ctx = fixture({ quotes: [{ LicenceType_KUT: 'TEST03', BuyerPartyID: '10001' }] });
  const r = await ctx.call();
  assert.equal(r.results[0].status, 'EXISTING_QUOTE_REVIEW');
  assert.equal(ctx.operation.claims, 0);
});
test('failed attachment returns PARTIAL with quote ID and never repeats quote POST', async () => {
  const attachment = { name: 'doc.pdf', mimeType: 'application/pdf', contentBase64: Buffer.from('%PDF-x').toString('base64') };
  const ctx = fixture({ writerOverrides: {
    async uploadAttachment() { throw Error('secret destination response'); }
  } });
  const first = await ctx.call(submission({ attachments: [attachment] }));
  assert.equal(first.results[0].status, 'PARTIAL');
  assert.equal(first.results[0].quoteID, 'Q100');
  assert.doesNotMatch(first.results[0].message, /secret/);
  const again = await ctx.call(submission({ attachments: [attachment] }));
  assert.equal(again.results[0].status, 'PARTIAL');
  assert.equal(ctx.calls.filter(x => x[0] === 'quote').length, 1);
});
test('failed or ambiguous quote POST remains UNCERTAIN and is not retried', async () => {
  const ctx = fixture({ writerOverrides: { async createQuote() { throw Error('unknown network timeout'); } } });
  const first = await ctx.call();
  assert.equal(first.results[0].status, 'UNCERTAIN');
  const again = await ctx.call();
  assert.equal(again.results[0].status, 'FAILED');
  assert.equal(again.results[0].errorCode, 'SUBMISSION_RECONCILIATION_REQUIRED');
});
test('comprehensive license requests create one quote per distinct license type', async () => {
  const ctx = fixture({ accounts: [
    { AccountID: '10001', RoleCode: 'TEST03', LicenseNumber_KUT: '' },
    { AccountID: '10002', RoleCode: 'NEXT01', LicenseNumber_KUT: '' }
  ] });
  const r = await ctx.call(submission({ licenseTypes: ['TEST03','NEXT01'] }));
  assert.deepEqual(r.results.map(item => item.status), ['SUCCEEDED','SUCCEEDED']);
  assert.equal(ctx.calls.filter(x => x[0] === 'quote').length, 2);
  assert.equal(ctx.operation.claims, 2);
});
test('operations use independently committed CAP root transactions, never plain ambient db.run', async () => {
  let commits = 0;
  const statements = [];
  const db = {
    async tx(fn) {
      const result = await fn({ async run(sql, values) {
        statements.push({ sql, values });
        if (sql.includes('INSERT INTO')) return [{ ID: values[0] }];
        if (sql.includes('UPDATE')) return [{ ID: values[0] }];
        return [];
      } });
      commits++;
      return result;
    },
    async run() { throw Error('unsafe ambient transaction'); }
  };
  const operations = createSubmissionOperations(db);
  const input = parseSubmission(JSON.stringify(submission()));
  const hash = payloadHash(input);
  assert.equal(await operations.find(identity, input, 'TEST03'), null);
  const id = await operations.claim(identity, input, 'TEST03', hash);
  await operations.mark(id, { status: 'SUCCEEDED', result: { type: 'TEST03' } });
  assert.equal(commits, 3);
  assert.equal(statements.length, 3);
  assert.match(statements[1].sql, /ON CONFLICT DO NOTHING/);
});
test('default configuration cannot initiate a C4C write', async () => {
  const ctx = fixture({ configOverrides: { writesEnabled: false } });
  await assert.rejects(ctx.call(), e => e.code === 'LICENSE_WRITES_NOT_READY' && e.status === 503);
  assert.equal(ctx.calls.length, 0);
});
