'use strict';

const { LicenseError, required } = require('./errors');

const LIST_CODES = ['LICENSE_TYPE', 'PORT_FOR_PERMIT', 'SERVICE_TYPE'];

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

function newest(rows) {
  return [...rows].sort((left, right) =>
    String(right?.CreationDateTime || '').localeCompare(String(left?.CreationDateTime || '')))[0];
}

function descendingId(left, right) {
  const a = String(left?.ID || '');
  const b = String(right?.ID || '');
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(b) - Number(a);
  return b.localeCompare(a);
}

function dateText(value) {
  if (value == null || value === '') return '';
  const source = String(value);
  const odata = source.match(/^\/Date\((-?\d+)/);
  if (odata) {
    const date = new Date(Number(odata[1]));
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  }
  const iso = source.match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : source;
}

function licenseStatus(code, text) {
  if (text) return text;
  return ({ '101': 'Active', '111': 'Expired', '121': 'Suspended' })[String(code || '')] || String(code || '');
}

function requestStatus(code, text) {
  if (text) return text;
  return ({ '101': 'Open', '111': 'Rejected', '121': 'Approved' })[String(code || '')] || String(code || '');
}

function createLicenseQueries({ crs, c4c, loadList = async () => null }) {
  async function lookups() {
    const result = {};
    for (const code of LIST_CODES) {
      // Legacy list reads returned no rows for a missing parent key. Labels are
      // display enrichment, so scoped C4C records must remain visible.
      try { result[code] = listMap(await loadList(code)); }
      catch (_) { result[code] = new Map(); }
    }
    return result;
  }

  function titles(code, key, reference) {
    const item = reference[code].get(String(key || ''));
    return { text: item?.title || '', textAr: item?.titleAr || '' };
  }

  async function loadScope(userUuid) {
    const registrations = await crs.listForUser(userUuid);
    const scoped = [];
    const seen = new Set();
    for (const cr of registrations) {
      // Synthetic data is visible in the user's CR selector, not sent to C4C.
      if (cr.IS_TEST_DATA) continue;
      if (!cr.CR_NUMBER || !cr.CR_NATIONAL_NUMBER) continue;
      const accounts = await c4c.findAccountsForCr(cr);
      for (const account of accounts) {
        if (seen.has(account.AccountID)) continue;
        seen.add(account.AccountID);
        scoped.push({ cr, account });
        if (scoped.length > 200) {
          throw new LicenseError('TOO_MANY_ACCOUNTS', 'Too many associated C4C accounts', 503);
        }
      }
    }
    return scoped;
  }

  async function getMyLicenses(userUuid) {
    const [scope, reference] = await Promise.all([loadScope(userUuid), lookups()]);
    const licenses = [];
    for (const { cr, account } of scope) {
      if (!String(account.LicenseNumber_KUT || '').trim()) continue;
      // Legacy used the newest approved quote for the license amount and its attachments.
      const quote = newest((await c4c.findQuotesForAccount(account.AccountID, 'CreationDateTime desc'))
        .filter(row => String(row.LiscenceStatus_KUT || '') === '121'));
      const licenseType = account.RoleCode || '';
      const port = account.Port3_KUT || '';
      const licenseTitle = titles('LICENSE_TYPE', licenseType, reference);
      const portTitle = titles('PORT_FOR_PERMIT', port, reference);
      licenses.push({
        AccountID: account.AccountID,
        ObjectID: account.ObjectID || '',
        LicenseNumber: String(account.LicenseNumber_KUT),
        LicenseType: licenseType,
        LicenseTypeText: licenseTitle.text,
        LicenseTypeTextAr: licenseTitle.textAr,
        CRNationalNumber: cr.CR_NATIONAL_NUMBER,
        CommercialRegistrationNumber: cr.CR_NUMBER,
        CompanyName: account.BusinessPartnerFormattedName || account.FullName_KUT || account.Name || cr.CR_NAME || cr.CR_NAME_AR || '',
        Port: port,
        PortText: portTitle.text,
        PortTextAr: portTitle.textAr,
        Status: licenseStatus(account.LicenseStatus_KUT, account.LicenseStatus_KUTText),
        StartDate: dateText(account.LicenseValidFrom_KUT),
        ExpiryDate: dateText(account.LicenseValidTo_KUT),
        Amount: quote?.NetAmount == null ? '' : String(quote.NetAmount),
        QuoteID: String(quote?.ID || ''),
        QuoteObjectID: String(quote?.ObjectID || '')
      });
    }
    return licenses.sort((left, right) => String(left.LicenseNumber).localeCompare(String(right.LicenseNumber)));
  }

  async function getMyRequests(userUuid) {
    const [scope, reference] = await Promise.all([loadScope(userUuid), lookups()]);
    const result = [];
    const seen = new Set();
    for (const { cr, account } of scope) {
      const quotes = await c4c.findQuotesForAccount(account.AccountID, 'ID desc');
      for (const quote of quotes) {
        const id = quote.ObjectID || quote.ID;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const licenseType = quote.LicenceType_KUT || quote.Role1_KUT || account.RoleCode || '';
        const serviceType = quote.Type1_KUT || '';
        const port = quote.Port3_KUT || '';
        const licenseTitle = titles('LICENSE_TYPE', licenseType, reference);
        const serviceTitle = titles('SERVICE_TYPE', serviceType, reference);
        const portTitle = titles('PORT_FOR_PERMIT', port, reference);
        result.push({
          ID: String(quote.ID || ''),
          ObjectID: String(quote.ObjectID || ''),
          BuyerPartyID: account.AccountID,
          LicenseType: licenseType,
          LicenseTypeText: licenseTitle.text,
          LicenseTypeTextAr: licenseTitle.textAr,
          RequestType: quote.RequestType_KUT || '',
          ServiceType: serviceType,
          ServiceTypeText: serviceTitle.text,
          ServiceTypeTextAr: serviceTitle.textAr,
          Port: port,
          PortText: portTitle.text,
          PortTextAr: portTitle.textAr,
          Status: requestStatus(quote.LiscenceStatus_KUT, quote.LiscenceStatus_KUTText),
          Amount: quote.NetAmount == null ? (quote.Amount == null ? '' : String(quote.Amount)) : String(quote.NetAmount),
          CreatedAt: dateText(quote.CreationDateTime),
          CRNationalNumber: cr.CR_NATIONAL_NUMBER,
          CommercialRegistrationNumber: cr.CR_NUMBER,
          CompanyName: account.BusinessPartnerFormattedName || account.FullName_KUT || account.Name || cr.CR_NAME || cr.CR_NAME_AR || ''
        });
      }
    }
    return result.sort(descendingId);
  }

  async function getLicenseAttachments(userUuid, accountId) {
    const id = required(accountId, 'C4C account ID', 80);
    const license = (await getMyLicenses(userUuid)).find(row => String(row.AccountID) === id);
    if (!license) throw new LicenseError('LICENSE_NOT_FOUND', 'License is not available for this account', 404);
    if (!license.QuoteObjectID) return [];
    return c4c.salesQuoteAttachments(license.QuoteObjectID);
  }

  async function getRequestAttachments(userUuid, requestId) {
    const id = required(requestId, 'License request ID', 80);
    const request = (await getMyRequests(userUuid)).find(row => String(row.ID) === id);
    if (!request) throw new LicenseError('REQUEST_NOT_FOUND', 'License request is not available for this account', 404);
    if (!request.ObjectID) return [];
    return c4c.salesQuoteAttachments(request.ObjectID);
  }

  return { getMyLicenses, getMyRequests, getLicenseAttachments, getRequestAttachments };
}

module.exports = { createLicenseQueries, dateText, descendingId, licenseStatus, requestStatus };
