'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createC4cWriter } = require('../srv/core/licenses/submission-c4c');

const accountID = '10004240';
const licenseType = 'ZSA016';
const input = {
  serviceTypes: ['SERVICE1'],
  applicant: {
    name: 'Example Applicant', id: 'test-actor-42', documentType: '1',
    mobile: '0550000000', email: 'example@example.invalid'
  },
  portCode: ''
};
const config = { salesOrg: 'SALESORG', salesUnit: 'UNIT01' };
const quote = {
  ID: '1061', ObjectID: '42010A1008661FD1B7B8DEEF08010E0D',
  BuyerPartyID: accountID, LicenceType_KUT: licenseType,
  Type1_KUT: input.serviceTypes[0], RequestType_KUT: 'NEW',
  ZAPPLICANT_ID_KUT: input.applicant.id,
  SalesOrganisationID: config.salesOrg, SalesUnitPartyID: config.salesUnit
};
const posted = body => ({ status: 201, data: { d: body } });
const listed = rows => ({ status: 200, data: { d: { results: rows } } });

const make = (postResponse, getResponse) => {
  const calls = [];
  const writer = createC4cWriter({ executeHttpRequest: async (_dest, request) => {
    calls.push(request);
    if (request.method === 'POST') {
      assert.equal(request.url, '/c4codataapi/SalesQuoteCollection');
      return postResponse;
    }
    assert.equal(request.method, 'GET');
    assert.equal(request.url.startsWith('/c4codataapi/SalesQuoteCollection?'), true);
    const u = new URL('https://example.invalid' + request.url);
    assert.equal(u.searchParams.get('$filter'),
      "BuyerPartyID eq '10004240' and LicenceType_KUT eq 'ZSA016'");
    assert.equal(u.searchParams.get('$top'), '2');
    assert.equal(u.searchParams.get('$format'), 'json');
    return typeof getResponse === 'function' ? getResponse() : getResponse;
  } });
  return { writer, calls };
};
const verifyUncertain = err => {
  assert.equal(err.code, 'C4C_WRITE_UNCERTAIN');
  assert.match(err.message, /reconcil/i);
  return true;
};

test('201 with both IDs never requires GET', async () => {
  const { writer, calls } = make(posted(quote));
  assert.deepEqual(await writer.createQuote(accountID, licenseType, input, config), {
    quoteID: quote.ID, quoteObjectID: quote.ObjectID
  });
  assert.deepEqual(calls.map(c => c.method), ['POST']);
});

test('successful POST without IDs finds one exact quote via GET; no second POST', async () => {
  const { writer, calls } = make(posted({}), listed([quote]));
  assert.deepEqual(await writer.createQuote(accountID, licenseType, input, config), {
    quoteID: quote.ID, quoteObjectID: quote.ObjectID
  });
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('successful POST with only one ID verifies it against persisted quote', async () => {
  const { writer, calls } = make(posted({ ID: quote.ID }), listed([quote]));
  assert.deepEqual(await writer.createQuote(accountID, licenseType, input, config), {
    quoteID: quote.ID, quoteObjectID: quote.ObjectID
  });
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('POST partial ObjectID conflicting with stored quote stays UNCERTAIN', async () => {
  const { writer, calls } = make(posted({ ObjectID: 'OTHER' }), listed([quote]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('two matching C4C quotes remain UNCERTAIN, never first-match', async () => {
  const { writer, calls } = make(posted({}), listed([quote, { ...quote, ID: '1062' }]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('returned quote with wrong scope stays UNCERTAIN', async () => {
  const { writer } = make(posted({}), listed([{ ...quote, BuyerPartyID: 'UNRELATED' }]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
});

test('returned quote with unrelated service or applicant stays UNCERTAIN', async () => {
  for (const field of ['Type1_KUT', 'ZAPPLICANT_ID_KUT', 'RequestType_KUT']) {
    const { writer } = make(posted({}), listed([{ ...quote, [field]: 'WRONG' }]));
    await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
  }
});

test('lack of a required correlation field cannot become success', async () => {
  const { writer } = make(posted({}), listed([{ ...quote, ZAPPLICANT_ID_KUT: undefined }]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
});

test('unexpected pagination remains UNCERTAIN; duplicate matches may be hidden', async () => {
  const { writer } = make(posted({}), { status: 200, data: { d: {
    results: [quote], __next: 'https://untrusted.invalid/path'
  } } });
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
});

test('failed GET after accepted POST remains UNCERTAIN, never retry POST', async () => {
  const { writer, calls } = make(posted({}), () => {
    const err = new Error('confidential data');
    err.response = { status: 503 };
    throw err;
  });
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), err => {
    verifyUncertain(err);
    assert.doesNotMatch(err.message, /confidential/);
    return true;
  });
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('failed POST never calls GET or retries POST', async () => {
  let count = 0;
  const writer = createC4cWriter({ executeHttpRequest: async () => {
    count++;
    throw Object.assign(new Error('secret'), { response: { status: 500 } });
  } });
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
  assert.equal(count, 1);
});


test('successful POST but no matching quote stays UNCERTAIN', async () => {
  const { writer, calls } = make(posted({}), listed([]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'GET']);
});

test('quote matching business fields but missing persisted ObjectID stays UNCERTAIN', async () => {
  const { writer } = make(posted({}), listed([{ ...quote, ObjectID: '' }]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
});

test('persisted sales unit mismatch must not be associated with submission', async () => {
  const { writer } = make(posted({}), listed([{ ...quote, SalesUnitPartyID: 'OTHER' }]));
  await assert.rejects(writer.createQuote(accountID, licenseType, input, config), verifyUncertain);
});
