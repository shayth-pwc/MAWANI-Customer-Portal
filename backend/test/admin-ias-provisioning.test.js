'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadWithFakeCds } = require('./helpers-cds');
const UserService = loadWithFakeCds('../srv/core/services/user.service');
const UserRepository = loadWithFakeCds('../srv/core/repositories/user.repository');
const IasController = loadWithFakeCds('../srv/core/controllers/ias.controller');

const IAS_ID = '83c30c52-6933-4223-b916-18f0a6b751dc';
const DB_ID = '9c9664ef-acf6-4c0b-89ab-7f45f60ea565';
const raw = {
  id: IAS_ID, active: true, userName: 'mawani.test.user01',
  name: { givenName: 'Mawani', familyName: 'Test' },
  emails: [{ value: 'test@example.com', primary: true }]
};
const safeResponse = {
  id: IAS_ID, active: true, userName: raw.userName,
  displayName: 'Mawani Test', email: 'test@example.com'
};

function fixture({ initial = null, failInsert = false, failAudit = false } = {}) {
  const events = [];
  let row = initial;
  const tx = { run: async (sql, params) => {
    assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(\$1::text, 0::bigint\)\)/);
    assert.deepEqual(params, [IAS_ID]);
    events.push('lock');
  } };
  const db = { tx: async fn => {
    events.push('begin');
    const result = await fn(tx);
    events.push('commit');
    return result;
  } };
  const users = {
    findByIasId: async (id, ctx) => {
      assert.equal(id, IAS_ID);
      assert.equal(ctx, tx);
      events.push('lookup');
      return row;
    },
    createFromAdministrativeIas: async (ias, ctx) => {
      assert.equal(ctx, tx);
      assert.deepEqual(ias, raw);
      events.push('insert');
      if (failInsert) throw Error('simulated postgres error');
      row = { UUID: DB_ID, IAS_ID: IAS_ID, IAS_ISSUER: null, IAS_SUBJECT: null,
        EMAIL: raw.emails[0].value, FNAME: 'Mawani', LNAME: 'Test',
        ACTIVE_STATUS: true, ACCOUNT_TYPE: 'PORTAL_USER' };
      return row;
    }
  };
  const audit = {
    record: async (req, action, entity, id, status, description, ctx) => {
      assert.equal(ctx, tx);
      assert.equal(status, 'SUCCESS');
      assert.ok(!description.includes(raw.emails[0].value));
      if (failAudit) throw Error('simulated audit failure');
      events.push(`audit:${action}`);
    },
    uncertain: async (req, action) => { events.push(`uncertain:${action}`); },
    failure: async (req, action) => { events.push(`failure:${action}`); }
  };
  const service = new UserService({ users, audit, getDb: async () => db });
  const ias = {
    createUser: async () => { events.push('ias-create'); return safeResponse; },
    getRawUser: async id => {
      assert.equal(id, IAS_ID);
      events.push('ias-get');
      return raw;
    }
  };
  const controller = new IasController({ ias, audit, users: service });
  return { controller, service, events, audit, ias, getRow: () => row };
}

test('createIasUser writes IAS then one active PORTAL_USER DB profile and both audit entries before reporting success', async () => {
  const { controller, events, getRow } = fixture();
  const result = await controller.createIasUser({ userName: raw.userName, email: 'test@example.com' }, {});
  assert.deepEqual(events, [
    'ias-create', 'ias-get', 'begin', 'lock', 'lookup', 'insert',
    'audit:PORTAL_USER_ADMIN_CREATE', 'audit:IAS_USER_CREATE', 'commit'
  ]);
  assert.equal(result.id, IAS_ID);
  assert.equal(result.portalUserUuid, DB_ID);
  assert.equal(result.portalCreated, true);
  assert.equal(getRow().ACCOUNT_TYPE, 'PORTAL_USER');
  assert.equal(getRow().ACTIVE_STATUS, true);
  assert.equal(getRow().IAS_ISSUER, null);
  assert.equal(getRow().IAS_SUBJECT, null);
});

