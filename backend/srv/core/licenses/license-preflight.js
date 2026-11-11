"use strict";

const { LicenseError, safeCode } = require("./errors");

function createLicensePreflight({ crs, c4c, allowedLicenseTypes }) {
  if (
    !crs?.requireOwned ||
    !c4c?.findAccountsForCr ||
    !c4c?.findQuotesForAccount ||
    !allowedLicenseTypes ||
    typeof allowedLicenseTypes.has !== "function"
  ) {
    throw new TypeError("License preflight dependencies are missing");
  }

  async function check(actorUuid, input = {}) {
    const licenseType = safeCode(input.licenseType, "license type");
    if (!allowedLicenseTypes.has(licenseType)) {
      throw new LicenseError(
        "INVALID_SELECTION",
        "License type is not active in portal lists",
        400,
      );
    }

    // Only the verified IAS user's portal UUID may scope this query.
    // Browser-supplied user IDs are never used.
    const cr = await crs.requireOwned(
      actorUuid,
      input.crNationalNumber,
      input.crNumber,
    );
    if (cr.IS_TEST_DATA !== false) {
      throw new LicenseError(
        "TEST_CR_FORBIDDEN",
        "A synthetic or unverified CR cannot be used for C4C submission",
        403,
      );
    }

    const base = {
      licenseType,
      accountID: "",
      accountMatches: 0,
      sameTypeQuoteCount: 0,
      accountQuoteCount: 0,
      existingLicenseNumber: "",
      crStatus: String(cr.CR_STATUS || "").slice(0, 256),
      btpActiveStatus: String(cr.BTP_ACTIVE_STATUS || "").slice(0, 32),
    };

    // Read-only C4C calls, scoped to both CR numbers by the existing C4C client.
    const accounts = await c4c.findAccountsForCr(cr);
    const matching = accounts.filter((a) => a.RoleCode === licenseType);

    if (matching.length === 0) {
      return {
        ...base,
        status: "ACCOUNT_CREATION_REQUIRED",
        message:
          "No C4C corporate account matches this CR and license type; do not POST a Sales Quote yet",
      };
    }
    if (matching.length > 1) {
      return {
        ...base,
        accountMatches: matching.length,
        status: "AMBIGUOUS_ACCOUNT",
        message:
          "Multiple matching C4C corporate accounts require manual resolution",
      };
    }

    const account = matching[0];
    const quotes = await c4c.findQuotesForAccount(account.AccountID);
    const sameType = quotes.filter(
      (q) => (q.LicenceType_KUT || q.Role1_KUT || "") === licenseType,
    );
    const licenseNumber = String(account.LicenseNumber_KUT || "").trim();

    const result = {
      ...base,
      accountID: account.AccountID,
      accountMatches: 1,
      accountQuoteCount: quotes.length,
      sameTypeQuoteCount: sameType.length,
      existingLicenseNumber: licenseNumber.slice(0, 80),
    };

    if (licenseNumber) {
      return {
        ...result,
        status: "LICENSE_ALREADY_EXISTS",
        message: "C4C account already has a license number",
      };
    }
    if (sameType.length) {
      return {
        ...result,
        status: "EXISTING_QUOTE_REVIEW",
        message:
          "A Sales Quote for this license type already exists; reconcile before creating another",
      };
    }
    return {
      ...result,
      status: "ACCOUNT_FOUND_WRITE_NOT_ENABLED",
      message:
        "Account mapped. CR status, C4C write metadata, business rules, and idempotency still require approval",
    };
  }

  return { check };
}

module.exports = { createLicensePreflight };
