"use strict";
const { LicenseError } = require("./errors");
const TABLE = 'public."BTP_TBL_LICENSE_SERVICE_PRICES"';

function normalizeServices(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 30) {
    throw new LicenseError(
      "INVALID_SERVICES",
      "Select between 1 and 30 services",
      400,
    );
  }
  const keys = values.map((value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(value)) {
      throw new LicenseError(
        "INVALID_SERVICES",
        "Invalid service selection",
        400,
      );
    }
    return value;
  });
  if (new Set(keys).size !== keys.length) {
    throw new LicenseError(
      "DUPLICATE_SERVICE",
      "Select each service once",
      400,
    );
  }
  return keys;
}

function parseHalalas(value) {
  const text = typeof value === "bigint" ? value.toString() : String(value);
  if (!/^(0|[1-9][0-9]{0,15})$/.test(text)) {
    throw new LicenseError(
      "INVALID_PRICE",
      "An invalid service price was returned",
      503,
    );
  }
  return BigInt(text);
}

function createServicePricing(db) {
  async function getActivePrices() {
    const rows = await db.run(
      `SELECT "SERVICE_CODE", "PRICE_HALALAS"::text AS "PRICE_HALALAS" FROM ${TABLE} WHERE "ACTIVE" = true ORDER BY "SERVICE_CODE"`,
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "PRICES_UNAVAILABLE",
        "Service prices are unavailable",
        503,
      );
    return rows.map((row) => ({
      serviceCode: row.SERVICE_CODE,
      priceHalalas: parseHalalas(row.PRICE_HALALAS).toString(),
      currency: "SAR",
    }));
  }
  async function quote(values) {
    const keys = normalizeServices(values);
    const placeholders = keys
      .map((_, index) => `$${index + 1}::text`)
      .join(", ");

    const rows = await db.run(
      `SELECT
     "SERVICE_CODE",
     "PRICE_HALALAS"::text AS "PRICE_HALALAS"
   FROM ${TABLE}
   WHERE "ACTIVE" = true
     AND "SERVICE_CODE" IN (${placeholders})`,
      keys,
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "PRICES_UNAVAILABLE",
        "Service prices are unavailable",
        503,
      );
    const byCode = new Map(
      rows.map((row) => [row.SERVICE_CODE, parseHalalas(row.PRICE_HALALAS)]),
    );
    const unavailable = keys.filter((key) => !byCode.has(key));
    if (unavailable.length)
      throw new LicenseError(
        "PRICE_NOT_CONFIGURED",
        "A selected service does not have an active price",
        409,
      );
    const total = keys.reduce((sum, key) => sum + byCode.get(key), 0n);
    return {
      currency: "SAR",
      totalHalalas: total.toString(),
      items: keys.map((serviceCode) => ({
        serviceCode,
        priceHalalas: byCode.get(serviceCode).toString(),
        currency: "SAR",
      })),
    };
  }
  return { getActivePrices, quote };
}
module.exports = { normalizeServices, parseHalalas, createServicePricing };
