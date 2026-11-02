'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWithFakeCds } = require('./helpers-cds');
const UserRepository = loadWithFakeCds('../srv/core/repositories/user.repository');
const AuditRepository = loadWithFakeCds('../srv/core/repositories/audit.repository');
const USER = '01234567-89ab-4cde-8fab-0123456789ab';

function setup(results = []) {
  const calls = [];
  const db = {run: async (sql,values) => {calls.push({sql,values}); return results;}};
  return {calls,db};
}

test('Find portal users from existing quoted uppercase table, parameterized',async()=>{
  const {calls, db} = setup([{UUID:USER}]);
  const repo = new UserRepository(async()=>db);
  const row = await repo.findById(USER);
  assert.equal(row.UUID,USER);
  assert.match(calls[0].sql,/FROM public\."BTP_TBL_USERS"/);
  assert.match(calls[0].sql,/WHERE "UUID" = \$1::uuid/);
  assert.deepEqual(calls[0].values,[USER]);
});

test('Admin lookup always binds issuer and subject, never email',async()=>{
  const {calls,db} = setup([{UUID:USER,ACCOUNT_TYPE:'SYSTEM_ADMIN'}]);
  const repo = new UserRepository(async()=>db);
  await repo.findByIdentity('https://ias.example.com','subject-1');
  assert.match(calls[0].sql,/"IAS_ISSUER" = \$1 AND "IAS_SUBJECT" = \$2/);
  assert.deepEqual(calls[0].values,['https://ias.example.com','subject-1']);
});

test('Portal updates never allow account-type or issuer/subject changes',async()=>{
  const {calls,db} = setup([{UUID:USER}]);
  const repo = new UserRepository(async()=>db);
  await assert.rejects(()=>repo.updateProfile(USER,{ACCOUNT_TYPE:'SYSTEM_ADMIN'}),/not editable/);
  await repo.updateProfile(USER,{ACTIVE_STATUS:false,FNAME:'Ahmed'});
  assert.match(calls[0].sql,/UPDATE public\."BTP_TBL_USERS"/);
  assert.match(calls[0].sql,/"ACTIVE_STATUS" = \$1/);
  assert.deepEqual(calls[0].values,[false,'Ahmed',USER]);
  assert.match(calls[0].sql, /"FNAME" = \$2/);
  assert.match(calls[0].sql, /WHERE "UUID" = \$3::uuid/);
});

test('Explicit portal creation inserts disabled user without fabricating IAS subject',async()=>{
  const calls=[];
  let inserted=null;
  const db={run:async(sql,values)=>{
    calls.push({sql,values});
    if (/^INSERT /i.test(sql)) {
      inserted={UUID:values[0],IAS_ID:values[1],ACTIVE_STATUS:false};
      return 1;
    }
    if (/^SELECT /i.test(sql)) return [inserted];
    throw new Error('Unexpected SQL');
  }};
  const repo = new UserRepository(async()=>db);
  const row=await repo.createFromIas({id:'directory-id',email:'a@example.com'});
  assert.equal(row.UUID,inserted.UUID);
  assert.equal(row.ACTIVE_STATUS,false);
  assert.match(calls[0].sql,/"ACTIVE_STATUS"/);
  assert.match(calls[0].sql,/FALSE/);
  assert.doesNotMatch(calls[0].sql,/IAS_SUBJECT|IAS_ISSUER|RETURNING/);
  assert.equal(calls[0].values[1],'directory-id');
  assert.match(calls[1].sql,/SELECT .* FROM public\."BTP_TBL_USERS"/s);
});

test('Audit insert targets existing table and never stores raw snapshots',async()=>{
  const {calls,db} = setup([]);
  const repo = new AuditRepository(async()=>db);
  await repo.create({userUuid:USER,pernr:null,action:'TEST',entityName:'IAS_USER',entityId:'dir-1',description:'Test',status:'SUCCESS'},db);
  assert.match(calls[0].sql,/INSERT INTO public\."BTP_TBL_AUDIT_LOG"/);
  assert.doesNotMatch(calls[0].sql,/OLD_VALUES|NEW_VALUES/);
  assert.equal(calls[0].values[1], USER);
});


test('Raw PostgreSQL queries always use numbered bind parameters', async()=>{
  const calls=[];
  let created;
  const db={run:async(sql,values=[])=>{
    calls.push({sql,values});
    if (/^INSERT INTO public\."BTP_TBL_USERS"/i.test(sql)) {
      created={UUID:values[0],IAS_ID:values[1],ACTIVE_STATUS:false};
      return 1;
    }
    if (/^UPDATE /i.test(sql)) return 1;
    if (/^INSERT /i.test(sql)) return 1;
    if (/^SELECT /i.test(sql)) return [created || {UUID:USER,ACTIVE_STATUS:true,FNAME:'Ali'}];
    throw new Error('Unexpected SQL');
  }};
  const repo = new UserRepository(async()=>db);
  await repo.findAll(10,0);
  await repo.findById(USER);
  await repo.findByIasId('scim-id');
  await repo.findByIdentity('https://ias.example','subject-1');
  await repo.updateProfile(USER,{ACTIVE_STATUS:true, FNAME:'Ali'});
  await repo.createFromIas({id:'scim-id',email:'a@example.com'});
  const audit = new AuditRepository(async()=>db);
  await audit.create({action:'TEST',entityName:'IAS_USER',entityId:'id',status:'SUCCESS'});
  for (const {sql,values} of calls) {
    assert.doesNotMatch(sql, /\?/, `Unexpected '?' SQL placeholder: ${sql}`);
    for (let i=1;i<=values.length;i++) {
      assert.ok(sql.includes(`$${i}`), `Missing bind parameter $${i}: ${sql}`);
    }
  }
  assert.match(calls[0].sql,/LIMIT \$1 OFFSET \$2/);
});
