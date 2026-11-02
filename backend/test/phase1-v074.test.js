"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadWithFakeCds } = require("./helpers-cds");
const UserService = loadWithFakeCds("../srv/core/services/user.service");
const UserRepository = loadWithFakeCds(
  "../srv/core/repositories/user.repository",
);
const Provisioning = loadWithFakeCds(
  "../srv/core/services/user-provisioning.service",
);
const IasController = loadWithFakeCds("../srv/core/controllers/ias.controller");
const IAS_ID = "83c30c52-6933-4223-b916-18f0a6b751dc";
const UUID = "fc92c7ac-66b6-48a3-a96f-614ff384ad8f";
const ISS = "https://ias.example.org";
const SUB = "P000062";
const raw = {
  id: IAS_ID,
  userName: "mawani.test.user01",
  active: true,
  name: { givenName: "MawaniQA", familyName: "TestQA" },
  emails: [{ value: "mawaniqa@example.com", primary: true }],
};
const portal = {
  UUID,
  IAS_ID,
  IAS_ISSUER: null,
  IAS_SUBJECT: null,
  ACCOUNT_TYPE: "PORTAL_USER",
  ACTIVE_STATUS: true,
  EMAIL: "old@example.com",
  FNAME: "Mawani",
  LNAME: "Test",
};
function request() {
  const jwt = `e30.${Buffer.from(JSON.stringify({ iss: ISS, sub: SUB, user_uuid: IAS_ID })).toString("base64url")}.signature`;
  return {
    user: {
      id: SUB,
      is: (role) => role === "authenticated-user",
      authInfo: { token: { jwt } },
    },
  };
}

test("GET profile is read-only and refuses to create a missing profile", async () => {
  const events = [];
  const service = new Provisioning({
    ias: {
      request: async () => {
        events.push("scim-get");
        return raw;
      },
    },
    users: {
      findByIdentity: async () => {
        events.push("lookup-token");
        return null;
      },
      findByIasId: async () => {
        events.push("lookup-ias");
        return null;
      },
    },
    audit: {
      record: async () => {
        throw Error("Read-only GET wrote audit");
      },
    },
    getDb: async () => ({
      tx: () => {
        throw Error("GET used a transaction");
      },
      run: () => {
        throw Error("GET wrote to DB");
      },
    }),
  });
  await assert.rejects(
    () => service.read(request()),
    (err) => err.status === 404,
  );
  assert.deepEqual(events, ["scim-get", "lookup-token", "lookup-ias"]);
});

test("GET profile reads already synchronized IAS-only profile without linking it", async () => {
  const service = new Provisioning({
    ias: { request: async () => raw },
    users: {
      findByIdentity: async () => null,
      findByIasId: async () => portal,
    },
    audit: {
      record: async () => {
        throw Error("GET attempted audit");
      },
    },
    getDb: async () => ({
      tx: () => {
        throw Error("GET writes are forbidden");
      },
    }),
  });
  const result = await service.read(request());
  assert.equal(result.created, false);
  assert.equal(result.profile.UUID, UUID);
  assert.equal(result.profile.IAS_SUBJECT, null);
});

test("GET profile rejects locally disabled, expired and conflicting users", async () => {
  for (const change of [
    { ACTIVE_STATUS: false },
    { ENDDA: "2000-01-01" },
    { IAS_ISSUER: "https://other-issuer.example.org" },
  ]) {
    const service = new Provisioning({
      ias: { request: async () => raw },
      users: {
        findByIdentity: async () => null,
        findByIasId: async () => ({ ...portal, ...change }),
      },
      getDb: async () => ({}),
    });
    await assert.rejects(
      () => service.read(request()),
      (err) => err.status === 403,
    );
  }
});

test("IAS verified update changes only selected PostgreSQL fields and records both audits inside transaction", async () => {
  const events = [];
  const tx = {
    run: async (sql, params) => {
      assert.match(sql, /pg_advisory_xact_lock/);
      assert.deepEqual(params, [IAS_ID]);
      events.push("lock");
    },
  };
  const db = {
    tx: async (fn) => {
      events.push("begin");
      const value = await fn(tx);
      events.push("commit");
      return value;
    },
  };
  const repository = {
    findByIasId: async (id, ctx) => {
      assert.equal(ctx, tx);
      events.push("lookup");
      return { ...portal };
    },
    updateVerifiedIasFields: async (id, changes, ctx) => {
      assert.equal(ctx, tx);
      assert.equal(id, UUID);
      assert.deepEqual(changes, {
        FNAME: "MawaniQA",
        LNAME: "TestQA",
        EMAIL: "mawaniqa@example.com",
      });
      events.push("update");
      return { ...portal, ...changes };
    },
  };
  const audit = {
    record: async (req, action, entity, id, status, description, ctx) => {
      assert.equal(ctx, tx);
      assert.equal(status, "SUCCESS");
      events.push(`audit:${action}`);
      assert.ok(!description.includes("mawaniqa@example.com"));
    },
  };
  const service = new UserService({
    users: repository,
    audit,
    getDb: async () => db,
  });
  const result = await service.applyVerifiedIasChange(
    raw,
    ["givenName", "familyName", "email"],
    {},
    "IAS_USER_UPDATE",
  );
  assert.equal(result.created, false);
  assert.equal(result.profile.FNAME, "MawaniQA");
  assert.deepEqual(events, [
    "begin",
    "lock",
    "lookup",
    "update",
    "audit:PORTAL_USER_IAS_SYNC",
    "audit:IAS_USER_UPDATE",
    "commit",
  ]);
});