test('syncIasUserToPortal reconciles an already-created IAS test user without another IAS POST and is idempotent', async () => {
  const { controller, events, getRow } = fixture();
  const first = await controller.syncIasUserToPortal({ id: IAS_ID }, {});
  const second = await controller.syncIasUserToPortal({ id: IAS_ID }, {});
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.profile.UUID, second.profile.UUID);
  assert.equal(getRow().UUID, DB_ID);
  assert.deepEqual(events, [
    'ias-get', 'begin', 'lock', 'lookup', 'insert',
    'audit:PORTAL_USER_ADMIN_CREATE', 'commit',
    'ias-get', 'begin', 'lock', 'lookup', 'commit'
  ]);
});

test('IAS creation that precedes a first-login race reuses the existing portal row and still audits IAS creation', async () => {
  const previous = { UUID: DB_ID, IAS_ID, ACTIVE_STATUS: true, ACCOUNT_TYPE: 'EMPLOYEE',
    IAS_ISSUER: 'https://validated.example', IAS_SUBJECT: 'existing-token-sub' };
  const { controller, getRow, events } = fixture({ initial: previous });
  const result = await controller.createIasUser({}, {});
  assert.equal(result.portalCreated, false);
  assert.equal(result.portalUserUuid, DB_ID);
  assert.strictEqual(getRow(), previous);
  assert.deepEqual(events, [ 'ias-create', 'ias-get', 'begin', 'lock', 'lookup', 'audit:IAS_USER_CREATE', 'commit' ]);
});

test('database failure after IAS creation yields explicit reconciliation error and no second IAS create', async () => {
  const { controller, events } = fixture({ failInsert: true });
  await assert.rejects(() => controller.createIasUser({}, {}), err =>
    err.status === 503 && err.code === 'IAS_PORTAL_SYNC_PENDING' &&
    /Do not retry user creation/.test(err.message));
  assert.deepEqual(events, [
    'ias-create', 'ias-get', 'begin', 'lock', 'lookup', 'insert',
    'uncertain:IAS_USER_CREATE_PROFILE_PENDING'
  ]);
});

test('audit failure after IAS user creation cannot report successful dual-system provisioning', async () => {
  const { controller, events } = fixture({ failAudit: true });
  await assert.rejects(() => controller.createIasUser({}, {}), err => err.code === 'IAS_PORTAL_SYNC_PENDING');
  assert.deepEqual(events, [
    'ias-create', 'ias-get', 'begin', 'lock', 'lookup', 'insert',
    'uncertain:IAS_USER_CREATE_PROFILE_PENDING'
  ]);
});

test('IAS creation failure never attempts PostgreSQL provisioning', async () => {
  const { controller, events, ias } = fixture();
  ias.createUser = async () => { events.push('ias-create'); throw Error('IAS failed'); };
  await assert.rejects(() => controller.createIasUser({ userName: raw.userName }, {}), /IAS failed/);
  assert.deepEqual(events, ['ias-create', 'failure:IAS_USER_CREATE']);
});

test('uncertain IAS response is not retried and is reported for manual verification', async () => {
  const { controller, events, ias } = fixture();
  ias.createUser = async () => {
    events.push('ias-create');
    const e = Error('unknown IAS outcome'); e.code = 'IAS_RESULT_UNCERTAIN'; throw e;
  };
  await assert.rejects(() => controller.createIasUser({ userName: raw.userName }, {}),
    err => err.code === 'IAS_RESULT_UNCERTAIN');
  assert.deepEqual(events, ['ias-create', 'uncertain:IAS_USER_CREATE']);
});

