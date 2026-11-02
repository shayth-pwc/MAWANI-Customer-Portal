'use strict';
const { AppError } = require('../utils/errors');

/**
 * Decode ONLY an already verified token from CAP/@sap/xssec's authInfo.
 * Never decode a raw Authorization header and treat it as authenticated.
 */
function trustedIdentity(req) {
  if (!req.user || !req.user.is?.('authenticated-user'))
    throw new AppError(401, 'IAS authentication required');

  const jwt = req.user.authInfo?.token?.jwt;
  if (typeof jwt !== 'string') throw new AppError(403, 'Validated IAS token information unavailable');
  let claims;
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw new AppError(403, 'Unable to resolve verified IAS identity'); }
  if (typeof claims.iss !== 'string' || !claims.iss.startsWith('https://') ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub !== req.user.id)
    throw new AppError(403, 'Verified IAS issuer and subject are required');
  // Cryptographic validation, audience and token trust are supplied by CAP IAS middleware.
  return { issuer: claims.iss, subject: claims.sub };
}
/**
 * SAP IAS may send user_uuid in its validated user token. This maps to the
 * Global User ID / SCIM ID; 'sub' is not assumed to have the same value.
 */
function trustedGlobalUserId(req) {
  trustedIdentity(req);
  const jwt = req.user.authInfo.token.jwt;
  let claims;
  try { claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')); }
  catch { throw new AppError(403, 'Unable to resolve IAS Global User ID'); }
  return typeof claims.user_uuid === 'string' &&
    /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(claims.user_uuid)
    ? claims.user_uuid : null;
}
module.exports = { trustedIdentity, trustedGlobalUserId };
