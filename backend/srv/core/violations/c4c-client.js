'use strict';

const { LicenseError, odataString, required } = require('../licenses/errors');
const { DESTINATION, ROOT } = require('../licenses/c4c-client');

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const READABLE = new Set(['CustomerOrderCollection', 'ServiceRequestCollection']);

function values(response) {
  const data = response?.data?.d ?? response?.data;
  return { data, rows: data?.results ?? data?.value };
}

function entity(response) {
  const data = response?.data?.d ?? response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Array.isArray(data.results)) return data.results.length === 1 ? data.results[0] : null;
  return data;
}

function safeObjectId(value, label) {
  const id = required(value, label, 120);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new LicenseError('INVALID_INPUT', `${label} contains invalid characters`, 400);
  }
  return id;
}

function createViolationsC4cClient({ executeHttpRequest }) {
  if (typeof executeHttpRequest !== 'function') throw new TypeError('SAP Cloud SDK HTTP request function is required');

  async function request(request, csrf = false) {
    try {
      return await executeHttpRequest({ destinationName: DESTINATION }, request, { fetchCsrfToken: csrf });
    } catch (error) {
      const status = Number(error?.response?.status);
      const suffix = [400, 401, 403, 404, 429, 500, 502, 503].includes(status) ? ` (HTTP ${status})` : '';
      throw new LicenseError('C4C_VIOLATIONS_FAILED', `C4C violations request failed${suffix}`, 503);
    }
  }

  async function list(collection, filter) {
    if (!READABLE.has(collection)) throw new TypeError('Unsupported C4C collection');
    const result = [];
    const seen = new Set();
    let page = 0;
    let paging = '';
    while (true) {
      if (++page > MAX_PAGES) throw new LicenseError('C4C_TOO_MANY_PAGES', 'C4C read exceeds the safe page limit', 503);
      const url = `${ROOT}${collection}?$filter=${encodeURIComponent(filter)}&$top=${PAGE_SIZE}&$format=json${paging}`;
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

  async function customerOrdersForCr(crNationalNumber) {
    const national = required(crNationalNumber, 'CR national number', 40);
    const rows = await list('CustomerOrderCollection', `ApprovalStatusCode eq '4' and CRNationalNumber_KUT eq ${odataString(national)}`);
    if (rows.some(row => row?.ApprovalStatusCode !== '4' || row?.CRNationalNumber_KUT !== national)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected customer order returned by C4C', 503);
    }
    return rows;
  }

  async function customerOrderById(fineId) {
    const id = required(fineId, 'Fine ID', 80);
    const rows = await list('CustomerOrderCollection', `ID eq ${odataString(id)}`);
    if (rows.some(row => String(row?.ID || '') !== id)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected customer order returned by C4C', 503);
    }
    return rows;
  }

  async function objectionsForFine(fineId) {
    const id = required(fineId, 'Fine ID', 80);
    const rows = await list('ServiceRequestCollection', `ProcessingTypeCode eq 'ZOBJ' and SalesOrderID eq ${odataString(id)}`);
    if (rows.some(row => row?.ProcessingTypeCode !== 'ZOBJ' || String(row?.SalesOrderID || '') !== id)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected objection returned by C4C', 503);
    }
    return rows;
  }

  async function attachments(collection, objectId) {
    const id = safeObjectId(objectId, 'C4C object ID');
    const suffix = collection === 'CustomerOrderCollection' ? 'CustomerOrderAttachmentFolder' :
      collection === 'ServiceRequestCollection' ? 'ServiceRequestAttachmentFolder' : null;
    if (!suffix) throw new TypeError('Unsupported attachment collection');
    const response = await request({ method: 'GET', url: `${ROOT}${collection}('${id}')/${suffix}?$format=json`, timeout: 20000, headers: { Accept: 'application/json' } });
    const payload = values(response);
    if (response?.status !== 200 || !Array.isArray(payload.rows)) {
      throw new LicenseError('C4C_BAD_RESPONSE', 'Unexpected C4C attachment response', 503);
    }
    return payload.rows;
  }

  async function createObjection(payload) {
    const response = await request({
      method: 'POST', url: `${ROOT}ServiceRequestCollection`, timeout: 25000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, data: payload
    }, true);
    const row = entity(response);
    if (![200, 201].includes(response?.status) || !row?.ID || !row?.ObjectID) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN', 'C4C objection outcome needs reconciliation before retrying', 503);
    }
    return row;
  }

  async function addObjectionAttachment(objection, attachment) {
    const response = await request({
      method: 'POST', url: `${ROOT}ServiceRequestAttachmentFolderCollection`, timeout: 25000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      data: {
        ParentObjectID: objection.ObjectID, ServiceRequestID: objection.ID,
        TypeCode: attachment.typeCode || '10001', Name: attachment.name,
        CategoryCode: attachment.categoryCode || '2', Binary: attachment.contentBase64,
        MimeType: attachment.mimeType
      }
    }, true);
    if (![200, 201].includes(response?.status)) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN', 'C4C objection attachment outcome needs reconciliation before retrying', 503);
    }
  }

  return { customerOrdersForCr, customerOrderById, objectionsForFine, attachments, createObjection, addObjectionAttachment };
}

module.exports = { createViolationsC4cClient };
