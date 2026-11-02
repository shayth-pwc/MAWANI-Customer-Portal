'use strict';
/**
 * Read-only audit summary for one IAS test user. Run in Cloud Foundry as a
 * task with the existing PostgreSQL service binding. No PII or IDs printed.
 * Example: node scripts/admin-audit-verify.js <IAS_UUID>
 */
const cds = require('@sap/cds');
const { uuid } = require('../srv/core/utils/validation');
async function main() {
  const iasId = uuid(process.argv[2] || process.env.MAWANI_QA_IAS_ID);
  const db = await cds.connect.to('db');
  const users = await db.run('SELECT "UUID" FROM public."BTP_TBL_USERS" WHERE "IAS_ID" = $1 LIMIT 2', [iasId]);
  if (users.length !== 1) throw Error(`Expected one portal profile; count=${users.length}`);
  const rows = await db.run(`SELECT "ACTION" AS action, "ACTION_STATUS" AS status,
    COUNT(*)::integer AS count FROM public."BTP_TBL_AUDIT_LOG"
    WHERE "ENTITY_ID" = $1 OR "ENTITY_ID" = $2
    GROUP BY "ACTION", "ACTION_STATUS" ORDER BY "ACTION", "ACTION_STATUS"`,
    [iasId, users[0].UUID]);
  console.log(JSON.stringify({
    testPortalProfileExists: true,
    auditByActionAndStatus: rows.map(r => ({action:r.action, status:r.status, count:r.count})),
    checkedActions: ['IAS_USER_CREATE', 'PORTAL_USER_ADMIN_CREATE',
      'IAS_USER_UPDATE', 'IAS_USER_STATUS', 'PORTAL_USER_IAS_SYNC',
      'IAS_USER_RECONCILE', 'PORTAL_USER_UPDATE']
  },null,2));
}
main().catch(err => {
  console.error(`Read-only admin audit check failed (code=${/^[A-Z0-9_]{1,20}$/.test(err.code) ? err.code : 'unknown'})`);
  process.exitCode = 1;
});
