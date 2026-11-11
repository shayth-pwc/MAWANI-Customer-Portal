"use strict";

const { randomUUID, createHash } = require("node:crypto");
const { LicenseError } = require("./errors");

const TABLE = 'public."BTP_TBL_LICENSE_OPERATIONS"';

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
function payloadHash(input) {
  return createHash("sha256").update(stableJSON(input)).digest("hex");
}

function createSubmissionOperations(db) {
  if (typeof db?.tx !== "function")
    throw new TypeError("Committed CAP DB transactions are required");
  // IMPORTANT: db.tx(callback) creates a new root transaction which COMMITS before
  // any external C4C POST. Do not perform network calls in the DB transaction.
  async function committed(action) {
    return db.tx(async (tx) => action(tx));
  }
  async function find(identity, input, licenseType) {
    const rows = await committed((tx) =>
      tx.run(
        `SELECT "ID", "STATUS", "REQUEST_SHA256", "RESULT_JSON",
      "ACCOUNT_ID", "QUOTE_ID", "QUOTE_OBJECT_ID", "STAGE"
      FROM ${TABLE}
      WHERE "IAS_ISSUER" = $1::text AND "IAS_SUBJECT" = $2::text
        AND "CLIENT_REQUEST_ID" = $3::uuid AND "LICENSE_TYPE" = $4::text
        AND "OPERATION_KIND" = 'NEW' LIMIT 1`,
        [identity.issuer, identity.subject, input.clientRequestId, licenseType],
      ),
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "OPERATIONS_UNAVAILABLE",
        "Operation tracking unavailable",
        503,
      );
    return rows[0] || null;
  }
  async function claim(identity, input, licenseType, hash) {
    const id = randomUUID();
    const rows = await committed((tx) =>
      tx.run(
        `WITH claimed AS (
      INSERT INTO ${TABLE}
      ("ID", "IAS_ISSUER", "IAS_SUBJECT", "CR_NATIONAL_NUMBER", "CR_NUMBER",
       "CLIENT_REQUEST_ID", "LICENSE_TYPE", "OPERATION_KIND", "REQUEST_SHA256", "STATUS", "STAGE")
      VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text,
              $6::uuid, $7::text, 'NEW', $8::text, 'PENDING', 'RESERVED')
      ON CONFLICT DO NOTHING RETURNING "ID"
    ) SELECT "ID" FROM claimed`,
        [
          id,
          identity.issuer,
          identity.subject,
          input.crNationalNumber,
          input.crNumber,
          input.clientRequestId,
          licenseType,
          hash,
        ],
      ),
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "OPERATIONS_UNAVAILABLE",
        "Operation tracking unavailable",
        503,
      );
    if (rows.length !== 1)
      throw new LicenseError(
        "DUPLICATE_LICENSE_REQUEST",
        "This CR and license type already have an active or recorded submission; reconcile before retrying",
        409,
      );
    return id;
  }
  async function mark(id, options) {
    const row = {
      status: options.status || null,
      stage: options.stage || null,
      accountID: options.accountID || null,
      quoteID: options.quoteID || null,
      quoteObjectID: options.quoteObjectID || null,
      result:
        options.result === undefined ? null : JSON.stringify(options.result),
      attachments:
        options.attachments === undefined
          ? null
          : JSON.stringify(options.attachments),
      errorCode: options.errorCode || null,
    };
    const rows = await committed((tx) =>
      tx.run(
        `WITH marked AS (
      UPDATE ${TABLE}
      SET "STATUS" = COALESCE($2::text, "STATUS"),
          "STAGE" = COALESCE($3::text, "STAGE"),
          "ACCOUNT_ID" = COALESCE($4::text, "ACCOUNT_ID"),
          "QUOTE_ID" = COALESCE($5::text, "QUOTE_ID"),
          "QUOTE_OBJECT_ID" = COALESCE($6::text, "QUOTE_OBJECT_ID"),
          "RESULT_JSON" = COALESCE($7::jsonb, "RESULT_JSON"),
          "ATTACHMENTS_JSON" = COALESCE($8::jsonb, "ATTACHMENTS_JSON"),
          "ERROR_CODE" = COALESCE($9::text, "ERROR_CODE"),
          "CHANGED_ON" = now()
      WHERE "ID" = $1::uuid RETURNING "ID"
    ) SELECT "ID" FROM marked`,
        [
          id,
          row.status,
          row.stage,
          row.accountID,
          row.quoteID,
          row.quoteObjectID,
          row.result,
          row.attachments,
          row.errorCode,
        ],
      ),
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new LicenseError(
        "OPERATION_RECORD_UNCERTAIN",
        "Operation tracking could not be confirmed; do not retry automatically",
        503,
      );
    }
  }
  return { find, claim, mark };
}
module.exports = { createSubmissionOperations, payloadHash };
