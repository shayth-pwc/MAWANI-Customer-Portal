"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createLicensePreflight,
} = require("../srv/core/licenses/license-preflight");

const ACTOR = "9c9664ef-acf6-4c0b-89ab-7f45f60ea565";
const INPUT = {
  crNationalNumber: "7000000000",
  crNumber: "123456",
  licenseType: "TEST03",
};
const CR = {
  CR_NUMBER: INPUT.crNumber,
  CR_NATIONAL_NUMBER: INPUT.crNationalNumber,
  IS_TEST_DATA: false,
  CR_STATUS: "Active",
  BTP_ACTIVE_STATUS: "Active",
};
const ACCOUNT = {
  AccountID: "C4C-1",
  RoleCode: INPUT.licenseType,
  CRNationalNumber_KUT: INPUT.crNationalNumber,
  CommercialRegisterNumber_KUT: INPUT.crNumber,
};

function setup({
  cr = CR,
  accounts = [ACCOUNT],
  quotes = [],
  allowed = ["TEST03"],
} = {}) {
  const calls = [];
  const crs = {
    requireOwned: async (uuid, national, number) => {
      calls.push(["requireOwned", uuid, national, number]);
      return cr;
    },
  };
  const c4c = {
    findAccountsForCr: async (record) => {
      calls.push(["findAccountsForCr", record]);
      return accounts;
    },
    findQuotesForAccount: async (id) => {
      calls.push(["findQuotesForAccount", id]);
      return quotes;
    },
  };
  return {
    preflight: createLicensePreflight({
      crs,
      c4c,
      allowedLicenseTypes: new Set(allowed),
    }),
    calls,
  };
}

test("valid mapping uses only the authenticated actor UUID and performs read-only C4C lookups", async () => {
  const { preflight, calls } = setup();
  const result = await preflight.check(ACTOR, INPUT);
  assert.equal(result.status, "ACCOUNT_FOUND_WRITE_NOT_ENABLED");
  assert.equal(result.accountID, "C4C-1");
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["requireOwned", "findAccountsForCr", "findQuotesForAccount"],
  );
  assert.deepEqual(calls[0], [
    "requireOwned",
    ACTOR,
    INPUT.crNationalNumber,
    INPUT.crNumber,
  ]);
});

test("synthetic CR is rejected before any C4C call", async () => {
  const { preflight, calls } = setup({ cr: { ...CR, IS_TEST_DATA: true } });
  await assert.rejects(
    preflight.check(ACTOR, INPUT),
    (e) => e.code === "TEST_CR_FORBIDDEN" && e.status === 403,
  );
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["requireOwned"],
  );
});

test("unknown active license type is rejected before querying CR or C4C", async () => {
  const { preflight, calls } = setup({ allowed: [] });
  await assert.rejects(
    preflight.check(ACTOR, INPUT),
    (e) => e.code === "INVALID_SELECTION" && e.status === 400,
  );
  assert.equal(calls.length, 0);
});

test("no matching account means account creation is required", async () => {
  const { preflight, calls } = setup({
    accounts: [{ ...ACCOUNT, RoleCode: "ANOTHER_TYPE" }],
  });
  assert.equal(
    (await preflight.check(ACTOR, INPUT)).status,
    "ACCOUNT_CREATION_REQUIRED",
  );
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["requireOwned", "findAccountsForCr"],
  );
});

test("two matching accounts are ambiguous; neither creates a quote", async () => {
  const { preflight } = setup({
    accounts: [ACCOUNT, { ...ACCOUNT, AccountID: "C4C-2" }],
  });
  const result = await preflight.check(ACTOR, INPUT);
  assert.equal(result.status, "AMBIGUOUS_ACCOUNT");
  assert.equal(result.accountMatches, 2);
  assert.equal(result.accountID, "");
});

test("existing license is flagged, even if account has no quote", async () => {
  const { preflight } = setup({
    accounts: [{ ...ACCOUNT, LicenseNumber_KUT: "LIC-123" }],
  });
  const result = await preflight.check(ACTOR, INPUT);
  assert.equal(result.status, "LICENSE_ALREADY_EXISTS");
  assert.equal(result.existingLicenseNumber, "LIC-123");
});

test("existing quote of same type is flagged for manual reconciliation", async () => {
  const { preflight } = setup({
    quotes: [{ LicenceType_KUT: "TEST03", ID: "Q1" }],
  });
  const result = await preflight.check(ACTOR, INPUT);
  assert.equal(result.status, "EXISTING_QUOTE_REVIEW");
  assert.equal(result.sameTypeQuoteCount, 1);
});

test("CR with unspecified IS_TEST_DATA flag is treated as unverified", async () => {
  const { preflight } = setup({ cr: { ...CR, IS_TEST_DATA: undefined } });
  await assert.rejects(preflight.check(ACTOR, INPUT), (e) => e.status === 403);
});