test("IAS status change can explicitly disable the existing local profile without modifying unrelated fields", async () => {
  const events = [];
  const tx = { run: async () => events.push("lock") };
  const db = { tx: async (fn) => fn(tx) };
  const users = {
    findByIasId: async () => portal,
    updateVerifiedIasFields: async (id, changes) => {
      assert.deepEqual(changes, { ACTIVE_STATUS: false });
      events.push("update");
      return { ...portal, ACTIVE_STATUS: false };
    },
  };
  const audit = { record: async () => events.push("audit") };
  const service = new UserService({ users, audit, getDb: async () => db });
  const result = await service.applyVerifiedIasChange(
    { ...raw, active: false },
    ["active"],
    {},
    "IAS_USER_STATUS",
  );
  assert.equal(result.profile.ACTIVE_STATUS, false);
  assert.deepEqual(events, ["lock", "update", "audit", "audit"]);
});

test("a previously missing PostgreSQL profile is created under the lock during verified IAS updates", async () => {
  const events = [];
  const tx = { run: async () => events.push("lock") };
  const db = {
    tx: async (fn) => {
      events.push("begin");
      const r = await fn(tx);
      events.push("commit");
      return r;
    },
  };
  const users = {
    findByIasId: async () => null,
    createFromAdministrativeIas: async (user, ctx) => {
      assert.equal(ctx, tx);
      assert.equal(user.id, IAS_ID);
      events.push("insert");
      return { ...portal, FNAME: "MawaniQA" };
    },
  };
  const audit = {
    record: async (req, action) => events.push("audit:" + action),
  };
  const service = new UserService({ users, audit, getDb: async () => db });
  const result = await service.applyVerifiedIasChange(
    raw,
    ["givenName"],
    {},
    "IAS_USER_UPDATE",
  );
  assert.equal(result.created, true);
  assert.deepEqual(events, [
    "begin",
    "lock",
    "insert",
    "audit:PORTAL_USER_ADMIN_CREATE",
    "audit:IAS_USER_UPDATE",
    "commit",
  ]);
});

test("audit failure prevents PostgreSQL transaction from reporting commit", async () => {
  const events = [];
  const tx = { run: async () => events.push("lock") };
  const db = {
    tx: async (fn) => {
      events.push("begin");
      const r = await fn(tx);
      events.push("commit");
      return r;
    },
  };
  const service = new UserService({
    getDb: async () => db,
    users: {
      findByIasId: async () => portal,
      updateVerifiedIasFields: async () => {
        events.push("db-update");
        return portal;
      },
    },
    audit: {
      record: async () => {
        events.push("audit-error");
        throw Error("audit failed");
      },
    },
  });
  await assert.rejects(
    () =>
      service.applyVerifiedIasChange(
        { ...raw, active: false },
        ["active"],
        {},
        "IAS_USER_STATUS",
      ),
    /audit failed/,
  );
  assert.deepEqual(events, ["begin", "lock", "db-update", "audit-error"]);
});

test("IAS update already committed but local DB sync failed returns pending reconciliation without retrying IAS PATCH", async () => {
  const events = [];
  const controller = new IasController({
    ias: {
      updateUser: async () => {
        events.push("ias-update");
        return {
          user: { id: IAS_ID },
          raw,
          fields: ["givenName"],
        };
      },
    },
    users: {
      applyVerifiedIasChange: async () => {
        events.push("db-failure");
        throw Error("offline");
      },
    },
    audit: {
      uncertain: async (req, action) => events.push("uncertain:" + action),
      failure: async () => events.push("failure"),
    },
  });
  await assert.rejects(
    () => controller.updateIasUser({ id: IAS_ID, givenName: "MawaniQA" }, {}),
    (err) => err.status === 503 && err.code === "IAS_PORTAL_SYNC_PENDING",
  );
  assert.deepEqual(events, [
    "ias-update",
    "db-failure",
    "uncertain:IAS_USER_UPDATE_PROFILE_PENDING",
  ]);
});

