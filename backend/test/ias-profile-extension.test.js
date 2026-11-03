'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const IasService = require('../srv/core/services/ias.service');

test('mobile and title updates preserve other SCIM phone numbers and verify read-back', async () => {
  const user = { id:'test-id', userName:'a', active:true, name:{givenName:'A',familyName:'B'},
    phoneNumbers:[{type:'work',value:'12345'}, {type:'mobile',value:'+962711111111'}], title:'Old' };
  const calls=[];
  const ias = new IasService({ request: async (method,path,body) => {
    calls.push({method,path,body});
    if (method==='GET') return structuredClone(user);
    if (method==='PATCH') {
      for(const op of body.Operations) user[op.path]=structuredClone(op.value);
      return null;
    }
  }});
  const result = await ias.updateUser({id:'test-id',mobile:'+962799999999',title:'Port Manager'});
  assert.equal(user.phoneNumbers.find(p=>p.type==='work').value,'12345');
  assert.equal(result.user.mobile,'+962799999999');
  assert.equal(result.user.title,'Port Manager');
  assert.deepEqual(result.fields,['mobile','title']);
  assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
});
test('IAS silent mobile write is reported as uncertain', async()=>{
  const user = {id:'id',active:true,phoneNumbers:[{type:'mobile',value:'+962777777777'}]};
  const ias=new IasService({request:async(method)=>method==='GET'?structuredClone(user):null});
  await assert.rejects(()=>ias.updateUser({id:'id',mobile:'+962711111111'}),e=>e.code==='IAS_RESULT_UNCERTAIN');
});
