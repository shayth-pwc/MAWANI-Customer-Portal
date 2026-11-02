'use strict';
const cds = require('@sap/cds');
const { randomUUID } = require('node:crypto');

class AuditRepository {
  constructor(getDb = () => cds.connect.to('db')) { this.getDb = getDb; }
  async create(entry, tx) {
    const db = tx || await this.getDb();
    const rid = randomUUID();
    await db.run(`INSERT INTO public."BTP_TBL_AUDIT_LOG"
      ("RID", "USER_UUID", "PERNR", "ACTION", "ENTITY_NAME", "ENTITY_ID",
       "ACTION_DESCRIPTION", "CORRELATION_ID", "ACTION_STATUS", "CREATED_ON")
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`, [
      rid, entry.userUuid || null, entry.pernr || null, entry.action,
      entry.entityName, String(entry.entityId || '').slice(0, 255),
      entry.description || null, entry.correlationId || randomUUID(), entry.status
    ]);
    return rid;
  }
}
module.exports = AuditRepository;
