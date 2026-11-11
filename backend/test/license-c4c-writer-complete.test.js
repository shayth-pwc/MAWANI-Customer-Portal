'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createC4cWriter, buildAccountPayload, buildQuotePayload, buildContactPayload
} = require('../srv/core/licenses/submission-c4c');

const cr = { CR_NUMBER: '1002003001', CR_NATIONAL_NUMBER: '7002612567', CR_NAME_AR: 'Example', CR_NAME: 'Example' };
const input = {
  investorType: 'INV1', portCode: '', serviceTypes: ['ZSA011'],
  applicant: { name: 'Test Applicant', id: '1200000000', documentType: '1', mobile: '0500000000', email: 'test@example.org' },
  address: {}
};
const cfg = { salesOrg: 'S1', salesUnit: 'S1' };
const entity = value => ({ status: 201, data: { d: value } });
const listing = values => ({ status: 200, data: { d: { results: values } } });

test('full adapter surface matches submission-service call contract', () => {
  const writer = createC4cWriter({ executeHttpRequest: async () => entity({}) });
  for (const method of ['createAccount','findMatchingContacts','createContact','createQuote','uploadAttachment'])
    assert.equal(typeof writer[method], 'function');
  assert.equal(buildAccountPayload(cr, input, 'TEST03').RoleCode, 'TEST03');
  assert.equal(buildQuotePayload('10001', 'TEST03', input, cfg).BuyerPartyID, '10001');
  assert.equal(buildContactPayload('10001', input).AccountID, '10001');
});

test('direct C4C OData v2 CorporateAccount POST response extracts AccountID', async () => {
  let calls = 0;
  const writer = createC4cWriter({ executeHttpRequest: async (...args) => {
    calls++; assert.equal(args[1].method, 'POST');
    assert.equal(args[2].fetchCsrfToken, true);
    return entity({ AccountID: '10003953', ObjectID: 'OBJ1' });
  } });
  assert.deepEqual(await writer.createAccount(cr, input, 'TEST03'), { accountID: '10003953', objectID: 'OBJ1' });
  assert.equal(calls, 1);
});

test('confirmed POST with missing AccountID performs one scoped GET read-back, never retries POST', async () => {
  const methods=[];
  const writer = createC4cWriter({ executeHttpRequest: async (_dest, request) => {
    methods.push(request.method);
    if (request.method === 'POST') return entity({ ObjectID: 'OBJ1' });
    assert.match(decodeURIComponent(request.url), /RoleCode eq 'TEST03'/);
    assert.match(decodeURIComponent(request.url), /CRNationalNumber_KUT eq '7002612567'/);
    return listing([{
      AccountID: '10003953', ObjectID: 'OBJ1', CRNationalNumber_KUT: '7002612567',
      CommercialRegisterNumber_KUT: '1002003001', RoleCode: 'TEST03'
    }]);
  } });
  assert.deepEqual(await writer.createAccount(cr, input, 'TEST03'), { accountID: '10003953', objectID: 'OBJ1' });
  assert.deepEqual(methods, ['POST', 'GET']);
});

test('ambiguous read-back remains UNCERTAIN and does not retry POST', async () => {
  let posts=0;
  const row = n => ({ AccountID: n, CRNationalNumber_KUT: '7002612567', CommercialRegisterNumber_KUT: '1002003001', RoleCode: 'TEST03' });
  const writer = createC4cWriter({ executeHttpRequest: async (_dest, request) => {
    if (request.method === 'POST') { posts++; return entity({ ObjectID:'OBJ1' }); }
    return listing([row('1'), row('2')]);
  } });
  await assert.rejects(writer.createAccount(cr, input, 'TEST03'), e => e.code === 'C4C_WRITE_UNCERTAIN');
  assert.equal(posts, 1);
});

test('read-back cannot accept records outside approved CR/type', async () => {
  const writer = createC4cWriter({ executeHttpRequest: async (_dest, request) =>
    request.method === 'POST' ? entity({}) : listing([
      { AccountID: '1', CRNationalNumber_KUT: 'other', CommercialRegisterNumber_KUT: cr.CR_NUMBER, RoleCode: 'TEST03' }
    ]) });
  await assert.rejects(writer.createAccount(cr,input,'TEST03'), e => e.code === 'C4C_WRITE_UNCERTAIN');
});

