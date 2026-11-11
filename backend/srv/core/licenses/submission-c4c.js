'use strict';

/**
 * Mawani C4C write adapter for NEW licence submissions.
 *
 * Called by submission-service.js.  All authorisation, CR ownership,
 * reference-list validation, pricing and operation-idempotency checks happen
 * in that service BEFORE any method here is called.
 *
 * No implicit retry is allowed for POST operations. A timeout or malformed
 * create response might mean the remote entity was nevertheless created.
 */

const { LicenseError, odataString } = require('./errors');
const { DESTINATION, ROOT } = require('./c4c-client');

const WRITABLE_COLLECTIONS = new Set([
  'CorporateAccountCollection',
  'ContactCollection',
  'SalesQuoteCollection',
  'SalesQuoteAttachmentFolderCollection'
]);

const DOCUMENT_TYPES = Object.freeze({
  '1': 'NAT', '2': 'IQA', '3': 'PAS', '4': 'GCC', '10': 'BRD'
});

function str(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function withoutBlank(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) =>
    value !== '' && value !== null && value !== undefined));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function entityFromResponse(response) {
  // SAP C4C OData v2: {data:{d:{...entity}}}. Some mocks / proxies return
  // the entity directly. Reject ambiguous collections and non-object results.
  const data = response?.data?.d ?? response?.data;
  const candidate = isRecord(data) && Array.isArray(data.results)
    ? (data.results.length === 1 ? data.results[0] : null)
    : data;
  return isRecord(candidate) ? candidate : null;
}

function collectionFromResponse(response) {
  const data = response?.data?.d ?? response?.data;
  const values = data?.results ?? data?.value;
  return response?.status === 200 && Array.isArray(values) ? values : null;
}

function c4cWriteError(error) {
  if (error instanceof LicenseError) return error;
  const status = Number(error?.response?.status || 0);
  const suffix = Number.isInteger(status) && status >= 400 && status <= 599
    ? ` (HTTP ${status})` : '';
  // Never include raw axios error: it can expose Authorization headers,
  // destination credentials, cookies, personal data and attachment content.
  return new LicenseError('C4C_WRITE_UNCERTAIN',
    `C4C write outcome needs reconciliation${suffix}`, 503);
}

function buildAccountPayload(cr, input, licenseType) {
  const nameAr = str(cr.CR_NAME_AR || cr.CR_NAME, 255);
  const nameEn = str(cr.CR_NAME || cr.CR_NAME_AR, 255);
  if (!nameAr) throw new LicenseError('CR_NAME_MISSING',
    'CR company name is required before creating a C4C account', 422);

  // Map only fields verified against the legacy account-create contract.
  // Do not fabricate C4C properties that may not be writable in this tenant.
  return withoutBlank({
    RoleCode: licenseType,
    CommercialRegisterNumber_KUT: cr.CR_NUMBER,
    CRNationalNumber_KUT: cr.CR_NATIONAL_NUMBER,
    AccountType_KUT: input.investorType,
    Name: nameAr.slice(0, 40),
    FullName_KUT: nameAr,
    ZCOMPANY_NAME_ENGLISH_KUT: nameEn,
    ZCityCode_KUT: str(cr.CR_CITY_EN || cr.CR_CITY_AR || input.address?.cityCode, 40),
    ZPOSTAL_CODE_KUT: str(cr.POSTAL_CODE || input.address?.postalCode, 20),
    ZDISTRICT_KUT: str(cr.DISTRICT || input.address?.district, 100),
    ZSTREET_KUT: str(cr.STREET || input.address?.street, 100),
    ZBUILDING_KUT: str(cr.BUILDING || input.address?.building, 40),
    ZSECONDARY_NUMBER_KUT: str(cr.SECONDARY_NUMBER || input.address?.secondaryNumber, 40),
    Port3_KUT: input.portCode || undefined
  });
}

function buildContactPayload(accountID, input) {
  const applicant = input.applicant;
  return {
    AccountID: accountID,
    LastName: applicant.name.slice(0, 35),
    ContactFullname_KUT: applicant.name,
    Mobile: applicant.mobile,
    Phone: applicant.mobile,
    Email: applicant.email
  };
}

