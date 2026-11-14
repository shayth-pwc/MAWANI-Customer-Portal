"use strict";
const cds = require("@sap/cds");
const { LicenseError } = require("./licenses/errors");
const { AppError } = require("./utils/errors");
const {
  createServicePricing,
  normalizeServices,
} = require("./licenses/service-pricing");
const { createC4cClient } = require("./licenses/c4c-client");
const { createCrRepository } = require("./licenses/cr-repository");
const { createLicenseQueries } = require("./licenses/license-queries");
const {
  createLicenseSubmitter,
  configurationFromEnv,
} = require("./licenses/submission-service");
const { createC4cWriter } = require("./licenses/submission-c4c");
const {
  createSubmissionOperations,
} = require("./licenses/submission-operations");
const UserProvisioningService = require("./services/user-provisioning.service");
const {
  parseDefinition,
  enabledKeys,
  LIST_APP,
} = require("./licenses/reference-lists");
const { trustedIdentity } = require("./security/identity");
const { createLicensePreflight } = require("./licenses/license-preflight");
const { createRenewalSubmitter } = require('./licenses/renewal-service');

function safeReject(req, error) {
  if (error instanceof LicenseError || error instanceof AppError)
    return req.reject(error.status, error.message);
  cds
    .log("mawani-license")
    .error("License operation failed (internal details withheld)");
  return req.reject(503, "License service temporarily unavailable");
}

