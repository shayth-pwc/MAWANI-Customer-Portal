'use strict';
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/errors');
const CR_DESTINATION = 'CR_REST_API_PROD'; const NAFATH_DESTINATION = 'Nafath';
function config(env = process.env) {
  const loginUrl = env.MAWANI_NAFATH_LOGIN_URL;
  const user = env.MAWANI_NAFATH_USERNAME; const password = env.MAWANI_NAFATH_PASSWORD;
  if (!loginUrl || !/^https:\/\//.test(loginUrl) || !user || !password) throw new AppError(503, 'Nafath registration integration is not configured');
  return { loginUrl, user, password };
}
async function crLookup(input) {
  try {
    const response = await executeHttpRequest({ destinationName: CR_DESTINATION }, { method: 'GET', url: '/GSBExpress_v5.0.7/api/moci/personrelatedcrapi/v2/personrelatedcrs', headers: { 'YeFI-Message-Id': randomUUID(), 'Custom-IdentifierTypeID': input.documentType, 'Custom-IdentifierNo': input.documentNumber, 'Custom-nationalityID': input.nationalityId, Accept: 'application/json' }, timeout: 20000 });
    const rows = response?.data?.relatedCRList || [];
    if (!Array.isArray(rows) || !rows.some(row => String(row?.crBasicInfo?.crStatus?.crStatusID) === '1')) throw new AppError(422, 'No active commercial registration is available for this identity');
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError(503, 'Commercial registration validation is unavailable'); }
}
async function nafathIdentity(tokenId, env) {
  const cfg = config(env);
  try {
    const response = await executeHttpRequest({ destinationName: NAFATH_DESTINATION }, { method: 'GET', url: `/api/v3.0/UserInformation?${new URLSearchParams({ UserName: cfg.user, Password: cfg.password, IsBrowsersAuth: 'True', TokenID: tokenId })}`, headers: { Accept: 'application/json' }, timeout: 20000 });
    if (response?.status !== 200 || !response.data?.id) throw new AppError(422, 'Nafath validation was not completed');
    return response.data;
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError(503, 'Nafath validation is unavailable'); }
}
module.exports = { config, crLookup, nafathIdentity };
