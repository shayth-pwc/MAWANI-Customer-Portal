'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWithFakeCds } = require('./helpers-cds');
const DynamicLists = loadWithFakeCds('../srv/core/services/dynamic-list.service');
const { toTree, code, key } = DynamicLists._test;

const item = (name, parentKey = '', active = true, order = 1) => ({
  KEY: name, TITLE: name, TITLE_AR: name, ACTIVE_STATUS: active, ITEM_ORDER: order,
  EXTRA_DATA: parentKey ? { parentKey } : {}, BEGDA: null, ENDDA: null
});

test('existing two-table schema supports one level of dependent options', () => {
  const list = toTree([item('A'), item('A_1','A'),item('B'),item('B_1','B')], true);
  assert.equal(list.length,2);
  assert.equal(list[0].subItems[0].key, 'A_1');
  assert.equal(list[1].subItems[0].key, 'B_1');
});
test('inactive parent options do not leak sub-items to consumer', () => {
  assert.deepEqual(toTree([item('A','',false),item('A_1','A')], true), []);
});
test('a grandchild is rejected rather than silently misrepresented', () => {
  assert.throws(() => toTree([item('A'),item('B','A'),item('C','B')]), /one sub-item level/);
});
test('invalid keys are rejected before interpolating SQL', () => {
  assert.throws(() => code('APP\'; DROP TABLE CONFIG_TBL_APPLICATIONS_LISTS;--', 'app'), /Invalid app/);
  assert.throws(() => key('bad/../value'), /Invalid key/);
});
test('consumer list query uses bound parameters and excludes inactive options', async () => {
  const calls = [];
  const head = { APP:'PORTAL', LIST:'PORTS', TITLE:'Ports', TYPE:'LOCAL', ACTIVE_STATUS:true };
  const getDb = async () => ({ run: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM public."CONFIG_TBL_APPLICATIONS_LISTS_I"')) return [item('JUBAIL'),item('JUBAIL_EAST','JUBAIL')];
    return [head];
  }});
  const service = new DynamicLists({ getDb, audit:{} });
  const result = await service.getList({app:'PORTAL',code:'PORTS'});
  assert.equal(result.items[0].subItems[0].key, 'JUBAIL_EAST');
  assert.deepEqual(calls[0].params,['PORTAL','PORTS']);
  assert.deepEqual(calls[1].params,['PORTAL','PORTS']);
  assert.ok(calls.every(({sql})=>sql.includes('$1') && sql.includes('$2')));
});
test('consumer cannot read an inactive list', async () => {
  const service = new DynamicLists({ getDb: async () => ({ run: async () => [
    { APP:'PORTAL', LIST:'SECRET', ACTIVE_STATUS:false }
  ] }), audit:{} });
  await assert.rejects(() => service.getList({app:'PORTAL',code:'SECRET'}), e => e.status===404);
});
