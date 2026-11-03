'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Password=require('../srv/core/services/ias-password.service');
const env={IAS_SCIM_BASE_URL:'https://tenant.accounts.ondemand.com/',IAS_SCIM_CLIENT_ID:'id',IAS_SCIM_CLIENT_SECRET:'secret'};
test('password reset uses the documented IAS REST endpoint and does not claim delivery', async()=>{
  let called;
  const service = new Password({env,fetchImpl:async(url,options)=>{called={url:String(url), options};return {ok:true,status:200};}});
  const result=await service.requestReset('test@example.com');
  assert.equal(called.url,'https://tenant.accounts.ondemand.com/service/users/forgotPassword');
  assert.deepEqual(JSON.parse(called.options.body),{identifier:'test@example.com'});
  assert.equal(called.options.headers.Authorization,`Basic ${Buffer.from('id:secret').toString('base64')}`);
  assert.equal(result.accepted,true);
  assert.match(result.message,/not guaranteed/i);
});
test('unconfigured password API fails closed with no outgoing request', async()=>{
  const service=new Password({env:{},fetchImpl:()=>{throw Error('Should not run');}});
  await assert.rejects(()=>service.requestReset('test@example.com'),e=>e.status===503);
});
test('invalid or non-IAS origins fail closed', async()=>{
  const service=new Password({env:{...env,IAS_SCIM_BASE_URL:'http://evil.example.com'},fetchImpl:()=>{throw Error('Should not run');}});
  await assert.rejects(()=>service.requestReset('test@example.com'),e=>e.status===500);
});
test('a lost write response is uncertain and not retried', async()=>{
  let calls=0;
  const service=new Password({env,fetchImpl:()=>{calls++;throw Error('Network');}});
  await assert.rejects(()=>service.requestReset('test@example.com'),e=>e.code==='IAS_RESULT_UNCERTAIN');
  assert.equal(calls,1);
});
