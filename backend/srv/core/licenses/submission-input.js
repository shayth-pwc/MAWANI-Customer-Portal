"use strict";

const { LicenseError, required } = require("./errors");

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{1,40}$/;
const EMAIL = /^[^\s@]{1,100}@[^\s@]{1,150}\.[^\s@]{2,50}$/;
const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB raw; CAP LicenseService request limit remains 2mb.

function invalid(message) {
  throw new LicenseError("INVALID_SUBMISSION", message, 400);
}
function code(value, name) {
  if (typeof value !== "string" || !CODE.test(value))
    invalid(`Invalid ${name}`);
  return value;
}
function optional(value, name, max = 160) {
  if (value === undefined || value === null || value === "") return "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    invalid(`Invalid ${name}`);
  return value.trim();
}
function uniqueCodes(values, name, maximum = 12) {
  if (!Array.isArray(values) || !values.length || values.length > maximum)
    invalid(`Invalid ${name} selection`);
  const result = values.map((value) => code(value, name));
  if (new Set(result).size !== result.length)
    invalid(`Duplicate ${name} selection`);
  return result;
}
function attachment(item) {
  if (!item || typeof item !== "object" || Array.isArray(item))
    invalid("Invalid attachment");
  const name = required(item.name, "Attachment name", 160);
  if (
    name !== name.split(/[\\/]/).pop() ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    name.startsWith(".")
  ) {
    invalid("Unsafe attachment filename");
  }
  const mimeType = optional(
    item.mimeType,
    "Attachment MIME type",
    100,
  ).toLowerCase();
  const extension = (name.match(/\.([A-Za-z0-9]+)$/) || [])[1]?.toLowerCase();
  const allowed = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  if (!extension || !allowed[extension] || allowed[extension] !== mimeType)
    invalid("Only matching PDF, PNG and JPEG attachments are supported");
  const b64 = item.contentBase64;
  if (
    typeof b64 !== "string" ||
    b64.length < 8 ||
    b64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      b64,
    )
  ) {
    invalid("Invalid or oversized Base64 attachment");
  }
  const bytes = Buffer.from(b64, "base64");
  if (
    !bytes.length ||
    bytes.length > MAX_FILE_BYTES ||
    bytes.toString("base64") !== b64
  )
    invalid("Invalid or oversized attachment bytes");
  const signatures = {
    pdf: bytes.subarray(0, 5).toString() === "%PDF-",
    png: bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpg: bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    jpeg: bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
  };
  if (!signatures[extension])
    invalid("Attachment content does not match its declared type");
  // Never store Base64 in the operations table or write it to logs.
  return { name, mimeType, contentBase64: b64, byteLength: bytes.length };
}

function parseSubmission(raw) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > 2 * 1024 * 1024
  )
    invalid("Invalid submission payload size");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    invalid("Submission payload is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Invalid submission payload");
  const clientRequestId = optional(
    value.clientRequestId,
    "Client request ID",
    64,
  );
  if (!UUID.test(clientRequestId))
    invalid("A valid client request UUID is required");
  const licenseTypes = uniqueCodes(value.licenseTypes, "license type", 10);
  const serviceTypes = uniqueCodes(
    value.serviceTypes ?? (value.serviceType ? [value.serviceType] : []),
    "service",
    30,
  );
  // Legacy C4C SalesQuote.Type1_KUT supports ONE service. No silent service loss.
  if (serviceTypes.length !== 1)
    throw new LicenseError(
      "MULTI_SERVICE_CONTRACT_PENDING",
      "More than one service requires an approved C4C mapping; submit one service for now",
      422,
    );
  if (value.serviceType && value.serviceType !== serviceTypes[0])
    invalid("Conflicting service selection");
  const input = value.applicant || {};
  const name = required(input.name, "Applicant name", 160);
  const id = required(input.id, "Applicant document number", 60);
  const documentType = code(input.documentType, "applicant document type");
  const mobile = required(input.mobile, "Applicant mobile", 40);
  if (!/^\+?[0-9][0-9\s-]{6,25}$/.test(mobile))
    invalid("Invalid applicant mobile");
  const email = required(input.email, "Applicant email", 254);
  if (!EMAIL.test(email)) invalid("Invalid applicant email");
  const files = value.attachments === undefined ? [] : value.attachments;
  if (!Array.isArray(files) || files.length > 1)
    invalid("Select at most one attachment per request");
  const address = value.address || {};
  const ministryDate = optional(
    value.ministryEnergyLicenseDate,
    "Ministry license date",
    10,
  );
  if (ministryDate) {
    const parsed = new Date(`${ministryDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(ministryDate) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== ministryDate
    )
      invalid("Invalid Ministry license date");
  }
  const quotedTotalHalalas = optional(
    value.quotedTotalHalalas,
    "Quoted total",
    24,
  );
  if (quotedTotalHalalas && !/^(0|[1-9][0-9]{0,23})$/.test(quotedTotalHalalas))
    invalid("Invalid quoted total");
  return {
    clientRequestId,
    crNumber: required(value.crNumber, "CR number", 32),
    crNationalNumber: required(
      value.crNationalNumber,
      "CR national number",
      32,
    ),
    licenseTypes,
    serviceTypes,
    investorType: code(value.investorType, "investor type"),
    portCode: value.portCode ? code(value.portCode, "port") : "",
    activityType: value.activityType
      ? code(value.activityType, "activity type")
      : "",
    shipName: optional(value.shipName, "ship name", 150),
    ministryEnergyLicenseDate: ministryDate,
    applicant: { name, id, documentType, mobile, email },
    address: {
      cityCode: optional(address.cityCode, "city", 40),
      postalCode: optional(address.postalCode, "postal code", 20),
      district: optional(address.district, "district", 100),
      street: optional(address.street, "street", 160),
      building: optional(address.building, "building", 40),
      secondaryNumber: optional(
        address.secondaryNumber,
        "secondary address number",
        40,
      ),
    },
    attachments: files.map(attachment),
    quotedTotalHalalas,
  };
}

function assertCommercialRegistration(cr, allowedStatuses) {
  if (cr?.IS_TEST_DATA !== false)
    throw new LicenseError(
      "UNVERIFIED_CR",
      "Synthetic or unverified CR cannot be submitted",
      403,
    );
  if (
    String(cr.BTP_ACTIVE_STATUS || "")
      .trim()
      .toUpperCase() !== "ACTIVE"
  ) {
    throw new LicenseError(
      "CR_INACTIVE",
      "Commercial registration is not active in the portal",
      403,
    );
  }
  const status = String(cr.CR_STATUS || "")
    .trim()
    .toUpperCase();
  if (!allowedStatuses.size || !allowedStatuses.has(status)) {
    throw new LicenseError(
      "CR_STATUS_NOT_APPROVED",
      "CR business status is not approved for C4C writes",
      403,
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, compare] of [
    ["START_DATE", "start"],
    ["END_DATE", "end"],
  ]) {
    if (cr[key] == null || cr[key] === "") continue;
    const value =
      cr[key] instanceof Date
        ? cr[key].toISOString().slice(0, 10)
        : String(cr[key]).slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      (compare === "start" ? value > today : value < today)
    ) {
      throw new LicenseError(
        "CR_DATE_INVALID",
        "Commercial registration is outside its validity dates",
        403,
      );
    }
  }
}

module.exports = {
  parseSubmission,
  assertCommercialRegistration,
  MAX_FILE_BYTES,
};
