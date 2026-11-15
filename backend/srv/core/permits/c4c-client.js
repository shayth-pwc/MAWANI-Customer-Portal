'use strict';

const { LicenseError, odataString, required } = require('../licenses/errors');
const { DESTINATION, ROOT } = require('../licenses/c4c-client');
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function unpack(response) {
  const data = response?.data?.d ?? response?.data;
  return { data, rows: data?.results ?? data?.value };
}

function safeObjectId(value, label) {
  const id = required(value, label, 120);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new LicenseError('INVALID_INPUT', `${label} contains invalid characters`, 400);
  return id;
}

function createPermitsC4cClient({ executeHttpRequest }) {
  if (typeof executeHttpRequest !== 'function') throw new TypeError('SAP Cloud SDK HTTP request function is required');
  async function request(options, csrf = false) {
    try { return await executeHttpRequest({ destinationName: DESTINATION }, options, { fetchCsrfToken: csrf }); }
    catch (error) {
      const status = Number(error?.response?.status);
      const suffix = [400, 401, 403, 404, 429, 500, 502, 503].includes(status) ? ` (HTTP ${status})` : '';
      throw new LicenseError('C4C_PERMITS_FAILED', `C4C permits request failed${suffix}`, 503);
    }
  }
  async function list(collection, filter, orderBy = '') {
    if (!['CorporateAccountCollection', 'SalesQuoteCollection', 'ServiceRequestCollection'].includes(collection)) throw new TypeError('Unsupported C4C collection');
    const result = []; const seen = new Set(); let paging = '';
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = `${ROOT}${collection}?$filter=${encodeURIComponent(filter)}${orderBy ? `&$orderby=${encodeURIComponent(orderBy)}` : ''}&$top=${PAGE_SIZE}&$format=json${paging}`;
      const response = await request({ method: 'GET', url, timeout: 20000, headers: { Accept: 'application/json' } });
      const payload = unpack(response);
      if (response?.status !== 200 || !Array.isArray(payload.rows)) throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C OData response', 503);
      result.push(...payload.rows);
      const next = payload.data?.__next ?? payload.data?.['@odata.nextLink'];
      if (!next) return result;
      let marker = '';
      try {
        const nextUrl = new URL(next, 'https://c4c.invalid');
        const token = nextUrl.searchParams.get('$skiptoken'); const skip = nextUrl.searchParams.get('$skip');
        marker = token ? `&$skiptoken=${encodeURIComponent(token)}` : (skip && /^\d{1,6}$/.test(skip) ? `&$skip=${skip}` : '');
      } catch (_) { /* rejected below */ }
      if (!marker || seen.has(marker)) throw new LicenseError('C4C_INVALID_PAGE', 'Invalid C4C paging marker', 503);
      seen.add(marker); paging = marker;
    }
    throw new LicenseError('C4C_TOO_MANY_PAGES', 'C4C read exceeds the safe page limit', 503);
  }
  async function accountsForCr(cr) {
    const national = required(cr.CR_NATIONAL_NUMBER, 'CR national number', 40);
    const number = required(cr.CR_NUMBER, 'CR number', 40);
    const rows = await list('CorporateAccountCollection', `CRNationalNumber_KUT eq ${odataString(national)} and CommercialRegisterNumber_KUT eq ${odataString(number)}`);
    if (rows.some(row => row?.CRNationalNumber_KUT !== national || row?.CommercialRegisterNumber_KUT !== number || !row?.AccountID)) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected corporate account returned by C4C', 503);
    return rows;
  }
  async function permitsForAccounts(accountIds) {
    const accounts = [...new Set(accountIds.map(id => required(id, 'C4C account ID', 80)))];
    const all = [];
    for (let index = 0; index < accounts.length; index += 50) {
      const batch = accounts.slice(index, index + 50);
      const rows = await list('ServiceRequestCollection', `(${batch.map(id => `BuyerPartyID eq ${odataString(id)}`).join(' or ')})`, 'ID desc');
      const allowed = new Set(batch);
      if (rows.some(row => !allowed.has(String(row?.BuyerPartyID || '')))) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected permit request returned by C4C', 503);
      all.push(...rows);
    }
    return all;
  }
  async function quotesForAccount(accountId) {
    const id = required(accountId, 'C4C account ID', 80);
    const rows = await list('SalesQuoteCollection', `BuyerPartyID eq ${odataString(id)}`, 'CreationDateTime desc');
    if (rows.some(row => String(row?.BuyerPartyID || '') !== id)) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected sales quote returned by C4C', 503);
    return rows;
  }
  async function salesQuoteAttachments(objectId) {
    const id = safeObjectId(objectId, 'C4C account object ID');
    const response = await request({ method: 'GET', url: `${ROOT}SalesQuoteCollection('${id}')/SalesQuoteAttachmentFolder?$format=json`, timeout: 20000, headers: { Accept: 'application/json' } });
    const payload = unpack(response);
    if (response?.status !== 200 || !Array.isArray(payload.rows)) throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C attachment response', 503);
    return payload.rows;
  }
  async function permitAttachments(objectId) {
    const id = safeObjectId(objectId, 'C4C permit object ID');
    const response = await request({ method: 'GET', url: `${ROOT}ServiceRequestCollection('${id}')/ServiceRequestAttachmentFolder?$format=json`, timeout: 20000, headers: { Accept: 'application/json' } });
    const payload = unpack(response);
    if (response?.status !== 200 || !Array.isArray(payload.rows)) throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C attachment response', 503);
    return payload.rows;
  }
  async function createPermit(payload) {
    const response = await request({ method: 'POST', url: `${ROOT}ServiceRequestCollection`, timeout: 25000, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, data: payload }, true);
    const row = unpack(response).data;
    if (![200, 201].includes(response?.status) || !row?.ID || !row?.ObjectID) throw new LicenseError('C4C_WRITE_UNCERTAIN', 'C4C permit outcome needs reconciliation before retrying', 503);
    return row;
  }
  async function addPermitAttachment(permit, attachment) {
    const response = await request({ method: 'POST', url: `${ROOT}ServiceRequestAttachmentFolderCollection`, timeout: 25000, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, data: { ParentObjectID: permit.ObjectID, ServiceRequestID: permit.ID, TypeCode: attachment.typeCode, CategoryCode: attachment.categoryCode, Name: attachment.name, Binary: attachment.contentBase64, MimeType: attachment.mimeType } }, true);
    if (![200, 201].includes(response?.status)) throw new LicenseError('C4C_WRITE_UNCERTAIN', 'C4C permit attachment outcome needs reconciliation before retrying', 503);
  }
  return { accountsForCr, permitsForAccounts, quotesForAccount, salesQuoteAttachments, permitAttachments, createPermit, addPermitAttachment };
}
module.exports = { createPermitsC4cClient };