test('explicit technical-user configuration skips automatic CSRF only when requested', async () => {
  let observed;
  const writer = createC4cWriter({
    executeHttpRequest: async (_destination,_request,options) => { observed=options; return entity({ ID: 'Q1', ObjectID: 'O1' }); },
    fetchCsrfToken: false
  });
  await writer.createQuote('10001','TEST03',input,cfg);
  assert.equal(observed.fetchCsrfToken, false);
});

test('C4C POST errors do not leak raw axios configuration or credentials', async () => {
  const writer = createC4cWriter({ executeHttpRequest: async () => {
    const error=new Error('secret-token-here');
    error.response={status:405};
    error.config={headers:{authorization:'secret-token-here'}};
    throw error;
  } });
  await assert.rejects(writer.createQuote('10001','TEST03',input,cfg), err => {
    assert.equal(err.code,'C4C_WRITE_UNCERTAIN');
    assert.match(err.message,/HTTP 405/);
    assert.doesNotMatch(err.message,/secret/);
    return true;
  });
});

test('Sales Quote ID and ObjectID are required and correctly returned', async () => {
  const writer = createC4cWriter({ executeHttpRequest: async (_destination,request) => {
    assert.equal(request.url,'/c4codataapi/SalesQuoteCollection');
    assert.equal(request.data.RequestType_KUT,'NEW');
    return entity({ ID: 'Q1', ObjectID: 'OBJ1' });
  } });
  assert.deepEqual(await writer.createQuote('10001','TEST03',input,cfg), { quoteID:'Q1', quoteObjectID:'OBJ1' });
});

test('incomplete Sales Quote response remains uncertain', async () => {
  const writer = createC4cWriter({ executeHttpRequest: async () => entity({ ID: 'Q1' }) });
  await assert.rejects(writer.createQuote('10001','TEST03',input,cfg), e => e.code==='C4C_WRITE_UNCERTAIN');
});

test('Contact POST and ContactCollection GET use scoped account data', async () => {
  let posts=0;
  const writer = createC4cWriter({ executeHttpRequest: async (_destination,request) => {
    if (request.method === 'POST') { posts++; assert.equal(request.data.AccountID,'10001'); return entity({ ContactID:'C1' }); }
    assert.match(decodeURIComponent(request.url), /AccountID eq '10001'/);
    return listing([{ AccountID: '10001', Mobile: input.applicant.mobile, ContactID:'C1' }]);
  } });
  assert.deepEqual(await writer.createContact('10001',input), { contactID:'C1',objectID:'' });
  assert.equal((await writer.findMatchingContacts('10001',input.applicant.mobile))[0].ContactID,'C1');
  assert.equal(posts,1);
});

test('unscoped contact reads are blocked', async () => {
  const writer = createC4cWriter({ executeHttpRequest: async () => listing([{ AccountID:'other', Mobile:'0500000000' }]) });
  await assert.rejects(writer.findMatchingContacts('10001','0500000000'), e => e.code==='C4C_SCOPE_MISMATCH');
});

test('valid attachment upload uses verified quote IDs and required legacy fields', async () => {
  const file={name:'proof.pdf',mimeType:'application/pdf',contentBase64:'JVBERi0x',byteLength:6};
  const writer = createC4cWriter({ executeHttpRequest: async (_destination,request) => {
    assert.equal(request.url,'/c4codataapi/SalesQuoteAttachmentFolderCollection');
    assert.equal(request.data.Binary,file.contentBase64);
    assert.equal(request.data.TypeCode,'10001');
    return entity({ ObjectID:'attachment-object' });
  } });
  assert.deepEqual(await writer.uploadAttachment({quoteID:'Q1',quoteObjectID:'OBJ1'},file), {
    name:'proof.pdf',sizeBytes:6,status:'SUCCEEDED'
  });
});

test('attachments missing their validated metadata are rejected before POST', async () => {
  let calls=0;
  const writer=createC4cWriter({ executeHttpRequest:async()=>{calls++;return entity({});} });
  await assert.rejects(writer.uploadAttachment({quoteID:'Q1'}, {name:'x.pdf'}),e=>e.code==='INVALID_ATTACHMENT');
  assert.equal(calls,0);
});

test('multiple distinct services are rejected in quote builder', () => {
  assert.throws(() => buildQuotePayload('10001','TEST03',{...input,serviceTypes:['A','B']},cfg),e=>e.code==='MULTI_SERVICE_CONTRACT_PENDING');
});
