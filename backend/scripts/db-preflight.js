'use strict';
// Non-destructive verification of Cloud Foundry-bound PostgreSQL role and privileges.
const cds = require('@sap/cds');
async function main() {
  const db = await cds.connect.to('db');
  const [identity, users, audits, grants] = await Promise.all([
    db.run('SELECT current_user AS db_user, current_database() AS db_name'),
    db.run('SELECT COUNT(*)::integer AS count FROM public."BTP_TBL_USERS"'),
    db.run('SELECT COUNT(*)::integer AS count FROM public."BTP_TBL_AUDIT_LOG"'),
    db.run(`SELECT
       has_table_privilege(current_user,'public."BTP_TBL_USERS"','SELECT') AS users_select,
       has_table_privilege(current_user,'public."BTP_TBL_USERS"','INSERT') AS users_insert,
       has_table_privilege(current_user,'public."BTP_TBL_USERS"','UPDATE') AS users_update,
       has_table_privilege(current_user,'public."BTP_TBL_AUDIT_LOG"','INSERT') AS audit_insert`)
  ]);
  console.log(JSON.stringify({
    databaseRole: identity[0]?.db_user,
    database: identity[0]?.db_name,
    usersTableCount: users[0]?.count,
    auditTableCount: audits[0]?.count,
    privileges: grants[0]
  }, null, 2));
  const g = grants[0] || {};
  if (['users_select','users_insert','users_update','audit_insert'].some(key => g[key] !== true)) {
    console.error('Missing one or more required table privileges for this backend.');
    process.exitCode = 2;
  }
}
main().catch(error => {
  console.error('Database read-only check failed:', error.message);
  process.exitCode = 1;
});
