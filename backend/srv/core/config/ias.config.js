'use strict';
const { AppError } = require('../utils/errors');
function httpsUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new AppError(500, `${label} not configured`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new AppError(500, `${label} must be an HTTPS URL`);
  return url.href.replace(/\/$/, '');
}
function getIasConfig(env = process.env) {
  const authMode = env.IAS_SCIM_AUTH_MODE || 'basic';
  if (!['basic', 'oauth2'].includes(authMode)) throw new AppError(500, 'Invalid IAS_SCIM_AUTH_MODE');
  if (!env.IAS_SCIM_CLIENT_ID || !env.IAS_SCIM_CLIENT_SECRET)
    throw new AppError(500, 'IAS technical user credentials are not configured');
  const timeoutMs = Number(env.IAS_SCIM_TIMEOUT_MS || 10000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
    throw new AppError(500, 'Invalid IAS timeout');
  return {
    baseUrl: httpsUrl(env.IAS_SCIM_BASE_URL, 'IAS_SCIM_BASE_URL'),
    tokenUrl: authMode === 'oauth2' ? httpsUrl(env.IAS_SCIM_TOKEN_URL, 'IAS_SCIM_TOKEN_URL') : null,
    authMode,
    clientId: env.IAS_SCIM_CLIENT_ID,
    clientSecret: env.IAS_SCIM_CLIENT_SECRET,
    timeoutMs
  };
}
module.exports = { getIasConfig };
