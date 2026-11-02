"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithFakeCds } = require("./helpers-cds");
const UserProvisioningService = loadWithFakeCds(
  "../srv/core/services/user-provisioning.service",
);
const UserRepository = loadWithFakeCds(
  "../srv/core/repositories/user.repository",
);
const AuditRepository = loadWithFakeCds(
  "../srv/core/repositories/audit.repository",
);
const AuditService = loadWithFakeCds("../srv/core/services/audit.service");
const ID = "a7952e14-b72a-488e-8e1f-0d5e8c8cb714";
const ISS = "https://as6lstkln.accounts.ondemand.com";
const SUB = "verified-human-subject";
const iasUser = {
  id: ID,
  active: true,
  emails: [{ value: "firstlogin@example.test", primary: true }],
  name: { givenName: "Maha", familyName: "Baker" },
};
function request() {
  const jwt = `e30.${Buffer.from(JSON.stringify({ iss: ISS, sub: SUB, user_uuid: ID })).toString("base64url")}.sig`;
  return {
    user: {
      id: SUB,
      is: (role) => role === "authenticated-user",
      authInfo: { token: { jwt } },
    },
  };
}
function pgFixture({ failAudit = false, skipInsert = false } = {}) {
  let state = { users: [], audits: [] };
  const statements = [];
  const db = {
    tx: async (fn) => {
      const work = {
        users: state.users.map((x) => ({ ...x })),
        audits: state.audits.map((x) => ({ ...x })),
      };
      const tx = {
        run: async (sql, params = []) => {
          statements.push(sql);
          if (sql.includes("pg_advisory_xact_lock")) return [];
          if (
            /^SELECT /i.test(sql) &&
            sql.includes('"IAS_ISSUER" = $1 AND "IAS_SUBJECT" = $2')
          )
            return work.users.filter(
              (x) => x.IAS_ISSUER === params[0] && x.IAS_SUBJECT === params[1],
            );
          if (/^SELECT /i.test(sql) && sql.includes('WHERE "IAS_ID" = $1'))
            return work.users.filter((x) => x.IAS_ID === params[0]);
          if (/^SELECT /i.test(sql) && sql.includes('WHERE "UUID" = $1::uuid'))
            return work.users.filter((x) => x.UUID === params[0]);
          if (/^INSERT INTO public\."BTP_TBL_USERS"/i.test(sql)) {
            if (!skipInsert)
              work.users.push({
                UUID: params[0],
                IAS_ID: params[1],
                IAS_ISSUER: params[2],
                IAS_SUBJECT: params[3],
                EMAIL: params[4],
                FNAME: params[5],
                LNAME: params[6],
                ACCOUNT_TYPE: "PORTAL_USER",
                ACTIVE_STATUS: true,
              });
            // Model the kind of non-array result CAP gave the caller.
            return skipInsert ? 0 : 1;
          }
          if (/^INSERT INTO public\."BTP_TBL_AUDIT_LOG"/i.test(sql)) {
            if (failAudit)
              throw Object.assign(new Error("simulated audit rejection"), {
                code: "23502",
              });
            work.audits.push({ USER_UUID: params[1], ACTION: params[3] });
            return 1;
          }
          throw new Error("Unexpected SQL in database fixture");
        },
      };
      const value = await fn(tx);
      state = work;
      return value;
    },
  };
  const users = new UserRepository(async () => db);
  const audit = new AuditService(new AuditRepository(async () => db));
  const service = new UserProvisioningService({
    getDb: async () => db,
    users,
    audit,
    ias: {
      request: async (method, path) => {
        assert.equal(method, "GET");
        assert.equal(path, `/Users/${ID}`);
        return iasUser;
      },
    },
  });
  return { service, statements, state: () => state };
}

test("real repository first-login flow handles raw PostgreSQL INSERT result of 1 and commits one audit", async () => {
  const { service, state, statements } = pgFixture();
  const first = await service.ensure(request());
  assert.equal(first.created, true);
  assert.equal(first.profile.ACCOUNT_TYPE, "PORTAL_USER");
  assert.equal(first.profile.IAS_ID, ID);
  assert.equal(state().users.length, 1);
  assert.deepEqual(state().audits, [
    { USER_UUID: first.profile.UUID, ACTION: "PORTAL_USER_AUTO_CREATE" },
  ]);
  assert.ok(
    statements.some(
      (x) => /^SELECT /i.test(x) && x.includes('WHERE "UUID" = $1::uuid'),
    ),
  );
  const second = await service.ensure(request());
  assert.equal(second.created, false);
  assert.equal(second.profile.UUID, first.profile.UUID);
  assert.equal(state().users.length, 1);
  assert.equal(state().audits.length, 1);
});

test("audit failure rolls back first-login profile and does not report success", async () => {
  const { service, state } = pgFixture({ failAudit: true });
  await assert.rejects(
    () => service.ensure(request()),
    (err) => err.code === "23502",
  );
  assert.equal(state().users.length, 0);
  assert.equal(state().audits.length, 0);
});

test("INSERT without a readable row fails closed instead of creating an audit-only profile", async () => {
  const { service, state } = pgFixture({ skipInsert: true });
  await assert.rejects(() => service.ensure(request()), /read-back mismatch/);
  assert.equal(state().users.length, 0);
  assert.equal(state().audits.length, 0);
});

test("identity linking rejects a conflicting row after UPDATE, independent of DML result format", async () => {
  const uuid = "01234567-89ab-4cde-8fab-0123456789ab";
  const row = {
    UUID: uuid,
    IAS_ID: ID,
    IAS_ISSUER: "another-issuer",
    IAS_SUBJECT: null,
    ACTIVE_STATUS: true,
  };
  const db = { run: async (sql) => (/^UPDATE /i.test(sql) ? 1 : [row]) };
  const repo = new UserRepository(async () => db);
  const profile = await repo.bindVerifiedIdentity(uuid, {
    globalUserId: ID,
    issuer: ISS,
    subject: SUB,
  });
  assert.equal(profile, null);
});

test("profile UPDATE uses a read-back and validates the requested values", async () => {
  const uuid = "01234567-89ab-4cde-8fab-0123456789ab";
  let profile = { UUID: uuid, ACTIVE_STATUS: true, FNAME: "Before" };
  const sqls = [];
  const db = {
    run: async (sql, params) => {
      sqls.push(sql);
      if (/^UPDATE /i.test(sql)) {
        profile = { ...profile, ACTIVE_STATUS: params[0], FNAME: params[1] };
        return 1;
      }
      return [profile];
    },
  };
  const repo = new UserRepository(async () => db);
  const updated = await repo.updateProfile(uuid, {
    ACTIVE_STATUS: false,
    FNAME: "After",
  });
  assert.equal(updated.ACTIVE_STATUS, false);
  assert.equal(updated.FNAME, "After");
  assert.match(sqls[0], /^UPDATE /);
  assert.match(sqls[1], /^SELECT /);
});

test("profile UPDATE does not report success when no row is updated", async () => {
  const uuid = "01234567-89ab-4cde-8fab-0123456789ab";
  const db = { run: async (sql) => (/^UPDATE /i.test(sql) ? 0 : []) };
  const repo = new UserRepository(async () => db);
  assert.equal(await repo.updateProfile(uuid, { FNAME: "After" }), null);
});
