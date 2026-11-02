'use strict';
// Read-only verification for the first-login portal registration flow.
// Displays counts only; never prints IAM identities, user PII or credentials.
const cds = require('@sap/cds');
async function main() {
  const db = await cds.connect.to('db');
  const [rows, linked, actions] = await Promise.all([
    db.run('SELECT COUNT(*)::integer AS count FROM public."BTP_TBL_USERS"'),
    db.run(`SELECT COUNT(*)::integer AS count FROM public."BTP_TBL_USERS"
      WHERE "IAS_ID" IS NOT NULL AND "IAS_ISSUER" IS NOT NULL
        AND "IAS_SUBJECT" IS NOT NULL`),
    db.run(`SELECT "ACTION" AS action, COUNT(*)::integer AS count
      FROM public."BTP_TBL_AUDIT_LOG"
      WHERE "ACTION" IN ('PORTAL_USER_AUTO_CREATE', 'PORTAL_USER_IDENTITY_LINK')
      GROUP BY "ACTION" ORDER BY "ACTION"`)
  ]);
  console.log(JSON.stringify({
    portalUserCount: rows[0]?.count,
    verifiedIdentityLinkCount: linked[0]?.count,
    provisioningAuditActions: Object.fromEntries(actions.map(x => [x.action, x.count]))
  }, null, 2));
}
main().catch(err => {
  console.error(`Read-only provisioning check failed (dbCode=${err.code || 'unknown'})`);
  process.exitCode = 1;
});
