"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const id = "83c30c52-6933-4223-b916-18f0a6b751dc";
const state = {
  iasActive: true,
  iasFirst: "Mawani",
  iasLast: "Test",
  portalFirst: "Mawani",
  portalLast: "Test",
  portalActive: true,
};
const respond = (object) => ({
  ok: true,
  status: 200,
  headers: { get: (key) => (key === "x-csrf-token" ? "abc" : null) },
  text: async () => JSON.stringify(object),
});
const fetch = async (url, options = {}) => {
  if (url === "/admin/$metadata") return respond({});
  if (url.startsWith("/admin/getIasUser"))
    return respond({
      id,
      userName: "mawani.test.user01",
      active: state.iasActive,
    });
  if (url.startsWith("/admin/getUsers"))
    return respond({
      value: [
        {
          IAS_ID: id,
          UUID: "fc92c7ac-66b6-48a3-a96f-614ff384ad8f",
          ACCOUNT_TYPE: "PORTAL_USER",
          ACTIVE_STATUS: state.portalActive,
          FNAME: state.portalFirst,
          LNAME: state.portalLast,
        },
      ],
    });
  assert.equal(options.method, "POST");
  assert.equal(options.headers["X-CSRF-Token"], "abc");
  const body = JSON.parse(options.body);
  if (url === "/admin/updateIasUser") {
    state.iasFirst = body.givenName;
    state.iasLast = body.familyName;
    state.portalFirst = body.givenName;
    state.portalLast = body.familyName;
    return respond({ id, active: state.iasActive });
  }
  if (url === "/admin/setIasUserActive") {
    state.iasActive = body.active;
    state.portalActive = body.active;
    return respond({ id, active: body.active });
  }
  if (url === "/admin/updatePortalUser") {
    state.portalFirst = body.FNAME;
    return respond({ UUID: body.uuid, FNAME: body.FNAME });
  }
  throw Error("Unexpected URL: " + url);
};
const logs = [];
const sandbox = {
  console: {
    log: (...a) => logs.push(a),
    table: () => {},
    warn: (...a) => logs.push(a),
  },
  window: {},
  location: {
    origin:
      "https://mawani-btp-dev-mawani-btp-dev-sp-mawani-portal-router.cfapps.sa30.hana.ondemand.com",
  },
  fetch,
  confirm: () => true,
};
vm.runInNewContext(
  fs.readFileSync(__dirname + "/mawani-phase1-admin-qa-v074.js", "utf8"),
  sandbox,
);
(async () => {
  const result = await sandbox.window.mawaniQA.run();
  assert.equal(result.failure, undefined);
  for (const testName of [
    "iasNameReadback",
    "iasNameSyncedToPortal",
    "iasDeactivate",
    "portalDeactivateSynced",
    "iasReactivate",
    "portalReactivateSynced",
    "portalUpdate",
    "portalUuidUnchanged",
  ])
    assert.match(result.tests[testName], /^PASS/);
  assert.equal(result.cleanup.portalFirstName, "RESTORED");
  assert.match(result.cleanup.iasNames, /RESTORED/);
  assert.equal(result.finalReadback.portalFirstName, "Mawani");
  assert.equal(result.finalReadback.portalActive, true);
  assert.equal(state.iasFirst, "Mawani");
  assert.equal(state.iasLast, "Test");
  console.log("v0.7.4 browser QA mock: PASS");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
