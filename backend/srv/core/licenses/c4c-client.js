'use strict';
const { LicenseError, required, odataString } = require('./errors');
const DESTINATION = 'C4C_DES';
// BTP Destination URL already ends with /sap/c4c/odata/v1/.
const ROOT = '/c4codataapi/';
const PAGE_SIZE = 100;

function createC4cClient({ executeHttpRequest }) {
  if (typeof executeHttpRequest !== 'function') throw new TypeError('SAP Cloud SDK HTTP request function is required');

  async function get(path, accept = 'application/json') {
    try {
      return await executeHttpRequest(
        { destinationName: DESTINATION },
        { method: 'GET', url: ROOT + path, headers: { Accept: accept }, timeout: 20000 },
        { fetchCsrfToken: false }
      );
    } catch (error) {
      const status = Number(error?.response?.status);
      // No downstream body, destination credentials, request URL, or tokens returned.
      throw new LicenseError('C4C_READ_FAILED',
        `C4C read request failed${[400,401,403,404,429,500,502,503].includes(status) ? ` (HTTP ${status})` : ''}`,
        503);
    }
  }

  async function requestMetadata() {
    try {
      const response = await get('$metadata', 'application/xml, text/xml');
      if (response?.status !== 200 || typeof response.data !== 'string' ||
          !/(?:Edmx|edmx:Edmx|EntityContainer)/.test(response.data)) {
        throw new Error('Unexpected metadata');
      }
      return { connected: true, destination: DESTINATION, status: 'METADATA_REACHABLE' };
    } catch (_) {
      throw new LicenseError('C4C_UNAVAILABLE', 'C4C destination check failed; inspect Cloud Foundry logs and destination configuration', 503);
    }
  }

  async function listCollection(entity, filter, orderBy = '') {
    if (!['CorporateAccountCollection', 'SalesQuoteCollection'].includes(entity)) {
      throw new TypeError('Unsupported C4C entity');
    }
    const rows = [];
    const seenPages = new Set();
    let page = 0;
    let paging = '';
    while (true) {
      if (++page > 10) {
        throw new LicenseError('C4C_TOO_MANY_PAGES', 'C4C read exceeds the safe page limit', 503);
      }
      // Always retain the original authorized server-side $filter on every page.
      const uri = `${entity}?$filter=${encodeURIComponent(filter)}` +
        `${orderBy ? `&$orderby=${encodeURIComponent(orderBy)}` : ''}&$top=${PAGE_SIZE}&$format=json${paging}`;
      const response = await get(uri);
      const data = response?.data?.d ?? response?.data;
      const batch = data?.results ?? data?.value;
      if (response?.status !== 200 || !Array.isArray(batch)) {
        throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C OData response', 503);
      }
      rows.push(...batch);
      const next = data?.__next ?? data?.['@odata.nextLink'];
      if (!next) return rows;
      let token;
      let skip;
      try {
        const url = new URL(next, 'https://c4c.invalid');
        token = url.searchParams.get('$skiptoken');
        skip = url.searchParams.get('$skip');
      } catch (_) {
        throw new LicenseError('C4C_INVALID_PAGE', 'Invalid C4C paging marker', 503);
      }
      // Never trust a next-link URL or host from C4C; use only a pagination marker.
      if (token) paging = `&$skiptoken=${encodeURIComponent(token)}`;
      else if (skip && /^[0-9]{1,6}$/.test(skip)) paging = `&$skip=${skip}`;
      else throw new LicenseError('C4C_INVALID_PAGE', 'Unsupported C4C paging marker', 503);
      if (seenPages.has(paging)) {
        throw new LicenseError('C4C_PAGING_LOOP', 'Repeated C4C paging marker', 503);
      }
      seenPages.add(paging);
    }
  }

  async function findAccountsForCr(cr) {
    const crNumber = required(cr.CR_NUMBER, 'CR number', 32);
    const national = required(cr.CR_NATIONAL_NUMBER, 'CR national number', 32);
    const filter = `CRNationalNumber_KUT eq ${odataString(national)} and ` +
      `CommercialRegisterNumber_KUT eq ${odataString(crNumber)}`;
    const accounts = await listCollection('CorporateAccountCollection', filter);
    // Always check remote result scope, even if a provider ignored its $filter.
    if (accounts.some(row => row?.CRNationalNumber_KUT !== national ||
        row?.CommercialRegisterNumber_KUT !== crNumber ||
        typeof row.AccountID !== 'string' || !row.AccountID)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected corporate account returned by C4C', 503);
    }
    return accounts;
  }

  async function findQuotesForAccount(accountID, orderBy = '') {
    const account = required(accountID, 'C4C account ID', 80);
    const quotes = await listCollection('SalesQuoteCollection',
      `BuyerPartyID eq ${odataString(account)}`, orderBy);
    if (quotes.some(row => row?.BuyerPartyID !== account)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected sales quote returned by C4C', 503);
    }
    return quotes;
  }

  async function salesQuoteAttachments(objectId) {
    const id = required(objectId, 'C4C Sales Quote object ID', 120);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new LicenseError('INVALID_INPUT', 'C4C Sales Quote object ID contains invalid characters', 400);
    }
    const response = await get(`SalesQuoteCollection('${id}')/SalesQuoteAttachmentFolder?$format=json`);
    const data = response?.data?.d ?? response?.data;
    const rows = data?.results ?? data?.value;
    if (response?.status !== 200 || !Array.isArray(rows)) {
      throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C attachment response', 503);
    }
    return rows;
  }

  return { requestMetadata, findAccountsForCr, findQuotesForAccount, salesQuoteAttachments };
}
module.exports = { createC4cClient, DESTINATION, ROOT };
