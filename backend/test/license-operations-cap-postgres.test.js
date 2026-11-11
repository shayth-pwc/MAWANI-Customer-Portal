'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSubmissionOperations } = require('../srv/core/licenses/submission-operations');

const identity = { issuer: 'mock-issuer', subject: 'mock-subject' };
const input = {
  clientRequestId: '51519879-407f-4054-ada0-dbb2e762cea1',
  crNationalNumber: 'MOCK-CR-NAT', crNumber: 'MOCK-CR'
};

// Simulates @cap-js/db-service v3.1.x onPlainSQL classification:
// SELECT/WITH -> rows; plain INSERT/UPDATE -> {changes:n}, even with RETURNING.
function capPostgresLikeDB({ conflict = false, updateMissing = false } = {}) {
  const statements = [];
  const db = {
    tx: async (callback) => callback({
      run: async (sql, params) => {
        statements.push({sql, params});
        if (/^\s*SELECT\b/i.test(sql)) return [];
        if (/^\s*WITH\s+claimed\b/i.test(sql)) {
          return conflict ? [] : [{ID: params[0]}];
        }
        if (/^\s*WITH\s+marked\b/i.test(sql)) {
          return updateMissing ? [] : [{ID: params[0]}];
        }
        if (/^\s*(INSERT|UPDATE)\b/i.test(sql)) return { changes: 1 };
        throw new Error('Unexpected SQL shape');
      }
    })
  };
  return {db, statements};
}

test('claim and mark dispatch as row-returning WITH statements', async () => {
  const {db, statements} = capPostgresLikeDB();
  const ops = createSubmissionOperations(db);
  assert.equal(await ops.find(identity, input, 'ZSA016'), null);
  const id = await ops.claim(identity, input, 'ZSA016', 'a'.repeat(64));
  assert.match(id, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
  await ops.mark(id, { status:'SUCCEEDED', stage:'COMPLETE', result: {status:'SUCCEEDED'} });
  assert.equal(statements.length, 3);
  assert.match(statements[1].sql, /^WITH claimed AS\s*\(\s*INSERT\b/);
  assert.match(statements[1].sql, /ON CONFLICT DO NOTHING RETURNING "ID"\s*\) SELECT "ID" FROM claimed$/);
  assert.match(statements[2].sql, /^WITH marked AS\s*\(\s*UPDATE\b/);
  assert.match(statements[2].sql, /WHERE "ID" = \$1::uuid RETURNING "ID"\s*\) SELECT "ID" FROM marked$/);
});

test('uniqueness conflict stays fail-closed', async () => {
  const {db} = capPostgresLikeDB({conflict:true});
  const ops = createSubmissionOperations(db);
  await assert.rejects(ops.claim(identity, input, 'ZSA016', 'a'.repeat(64)),
    error => error.code === 'DUPLICATE_LICENSE_REQUEST');
});

test('missing tracking row stays fail-closed', async () => {
  const {db} = capPostgresLikeDB({updateMissing:true});
  const ops = createSubmissionOperations(db);
  await assert.rejects(ops.mark('51519879-407f-4054-ada0-dbb2e762cea1',{status:'SUCCEEDED'}),
    error => error.code === 'OPERATION_RECORD_UNCERTAIN');
});
