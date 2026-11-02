'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const GroupService = require('../srv/core/services/group.service');

function fakeClient(response) {
  const requests = [];
  return {
    requests,
    async request(method, path) {
      requests.push({ method, path });
      return typeof response === 'function' ? response(path) : response;
    }
  };
}

test('lists IAS groups with pagination, excludes member records', async () => {
  const client = fakeClient({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 9, startIndex: 1, Resources: [
      { id: 'g1', displayName: 'Admin', externalId: 'ext1', members: [{value:'u1'}] },
      { id: 'g2', displayName: 'Employees' }
    ]
  });
  const result = await new GroupService(client).listGroups({ startIndex: 1, count: 2 });
  assert.deepEqual(result, {
    totalResults: 9, itemsPerPage: 2, startIndex: 1,
    groups: [
      { id: 'g1', displayName: 'Admin', externalId: 'ext1' },
      { id: 'g2', displayName: 'Employees', externalId: '' }
    ]
  });
  assert.deepEqual(client.requests, [{
    method: 'GET', path: '/Groups?startIndex=1&count=2&excludedAttributes=members'
  }]);
});

test('rejects invalid page sizes before calling IAS', async () => {
  const client = fakeClient({ totalResults: 0, Resources: [] });
  const service = new GroupService(client);
  await assert.rejects(() => service.listGroups({ count: 101 }), /Invalid count/);
  await assert.rejects(() => service.listGroups({ startIndex: 0 }), /Invalid startIndex/);
  assert.equal(client.requests.length, 0);
});

test('gets a single group safely and strips membership details', async () => {
  const client = fakeClient({ id: 'group/1', displayName: 'Mawani', members: [{value:'u1'}] });
  const result = await new GroupService(client).getGroup('group/1');
  assert.deepEqual(result, { id: 'group/1', displayName: 'Mawani', externalId: '' });
  assert.equal(client.requests[0].path, '/Groups/group%2F1?excludedAttributes=members');
});

test('rejects malformed IAS responses instead of returning an empty group list', async () => {
  const client = fakeClient({ Resources: [] });
  await assert.rejects(() => new GroupService(client).listGroups(), /Invalid IAS group list response/);
});
