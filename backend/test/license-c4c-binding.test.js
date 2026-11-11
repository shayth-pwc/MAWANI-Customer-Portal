'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { destinationBindingNames } = require('../scripts/check-c4c-binding');
test('read-only destination binding inspection never prints credential content', () => {
  const names = destinationBindingNames({ destination: [{ name: 'existing-dest-service', label: 'destination', credentials: { password: 'PRIVATE' } }], identity: [{ name: 'ias', label: 'identity' }] });
  assert.deepEqual(names, ['existing-dest-service']);
  assert.equal(JSON.stringify(names).includes('PRIVATE'), false);
});
