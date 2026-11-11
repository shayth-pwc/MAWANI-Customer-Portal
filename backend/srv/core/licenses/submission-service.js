"use strict";

const { LicenseError } = require("./errors");
const {
  parseSubmission,
  assertCommercialRegistration,
} = require("./submission-input");
const { payloadHash } = require("./submission-operations");

function configurationFromEnv(env = process.env) {
  let space = "";
  try {
    space = JSON.parse(env.VCAP_APPLICATION || "{}").space_name || "";
  } catch {
    /* fail closed */
  }
  return {
    writesEnabled: env.MAWANI_C4C_WRITES_ENABLED === "true",
    contractReviewed: env.MAWANI_C4C_CONTRACT_REVIEWED === "true",
    space,
    allowedSpace: env.MAWANI_C4C_ALLOWED_CF_SPACE || "",
    salesOrg: env.MAWANI_C4C_SALES_ORG || "",
    salesUnit: env.MAWANI_C4C_SALES_UNIT || "",
    allowedStatuses: new Set(
      (env.MAWANI_C4C_ALLOWED_CR_STATUSES || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
    createAccounts: env.MAWANI_C4C_CREATE_ACCOUNTS_ENABLED === "true",
    createContacts: env.MAWANI_C4C_CREATE_CONTACTS_ENABLED === "true",
    uploadAttachments: env.MAWANI_C4C_UPLOAD_ATTACHMENTS_ENABLED === "true",
  };
}
function requireApprovedConfiguration(config) {
  if (
    !config.writesEnabled ||
    !config.contractReviewed ||
    !config.allowedSpace ||
    config.space !== config.allowedSpace ||
    !config.salesOrg ||
    !config.salesUnit ||
    !config.allowedStatuses?.size
  ) {
    throw new LicenseError(
      "LICENSE_WRITES_NOT_READY",
      "C4C writes require approved contracts, DEV space, sales organisation, and CR status policy",
      503,
    );
  }
}
function checkCodes(type, values, enabled) {
  if (!enabled || !enabled.size) {
    throw new LicenseError("LIST_NOT_READY", `${type} list is not active`, 503);
  }
  if (values.some((value) => !enabled.has(value))) {
    throw new LicenseError(
      "INVALID_SELECTION",
      `${type} selection is not active`,
      400,
    );
  }
}
function readableError(error) {
  if (error instanceof LicenseError)
    return { code: error.code, message: error.message };
  return {
    code: "UNEXPECTED_FAILURE",
    message:
      "Submission could not be confirmed; check operation tracking before retrying",
  };
}
function previousResult(row, hash, type) {
  if (!row) return null;
  if (String(row.REQUEST_SHA256).trim() !== hash) {
    throw new LicenseError(
      "REQUEST_REUSED",
      "Request ID was reused with different content",
      409,
    );
  }
  if (row.STATUS === "SUCCEEDED" && row.RESULT_JSON) {
    const value =
      typeof row.RESULT_JSON === "string"
        ? JSON.parse(row.RESULT_JSON)
        : row.RESULT_JSON;
    return { ...value, type, status: "ALREADY_SUCCEEDED" };
  }
  if (row.STATUS === "PARTIAL" && row.RESULT_JSON) {
    const value =
      typeof row.RESULT_JSON === "string"
        ? JSON.parse(row.RESULT_JSON)
        : row.RESULT_JSON;
    return { ...value, type, status: "PARTIAL" };
  }
  throw new LicenseError(
    "SUBMISSION_RECONCILIATION_REQUIRED",
    "A previous submission is pending, failed, or uncertain; reconcile before retrying",
    409,
  );
}

function createLicenseSubmitter({
  crs,
  c4c,
  writer,
  pricing,
  operations,
  getEnabledKeys,
  config,
}) {
  if (
    !crs?.requireOwned ||
    !c4c?.findAccountsForCr ||
    !c4c?.findQuotesForAccount ||
    !writer?.createQuote ||
    !operations?.claim ||
    !operations?.mark ||
    !operations?.find ||
    !pricing?.quote ||
    typeof getEnabledKeys !== "function"
  ) {
    throw new TypeError("Missing license submission dependencies");
  }

  async function validateLists(input) {
    checkCodes(
      "LICENSE_TYPE",
      input.licenseTypes,
      await getEnabledKeys("LICENSE_TYPE"),
    );
    checkCodes(
      "SERVICE_TYPE",
      input.serviceTypes,
      await getEnabledKeys("SERVICE_TYPE"),
    );
    checkCodes(
      "INVESTOR_TYPE",
      [input.investorType],
      await getEnabledKeys("INVESTOR_TYPE"),
    );
    if (input.portCode)
      checkCodes(
        "PORT_FOR_PERMIT",
        [input.portCode],
        await getEnabledKeys("PORT_FOR_PERMIT"),
      );
    if (input.activityType)
      checkCodes(
        "ACTIVITY_TYPE",
        [input.activityType],
        await getEnabledKeys("ACTIVITY_TYPE"),
      );
    if (input.serviceTypes.includes("111") && !input.portCode) {
      throw new LicenseError(
        "PORT_REQUIRED",
        "A port is required for the selected service",
        400,
      );
    }
    // Legacy external-application license types must not be moved silently into the new C4C flow.
    if (
      input.licenseTypes.some((type) => ["ZSA001", "ZMA001"].includes(type))
    ) {
      throw new LicenseError(
        "EXTERNAL_LICENSE_TYPE",
        "This license type uses a separate application",
        422,
      );
    }
  }

  function accountForType(accounts, type, input) {
    const matching = accounts.filter(
      (a) =>
        a.RoleCode === type &&
        (input.serviceTypes[0] !== "111" ||
          String(a.Port3_KUT || "") === input.portCode),
    );
    if (matching.length > 1)
      throw new LicenseError(
        "AMBIGUOUS_ACCOUNT",
        "Multiple C4C accounts match; resolve duplicate account mapping first",
        409,
      );
    return matching[0] || null;
  }

  async function submit({ actorUuid, identity, rawPayload }) {
    requireApprovedConfiguration(config); // No C4C writes with default settings.
    const input = parseSubmission(rawPayload);
    await validateLists(input);
    const cr = await crs.requireOwned(
      actorUuid,
      input.crNationalNumber,
      input.crNumber,
    );
    assertCommercialRegistration(cr, config.allowedStatuses);
    const quotePrice = await pricing.quote(input.licenseTypes);
    if (
      input.quotedTotalHalalas &&
      input.quotedTotalHalalas !== quotePrice.totalHalalas
    ) {
      throw new LicenseError(
        "PRICE_CHANGED",
        "The selected service price changed; refresh before submitting",
        409,
      );
    }
    const hash = payloadHash(input);
    const results = [];
    // Sequential intentionally: comprehensive license creates one independent operation per type.
    for (const type of input.licenseTypes) {
      try {
        const old = await operations.find(identity, input, type);
        if (old) {
          results.push(previousResult(old, hash, type));
          continue;
        }
        results.push(await submitType({ type, cr, input, identity, hash }));
      } catch (error) {
        const safe = readableError(error);
        results.push({
          type,
          status: "FAILED",
          errorCode: safe.code,
          message: safe.message,
        });
      }
    }
    return {
      clientRequestId: input.clientRequestId,
      currency: quotePrice.currency,
      totalHalalas: quotePrice.totalHalalas,
      results,
    };
  }

  async function submitType({ type, cr, input, identity, hash }) {
    let account;
    try {
      const allAccounts = await c4c.findAccountsForCr(cr);
      account = accountForType(allAccounts, type, input);
      if (account?.LicenseNumber_KUT) {
        return {
          type,
          status: "LICENSE_ALREADY_EXISTS",
          message: "C4C already has a license number for this type",
        };
      }
      if (account) {
        const quotes = await c4c.findQuotesForAccount(account.AccountID);
        const sameType = quotes.filter(
          (q) =>
            (q.LicenceType_KUT || q.Role1_KUT || "") === type &&
            (input.serviceTypes[0] !== "111" ||
              String(q.Port3_KUT || "") === input.portCode),
        );
        if (sameType.length) {
          return {
            type,
            status: "EXISTING_QUOTE_REVIEW",
            message: "Existing quote needs review before a new submission",
          };
        }
      } else if (!config.createAccounts) {
        return {
          type,
          status: "ACCOUNT_CREATION_REQUIRED",
          message: "C4C account creation is not approved/enabled",
        };
      }
      if (input.attachments.length && !config.uploadAttachments) {
        return {
          type,
          status: "ATTACHMENTS_NOT_ENABLED",
          message:
            "C4C attachment upload requires approval before creating a quote",
        };
      }
    } catch (error) {
      const safe = readableError(error);
      return {
        type,
        status: "FAILED",
        errorCode: safe.code,
        message: safe.message,
      };
    }

    // UNIQUE indexes reserve the CR/type before any external write: no C4C write inside a DB transaction.
    const id = await operations.claim(identity, input, type, hash);
    let stage = "RESERVED";
    let remoteWriteStarted = false;
    let accountID = account?.AccountID || "";
    let quote = null;
    const uploaded = [];
    try {
      if (!accountID) {
        stage = "ACCOUNT_POST";
        await operations.mark(id, { stage });
        remoteWriteStarted = true;
        const created = await writer.createAccount(cr, input, type);
        accountID = created.accountID;
        stage = "ACCOUNT_CREATED";
        await operations.mark(id, { stage, accountID });
      } else {
        await operations.mark(id, { stage: "ACCOUNT_RESOLVED", accountID });
      }

      if (config.createContacts) {
        stage = "CONTACT_LOOKUP";
        await operations.mark(id, { stage });
        const contacts = await writer.findMatchingContacts(
          accountID,
          input.applicant.mobile,
        );
        if (!contacts.length) {
          stage = "CONTACT_POST";
          await operations.mark(id, { stage });
          remoteWriteStarted = true;
          await writer.createContact(accountID, input);
          await operations.mark(id, { stage: "CONTACT_CREATED" });
        } else if (contacts.length > 1) {
          throw new LicenseError(
            "AMBIGUOUS_CONTACT",
            "Multiple matching contacts need reconciliation",
            409,
          );
        }
      }

      stage = "QUOTE_POST";
      await operations.mark(id, { stage, accountID });
      remoteWriteStarted = true;
      quote = await writer.createQuote(accountID, type, input, config);
      stage = "QUOTE_CREATED";
      await operations.mark(id, {
        stage,
        quoteID: quote.quoteID,
        quoteObjectID: quote.quoteObjectID,
        accountID,
      });

      for (const attachment of input.attachments) {
        stage = "ATTACHMENT_POST";
        await operations.mark(id, { stage, attachments: uploaded });
        const result = await writer.uploadAttachment(quote, attachment);
        uploaded.push(result);
        await operations.mark(id, {
          stage: "ATTACHMENT_CREATED",
          attachments: uploaded,
        });
      }
      const result = {
        type,
        status: "SUCCEEDED",
        accountID,
        quoteID: quote.quoteID,
        quoteObjectID: quote.quoteObjectID,
        attachments: uploaded,
      };
      await operations.mark(id, {
        status: "SUCCEEDED",
        stage: "COMPLETE",
        result,
        attachments: uploaded,
      });
      return result;
    } catch (error) {
      const safe = readableError(error);
      // If C4C may have committed a write, NEVER mark FAILED and automatically allow retries.
      const status = quote
        ? "PARTIAL"
        : remoteWriteStarted
          ? "UNCERTAIN"
          : "FAILED";
      const result = {
        type,
        status,
        accountID,
        quoteID: quote?.quoteID || "",
        quoteObjectID: quote?.quoteObjectID || "",
        attachments: uploaded,
        errorCode: safe.code,
        message: safe.message,
      };
      try {
        await operations.mark(id, {
          status,
          stage,
          accountID,
          quoteID: quote?.quoteID,
          quoteObjectID: quote?.quoteObjectID,
          attachments: uploaded,
          result,
          errorCode: safe.code,
        });
      } catch (_) {
        // Database state remains PENDING; the unique index prevents duplicate creation.
        return {
          ...result,
          status: "UNCERTAIN",
          message:
            "Tracking update failed after C4C processing. Reconcile this request before retrying.",
        };
      }
      return result;
    }
  }
  return { submit };
}
module.exports = {
  createLicenseSubmitter,
  configurationFromEnv,
  requireApprovedConfiguration,
};
