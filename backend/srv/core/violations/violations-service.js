'use strict';

const { LicenseError, required } = require('../licenses/errors');

const LIST_CODES = ['PORTS', 'FINE_STATUS', 'LICENSE_TYPE', 'FINE_TYPE', 'REQUEST_STATUS'];
const MAX_ATTACHMENT_BYTES = 1024 * 1024;

function text(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

function listMap(definition) {
  const result = new Map();
  function visit(items) {
    for (const item of items || []) {
      if (!item || item.active === false || !item.key) continue;
      result.set(String(item.key), item);
      visit(item.subItems);
    }
  }
  visit(definition?.items);
  return result;
}

function mapFine(row, lists) {
  const fine = { ...row };
  const port = lists.PORTS.get(String(row.SalesOrganisationID || ''));
  const status = lists.FINE_STATUS.get(String(row.BTP_FInestatus_KUT || ''));
  const license = lists.LICENSE_TYPE.get(String(row.Role1_KUT || ''));
  const type = lists.FINE_TYPE.get(String(row.ProcessingTypeCode || ''));
  if (port) Object.assign(fine, { PORT_TEXT: port.title || '', PORT_TEXT_AR: port.titleAr || '', PORT_UICOLORSTATUS: port.uiColor || '' });
  if (status) Object.assign(fine, { BTP_FInestatus_KUTText: status.title || '', BTP_FInestatus_KUTText_AR: status.titleAr || '', BTP_FInestatus_KUT_UICOLORSTATUS: status.uiColor || '' });
  if (license) Object.assign(fine, { Role1_KUTText: license.title || '', Role1_KUTText_AR: license.titleAr || '' });
  if (type) Object.assign(fine, { ProcessingTypeCodeText: type.title || '', ProcessingTypeCodeText_AR: type.titleAr || '', ProcessingTypeCode_UICOLORSTATUS: type.uiColor || '' });
  return fine;
}

function mapObjection(row, fine, lists) {
  const request = { ...row, Role1_KUT: fine.Role1_KUT || '', SalesOrganisationID: fine.SalesOrganisationID || '', BTP_SadadNumber: fine.SadadNumber_KUT || '' };
  const status = lists.REQUEST_STATUS.get(String(row.ServiceRequestUserLifeCycleStatusCode || ''));
  if (status) Object.assign(request, {
    ServiceRequestUserLifeCycleStatusCodeText: status.title || '',
    ServiceRequestUserLifeCycleStatusCodeText_AR: status.titleAr || '',
    ServiceRequestUserLifeCycleStatusCode_UICOLORSTATUS: status.uiColor || ''
  });
  return request;
}

function parseAttachment(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid objection attachment', 400);
  const name = required(item.name, 'Attachment name', 160);
  if (name !== name.split(/[\\/]/).pop() || name.startsWith('.') || /[\u0000-\u001f\u007f]/.test(name)) throw new LicenseError('INVALID_ATTACHMENT', 'Unsafe attachment filename', 400);
  const extension = (name.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase();
  const mimeType = text(item.mimeType, 100).toLowerCase();
  const allowed = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  if (!extension || allowed[extension] !== mimeType) throw new LicenseError('INVALID_ATTACHMENT', 'Only matching PDF, PNG and JPEG attachments are supported', 400);
  const contentBase64 = item.contentBase64;
  if (typeof contentBase64 !== 'string' || contentBase64.length < 8 || contentBase64.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid or oversized Base64 attachment', 400);
  const bytes = Buffer.from(contentBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES || bytes.toString('base64') !== contentBase64) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid or oversized attachment bytes', 400);
  const signatures = { pdf: bytes.subarray(0, 5).toString() === '%PDF-', png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), jpg: bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])), jpeg: bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) };
  if (!signatures[extension]) throw new LicenseError('INVALID_ATTACHMENT', 'Attachment content does not match its declared type', 400);
  return { name, mimeType, contentBase64, typeCode: '10001', categoryCode: '2' };
}

