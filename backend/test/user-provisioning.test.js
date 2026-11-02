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
const IAS_ID = "a7952e14-b72a-488e-8e1f-0d5e8c8cb714";
const UUID = "01234567-89ab-4cde-8fab-0123456789ab";
const ISS = "https://as6lstkln.accounts.ondemand.com";
const SUB = "verified-human-subject";
function request(claims = {}) {
  const payload = { iss: ISS, sub: SUB, user_uuid: IAS_ID, ...claims };
  const jwt = `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
  return {
    user: {
      id: SUB,
      is: (role) => role === "authenticated-user",
      authInfo: { token: { jwt } },
    },
  };
}
const directoryUser = {
  id: IAS_ID,
  active: true,
  emails: [{ value: "person@example.com", primary: true }],
  name: { givenName: "Maha", familyName: "Baker" },
};
function fixture({
  iasUser = directoryUser,
  initial = null,
  byIdentity = null,
  byIasId = null,
} = {}) {
  const events = [];
  let row = initial;
  const tx = {
    run: async (sql, values) => {
      events.push(["lock", sql, values]);
      assert.match(sql, /pg_advisory_xact_lock/);
      assert.deepEqual(values, [IAS_ID]);
    },
  };
  const db = {
    tx: async (fn) => {
      events.push(["transaction-start"]);
      const result = await fn(tx);
      events.push(["transaction-commit"]);
      return result;
    },
  };
  const users = {
    findByIdentity: async (...args) => {
      assert.equal(args[2], tx);
      events.push(["lookup-identity"]);
      return byIdentity === null ? row : byIdentity;
    },
    findByIasId: async (...args) => {
      assert.equal(args[1], tx);
      events.push(["lookup-ias"]);
      return byIasId === null ? row : byIasId;
    },
    createFromVerifiedLogin: async (data, t) => {
      assert.equal(t, tx);
      events.push(["insert", data]);
      row = {
        UUID,
        IAS_ID: IAS_ID,
        IAS_ISSUER: ISS,
        IAS_SUBJECT: SUB,
        EMAIL: directoryUser.emails[0].value,
        ACCOUNT_TYPE: "PORTAL_USER",
        ACTIVE_STATUS: true,
      };
      return row;
    },
    bindVerifiedIdentity: async (id, data, t) => {
      assert.equal(t, tx);
      events.push(["link", data]);
      row = { ...row, IAS_ID: IAS_ID, IAS_ISSUER: ISS, IAS_SUBJECT: SUB };
      return row;
    },
  };
  const ias = {
    request: async (method, path) => {
      events.push(["ias", method, path]);
      assert.equal(method, "GET");
      assert.equal(path, `/Users/${IAS_ID}`);
      return iasUser;
    },
  };
  const audit = {
    record: async (req, action, table, id, status, description, t) => {
      assert.equal(t, tx);
      assert.equal(table, "BTP_TBL_USERS");
      assert.equal(id, UUID);
      assert.equal(status, "SUCCESS");
      assert.equal(req.mawaniActor.UUID, UUID);
      events.push(["audit", action]);
    },
  };
  const service = new UserProvisioningService({
    ias,
    users,
    audit,
    getDb: async () => db,
  });
  return { service, events, users, getRow: () => row };
}

test("first human IAS login creates one active, least-privileged portal record with audit in transaction", async () => {
  const { service, events } = fixture();
  const req = request();
  const result = await service.ensure(req);
  assert.equal(result.created, true);
  assert.equal(result.profile.ACCOUNT_TYPE, "PORTAL_USER");
  assert.equal(result.profile.ACTIVE_STATUS, true);
  assert.equal(req.mawaniIdentity.globalUserId, IAS_ID);
  assert.equal(req.mawaniActor.UUID, UUID);
  assert.deepEqual(
    events.map((e) => e[0]),
    [
      "ias",
      "transaction-start",
      "lock",
      "lookup-identity",
      "lookup-ias",
      "insert",
      "audit",
      "transaction-commit",
    ],
  );
  assert.equal(
    events.find((e) => e[0] === "audit")[1],
    "PORTAL_USER_AUTO_CREATE",
  );
  const payload = events.find((e) => e[0] === "insert")[1];
  assert.equal(payload.issuer, ISS);
  assert.equal(payload.subject, SUB);
  assert.equal(payload.globalUserId, IAS_ID);
  assert.equal(payload.iasUser.name.givenName, "Maha");
});

test("subsequent authenticated calls use existing profile without insert or audit", async () => {
  const initial = {
    UUID,
    IAS_ID,
    IAS_ISSUER: ISS,
    IAS_SUBJECT: SUB,
    ACTIVE_STATUS: true,
    ACCOUNT_TYPE: "EMPLOYEE",
  };
  const { service, events } = fixture({ initial });
  const result = await service.ensure(request());
  assert.equal(result.created, false);
  assert.equal(result.profile.ACCOUNT_TYPE, "EMPLOYEE");
  assert.ok(
    !events.some(
      (e) => e[0] === "insert" || e[0] === "audit" || e[0] === "link",
    ),
  );
});

test("previously admin-created portal record links on login without changing profile settings", async () => {
  const initial = {
    UUID,
    IAS_ID,
    IAS_ISSUER: null,
    IAS_SUBJECT: null,
    ACTIVE_STATUS: true,
    ACCOUNT_TYPE: "EMPLOYEE",
  };
  const { service, events } = fixture({ initial });
  const result = await service.ensure(request());
  assert.equal(result.created, false);
  assert.equal(result.profile.ACCOUNT_TYPE, "EMPLOYEE");
  assert.equal(result.profile.IAS_SUBJECT, SUB);
  assert.deepEqual(
    events.filter((e) => ["link", "audit"].includes(e[0])).map((e) => e[0]),
    ["link", "audit"],
  );
  assert.equal(
    events.find((e) => e[0] === "audit")[1],
    "PORTAL_USER_IDENTITY_LINK",
  );
});

test("disabled and expired local accounts remain denied and never reactivated", async () => {
  for (const local of [
    { ACTIVE_STATUS: false },
    { ACTIVE_STATUS: true, ENDDA: "2000-01-01" },
    { ACTIVE_STATUS: true, BEGDA: "2999-01-01" },
  ]) {
    const { service, events } = fixture({
      initial: { UUID, IAS_ID, IAS_ISSUER: null, IAS_SUBJECT: null, ...local },
    });
    await assert.rejects(
      () => service.ensure(request()),
      (e) => e.status === 403,
    );
    assert.ok(!events.some((e) => ["link", "insert", "audit"].includes(e[0])));
  }
});

test("IAS must independently confirm the same active SCIM identity", async () => {
  for (const iasUser of [
    null,
    { ...directoryUser, active: false },
    { ...directoryUser, id: "different" },
  ]) {
    const { service, events } = fixture({ iasUser });
    await assert.rejects(
      () => service.ensure(request()),
      (e) => e.status === 403,
    );
    assert.ok(!events.some((e) => e[0] === "transaction-start"));
  }
});

test("unverified identity, missing user_uuid and technical caller fail closed", async () => {
  const { service, events } = fixture();
  const noUuid = request({ user_uuid: undefined });
  await assert.rejects(
    () => service.ensure(noUuid),
    (e) => e.status === 403,
  );
  const badToken = request();
  badToken.user.id = "forged";
  await assert.rejects(
    () => service.ensure(badToken),
    (e) => e.status === 403,
  );
  const machine = request();
  machine.user.is = (role) =>
    role === "authenticated-user" || role === "system-user";
  await assert.rejects(
    () => service.ensure(machine),
    (e) => e.status === 403,
  );
  assert.ok(!events.some((e) => e[0] === "ias"));
});

test("conflicting SCIM and token-linked records are never silently merged", async () => {
  const byIdentity = {
    UUID,
    IAS_ID,
    IAS_ISSUER: ISS,
    IAS_SUBJECT: SUB,
    ACTIVE_STATUS: true,
  };
  const byIasId = {
    UUID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    IAS_ID,
    ACTIVE_STATUS: true,
  };
  const { service, events } = fixture({ byIdentity, byIasId });
  await assert.rejects(
    () => service.ensure(request()),
    (e) => e.status === 409,
  );
  assert.ok(!events.some((e) => ["insert", "link", "audit"].includes(e[0])));
});

test("existing SCIM row with another token identity is rejected", async () => {
  const row = {
    UUID,
    IAS_ID,
    IAS_ISSUER: ISS,
    IAS_SUBJECT: "some-other-subject",
    ACTIVE_STATUS: true,
  };
  const { service } = fixture({ initial: row });
  await assert.rejects(
    () => service.ensure(request()),
    (e) => e.status === 403,
  );
});

test("repository SQL provisions verified identity using INSERT then SELECT read-back", async () => {
  const events = [];
  let row = null;
  const db = {
    run: async (sql, params) => {
      events.push({ sql, params });
      if (/^INSERT INTO /i.test(sql)) {
        row = {
          UUID: params[0],
          IAS_ID: params[1],
          IAS_ISSUER: params[2],
          IAS_SUBJECT: params[3],
          EMAIL: params[4],
          FNAME: params[5],
          LNAME: params[6],
          ACCOUNT_TYPE: "PORTAL_USER",
          ACTIVE_STATUS: true,
        };
        return 1; // Simulate CAP returning affected-row count, not RETURNING rows.
      }
      if (/^UPDATE /i.test(sql)) return 1;
      if (/^SELECT /i.test(sql)) return row ? [row] : [];
      throw new Error("Unexpected SQL");
    },
  };
  const repo = new UserRepository(async () => db);
  const created = await repo.createFromVerifiedLogin({
    iasUser: directoryUser,
    globalUserId: IAS_ID,
    issuer: ISS,
    subject: SUB,
  });
  assert.equal(created.UUID, row.UUID);
  const bound = await repo.bindVerifiedIdentity(created.UUID, {
    globalUserId: IAS_ID,
    issuer: ISS,
    subject: SUB,
  });
  assert.equal(bound.UUID, created.UUID);
  assert.deepEqual(
    events.map((x) => x.sql.trim().split(/\s+/)[0]),
    ["INSERT", "SELECT", "UPDATE", "SELECT"],
  );
  assert.match(events[0].sql, /"IAS_ISSUER", "IAS_SUBJECT"/);
  assert.match(events[0].sql, /'PORTAL_USER', TRUE/);
  assert.doesNotMatch(events[0].sql, /SYSTEM_ADMIN|RETURNING/);
  assert.equal(events[0].params[1], IAS_ID);
  assert.equal(events[0].params[2], ISS);
  assert.equal(events[0].params[3], SUB);
  assert.equal(events[0].params[4], "person@example.com");
  assert.equal(events[0].params[5], "Maha");
  assert.equal(events[0].params[6], "Baker");
  assert.match(events[2].sql, /COALESCE\("IAS_ISSUER", \$2\)/);
  for (const { sql, params = [] } of events) {
    assert.doesNotMatch(sql, /\?/);
    for (let i = 1; i <= params.length; i++) assert.ok(sql.includes(`$${i}`));
  }
});

test('service and Application Router entry point require IAS authentication', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const cds = fs.readFileSync(path.join(root, 'srv/profile-service.cds'), 'utf8');
  assert.match(cds, /@requires:\s*'authenticated-user'/);
  assert.match(cds, /function me\(\)/);
  assert.match(cds, /action provision\(\)/);

  const config = JSON.parse(fs.readFileSync(
    path.join(root, '.deploy/app-router/xs-app.json'), 'utf8'));
  assert.equal(config.authenticationMethod, 'route');
  assert.equal(config.logout?.logoutEndpoint, '/logout');
  assert.equal(config.logout?.logoutPage, '/signed-out');
  const routes = config.routes;
  const forUrl = (url) => routes.find((r) => new RegExp(r.source).test(url));

  // Check real matching order, not brittle old 0.7.4 bootstrap rule indexes.
  const spaProfile = routes[0];
  const api = routes[1];
  assert.equal(spaProfile.source, '^/profile(?:/(?:registration|password))?/?$');
  assert.equal(spaProfile.authenticationType, 'ias');
  assert.equal(spaProfile.localDir, 'portal-bootstrap');
  assert.equal(api.source, '^/(profile|admin)(/.*)?$');
  assert.equal(api.target, '/$1$2');
  assert.equal(api.destination, 'srv-api');
  assert.equal(api.authenticationType, 'ias');
  assert.equal(api.csrfProtection, true);
  for (const url of ['/profile/$metadata', '/profile/me()', '/profile/provision',
                     '/admin/getUsers(limit=1,offset=0)']) {
    assert.equal(forUrl(url), api, 'Unauthenticated/incorrect CAP route: ' + url);
  }
  for (const url of ['/profile', '/profile/registration', '/profile/password']) {
    assert.equal(forUrl(url), spaProfile, 'React profile page lost: ' + url);
  }

  const allowedPublic = new Set([
    '^/assets/(.*)$',
    '^/(.*\\.(?:ico|png|svg|jpg|jpeg|webp|gif|woff2?|css|js|txt|json))$',
    '^/(login|signup|forgot-password|signed-out)$',
  ]);
  for (const route of routes.filter((r) => r.authenticationType === 'none')) {
    assert.ok(allowedPublic.has(route.source), 'Unexpected public route: ' + route.source);
    assert.equal(route.localDir, 'portal-bootstrap');
  }
  assert.equal(forUrl('/signed-out')?.authenticationType, 'none');
  const fallback = routes.at(-1);
  assert.equal(fallback.source, '^/(.*)$');
  assert.equal(fallback.localDir, 'portal-bootstrap');
  assert.equal(fallback.authenticationType, 'ias');
  for (const url of ['/', '/requests', '/dashboard']) {
    assert.equal(forUrl(url), fallback, 'Unprotected React page: ' + url);
  }
});
test("audit failure rejects first-login transaction instead of reporting successful provisioning", async () => {
  const events = [];
  const tx = {
    run: async () => {
      events.push("lock");
    },
  };
  const db = {
    tx: async (fn) => {
      events.push("begin");
      const result = await fn(tx);
      events.push("commit");
      return result;
    },
  };
  const users = {
    findByIdentity: async () => null,
    findByIasId: async () => null,
    createFromVerifiedLogin: async () => {
      events.push("insert");
      return { UUID, IAS_ID, ACTIVE_STATUS: true };
    },
  };
  const ias = { request: async () => directoryUser };
  const audit = {
    record: async () => {
      events.push("audit-error");
      throw new Error("injected audit failure");
    },
  };
  const service = new UserProvisioningService({
    ias,
    users,
    audit,
    getDb: async () => db,
  });
  await assert.rejects(
    () => service.ensure(request()),
    /injected audit failure/,
  );
  assert.deepEqual(events, ["begin", "lock", "insert", "audit-error"]);
});

test("admin GET and profile GET do not auto-provision", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const admin = fs.readFileSync(
    path.join(__dirname, "../srv/admin-service.js"),
    "utf8",
  );
  const profile = fs.readFileSync(
    path.join(__dirname, "../srv/profile-service.js"),
    "utf8",
  );
  assert.match(admin, /await guard\.authorize\(req\)/);
  assert.doesNotMatch(admin, /provisioning\.ensure\(req\)/);
  assert.match(
    profile,
    /this\.on\('me', req => handle\(req, r => provisioning\.read\(r\)\)\)/,
  );
  assert.match(
    profile,
    /this\.on\('provision', req => handle\(req, r => provisioning\.ensure\(r\)\)\)/,
  );
  const cds = fs.readFileSync(
    path.join(__dirname, "../srv/profile-service.cds"),
    "utf8",
  );
  assert.match(cds, /function me\(\)/);
  assert.match(cds, /action provision\(\)/);
});
