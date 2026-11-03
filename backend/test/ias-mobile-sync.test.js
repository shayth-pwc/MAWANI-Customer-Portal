'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWithFakeCds } = require('./helpers-cds');
const UserRepository = loadWithFakeCds('../srv/core/repositories/user.repository');
const UserService = loadWithFakeCds('../srv/core/services/user.service');
const IAS_ID = '83c30c52-6933-4223-b916-18f0a6b751dc';
const UUID = 'fc92c7ac-66b6-48a3-a96f-614ff384ad8f';

test('verified IAS mobile number can update only the allowed portal column', async () => {
  const calls=[];
  let row={UUID, IAS_ID, MOBILE_NUMBER:'+962700000000'};
  const db={run:async(sql,params)=>{
    calls.push({sql,params});
    if (sql.trim().startsWith('UPDATE')) { row={...row,MOBILE_NUMBER:params[0]}; return 1; }
    if (sql.trim().startsWith('SELECT')) return [row];
    throw Error('Unexpected SQL');
  }};
  const repository=new UserRepository(async()=>db);
  const updated=await repository.updateVerifiedIasFields(UUID,{MOBILE_NUMBER:'+962799999999'});
  assert.equal(updated.MOBILE_NUMBER,'+962799999999');
  assert.match(calls[0].sql,/"MOBILE_NUMBER" = \$1/);
  assert.deepEqual(calls[0].params,['+962799999999',UUID]);
  await assert.rejects(()=>repository.updateVerifiedIasFields(UUID,{MOBILE_KEY:'962'}),err=>err.status===400);
});

test('missing portal row receives mobile from the verified IAS profile inside transaction',async()=>{
  const events=[];
  const tx={run:async(sql)=>{if(sql.includes('pg_advisory_xact_lock'))events.push('lock')}};
  const service=new UserService({
    users:{
      findByIasId:async()=>null,
      createFromAdministrativeIas:async()=>{events.push('create');return {UUID,IAS_ID}},
      updateVerifiedIasFields:async(uuid,changes,context)=>{
        assert.equal(uuid,UUID);assert.equal(context,tx);
        assert.deepEqual(changes,{MOBILE_NUMBER:'+962799999999'});
        events.push('mobile-update');return {UUID,IAS_ID,...changes};
      }
    },
    audit:{record:async()=>events.push('audit')},
    getDb:async()=>({tx:async(fn)=>fn(tx)})
  });
  const result=await service.applyVerifiedIasChange({id:IAS_ID,phoneNumbers:[{type:'mobile',value:'+962799999999'}]},['mobile'],{},'IAS_USER_UPDATE');
  assert.equal(result.created,true);
  assert.equal(result.profile.MOBILE_NUMBER,'+962799999999');
  assert.deepEqual(events,['lock','create','mobile-update','audit','audit']);
});