function buildQuotePayload(accountID, licenseType, input, config) {
  if (!config?.salesOrg || !config?.salesUnit) {
    throw new LicenseError('C4C_SALES_ORG_REQUIRED',
      'Approved C4C Sales Organisation and Sales Unit are not configured', 503);
  }
  if (!Array.isArray(input.serviceTypes) || input.serviceTypes.length !== 1) {
    throw new LicenseError('MULTI_SERVICE_CONTRACT_PENDING',
      'One approved C4C service type is required for each Sales Quote', 422);
  }
  const applicant = input.applicant;
  return withoutBlank({
    BuyerPartyID: accountID,
    LicenceType_KUT: licenseType,
    SalesOrganisationID: config.salesOrg,
    SalesUnitPartyID: config.salesUnit,
    LicenceRequesterName_KUT: applicant.name.slice(0, 35),
    licenserequestername2_KUT: applicant.name,
    ZAPPLICANT_ID_KUT: applicant.id,
    ZAPPLICANT_ID_TYPE_KUT: DOCUMENT_TYPES[applicant.documentType] || applicant.documentType,
    ZMOBIL_KUT: applicant.mobile,
    ZEMAIL_KUT: applicant.email,
    RequestType_KUT: 'NEW',
    Type1_KUT: input.serviceTypes[0],
    Port3_KUT: input.portCode || undefined,
    Shipname_KUT: input.shipName || undefined,
    ActivityType_KUT: input.activityType || undefined,
    MinistryofEnergylicense_KUT: input.ministryEnergyLicenseDate
      ? `${input.ministryEnergyLicenseDate}T00:00:00` : undefined
  });
}

