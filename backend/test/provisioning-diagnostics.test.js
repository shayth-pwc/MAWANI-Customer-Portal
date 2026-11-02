"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadWithFakeCds } = require("./helpers-cds");
const UserProvisioningService = loadWithFakeCds(
  "../srv/core/services/user-provisioning.service",
);
const { safeProvisioningDiagnostic } = require("../srv/core/utils/errors");

const userId = "a7952e14-b72a-488e-8e1f-0d5e8c8cb714";
const subject = "verified-human-subject";
const issuer = "https://as6lstkln.accounts.ondemand.com";
function request() {
  const payload = { iss: issuer, sub: subject, user_uuid: userId };
  const jwt = `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
  return {
    user: {
      id: subject,
      is: (role) => role === "authenticated-user",
      authInfo: { token: { jwt } },
    },
  };
}
const scimUser = {
  id: userId,
  active: true,
  emails: [{ value: "test@example.com" }],
};

function injected({ transaction, ias } = {}) {
  const db = { tx: transaction || (async (fn) => fn({ run: async () => [] })) };
  return new UserProvisioningService({
    getDb: async () => db,
    ias: ias || { request: async () => scimUser },
    users: {
      findByIdentity: async () => null,
      findByIasId: async () => null,
      createFromVerifiedLogin: async () => ({
        UUID: "01234567-89ab-4cde-8fab-0123456789ab",
      }),
    },
    audit: { record: async () => undefined },
  });
}

test("network failure is labeled scim-user-lookup without leaking identifiers", async () => {
  const service = injected({
    ias: {
      request: async () => {
        throw new TypeError("Private user email test@example.com");
      },
    },
  });
  await assert.rejects(
    () => service.ensure(request()),
    (error) => {
      assert.equal(error.provisioningStage, "scim-user-lookup");
      const diagnostic = safeProvisioningDiagnostic(error);
      assert.match(
        diagnostic,
        /stage=scim-user-lookup, type=TypeError, code=unknown/,
      );
      assert.doesNotMatch(diagnostic, /test@example.com/);
      return true;
    },
  );
});

test("transaction lock failure is diagnosed without changing transaction behavior", async () => {
  const service = injected({
    transaction: async (fn) =>
      fn({
        run: async () => {
          throw new Error("Injected lock failure");
        },
      }),
  });
  await assert.rejects(
    () => service.ensure(request()),
    (error) => {
      assert.equal(error.provisioningStage, "advisory-lock");
      return true;
    },
  );
});

test("profile insertion failure has a specific stage", async () => {
  const service = injected();
  service.users.createFromVerifiedLogin = async () => {
    throw new Error("Injected insert failure");
  };
  await assert.rejects(
    () => service.ensure(request()),
    (error) => {
      assert.equal(error.provisioningStage, "insert-new-profile");
      return true;
    },
  );
});

test("audit insertion failure is distinguished from portal insert", async () => {
  const service = injected();
  service.audit.record = async () => {
    throw new Error("Injected audit failure");
  };
  await assert.rejects(
    () => service.ensure(request()),
    (error) => {
      assert.equal(error.provisioningStage, "audit-profile-create");
      return true;
    },
  );
});

test("diagnostic reporter accepts SQLSTATE and hides arbitrary code and exception messages", () => {
  const err = new TypeError("Sensitive email private@example.com");
  err.code = "23502";
  err.provisioningStage = "insert-new-profile";
  assert.equal(
    safeProvisioningDiagnostic(err),
    "stage=insert-new-profile, type=TypeError, code=23502, category=unspecified",
  );
  err.code = "private_data?";
  err.provisioningStage = "unknown-sensitive-stage";
  const out = safeProvisioningDiagnostic(err);
  assert.match(out, /stage=unclassified/);
  assert.doesNotMatch(out, /private@example.com|unknown-sensitive-stage/);
});

test("read-only diagnostic script never writes portal or IAS users", () => {
  const root = path.join(__dirname, "..");
  const script = fs.readFileSync(
    path.join(root, "scripts/provisioning-diagnose.js"),
    "utf8",
  );
  assert.doesNotMatch(
    script,
    /\b(?:INSERT INTO|UPDATE\s+public|DELETE FROM|PATCH|POST)\b/,
  );
  assert.match(script, /pg_advisory_xact_lock/);
  assert.match(script, /scim-user-detail/);
});