test("IAS update with unverified attributes does not attempt PostgreSQL sync", async () => {
  const { AppError } = require("../srv/core/utils/errors");
  const events = [];
  const controller = new IasController({
    ias: {
      updateUser: async () => {
        events.push("ias-update");
        throw new AppError(503, "unverified", "IAS_RESULT_UNCERTAIN");
      },
    },
    users: {
      applyVerifiedIasChange: async () => {
        events.push("db-update");
      },
    },
    audit: {
      uncertain: async () => events.push("uncertain"),
      failure: async () => events.push("failure"),
    },
  });
  await assert.rejects(
    () => controller.updateIasUser({ id: IAS_ID }, {}),
    (err) => err.code === "IAS_RESULT_UNCERTAIN",
  );
  assert.deepEqual(events, ["ias-update", "uncertain"]);
});

test("verified IAS field repository binds only permitted columns and confirms DML with SELECT", async () => {
  let row = { ...portal };
  const events = [];
  const db = {
    run: async (sql, params) => {
      events.push({ sql, params });
      if (/^UPDATE /i.test(sql)) {
        row = { ...row, EMAIL: params[0], FNAME: params[1] };
        return 1;
      }
      if (/^SELECT /i.test(sql)) return [row];
      throw Error("unexpected SQL");
    },
  };
  const repo = new UserRepository(async () => db);
  const result = await repo.updateVerifiedIasFields(UUID, {
    EMAIL: "new@example.com",
    FNAME: "New",
  });
  assert.equal(result.EMAIL, "new@example.com");
  assert.equal(result.FNAME, "New");
  assert.equal(events.length, 2);
  assert.doesNotMatch(events[0].sql, /\?/);
  assert.match(events[0].sql, /"EMAIL" = \$1, "FNAME" = \$2/);
  assert.deepEqual(events[0].params, ["new@example.com", "New", UUID]);
  await assert.rejects(
    () => repo.updateVerifiedIasFields(UUID, { ACCOUNT_TYPE: "SYSTEM_ADMIN" }),
    (err) => err.status === 400,
  );
});

test('React SPA entry is IAS-protected and CAP API paths remain authenticated', () => {
  const appRoot = path.join(__dirname, '../.deploy/app-router');
  const config = JSON.parse(fs.readFileSync(path.join(appRoot, 'xs-app.json'), 'utf8'));
  const routes = config.routes;
  assert.equal(config.authenticationMethod, 'route');
  assert.equal(config.logout?.logoutEndpoint, '/logout');
  assert.equal(config.logout?.logoutPage, '/signed-out');
  const forUrl = (url) => routes.find((route) => new RegExp(route.source).test(url));

  const profilePage = routes[0];
  assert.equal(profilePage.source, '^/profile(?:/(?:registration|password))?/?$');
  assert.equal(profilePage.target, 'index.html');
  assert.equal(profilePage.localDir, 'portal-bootstrap');
  assert.equal(profilePage.authenticationType, 'ias');
  assert.equal(profilePage.cacheControl, 'no-store');
  for (const url of ['/profile', '/profile/registration', '/profile/password']) {
    assert.equal(forUrl(url), profilePage, 'React profile path does not serve the SPA: ' + url);
  }

  const cap = routes[1];
  assert.equal(cap.source, '^/(profile|admin)(/.*)?$');
  assert.equal(cap.target, '/$1$2');
  assert.equal(cap.destination, 'srv-api');
  assert.equal(cap.authenticationType, 'ias');
  assert.equal(cap.csrfProtection, true);
  for (const url of ['/profile/$metadata', '/profile/me()', '/profile/provision',
                     '/admin/getUsers(limit=1,offset=0)']) {
    assert.equal(forUrl(url), cap, 'CAP API not routed to authenticated service: ' + url);
  }

  const spaFallback = routes.at(-1);
  assert.equal(spaFallback.source, '^/(.*)$');
  assert.equal(spaFallback.target, 'index.html');
  assert.equal(spaFallback.localDir, 'portal-bootstrap');
  assert.equal(spaFallback.authenticationType, 'ias');
  assert.equal(spaFallback.cacheControl, 'no-store');
  for (const url of ['/', '/requests', '/dashboard']) {
    assert.equal(forUrl(url), spaFallback, 'SPA route is not IAS-protected: ' + url);
  }

  // The old standalone bootstrap.js is gone. Test the actual built React
  // index and ensure its hashed Vite script exists in the staging folder.
  const staticRoot = path.join(appRoot, 'portal-bootstrap');
  const index = fs.readFileSync(path.join(staticRoot, 'index.html'), 'utf8');
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/gi)];
  assert.ok(scripts.length > 0, 'React index.html needs a Vite script');
  for (const [, script] of scripts) {
    assert.ok(fs.existsSync(path.join(staticRoot, script.slice(1))),
      'Vite JS asset not staged: ' + script);
  }
});
test("read-only audit verification script never writes rows", () => {
  const script = fs.readFileSync(
    path.join(__dirname, "../scripts/admin-audit-verify.js"),
    "utf8",
  );
  assert.match(script, /BTP_TBL_AUDIT_LOG/);
  assert.match(script, /"ENTITY_ID" = \$1 OR "ENTITY_ID" = \$2/);
  assert.doesNotMatch(
    script,
    /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|public)/i,
  );
});
