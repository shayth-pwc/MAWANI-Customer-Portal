'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LIST_APP, LIST_CODES, parseDefinition, enabledKeys, createExistingListValidator } = require('../srv/core/licenses/reference-lists');

function definition(code, items, options = {}) {
  return { '@odata.context': '$metadata#ListService.Definition', app: 'PORTAL', code,
    title: code, titleAr: code, listType: 'LOCAL', active: true, items, ...options };
}
function item(key, active = true, subItems = []) {
  return { key, title: key, titleAr: key, itemOrder: 0, active, subItems };
}
const sample = {
  licenseTypes: ['ZSA013'], investorType: 'SA', serviceType: '111',
  portCode: 'JED', activityType: 'DRY_DOCK', applicant: { documentType: '1' }
};
function catalog() {
  return {
    LICENSE_TYPE: definition('LICENSE_TYPE', [item('ZSA013'), item('ZSA012', false)]),
    INVESTOR_TYPE: definition('INVESTOR_TYPE', [item('SA')]),
    SERVICE_TYPE: definition('SERVICE_TYPE', [item('111')]),
    PORT_FOR_PERMIT: definition('PORT_FOR_PERMIT', [item('JED')]),
    ACTIVITY_TYPE: definition('ACTIVITY_TYPE', [item('DRY_DOCK')]),
    APPLICANT_DOCUMENT_TYPE: definition('APPLICANT_DOCUMENT_TYPE', [item('1')])
  };
}
test('only the existing PORTAL ListService codes are referenced', () => {
  assert.equal(LIST_APP, 'PORTAL');
  assert.deepEqual(LIST_CODES, ['INVESTOR_TYPE','SERVICE_TYPE','LICENSE_TYPE', 'PORT_FOR_PERMIT','ACTIVITY_TYPE','APPLICANT_DOCUMENT_TYPE']);
});
test('existing ListService Definition response is accepted', () => {
  assert.equal(parseDefinition(definition('LICENSE_TYPE', [item('ZSA013')]), 'LICENSE_TYPE').code, 'LICENSE_TYPE');
  assert.equal(parseDefinition({value:definition('LICENSE_TYPE', [])}, 'LICENSE_TYPE').code, 'LICENSE_TYPE');
  assert.throws(() => parseDefinition(definition('SERVICE_TYPE', []), 'LICENSE_TYPE'), e => e.code === 'LIST_UNAVAILABLE');
});
test('active list items are selectable and nested children are respected', () => {
  const data = definition('LICENSE_TYPE', [item('A', true, [item('B'), item('DISABLED', false)]), item('OFF', false, [item('HIDDEN')])]);
  assert.deepEqual([...enabledKeys(data)].sort(), ['A','B']);
  assert.equal(enabledKeys({...data,active:false}).size,0);
});
test('validated C4C selections are checked via existing list loader, never database SQL', async () => {
  const fixture = catalog();
  const seen = [];
  const validator = createExistingListValidator({loadList: async (code, app) => {seen.push([code,app]);return fixture[code];}});
  await validator.validateSubmission(sample);
  assert.deepEqual(seen.map(x => x[0]), ['LICENSE_TYPE','INVESTOR_TYPE','SERVICE_TYPE','APPLICANT_DOCUMENT_TYPE','PORT_FOR_PERMIT','ACTIVITY_TYPE']);
  assert.ok(seen.every(([, app]) => app === 'PORTAL'));
});
test('rejects unknown or inactive C4C codes', async () => {
  const fixture = catalog();
  const v = createExistingListValidator({loadList: async code=>fixture[code]});
  await assert.rejects(v.validateSubmission({...sample,licenseTypes:['ZSA012']}), e=>e.code==='INVALID_SELECTION');
  await assert.rejects(v.validateSubmission({...sample,portCode:'OTHER'}), e=>e.code==='INVALID_SELECTION');
  await assert.rejects(v.validateSubmission({...sample,serviceType:'OTHER'}), e=>e.code==='INVALID_SELECTION');
});
test('missing and inactive lists fail closed instead of creating fallback values', async () => {
  const fixture=catalog();
  fixture.LICENSE_TYPE.active=false;
  const v=createExistingListValidator({loadList:async code=>fixture[code]});
  await assert.rejects(v.validateSubmission(sample),e=>e.code==='LIST_NOT_READY');
  const noList=createExistingListValidator({loadList:async()=>undefined});
  await assert.rejects(noList.validateSubmission(sample),e=>e.code==='LIST_UNAVAILABLE');
});
test('renewal skips selection revalidation for retired legacy codes', async () => {
  const v=createExistingListValidator({loadList:async()=>{throw new Error('should not be called');}});
  await v.validateSubmission(sample,'RENEW');
});
