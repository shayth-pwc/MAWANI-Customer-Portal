'use strict';
const cds = require('@sap/cds');
const { randomUUID } = require('node:crypto');
const AuditRepository = require('../repositories/audit.repository');
const { AppError } = require('../utils/errors');
const LOG = cds.log('mawani-audit');

class AuditService {
  constructor(repository = new AuditRepository()) { this.repository = repository; }
  context(req) {
    const actor = req.mawaniActor;
    return {
      userUuid: actor?.UUID || null,
      pernr: actor?.PERNR || null,
      correlationId: req.mawaniCorrelationId ||= randomUUID()
    };
  }
  async record(req, action, entityName, entityId, status, description, tx) {
    const identity = req.mawaniIdentity;
    const auditDescription = identity && !req.mawaniActor?.UUID
      ? `${description || ''} [IAS Global User ID: ${identity.globalUserId}; Issuer: ${identity.issuer}; Subject: ${identity.subject}]`
      : description;
    return this.repository.create({
      ...this.context(req), action, entityName, entityId, status, description: auditDescription
    }, tx);
  }
  async afterExternalWrite(req, action, entityId, description) {
    try {
      await this.record(req, action, 'IAS_USER', entityId, 'SUCCESS', description);
    } catch (err) {
      // A remote IAS change cannot be rolled back by a database transaction.
      LOG.error(`IAS operation completed, audit insert failed (dbCode=${err.code || 'unknown'}); verify IAS state.`);
      throw new AppError(503,
        'IAS operation may have succeeded; audit storage failed. Verify IAS state before retrying',
        'IAS_RESULT_UNCERTAIN');
    }
  }
  async uncertain(req, action, entityName, entityId) {
    try {
      await this.record(req, action, entityName, entityId, 'UNCERTAIN',
        'Provider operation may have completed; confirm its state');
    } catch (err) { LOG.error(`Unable to record uncertain operation (dbCode=${err.code || 'unknown'})`); }
  }
  async failure(req, action, entityName, entityId) {
    try {
      await this.record(req, action, entityName, entityId, 'FAILURE', 'Requested operation was unsuccessful');
    } catch (err) {
      LOG.error(`Unable to record failed operation in audit log (dbCode=${err.code || 'unknown'})`);
    }
  }
}
module.exports = AuditService;
