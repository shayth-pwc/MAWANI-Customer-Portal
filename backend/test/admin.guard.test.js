'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadWithFakeCds} = require('./helpers-cds');
const AdminGuard = loadWithFakeCds('../srv/core/security/admin.guard');
const GROUP='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const IAS_ID='a7952e14-b72a-488e-8e1f-0d5e8c8cb714';
const USER_ID='01234567-89ab-4cde-8fab-0123456789ab';
function request(extraClaims={}) {
  const claims = { iss:'https://ias.example.com', sub:'P000061', user_uuid:IAS_ID, ...extraClaims };
  const jwt = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  return { user: { id:claims.sub, is:role=>role==='authenticated-user', authInfo:{token:{jwt}} } };
}
function guard({ row=null, iasRow=null, scim=null, group=GROUP }={}) {
  const ias = { request: async (_,path)=> scim || { id:IAS_ID, active:true, groups:[{value:GROUP}] } };
  const users={findByIdentity: async()=>row,findByIasId: async()=>iasRow};
  return new AdminGuard(users, ias, {MAWANI_PORTAL_ADMIN_GROUP_ID:group});
}
test('IAS portal admin group authorizes without a local profile or SYSTEM_ADMIN DB classification', async()=>{
  const req=request();
  assert.equal(await guard().authorize(req),null);
  assert.equal(req.mawaniActor,null);
  assert.equal(req.mawaniIdentity.globalUserId,IAS_ID);
});
test('existing EMPLOYEE DB profile may be admin by IAS group, if active',async()=>{
  const row={UUID:USER_ID,ACCOUNT_TYPE:'EMPLOYEE',ACTIVE_STATUS:true};
  assert.deepEqual(await guard({row}).authorize(request()),row);
});
test('reject non-members, inactive IAS user and mismatched SCIM identity',async()=>{
  const invalid=[
    {id:IAS_ID,active:true,groups:[{value:'another-group'}]},
    {id:IAS_ID,active:false,groups:[{value:GROUP}]},
    {id:'another-user',active:true,groups:[{value:GROUP}]},
    {id:IAS_ID,active:true}
  ];
  for (const scim of invalid) await assert.rejects(()=>guard({scim}).authorize(request()),/membership required/);
});
test('reject local inactive profile even if IAS group authorized',async()=>{
  await assert.rejects(()=>guard({row:{ACCOUNT_TYPE:'EMPLOYEE',ACTIVE_STATUS:false}}).authorize(request()),/inactive/);
});
test('reject expired local profile',async()=>{
  await assert.rejects(()=>guard({row:{ACCOUNT_TYPE:'EMPLOYEE',ACTIVE_STATUS:true,ENDDA:'2000-01-01'}}).authorize(request()),/outside its validity period/);
});
test('reject missing user_uuid claim and missing configured group',async()=>{
  await assert.rejects(()=>guard().authorize(request({user_uuid:undefined})),/Global User ID is required/);
  await assert.rejects(()=>guard({group:''}).authorize(request()),/not configured/);
});
test('reject unverifiable token subject',async()=>{
  const req=request();
  req.user.id='other';
  await assert.rejects(()=>guard().authorize(req),/issuer and subject/);
});

test('read-only admin guard enforces inactive local rows linked only by IAS_ID', async()=>{
  const req=request();
  const disabled={UUID:USER_ID,IAS_ID,IAS_ISSUER:null,IAS_SUBJECT:null,ACTIVE_STATUS:false};
  await assert.rejects(()=>guard({iasRow:disabled}).authorize(req),/inactive/);
});

test('read-only admin guard rejects conflicting IAS-ID and token linkage rows', async()=>{
  const req=request();
  const linked={UUID:USER_ID,IAS_ID,IAS_ISSUER:'https://ias.example.com',IAS_SUBJECT:'P000061',ACTIVE_STATUS:true};
  const other={UUID:'99999999-8888-4777-8999-111111111111',IAS_ID,ACTIVE_STATUS:true};
  await assert.rejects(()=>guard({row:linked,iasRow:other}).authorize(req),/Conflicting portal identity/);
});
