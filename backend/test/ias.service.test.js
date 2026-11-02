"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const IasService = require("../srv/core/services/ias.service");

class FakeIasClient {
  constructor({ ignoreName = false } = {}) {
    this.calls = [];
    this.ignoreName = ignoreName;
    this.user = {
      id: "scim-id",
      userName: "A",
      active: true,
      name: { givenName: "Mawani", familyName: "Test", middleName: "Other" },
      emails: [{ value: "old@example.com", primary: true }],
    };
  }
  async request(method, path, payload) {
    this.calls.push({ method, path, payload });
    if (method === "GET" && path.startsWith("/Users?"))
      return {
        totalResults: 2,
        itemsPerPage: 2,
        startIndex: 1,
        Resources: [
          {
            id: "u-1",
            userName: "a",
            name: { givenName: "A", familyName: "B" },
            emails: [{ value: "a@example.com" }],
            active: true,
          },
          { id: "u-2", userName: "b", active: false },
        ],
      };
    if (method === "GET") return structuredClone(this.user);
    if (method === "POST")
      return {
        id: "scim-id",
        userName: payload.userName,
        emails: payload.emails,
        active: true,
      };
    if (method === "PATCH") {
      for (const op of payload.Operations) {
        if (op.path === "name" && !this.ignoreName)
          this.user.name = { ...op.value };
        if (op.path === "emails") this.user.emails = op.value;
        if (op.path === "active") this.user.active = op.value;
      }
      return null;
    }
    throw Error("Unrecognized fake call");
  }
}

test("list paginates SCIM users and normalizes results", async () => {
  const client = new FakeIasClient();
  const service = new IasService(client);
  const result = await service.listUsers({ startIndex: 1, count: 2 });
  assert.equal(result.users[0].email, "a@example.com");
  assert.equal(result.users[0].displayName, "A B");
  assert.equal(result.users.length, 2);
  assert.equal(client.calls[0].path, "/Users?startIndex=1&count=2");
});

test("SCIM user creation is validated and transmits no password", async () => {
  const client = new FakeIasClient();
  const service = new IasService(client);
  const user = await service.createUser({
    userName: "a",
    email: "a@example.com",
    givenName: "A",
    familyName: "B",
  });
  assert.equal(user.id, "scim-id");
  assert.equal(
    client.calls[0].payload.schemas[0],
    "urn:ietf:params:scim:schemas:core:2.0:User",
  );
  assert.ok(!Object.hasOwn(client.calls[0].payload, "password"));
  await assert.rejects(
    () =>
      service.createUser({
        userName: "a",
        email: "bad",
        givenName: "A",
        familyName: "B",
      }),
    /email/i,
  );
});

test("IAS name PATCH replaces complex name without clearing unrelated components and verifies persistence", async () => {
  const client = new FakeIasClient();
  const service = new IasService(client);
  const result = await service.updateUser({
    id: "scim-id",
    givenName: "Ahmed",
  });
  assert.deepEqual(client.calls[1].payload.Operations, [
    {
      op: "replace",
      path: "name",
      value: { givenName: "Ahmed", familyName: "Test", middleName: "Other" },
    },
  ]);
  assert.equal(client.calls[0].method, "GET"); // Preserve existing name properties
  assert.equal(client.calls[2].method, "GET"); // Verify persisted SCIM values
  assert.deepEqual(result.fields, ["givenName"]);
  assert.equal(result.raw.name.givenName, "Ahmed");
  assert.equal(result.raw.name.middleName, "Other");
  await assert.rejects(
    () => service.updateUser({ id: "scim-id" }),
    /No IAS fields/,
  );
});

test("IAS name PATCH that silently fails must NOT be reported as a successful update", async () => {
  const client = new FakeIasClient({ ignoreName: true });
  const service = new IasService(client);
  await assert.rejects(
    () => service.updateUser({ id: "scim-id", givenName: "Ahmed" }),
    (err) => err.status === 503 && err.code === "IAS_RESULT_UNCERTAIN",
  );
  assert.equal(client.user.name.givenName, "Mawani");
});

test("IAS email update checks primary email and leaves unrelated SCIM fields intact", async () => {
  const client = new FakeIasClient();
  const service = new IasService(client);
  const result = await service.updateUser({
    id: "scim-id",
    email: "new@example.com",
  });
  assert.deepEqual(result.fields, ["email"]);
  assert.equal(result.raw.emails[0].value, "new@example.com");
  assert.equal(client.calls[0].method, "PATCH");
});

test("IAS activation requires explicit boolean and confirmed status", async () => {
  const client = new FakeIasClient();
  const service = new IasService(client);
  await assert.rejects(
    () => service.setUserActive({ id: "scim-id", active: "true" }),
    /boolean/,
  );
  assert.equal(client.calls.length, 0);
  const result = await service.setUserActive({ id: "scim-id", active: false });
  assert.equal(client.calls[0].payload.Operations[0].value, false);
  assert.equal(result.raw.active, false);
  assert.deepEqual(result.fields, ["active"]);
});

test("SCIM paging constraints prevent unbounded queries", async () => {
  const service = new IasService(new FakeIasClient());
  await assert.rejects(
    () => service.listUsers({ count: 500 }),
    /Invalid count/,
  );
});
