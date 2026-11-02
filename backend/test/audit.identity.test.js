"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithFakeCds } = require("./helpers-cds");
const AuditService = loadWithFakeCds("../srv/core/services/audit.service");
test("audit identifies an IAS admin even without a PostgreSQL portal row", async () => {
  let record;
  const svc = new AuditService({
    create: async (entry) => {
      record = entry;
    },
  });
  const req = {
    mawaniActor: null,
    mawaniIdentity: {
      issuer: "https://ias.example.com",
      subject: "P000061",
      globalUserId: "a7952e14-b72a-488e-8e1f-0d5e8c8cb714",
    },
  };
  await svc.record(
    req,
    "IAS_USER_UPDATE",
    "IAS_USER",
    "target",
    "SUCCESS",
    "Updated user",
  );
  assert.equal(record.userUuid, null);
  assert.match(record.description, /IAS Global User ID/);
  assert.match(record.description, /P000061/);
});
