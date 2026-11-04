'use strict';
// Validation ONLY. Definitions and items are owned by the existing ListService.
// This module never queries or creates a license-specific list table.
const { LicenseError } = require('./errors');

const LIST_APP = 'PORTAL';
const LIST_CODES = Object.freeze([
  'INVESTOR_TYPE', 'SERVICE_TYPE', 'LICENSE_TYPE',
  'PORT_FOR_PERMIT', 'ACTIVITY_TYPE', 'APPLICANT_DOCUMENT_TYPE'
]);
const LIST_CODE_SET = new Set(LIST_CODES);

function parseDefinition(raw, requestedCode, app = LIST_APP) {
  let definition = raw;
  if (typeof definition === 'string') {
    try { definition = JSON.parse(definition); }
    catch (_) { throw new LicenseError('LIST_UNAVAILABLE', 'Invalid list service response', 503); }
  }
  // CAP local calls normally return Definition directly. Some wrappers return {value: Definition}.
  if (definition?.value && !Array.isArray(definition.value)) definition = definition.value;
  if (!definition || !Array.isArray(definition.items)) {
    throw new LicenseError('LIST_UNAVAILABLE', `Dynamic list ${requestedCode} is unavailable`, 503);
  }
  if ((definition.code && definition.code !== requestedCode) ||
      (definition.app && definition.app !== app)) {
    throw new LicenseError('LIST_UNAVAILABLE', `Unexpected dynamic list ${requestedCode}`, 503);
  }
  return definition;
}

function enabledKeys(definition) {
  const keys = new Set();
  if (definition.active === false) return keys;
  function visit(items) {
    for (const item of items) {
      if (!item || item.active === false) continue;
      if (typeof item.key === 'string' && item.key.trim()) keys.add(item.key);
      if (Array.isArray(item.subItems)) visit(item.subItems);
    }
  }
  visit(definition.items);
  return keys;
}

function createExistingListValidator({ loadList, app = LIST_APP }) {
  if (typeof loadList !== 'function') throw new TypeError('loadList must invoke the existing ListService');
  async function validateSubmission(input, operation = 'NEW') {
    // Old renewal codes might no longer be selectable in current admin lists.
    if (operation !== 'NEW') return;
    for (const code of input.licenseTypes || []) {
      if (['ZSA001', 'ZMA001', 'ZSA002'].includes(code)) {
        throw new LicenseError('EXTERNAL_OR_EXCLUDED_LICENSE', 'This license type cannot be submitted here', 400);
      }
    }
    const checks = [
      ['LICENSE_TYPE', input.licenseTypes || []],
      ['INVESTOR_TYPE', [input.investorType]],
      ['SERVICE_TYPE', [input.serviceType]],
      ['APPLICANT_DOCUMENT_TYPE', [input.applicant?.documentType]]
    ];
    if (input.serviceType === '111') checks.push(['PORT_FOR_PERMIT', [input.portCode]]);
    if ((input.licenseTypes || []).includes('ZSA013') && input.activityType) {
      checks.push(['ACTIVITY_TYPE', [input.activityType]]);
    }
    for (const [code, values] of checks) {
      if (!LIST_CODE_SET.has(code)) throw new LicenseError('UNKNOWN_LIST', 'Unsupported license list', 400);
      const definition = parseDefinition(await loadList(code, app), code, app);
      const allowed = enabledKeys(definition);
      if (allowed.size === 0) throw new LicenseError('LIST_NOT_READY', `Admin list ${code} is empty or inactive`, 503);
      for (const value of values) {
        if (typeof value !== 'string' || !allowed.has(value)) {
          throw new LicenseError('INVALID_SELECTION', `Invalid ${code} selection`, 400);
        }
      }
    }
  }
  return { validateSubmission };
}

module.exports = { LIST_APP, LIST_CODES, parseDefinition, enabledKeys, createExistingListValidator };
