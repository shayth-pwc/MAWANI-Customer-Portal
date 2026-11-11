'use strict';
const { LicenseError } = require('./errors');

function createLicenseQueries({ crs, c4c }) {
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
    const scope = await loadScope(userUuid);
    return scope.filter(({ account }) => String(account.LicenseNumber_KUT || '').trim())
      .map(({ cr, account }) => ({
        AccountID: account.AccountID,
        ObjectID: account.ObjectID || '',
        LicenseNumber: String(account.LicenseNumber_KUT),
        LicenseType: account.RoleCode || '',
        CRNationalNumber: cr.CR_NATIONAL_NUMBER,
        CommercialRegistrationNumber: cr.CR_NUMBER,
        CompanyName: account.FullName_KUT || account.Name || cr.CR_NAME || cr.CR_NAME_AR || '',
        Port: account.Port3_KUT || '',
        Status: account.LicenseStatus_KUTText || account.LicenseStatus_KUT || ''
      }));
  }

  async function getMyRequests(userUuid) {
    const scope = await loadScope(userUuid);
    const result = [];
    const seen = new Set();
    for (const { cr, account } of scope) {
      const quotes = await c4c.findQuotesForAccount(account.AccountID);
      for (const quote of quotes) {
        const id = quote.ObjectID || quote.ID;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push({
          ID: String(quote.ID || ''),
          ObjectID: String(quote.ObjectID || ''),
          BuyerPartyID: account.AccountID,
          LicenseType: quote.Role1_KUT || quote.LicenceType_KUT || account.RoleCode || '',
          RequestType: quote.RequestType_KUT || '',
          Status: quote.LiscenceStatus_KUTText || quote.LiscenceStatus_KUT || '',
          Amount: quote.Amount == null ? '' : String(quote.Amount),
          CRNationalNumber: cr.CR_NATIONAL_NUMBER,
          CommercialRegistrationNumber: cr.CR_NUMBER
        });
      }
    }
    return result;
  }

  return { getMyLicenses, getMyRequests };
}
module.exports = { createLicenseQueries };