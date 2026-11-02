'use strict';
const { AppError } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new AppError(400, 'Invalid user UUID');
  return value;
}
function text(value, name, { max = 255, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new AppError(400, `${name} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new AppError(400, `Invalid ${name}`);
  }
  return value.trim();
}
function boolean(value, name) {
  if (typeof value !== 'boolean') throw new AppError(400, `${name} must be boolean`);
  return value;
}
function int(value, name, fallback, min, max) {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < min || num > max) throw new AppError(400, `Invalid ${name}`);
  return num;
}
function email(value) {
  const val = text(value, 'email', { max: 254, required: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) throw new AppError(400, 'Invalid email');
  return val;
}
module.exports = { uuid, text, boolean, int, email };