module.exports = cds.service.impl(function () {
  let dbPromise;
  const db = () => {
    if (!dbPromise) dbPromise = cds.connect.to("db");
    return dbPromise;
  };
  const ensureTrusted = (req) => trustedIdentity(req);
  const provisioning = new UserProvisioningService();
  // SCIM-verified IAS identity -> existing active portal UUID. No email/UUID accepted from browser.
  async function getActor(req) {
    const result = await provisioning.read(req);
    return result.profile;
  }
  function getC4c() {
    return createC4cClient({
      executeHttpRequest: require("@sap-cloud-sdk/http-client")
        .executeHttpRequest,
    });
  }
  async function reads(req, operation) {
    try {
      const actor = await getActor(req);
      const crs = createCrRepository(await db());
      const listService = await cds.connect.to('ListService');
      const queries = createLicenseQueries({
        crs,
        c4c: getC4c(),
        loadList: async code => parseDefinition(
          await listService.send('getList', { app: LIST_APP, code }), code, LIST_APP)
      });
      return await queries[operation](actor.UUID, ...Object.values(req.data || {}));
    } catch (error) {
      return safeReject(req, error);
    }
  }
  this.on("getMyCommercialRegistrations", async (req) => {
    try {
      const actor = await getActor(req);
      const records = await createCrRepository(await db()).listForUser(
        actor.UUID,
      );
      const str = (value) => (value == null ? "" : String(value));
      return records.map((row) => ({
        id: str(row.ID),
        crNumber: str(row.CR_NUMBER),
        crNationalNumber: str(row.CR_NATIONAL_NUMBER),
        companyName: str(row.CR_NAME || row.CR_NAME_AR).slice(0, 255),
        companyNameEn: str(row.CR_NAME),
        companyNameAr: str(row.CR_NAME_AR),
        address: str(row.CR_ADDRESS),
        cityCode: str(row.CITY_CODE || row.CR_CITY_CODE),
        cityEn: str(row.CR_CITY_EN),
        cityAr: str(row.CR_CITY_AR),
        postal: str(row.POSTAL_CODE || row.CR_ZIPCODE),
        district: str(row.DISTRICT),
        street: str(row.STREET),
        building: str(row.BUILDING),
        secondary: str(row.SECONDARY_NUMBER),
        shortAddress: str(row.SHORT_ADDRESS),
        isTestData: row.IS_TEST_DATA === true,
      }));
    } catch (error) {
      return safeReject(req, error);
    }
  });
  this.on("getMyLicenses", (req) => reads(req, "getMyLicenses"));
  this.on("getMyRequests", (req) => reads(req, "getMyRequests"));
  this.on('getLicenseAttachments', req => reads(req, 'getLicenseAttachments'));
  this.on('getRequestAttachments', req => reads(req, 'getRequestAttachments'));
  this.on("checkC4cConnection", async (req) => {
    try {
      ensureTrusted(req);
      // Loaded only for C4C metadata verification; credentials remain in BTP destination service.
      const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
      return await createC4cClient({ executeHttpRequest }).requestMetadata();
    } catch (error) {
      return safeReject(req, error);
    }
  });
  this.on("getServicePrices", async (req) => {
    try {
      ensureTrusted(req);
      return await createServicePricing(await db()).getActivePrices();
    } catch (error) {
      return safeReject(req, error);
    }
  });
  this.on("quoteServices", async (req) => {
    let stage = "AUTHENTICATION";

    try {
      ensureTrusted(req);

      stage = "VALIDATE_INPUT";

      let selected;

      try {
        selected = JSON.parse(req.data.serviceCodes);
      } catch {
        throw new LicenseError(
          "INVALID_SERVICES",
          "Invalid list of selected services",
          400,
        );
      }

      selected = normalizeServices(selected);

      stage = "LOAD_SERVICE_TYPE_LIST";

      // CAP propagates the current request context automatically.
      const lists = await cds.connect.to("ListService");

      const listResult = await lists.send("getList", {
        app: LIST_APP,
        code: "LICENSE_TYPE",
      });

      const definition = parseDefinition(listResult, "LICENSE_TYPE", LIST_APP);

      const allowed = enabledKeys(definition);

      if (!allowed.size) {
        throw new LicenseError(
          "LIST_NOT_READY",
          "SERVICE_TYPE list is inactive or empty",
          503,
        );
      }

      if (selected.some((code) => !allowed.has(code))) {
        throw new LicenseError(
          "INVALID_SELECTION",
          "Selected service is not active",
          400,
        );
      }

      stage = "CALCULATE_POSTGRESQL_PRICE";

      const pricing = createServicePricing(await db());

      return await pricing.quote(selected);
    } catch (error) {
      cds
        .log("mawani-license")
        .error(
          `quoteServices failed: stage=${stage}; ` +
            `code=${String(error?.code || "UNKNOWN").slice(0, 64)}; ` +
            `status=${Number(error?.status || error?.statusCode || 503)}`,
        );

      return safeReject(req, error);
    }
  });

this.on('preflightLicenseSubmission', async req => {
  try {
    ensureTrusted(req);

    const actor = await getActor(req);
    const lists = await cds.connect.to('ListService');

    const definition = parseDefinition(
      await lists.send('getList', {
        app: LIST_APP,
        code: 'LICENSE_TYPE'
      }),
      'LICENSE_TYPE',
      LIST_APP
    );

    const preflight = createLicensePreflight({
      crs: createCrRepository(await db()),
      c4c: getC4c(),
      allowedLicenseTypes: enabledKeys(definition)
    });

    return await preflight.check(actor.UUID, req.data);

  } catch (error) {
    return safeReject(req, error);
  }
});


  // NEW license writes: all authorization and price checks are repeated server-side.
  // Configuration defaults to fail-closed; operation reservation commits before each C4C POST.
  this.on("submitLicense", async (req) => {
    try {
      const identity = ensureTrusted(req);
      const actor = await getActor(req);
      const database = await db();
      const lists = await cds.connect.to("ListService");
      const getEnabledKeys = async (code) =>
        enabledKeys(
          parseDefinition(
            await lists.send("getList", { app: LIST_APP, code }),
            code,
            LIST_APP,
          ),
        );
      const submitter = createLicenseSubmitter({
        crs: createCrRepository(database),
        c4c: getC4c(),
        writer: createC4cWriter({
          executeHttpRequest: require("@sap-cloud-sdk/http-client")
            .executeHttpRequest,
        }),
        pricing: createServicePricing(database),
        operations: createSubmissionOperations(database),
        getEnabledKeys,
        config: configurationFromEnv(),
      });
      const result = await submitter.submit({
        actorUuid: actor.UUID,
        identity,
        rawPayload: req.data.payload,
      });
      // Existing React API expects a JSON string in the OData LargeString return.
      return JSON.stringify(result);
    } catch (error) {
      return safeReject(req, error);
    }
  });

  this.on("renewLicense", async (req) => {
    try {
      const identity = ensureTrusted(req);
      const actor = await getActor(req);
      const database = await db();
      const submitter = createRenewalSubmitter({
        crs: createCrRepository(database),
        c4c: getC4c(),
        writer: createC4cWriter({ executeHttpRequest: require('@sap-cloud-sdk/http-client').executeHttpRequest }),
        operations: createSubmissionOperations(database),
        config: configurationFromEnv(),
      });
      return JSON.stringify(await submitter.submit({ actorUuid: actor.UUID, identity, rawPayload: req.data.payload }));
    } catch (error) {
      return safeReject(req, error);
    }
  });
});