function parseSubmission(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 2 * 1024 * 1024) throw new LicenseError('INVALID_SUBMISSION', 'Invalid objection payload size', 400);
  let input;
  try { input = JSON.parse(raw); } catch (_) { throw new LicenseError('INVALID_SUBMISSION', 'Objection payload is not valid JSON', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LicenseError('INVALID_SUBMISSION', 'Invalid objection payload', 400);
  const attachments = input.attachments === undefined ? [] : input.attachments;
  if (!Array.isArray(attachments) || attachments.length > 5) throw new LicenseError('INVALID_SUBMISSION', 'Select up to five objection attachments', 400);
  return { fineId: required(input.fineId, 'Fine ID', 80), attachments: attachments.map(parseAttachment) };
}

function objectionExpiryIsOpen(value) {
  if (!value) return false;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

function createViolationsService({ crs, c4c, loadList }) {
  if (!crs || !c4c || typeof loadList !== 'function') throw new TypeError('Violations dependencies are required');

  async function lists() {
    // Local CAP service calls inherit the current PostgreSQL request context.
    // The pg client permits one query at a time, so concurrent ListService
    // requests can fail with "client is already executing a query".
    const result = {};
    for (const code of LIST_CODES) {
      try {
        result[code] = listMap(await loadList(code));
      } catch (_) {
        // The original XSJS implementation treated a missing parent-data row
        // as an empty lookup. These lists add translated labels and UI states;
        // they must not prevent an authorized user from seeing C4C violations.
        result[code] = new Map();
      }
    }
    return result;
  }

  async function scopedFines(userUuid) {
    let registrations;
    try { registrations = await crs.listForUser(userUuid); }
    catch (error) { error.violationsStage = 'cr-scope'; throw error; }
    const knownCrs = new Set(registrations.filter(cr => !cr.IS_TEST_DATA && cr.CR_NATIONAL_NUMBER).map(cr => String(cr.CR_NATIONAL_NUMBER)));
    const byId = new Map();
    for (const national of knownCrs) {
      let fines;
      try { fines = await c4c.customerOrdersForCr(national); }
      catch (error) { error.violationsStage = 'c4c-fines'; throw error; }
      for (const fine of fines) {
        if (!fine?.ID || fine.CRNationalNumber_KUT !== national) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected customer order returned by C4C', 503);
        byId.set(String(fine.ID), fine);
      }
    }
    return [...byId.values()];
  }

  async function getMyFines(userUuid) {
    const fines = await scopedFines(userUuid);
    if (!fines.length) return [];
    let reference;
    try { reference = await lists(); }
    catch (error) { error.violationsStage = 'reference-lists'; throw error; }
    return fines.map(fine => mapFine(fine, reference));
  }

  async function getFineById(userUuid, fineId) {
    const id = required(fineId, 'Fine ID', 80);
    const registrations = await crs.listForUser(userUuid);
    const allowed = new Set(registrations.filter(cr => !cr.IS_TEST_DATA && cr.CR_NATIONAL_NUMBER).map(cr => String(cr.CR_NATIONAL_NUMBER)));
    const rows = await c4c.customerOrderById(id);
    const scoped = rows.filter(row => row.ApprovalStatusCode === '4' && allowed.has(String(row.CRNationalNumber_KUT || '')));
    if (!scoped.length) return [];
    if (scoped.length !== 1) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Ambiguous customer order returned by C4C', 503);
    return [mapFine(scoped[0], await lists())];
  }

  async function ownedFine(userUuid, fineId) {
    const rows = await getFineById(userUuid, fineId);
    if (rows.length !== 1) throw new LicenseError('FINE_NOT_FOUND', 'Violation is not available for this account', 404);
    return rows[0];
  }

  async function getMyObjectionRequests(userUuid) {
    const fines = await scopedFines(userUuid);
    if (!fines.length) return [];
    const reference = await lists();
    const requests = [];
    const seen = new Set();
    for (const fine of fines) {
      for (const request of await c4c.objectionsForFine(String(fine.ID))) {
        const id = String(request.ObjectID || request.ID || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        requests.push(mapObjection(request, fine, reference));
      }
    }
    return requests;
  }

  async function getFineAttachments(userUuid, fineId) {
    const fine = await ownedFine(userUuid, fineId);
    if (!fine.ObjectID) throw new LicenseError('C4C_BAD_RESPONSE', 'Violation has no C4C object identifier', 503);
    return c4c.attachments('CustomerOrderCollection', fine.ObjectID);
  }

  async function getObjectionAttachments(userUuid, requestId) {
    const id = required(requestId, 'Request ID', 80);
    const requests = await getMyObjectionRequests(userUuid);
    const request = requests.find(row => String(row.ID) === id);
    if (!request?.ObjectID) throw new LicenseError('OBJECTION_NOT_FOUND', 'Objection is not available for this account', 404);
    return c4c.attachments('ServiceRequestCollection', request.ObjectID);
  }

  async function submitObjection(userUuid, rawPayload) {
    const input = parseSubmission(rawPayload);
    const fine = await ownedFine(userUuid, input.fineId);
    if (!objectionExpiryIsOpen(fine.ObjectionExpiryDate)) throw new LicenseError('OBJECTION_EXPIRED', 'The objection period has expired', 422);
    const existing = await c4c.objectionsForFine(fine.ID);
    if (existing.some(request => String(request.ServiceRequestUserLifeCycleStatusCode || '') !== 'Z8')) {
      throw new LicenseError('OBJECTION_ALREADY_OPEN', 'An objection is already open for this violation', 409);
    }
    if (!fine.BuyerPartyID) throw new LicenseError('C4C_BAD_RESPONSE', 'Violation has no buyer party identifier', 503);
    const objection = await c4c.createObjection({
      Name: `طلب اعتراض على الفاتوره رقم ${fine.SadadNumber_KUT || ''}`.trim(),
      SalesOrderID: fine.ID, ProcessingTypeCode: 'ZOBJ', BuyerPartyID: fine.BuyerPartyID,
      FINEID_KUT: fine.ID, Porttext_KUT: fine.PORT_TEXT_AR || ''
    });
    // The legacy UI copies the fine's existing attachments into the objection.
    const inherited = fine.ObjectID ? await c4c.attachments('CustomerOrderCollection', fine.ObjectID) : [];
    const attachments = [
      ...inherited.filter(item => item?.Name && item?.Binary && item?.MimeType).map(item => ({ name: text(item.Name, 160), mimeType: text(item.MimeType, 100), contentBase64: item.Binary, typeCode: item.TypeCode || '10001', categoryCode: item.CategoryCode || '2' })),
      ...input.attachments
    ];
    for (const attachment of attachments) await c4c.addObjectionAttachment(objection, attachment);
    return { ID: String(objection.ID), ObjectID: String(objection.ObjectID), attachmentCount: attachments.length };
  }

  return { getMyFines, getFineById, getMyObjectionRequests, getFineAttachments, getObjectionAttachments, submitObjection };
}

module.exports = { createViolationsService, mapFine, mapObjection, parseSubmission };
