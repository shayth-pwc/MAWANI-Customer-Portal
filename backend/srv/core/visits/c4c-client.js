'use strict';

const { LicenseError, odataString, required } = require('../licenses/errors');
const { DESTINATION, ROOT } = require('../licenses/c4c-client');

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const ACCOUNT_BATCH_SIZE = 50;

function values(response) {
  const data = response?.data?.d ?? response?.data;
  return { data, rows: data?.results ?? data?.value };
}

function safeObjectId(value) {
  const id = required(value, 'C4C object ID', 120);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new LicenseError('INVALID_INPUT', 'C4C object ID contains invalid characters', 400);
  return id;
}

function createVisitsC4cClient({ executeHttpRequest }) {
  if (typeof executeHttpRequest !== 'function') throw new TypeError('SAP Cloud SDK HTTP request function is required');

  async function request(request) {
    try {
      return await executeHttpRequest({ destinationName: DESTINATION }, request, { fetchCsrfToken: false });
    } catch (error) {
      const status = Number(error?.response?.status);
      const suffix = [400, 401, 403, 404, 429, 500, 502, 503].includes(status) ? ` (HTTP ${status})` : '';
      throw new LicenseError('C4C_VISITS_FAILED', `C4C visits request failed${suffix}`, 503);
    }
  }

  async function list(collection, filter, orderBy = '') {
    const result = [];
    const seen = new Set();
    let page = 0;
    let paging = '';
    while (true) {
      if (++page > MAX_PAGES) throw new LicenseError('C4C_TOO_MANY_PAGES', 'C4C read exceeds the safe page limit', 503);
      const url = `${ROOT}${collection}?$filter=${encodeURIComponent(filter)}${orderBy ? `&$orderby=${encodeURIComponent(orderBy)}` : ''}&$top=${PAGE_SIZE}&$format=json${paging}`;
      const response = await request({ method: 'GET', url, timeout: 20000, headers: { Accept: 'application/json' } });
      const payload = values(response);
      if (response?.status !== 200 || !Array.isArray(payload.rows)) {
        throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C OData response', 503);
      }
      result.push(...payload.rows);
      const next = payload.data?.__next ?? payload.data?.['@odata.nextLink'];
      if (!next) return result;
      let marker = '';
      try {
        const nextUrl = new URL(next, 'https://c4c.invalid');
        const token = nextUrl.searchParams.get('$skiptoken');
        const skip = nextUrl.searchParams.get('$skip');
        marker = token ? `&$skiptoken=${encodeURIComponent(token)}` : (skip && /^[0-9]{1,6}$/.test(skip) ? `&$skip=${skip}` : '');
      } catch (_) { /* rejected below */ }
      if (!marker) throw new LicenseError('C4C_INVALID_PAGE', 'Unsupported C4C paging marker', 503);
      if (seen.has(marker)) throw new LicenseError('C4C_PAGING_LOOP', 'Repeated C4C paging marker', 503);
      seen.add(marker);
      paging = marker;
    }
  }

  async function accountsForCr(crNationalNumber) {
    const national = required(crNationalNumber, 'CR national number', 40);
    const rows = await list('CorporateAccountCollection', `CRNationalNumber_KUT eq ${odataString(national)}`);
    if (rows.some(row => row?.CRNationalNumber_KUT !== national || typeof row?.AccountID !== 'string' || !row.AccountID)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected corporate account returned by C4C', 503);
    }
    return rows;
  }

  async function visitsForAccounts(accountIds) {
    const accounts = [...new Set(accountIds.map(value => required(value, 'C4C account ID', 80)))];
    const visits = [];
    for (let start = 0; start < accounts.length; start += ACCOUNT_BATCH_SIZE) {
      const batch = accounts.slice(start, start + ACCOUNT_BATCH_SIZE);
      const filter = `Status eq '3' and (${batch.map(id => `MainAccountPartyID eq ${odataString(id)}`).join(' or ')})`;
      const rows = await list('VisitCollection', filter, 'ID asc');
      const allowed = new Set(batch);
      if (rows.some(row => String(row?.Status) !== '3' || !allowed.has(String(row?.MainAccountPartyID || '')))) {
        throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected visit returned by C4C', 503);
      }
      visits.push(...rows);
    }
    return visits;
  }

  async function visitById(visitId) {
    const id = required(visitId, 'Visit ID', 80);
    const rows = await list('VisitCollection', `ID eq ${odataString(id)}`, 'ID asc');
    if (rows.some(row => String(row?.ID || '') !== id)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected visit returned by C4C', 503);
    }
    return rows;
  }

  async function attachments(objectId) {
    const id = safeObjectId(objectId);
    const response = await request({ method: 'GET', url: `${ROOT}VisitCollection('${id}')/VisitAttachment?$format=json`, timeout: 20000, headers: { Accept: 'application/json' } });
    const payload = values(response);
    if (response?.status !== 200 || !Array.isArray(payload.rows)) {
      throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C attachment response', 503);
    }
    return payload.rows;
  }

  return { accountsForCr, visitsForAccounts, visitById, attachments };
}

module.exports = { createVisitsC4cClient };
