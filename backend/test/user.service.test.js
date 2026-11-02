"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithFakeCds } = require("./helpers-cds");
const UserService = loadWithFakeCds("../srv/core/services/user.service");
const UUID = "01234567-89ab-4cde-8fab-0123456789ab";

test("Portal update keeps write and audit in the same transaction", async () => {
  const events = [];
  const tx = { run: async () => {} };
  const db = {
    tx: async (fn) => {
      events.push("tx-start");
      const result = await fn(tx);
      events.push("tx-commit");
      return result;
    },
  };
  const svc = new UserService({
    users: {
      updateProfile: async (id, data, ctx) => {
        assert.equal(ctx, tx);
        events.push("db-update");
        return { UUID: id, FNAME: data.FNAME };
      },
    },
    audit: {
      record: async (req, action, entity, id, status, desc, ctx) => {
        assert.equal(ctx, tx);
        events.push("audit");
      },
    },
    getDb: async () => db,
  });
  const result = await svc.updateUser({ uuid: UUID, FNAME: "Ahmed" }, {});
  assert.equal(result.FNAME, "Ahmed");
  assert.deepEqual(events, ["tx-start", "db-update", "audit", "tx-commit"]);
});

test("Explicit portal creation guards against duplicate local IAS linkage", async () => {
  const events = [];
  const tx = {
    run: async (sql, params) => {
      events.push("lock");
      assert.match(
        sql,
        /pg_advisory_xact_lock\(hashtextextended\(\$1::text, 0::bigint\)\)/,
      );
      assert.deepEqual(params, ["scim-id"]);
    },
  };
  const db = { tx: async (fn) => fn(tx) };
  const svc = new UserService({
    users: {
      findByIasId: async () => {
        events.push("lookup");
        return { UUID };
      },
      createFromIas: async () => {
        events.push("insert");
      },
    },
    audit: { record: async () => {} },
    getDb: async () => db,
  });
  await assert.rejects(
    () => svc.createFromIas({ id: "scim-id" }, {}),
    /already has a portal profile/,
  );
  assert.deepEqual(events, ["lock", "lookup"]);
});
