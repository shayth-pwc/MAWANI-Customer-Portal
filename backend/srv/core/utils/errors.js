'use strict';

class AppError extends Error {
  constructor(status, message, code = 'APPLICATION_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

function safeError(error) {
  if (error instanceof AppError) return error;
  // Never expose database SQL, IAS response payloads, credentials, or stack traces to clients.
  return new AppError(500, 'Internal operation failed', 'INTERNAL_ERROR');
}

// Structured diagnostics only: no raw error message, stack, SQL text, IDs or secrets.
// The real failure can be located by its stage, exception class and SQLSTATE.
function safeProvisioningDiagnostic(error) {
  const stages = new Set([
    'verified-identity', 'scim-user-lookup', 'database-connect',
    'database-transaction', 'database-commit', 'advisory-lock', 'lookup-by-token-identity',
    'lookup-by-ias-id', 'link-existing-profile', 'audit-identity-link',
    'insert-new-profile', 'audit-profile-create'
  ]);
  const types = new Set(['AppError', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'Error', 'AggregateError']);
  const stage = stages.has(error?.provisioningStage) ? error.provisioningStage : 'unclassified';
  const type = types.has(error?.name) ? error.name : 'OtherError';
  const rawCode = error?.code || error?.cause?.code;
  const code = typeof rawCode === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(rawCode)
    ? rawCode : 'unknown';
  // Pattern classification provides extra detail without logging any message text.
  const message = typeof error?.message === 'string' ? error.message : '';
  let category = 'unspecified';
  if (/Pool resource could not be acquired|resource request timed out|Timeout acquiring a connection/i.test(message))
    category = 'pool-timeout';
  else if (/Cannot read propert(?:y|ies) of (?:undefined|null)/i.test(message))
    category = 'missing-value';
  else if (/\btransaction\b.{0,40}\b(?:closed|committed|rolled back)\b/i.test(message))
    category = 'transaction-state';
  else if (/Profile insert did not return a UUID/i.test(message))
    category = 'unexpected-insert-result';
  else if (/Inserted portal profile read-back mismatch|Manually inserted portal profile read-back mismatch/i.test(message))
    category = 'insert-readback-mismatch';
  return `stage=${stage}, type=${type}, code=${code}, category=${category}`;
}

module.exports = { AppError, safeError, safeProvisioningDiagnostic };
