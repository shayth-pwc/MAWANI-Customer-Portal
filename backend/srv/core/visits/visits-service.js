'use strict';

const { LicenseError, required } = require('../licenses/errors');

const LIST_CODES = ['PORTS', 'VISITTYPE'];

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

function mapVisit(row, lists) {
  const visit = { ...row };
  const port = lists.PORTS.get(String(row.SalesOrganisationID || ''));
  const visitType = lists.VISITTYPE.get(String(row.VisitType || ''));
  if (port) Object.assign(visit, { BTP_PORT_TEXT_EN: port.title || '', BTP_PORT_TEXT_AR: port.titleAr || '' });
  if (visitType) Object.assign(visit, { BTP_VisitTypeText_EN: visitType.title || '', BTP_VisitTypeText_AR: visitType.titleAr || '' });
  return visit;
}

function createVisitsService({ crs, c4c, loadList }) {
  if (!crs || !c4c || typeof loadList !== 'function') throw new TypeError('Visits dependencies are required');

  async function lists() {
    const result = {};
    for (const code of LIST_CODES) {
      try { result[code] = listMap(await loadList(code)); }
      catch (_) { result[code] = new Map(); }
    }
    return result;
  }

  async function accountIdsForUser(userUuid) {
    const registrations = await crs.listForUser(userUuid);
    const nationals = [...new Set(registrations.filter(cr => !cr.IS_TEST_DATA && cr.CR_NATIONAL_NUMBER).map(cr => String(cr.CR_NATIONAL_NUMBER)))];
    const accountIds = new Set();
    for (const national of nationals) {
      for (const account of await c4c.accountsForCr(national)) accountIds.add(String(account.AccountID));
    }
    return accountIds;
  }

  async function scopedVisits(userUuid) {
    const accountIds = await accountIdsForUser(userUuid);
    if (!accountIds.size) return [];
    const rows = await c4c.visitsForAccounts([...accountIds]);
    const unique = new Map();
    for (const row of rows) {
      if (!row?.ID || String(row.Status) !== '3' || !accountIds.has(String(row.MainAccountPartyID || ''))) {
        throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected visit returned by C4C', 503);
      }
      unique.set(String(row.ID), row);
    }
    return [...unique.values()];
  }

  async function getMyVisits(userUuid) {
    const rows = await scopedVisits(userUuid);
    if (!rows.length) return [];
    const reference = await lists();
    return rows.map(row => mapVisit(row, reference));
  }

  async function getVisitById(userUuid, visitId) {
    const id = required(visitId, 'Visit ID', 80);
    const accountIds = await accountIdsForUser(userUuid);
    if (!accountIds.size) return [];
    const rows = await c4c.visitById(id);
    const scoped = rows.filter(row => String(row.Status) === '3' && accountIds.has(String(row.MainAccountPartyID || '')));
    if (scoped.length > 1) throw new LicenseError('C4C_SCOPE_MISMATCH', 'Ambiguous visit returned by C4C', 503);
    if (!scoped.length) return [];
    return [mapVisit(scoped[0], await lists())];
  }

  async function getVisitAttachments(userUuid, visitId) {
    const rows = await getVisitById(userUuid, visitId);
    if (rows.length !== 1) throw new LicenseError('VISIT_NOT_FOUND', 'Visit is not available for this account', 404);
    if (!rows[0].ObjectID) throw new LicenseError('C4C_BAD_RESPONSE', 'Visit has no C4C object identifier', 503);
    return c4c.attachments(rows[0].ObjectID);
  }

  return { getMyVisits, getVisitById, getVisitAttachments };
}

module.exports = { createVisitsService, mapVisit };