function createC4cWriter({ executeHttpRequest, fetchCsrfToken = true } = {}) {
  if (typeof executeHttpRequest !== 'function') {
    throw new TypeError('SAP Cloud SDK executeHttpRequest client is required');
  }
  if (typeof fetchCsrfToken !== 'boolean') {
    throw new TypeError('fetchCsrfToken must be a boolean');
  }

  async function post(collection, payload) {
    if (!WRITABLE_COLLECTIONS.has(collection)) {
      throw new TypeError('Unapproved C4C write collection');
    }
    let response;
    try {
      response = await executeHttpRequest(
        { destinationName: DESTINATION },
        {
          method: 'POST',
          url: ROOT + collection,
          timeout: 25000,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          data: payload
        },
        // Keep the previous secure default. Disable ONLY after the tenant
        // owner confirms this destination uses a CSRF-exempt technical user.
        { fetchCsrfToken }
      );
    } catch (error) {
      throw c4cWriteError(error);
    }
    if (response?.status !== 200 && response?.status !== 201) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN',
        'Unexpected C4C write status; reconcile before retrying', 503);
    }
    return response;
  }

  async function get(collection, filter, limit = 10) {
    if (!['CorporateAccountCollection', 'ContactCollection'].includes(collection)) {
      throw new TypeError('Unapproved C4C read collection');
    }
    const url = `${ROOT}${collection}?$filter=${encodeURIComponent(filter)}` +
      `&$top=${limit}&$format=json`;
    let response;
    try {
      response = await executeHttpRequest(
        { destinationName: DESTINATION },
        { method: 'GET', url, timeout: 20000, headers: { Accept: 'application/json' } },
        { fetchCsrfToken: false }
      );
    } catch (_error) {
      throw new LicenseError('C4C_READ_FAILED', 'C4C reconciliation lookup failed', 503);
    }
    const values = collectionFromResponse(response);
    if (!values || values.length > limit || values.some(row => !isRecord(row))) {
      throw new LicenseError('C4C_SCOPE_MISMATCH', 'Unexpected C4C lookup response', 503);
    }
    return values;
  }

  async function findCreatedAccount(cr, input, licenseType) {
    // Read-back is only used after a confirmed 200/201 account POST without
    // AccountID in its body. It never triggers another POST.
    const national = str(cr.CR_NATIONAL_NUMBER, 32);
    const registration = str(cr.CR_NUMBER, 32);
    if (!national || !registration) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN',
        'C4C account response is missing AccountID; CR lookup unavailable', 503);
    }
    const filter = `CRNationalNumber_KUT eq ${odataString(national)} and ` +
      `CommercialRegisterNumber_KUT eq ${odataString(registration)} and ` +
      `RoleCode eq ${odataString(licenseType)}`;
    const rows = await get('CorporateAccountCollection', filter, 10);
    const matching = rows.filter(row =>
      row.CRNationalNumber_KUT === national &&
      row.CommercialRegisterNumber_KUT === registration &&
      row.RoleCode === licenseType &&
      (input.serviceTypes?.[0] !== '111' || String(row.Port3_KUT || '') === String(input.portCode || ''))
    );
    if (matching.length !== 1 || !str(matching[0].AccountID, 80)) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN',
        'C4C account response has no AccountID and read-back was not unique', 503);
    }
    return matching[0];
  }

  async function createAccount(cr, input, licenseType) {
    const response = await post('CorporateAccountCollection',
      buildAccountPayload(cr, input, licenseType));
    let row = entityFromResponse(response);
    if (!str(row?.AccountID, 80)) {
      // C4C might return only a Location header or entity key, which is NOT
      // necessarily AccountID. Never guess it from the URL or ObjectID.
      row = await findCreatedAccount(cr, input, licenseType);
    }
    const accountID = str(row.AccountID, 80);
    return { accountID, objectID: str(row.ObjectID, 120) };
  }

  async function findMatchingContacts(accountID, mobile) {
    const filter = `AccountID eq ${odataString(accountID)} and Mobile eq ${odataString(mobile)}`;
    const rows = await get('ContactCollection', filter, 5);
    if (rows.some(row => row.AccountID !== accountID || row.Mobile !== mobile)) {
      throw new LicenseError('C4C_SCOPE_MISMATCH',
        'Unexpected C4C contact lookup response', 503);
    }
    return rows;
  }

  async function createContact(accountID, input) {
    const response = await post('ContactCollection', buildContactPayload(accountID, input));
    const row = entityFromResponse(response);
    if (!str(row?.ContactID, 120) && !str(row?.ObjectID, 120)) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN',
        'C4C contact creation response lacks identifiers; reconcile before retrying', 503);
    }
    return { contactID: str(row.ContactID, 120), objectID: str(row.ObjectID, 120) };
  }

  async function createQuote(accountID, licenseType, input, config) {
    const response = await post('SalesQuoteCollection',
      buildQuotePayload(accountID, licenseType, input, config));
    const row = entityFromResponse(response);
    const quoteID = str(row?.ID, 120);
    const quoteObjectID = str(row?.ObjectID, 120);
    if (!quoteID || !quoteObjectID) {
      throw new LicenseError('C4C_WRITE_UNCERTAIN',
        'C4C Sales Quote response lacks ID or ObjectID; reconcile before retrying', 503);
    }
    return { quoteID, quoteObjectID };
  }

  async function uploadAttachment(quote, file) {
    if (!quote?.quoteID || !quote?.quoteObjectID || !file?.name ||
        !file?.contentBase64 || !file?.mimeType || !Number.isSafeInteger(file?.byteLength)) {
      throw new LicenseError('INVALID_ATTACHMENT', 'Invalid validated attachment input', 422);
    }
    await post('SalesQuoteAttachmentFolderCollection', {
      ParentObjectID: quote.quoteObjectID,
      SalesQuoteID: quote.quoteID,
      TypeCode: '10001',
      Name: file.name,
      CategoryCode: '2',
      Binary: file.contentBase64,
      MimeType: file.mimeType
    });
    return { name: file.name, sizeBytes: file.byteLength, status: 'SUCCEEDED' };
  }

  return {
    createAccount,
    findMatchingContacts,
    createContact,
    createQuote,
    uploadAttachment
  };
}

module.exports = {
  createC4cWriter,
  buildAccountPayload,
  buildQuotePayload,
  buildContactPayload
};
