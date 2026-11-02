'use strict';
/*
 * SAFE, READ-ONLY deployed-CF diagnostics for v0.7.x profile auto-provisioning.
 * No INSERT/UPDATE/DELETE, identity output, bearer token, secret, SQL text or PII.
 * The lock is transaction-scoped and uses a dedicated non-personal diagnostic key.
 */
const cds = require('@sap/cds');
const IasClient = require('../srv/core/clients/ias.client');
const { safeProvisioningDiagnostic } = require('../srv/core/utils/errors');

async function run() {
  let failures = 0;
  let db;
  try {
    db = await cds.connect.to('db');
    console.log('PASS db-connect');
  } catch (error) {
    error.provisioningStage = 'database-connect';
    console.error(`FAIL db-connect (${safeProvisioningDiagnostic(error)})`);
    process.exitCode = 1;
    return;
  }

  try {
    const rows = await db.run(`SELECT
      COUNT(*)::integer AS user_count,
      has_table_privilege(current_user, 'public."BTP_TBL_USERS"', 'SELECT') AS can_read,
      has_table_privilege(current_user, 'public."BTP_TBL_USERS"', 'INSERT') AS can_insert_user,
      has_table_privilege(current_user, 'public."BTP_TBL_USERS"', 'UPDATE') AS can_update_user,
      has_table_privilege(current_user, 'public."BTP_TBL_AUDIT_LOG"', 'INSERT') AS can_insert_audit
      FROM public."BTP_TBL_USERS"`);
    const row = rows?.[0];
    if (!row || !row.can_read || !row.can_insert_user || !row.can_update_user || !row.can_insert_audit)
      throw new Error('Required table privilege is missing');
    console.log('PASS db-read-and-table-privileges');
  } catch (error) {
    error.provisioningStage = 'lookup-by-token-identity';
    console.error(`FAIL db-read-and-table-privileges (${safeProvisioningDiagnostic(error)})`);
    failures++;
  }

  try {
    await db.tx(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0::bigint))',
        ['MAWANI_PORTAL_DIAGNOSTIC_NONUSER_KEY']);
      const rows = await tx.run('SELECT COUNT(*)::integer AS count FROM public."BTP_TBL_USERS"');
      if (!Array.isArray(rows) || !rows[0] || typeof rows[0].count !== 'number')
        throw new TypeError('Unexpected raw-query result');
    });
    console.log('PASS transaction-lock-and-select');
  } catch (error) {
    error.provisioningStage = 'advisory-lock';
    console.error(`FAIL transaction-lock-and-select (${safeProvisioningDiagnostic(error)})`);
    failures++;
  }

  try {
    const ias = new IasClient();
    const list = await ias.request('GET', '/Users?startIndex=1&count=20');
    const candidate = list?.Resources?.find(user =>
      typeof user?.id === 'string' && /^[0-9a-fA-F-]{36}$/.test(user.id) && user.active === true);
    if (!candidate) throw new Error('No active IAS user in first page for read-only check');
    const detail = await ias.request('GET', `/Users/${encodeURIComponent(candidate.id)}`);
    if (detail?.id !== candidate.id || detail.active !== true) throw new Error('IAS SCIM detail mismatch');
    console.log('PASS scim-user-detail');
  } catch (error) {
    error.provisioningStage = 'scim-user-lookup';
    console.error(`FAIL scim-user-detail (${safeProvisioningDiagnostic(error)})`);
    failures++;
  }

  if (failures) process.exitCode = 1;
  else console.log('All read-only provisioning diagnostics passed. Live INSERT/audit remain unverified.');
}
run().catch(error => {
  console.error(`FAIL diagnostics (${safeProvisioningDiagnostic(error)})`);
  process.exitCode = 1;
});