test('administrative repository INSERT binds SCIM fields, leaves issuer/subject unset and verifies raw DML by SELECT', async () => {
  const events = [];
  let row;
  const db = { run: async (sql, params) => {
    events.push({ sql, params });
    if (/^INSERT /i.test(sql)) {
      row = { UUID: params[0], IAS_ID: params[1], IAS_ISSUER: null, IAS_SUBJECT: null,
        EMAIL: params[2], FNAME: params[3], LNAME: params[4], ACCOUNT_TYPE: 'PORTAL_USER',
        ACTIVE_STATUS: params[5] };
      return 1; // CAP raw DML often returns an affected-row count.
    }
    if (/^SELECT /i.test(sql)) return [row];
    throw Error('unexpected sql');
  } };
  const repo = new UserRepository(async () => db);
  const profile = await repo.createFromAdministrativeIas(raw);
  assert.equal(profile.IAS_ID, IAS_ID);
  assert.equal(profile.EMAIL, 'test@example.com');
  assert.equal(profile.FNAME, 'Mawani');
  assert.equal(profile.LNAME, 'Test');
  assert.equal(profile.ACTIVE_STATUS, true);
  assert.equal(profile.ACCOUNT_TYPE, 'PORTAL_USER');
  assert.match(events[0].sql, /"IAS_ISSUER", "IAS_SUBJECT"/);
  assert.match(events[0].sql, /VALUES \(\$1::uuid, \$2, NULL, NULL/);
  assert.match(events[0].sql, /'PORTAL_USER', \$6::boolean/);
  assert.deepEqual(events[0].params.slice(1), [IAS_ID, 'test@example.com', 'Mawani', 'Test', true]);
  assert.equal(events.length, 2);
});

test('inactive SCIM account is represented as an inactive PostgreSQL record, never auto-activated', async () => {
  const db = { run: async (sql, params) => /^INSERT /i.test(sql)
    ? (db.insertParams = params, 1)
    : [{ UUID: db.insertParams[0], IAS_ID, IAS_ISSUER: null, IAS_SUBJECT: null,
      ACCOUNT_TYPE: 'PORTAL_USER', ACTIVE_STATUS: false }] };
  const repo = new UserRepository(async () => db);
  const result = await repo.createFromAdministrativeIas({ ...raw, active: false });
  assert.equal(result.ACTIVE_STATUS, false);
  assert.equal(db.insertParams[5], false);
});

test('SCIM user missing boolean active flag is not inserted in PostgreSQL', async () => {
  const repo = new UserRepository(async () => ({ run: async () => { throw Error('should not run'); } }));
  await assert.rejects(() => repo.createFromAdministrativeIas({ ...raw, active: undefined }),
    err => err.status === 502);
});

test('CAP CDS action contracts expose reconciliation action and portal linkage in IAS creation response', () => {
  const cds = fs.readFileSync(require('node:path').join(__dirname, '../srv/admin-service.cds'), 'utf8');
  assert.match(cds, /action createIasUser\(/);
  assert.match(cds, /action syncIasUserToPortal\(id: String\) returns PortalSyncResult/);
  assert.match(cds, /portalUserUuid\s*:\s*UUID/);
  assert.match(cds, /portalCreated\s*:\s*Boolean/);
  const service = fs.readFileSync(require('node:path').join(__dirname, '../srv/admin-service.js'), 'utf8');
  assert.match(service, /syncIasUserToPortal: \(data, req\) => ias\.syncIasUserToPortal\(data, req\)/);
  assert.match(service, /await guard\.authorize\(req\)/);
  assert.doesNotMatch(service, /provisioning\.ensure\(req\)/);
});

test('existing disabled portal profile stays disabled during an administrative sync', async () => {
  const previous = { UUID: DB_ID, IAS_ID, ACTIVE_STATUS: false, ACCOUNT_TYPE: 'PORTAL_USER',
    IAS_ISSUER: null, IAS_SUBJECT: null };
  const { controller, events, getRow } = fixture({ initial: previous });
  const result = await controller.syncIasUserToPortal({ id: IAS_ID }, {});
  assert.equal(result.created, false);
  assert.strictEqual(result.profile, previous);
  assert.equal(getRow().ACTIVE_STATUS, false);
  assert.ok(!events.includes('insert'));
});

test('IAS user created but subsequent SCIM read failed is reported as pending, not as failed IAS creation', async () => {
  const { controller, events, ias } = fixture();
  ias.getRawUser = async () => { events.push('ias-get'); throw Error('temporary IAS read failure'); };
  await assert.rejects(() => controller.createIasUser({}, {}),
    err => err.status === 503 && err.code === 'IAS_PORTAL_SYNC_PENDING');
  assert.deepEqual(events, ['ias-create', 'ias-get', 'uncertain:IAS_USER_CREATE_PROFILE_PENDING']);
});
