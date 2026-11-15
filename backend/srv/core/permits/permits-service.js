'use strict';

const { LicenseError, required } = require('../licenses/errors');
const { dateText } = require('../licenses/license-queries');

const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const PERMIT_STATUS = new Set(['Y1', 'Y3', 'Y5']);

function listMap(definition) {
  const map = new Map();
  function visit(items) { for (const item of items || []) { if (item?.key && item.active !== false) { map.set(String(item.key), item); visit(item.subItems); } } }
  visit(definition?.items); return map;
}
function text(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function newest(rows) { return [...rows].sort((a, b) => String(b?.CreationDateTime || '').localeCompare(String(a?.CreationDateTime || '')))[0]; }
function activeLicense(account) { return String(account?.LicenseStatus_KUT || '') === '101' && Boolean(String(account?.LicenseNumber_KUT || '').trim()); }
function atLeastSixtyDays(value) { const date = new Date(String(value || '')); return Number.isFinite(date.getTime()) && date.getTime() - Date.now() > 60 * 86400000; }

function parseAttachment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid permit attachment', 400);
  const name = required(value.name, 'Attachment name', 160);
  if (name !== name.split(/[\\/]/).pop() || name.startsWith('.') || /[\u0000-\u001f\u007f]/.test(name)) throw new LicenseError('INVALID_ATTACHMENT', 'Unsafe attachment filename', 400);
  const mimeType = text(value.mimeType, 100).toLowerCase();
  const extension = (name.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase();
  const allowed = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  if (!extension || allowed[extension] !== mimeType) throw new LicenseError('INVALID_ATTACHMENT', 'Only matching PDF, PNG and JPEG attachments are supported', 400);
  const base64 = value.contentBase64;
  if (typeof base64 !== 'string' || base64.length < 8 || base64.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid or oversized Base64 attachment', 400);
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES || bytes.toString('base64') !== base64) throw new LicenseError('INVALID_ATTACHMENT', 'Invalid or oversized attachment bytes', 400);
  const signature = extension === 'pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (!signature) throw new LicenseError('INVALID_ATTACHMENT', 'Attachment content does not match its declared type', 400);
  return { name, mimeType, contentBase64: base64, typeCode: '10001', categoryCode: '2' };
}
function parseSubmission(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 5 * 1024 * 1024) throw new LicenseError('INVALID_SUBMISSION', 'Invalid permit payload size', 400);
  let value; try { value = JSON.parse(raw); } catch (_) { throw new LicenseError('INVALID_SUBMISSION', 'Permit payload is not valid JSON', 400); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LicenseError('INVALID_SUBMISSION', 'Invalid permit payload', 400);
  if (value.disclaimerAccepted !== true) throw new LicenseError('DISCLAIMER_REQUIRED', 'The permit declaration must be accepted', 400);
  const attachments = value.attachments === undefined ? [] : value.attachments;
  if (!Array.isArray(attachments) || attachments.length > 5) throw new LicenseError('INVALID_SUBMISSION', 'Select up to five permit attachments', 400);
  return { accountId: required(value.accountId, 'C4C account ID', 80), permitType: required(value.permitType, 'Permit type', 80), port: required(value.port, 'Port', 80), place: required(value.place, 'Place', 80), attachments: attachments.map(parseAttachment), hazmat: value.hazmat && typeof value.hazmat === 'object' && !Array.isArray(value.hazmat) ? value.hazmat : null };
}

function createPermitsService({ crs, c4c, loadList }) {
  if (!crs?.listForUser || !c4c?.accountsForCr || !c4c?.permitsForAccounts || typeof loadList !== 'function') throw new TypeError('Permits dependencies are required');
  async function references() {
    const result = {}; for (const code of ['LICENSE_TYPE', 'PERMIT_TYPE', 'PORTS', 'REQUEST_STATUS']) { try { result[code] = listMap(await loadList(code)); } catch (_) { result[code] = new Map(); } } return result;
  }
  async function scope(userUuid) {
    const registrations = await crs.listForUser(userUuid); const result = []; const seen = new Set();
    for (const cr of registrations) {
      if (cr.IS_TEST_DATA || !cr.CR_NUMBER || !cr.CR_NATIONAL_NUMBER) continue;
      for (const account of await c4c.accountsForCr(cr)) if (!seen.has(account.AccountID)) { seen.add(account.AccountID); result.push({ cr, account }); }
    }
    return result;
  }
  function mapLicense({ cr, account }, refs) {
    const type = refs.LICENSE_TYPE.get(String(account.RoleCode || '')); const port = refs.PORTS.get(String(account.Port3_KUT || ''));
    return { AccountID: String(account.AccountID), ObjectID: String(account.ObjectID || ''), LicenseNumber: String(account.LicenseNumber_KUT || ''), LicenseType: String(account.RoleCode || ''), LicenseTypeText: type?.title || '', LicenseTypeTextAr: type?.titleAr || '', CRNationalNumber: String(cr.CR_NATIONAL_NUMBER), CommercialRegistrationNumber: String(cr.CR_NUMBER), CompanyName: text(account.BusinessPartnerFormattedName || account.FullName_KUT || account.Name || cr.CR_NAME || cr.CR_NAME_AR, 500), Port: String(account.Port3_KUT || ''), PortText: port?.title || '', PortTextAr: port?.titleAr || '', Status: String(account.LicenseStatus_KUT || ''), StartDate: dateText(account.LicenseValidFrom_KUT), ExpiryDate: dateText(account.LicenseValidTo_KUT) };
  }
  function mapPermit(row, owner, refs) {
    const type = refs.PERMIT_TYPE.get(String(row.ProcessingTypeCode || '')); const port = refs.PORTS.get(String(row.Port3_KUT || '')); const status = refs.REQUEST_STATUS.get(String(row.ServiceRequestUserLifeCycleStatusCode || ''));
    return { ID: String(row.ID || ''), ObjectID: String(row.ObjectID || ''), BuyerPartyID: String(row.BuyerPartyID || ''), BuyerPartyName: text(row.BuyerPartyName || owner.account.BusinessPartnerFormattedName, 500), ProcessingTypeCode: String(row.ProcessingTypeCode || ''), ProcessingTypeText: type?.title || '', ProcessingTypeTextAr: type?.titleAr || '', Port: String(row.Port3_KUT || ''), PortText: port?.title || '', PortTextAr: port?.titleAr || '', Place: String(row.Place_KUT || ''), Status: String(row.ServiceRequestUserLifeCycleStatusCode || ''), StatusText: status?.title || '', StatusTextAr: status?.titleAr || '', CreationDateTime: dateText(row.CreationDateTime), ExpiryDate: dateText(row.ExpiryDateActivityinPort_KUT), CancellationDate: dateText(row.Cancellationdate_KUT), LicenseNumber: String(owner.account.LicenseNumber_KUT || ''), CRNationalNumber: String(owner.cr.CR_NATIONAL_NUMBER || '') };
  }
  async function getMyLicenses(userUuid) { const [entries, refs] = await Promise.all([scope(userUuid), references()]); return entries.filter(({ account }) => String(account.LicenseNumber_KUT || '').trim()).map(entry => mapLicense(entry, refs)).sort((a, b) => a.LicenseNumber.localeCompare(b.LicenseNumber)); }
  async function getMyPermitRequests(userUuid) { const [entries, refs] = await Promise.all([scope(userUuid), references()]); const byAccount = new Map(entries.map(entry => [String(entry.account.AccountID), entry])); const rows = await c4c.permitsForAccounts([...byAccount.keys()]); return rows.filter(row => refs.PERMIT_TYPE.has(String(row.ProcessingTypeCode || ''))).map(row => mapPermit(row, byAccount.get(String(row.BuyerPartyID)), refs)); }
  async function ownedAccount(userUuid, accountId) { const found = (await scope(userUuid)).find(entry => String(entry.account.AccountID) === accountId); if (!found) throw new LicenseError('LICENSE_NOT_FOUND', 'License is not available for this account', 404); return found; }
  async function getLicenseAttachments(userUuid, accountId) { const entry = await ownedAccount(userUuid, required(accountId, 'C4C account ID', 80)); const quote = newest(await c4c.quotesForAccount(entry.account.AccountID)); return quote?.ObjectID ? c4c.salesQuoteAttachments(quote.ObjectID) : []; }
  async function getPermitAttachments(userUuid, requestId) { const id = required(requestId, 'Permit request ID', 80); const permit = (await getMyPermitRequests(userUuid)).find(row => row.ID === id); if (!permit?.ObjectID) throw new LicenseError('PERMIT_NOT_FOUND', 'Permit is not available for this account', 404); return c4c.permitAttachments(permit.ObjectID); }
  async function submitPermit(userUuid, raw) {
    const input = parseSubmission(raw); const [entry, refs] = await Promise.all([ownedAccount(userUuid, input.accountId), references()]);
    if (!refs.PERMIT_TYPE.has(input.permitType) || !refs.PORTS.has(input.port)) throw new LicenseError('INVALID_SELECTION', 'Permit type or port is not active in portal lists', 400);
    if (!activeLicense(entry.account) || !atLeastSixtyDays(entry.account.LicenseValidTo_KUT)) throw new LicenseError('LICENSE_NOT_ELIGIBLE', 'A permit requires an active license with more than sixty days validity', 422);
    const existing = await c4c.permitsForAccounts([entry.account.AccountID]);
    if (existing.some(row => row.ProcessingTypeCode === input.permitType && row.Port3_KUT === input.port && row.Place_KUT === input.place && (input.permitType === 'ZMZW' ? row.ActivityinPortStatus_KUT === '101' : input.permitType === 'ZHAZ' ? row.ServiceRequestUserLifeCycleStatusCode === '1' : PERMIT_STATUS.has(String(row.ServiceRequestUserLifeCycleStatusCode || ''))))) throw new LicenseError('PERMIT_ALREADY_OPEN', 'A matching permit request is already open', 409);
    const payload = { BuyerPartyID: entry.account.AccountID, Port3_KUT: input.port, ExpiryDateActivityinPort_KUT: entry.account.LicenseValidTo_KUT, ProcessingTypeCode: input.permitType, ServiceSupportTeamPartyID: 'S1700', Place_KUT: input.place };
    if (entry.cr.CR_ADDRESS) payload.CRAddress1_KUT = text(entry.cr.CR_ADDRESS, 60);
    if (input.hazmat) Object.assign(payload, { SupportingLocations_KUT: text(input.hazmat.supportingLocation, 80), UNNo_KUT: text(input.hazmat.unNo, 80), IMONo_KUT: text(input.hazmat.imoNo, 80), SubstanceName_KUT: text(input.hazmat.substanceName, 255), Quantity_KUT: text(input.hazmat.quantity, 80), UoM_KUT: text(input.hazmat.unitOfMeasure, 80) });
    const created = await c4c.createPermit(payload); for (const attachment of input.attachments) await c4c.addPermitAttachment(created, attachment);
    return { ID: String(created.ID), ObjectID: String(created.ObjectID), attachmentCount: input.attachments.length };
  }
  return { getMyLicenses, getMyPermitRequests, getLicenseAttachments, getPermitAttachments, submitPermit };
}
module.exports = { createPermitsService, parseSubmission };
