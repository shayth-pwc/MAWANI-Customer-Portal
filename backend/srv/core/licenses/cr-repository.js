"use strict";
const { LicenseError, required } = require("./errors");

const TABLE = 'public."GENERAL_TBL_USERS_CR_DETAILS"';
// CR entitlements are loaded ONLY by UUID from a verified portal account.
function createCrRepository(db) {
  const scope = `"USER_UUID" = $1::uuid
    AND ("DELETED" IS NULL OR upper(trim("DELETED")) IN ('', 'N', '0', 'FALSE'))`;
    const columns = `"ID", "USER_UUID", "CR_NUMBER", "CR_NATIONAL_NUMBER",
    "CR_NAME", "CR_NAME_AR", "LICENSE_TYPE", "CR_STATUS",
    "BTP_ACTIVE_STATUS", "IS_TEST_DATA", "START_DATE", "END_DATE",
    "CR_CITY_EN", "CR_CITY_AR", "CR_CITY_CODE", "CITY_CODE",
    "CR_ADDRESS", "CR_ZIPCODE", "POSTAL_CODE", "DISTRICT",
    "STREET", "BUILDING", "SECONDARY_NUMBER", "SHORT_ADDRESS", "VAT_NO"`;

  async function listForUser(userUuid) {
    const rows = await db.run(
      `SELECT ${columns} FROM ${TABLE}
      WHERE ${scope} ORDER BY "CR_NUMBER", "ID" LIMIT 51`,
      [userUuid],
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "CR_UNAVAILABLE",
        "CR mappings are unavailable",
        503,
      );
    if (rows.length > 50)
      throw new LicenseError(
        "TOO_MANY_CRS",
        "Too many CR mappings to display safely",
        503,
      );
    return rows;
  }

  async function requireOwned(userUuid, crNationalNumber, crNumber) {
    const national = required(crNationalNumber, "CR national number", 32);
    const number = required(crNumber, "CR number", 32);
    const rows = await db.run(
      `SELECT ${columns} FROM ${TABLE}
      WHERE ${scope} AND "CR_NATIONAL_NUMBER" = $2 AND "CR_NUMBER" = $3 LIMIT 2`,
      [userUuid, national, number],
    );
    if (!Array.isArray(rows))
      throw new LicenseError(
        "CR_UNAVAILABLE",
        "CR mapping is unavailable",
        503,
      );
    // Same response for unknown and someone else's CR; never enumerate entitlements.
    if (rows.length !== 1)
      throw new LicenseError(
        "CR_NOT_AUTHORIZED",
        "Commercial registration is not available for this account",
        403,
      );
    return rows[0];
  }

  return { listForUser, requireOwned };
}
module.exports = { createCrRepository };
