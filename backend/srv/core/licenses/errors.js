'use strict';

class LicenseError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'LicenseError';
    this.code = code;
    this.status = status;
  }
}

function required(value, name, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new LicenseError('INVALID_INPUT', `${name} is required (max ${max} characters)`, 400);
  }
  return value.trim();
}

function safeCode(value, name = 'code') {
  const code = required(value, name, 32);
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new LicenseError('INVALID_INPUT', `${name} contains invalid characters`, 400);
  }
  return code;
}

function odataString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = { LicenseError, required, safeCode, odataString };
