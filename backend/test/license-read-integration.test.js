"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCrRepository } = require("../srv/core/licenses/cr-repository");
const { createC4cClient } = require("../srv/core/licenses/c4c-client");
const {
  createLicenseQueries,
} = require("../srv/core/licenses/license-queries");
const USER_UUID = "9c9664ef-acf6-4c0b-89ab-7f45f60ea565";
const CR = {
  ID: "cr1",
  CR_NUMBER: "123456",
  CR_NATIONAL_NUMBER: "7000000000",
  CR_NAME: "Client",
  IS_TEST_DATA: false,
};

test("CR repository limits all queries by authenticated portal UUID", async () => {
  const queries = [];
  const db = {
    run: async (sql, params) => {
      queries.push({ sql, params });
      return [CR];
    },
  };
  const repo = createCrRepository(db);
  assert.deepEqual(await repo.listForUser(USER_UUID), [CR]);
  assert.equal(
    (await repo.requireOwned(USER_UUID, "7000000000", "123456")).ID,
    "cr1",
  );
  assert.ok(queries.every((q) => q.sql.includes('"USER_UUID" = $1::uuid')));
  assert.deepEqual(queries[1].params, [USER_UUID, "7000000000", "123456"]);
});

test("CR mapping cannot be obtained by someone else or by duplicate records", async () => {
  const r = createCrRepository({ run: async () => [] });
  await assert.rejects(
    r.requireOwned(USER_UUID, "7000000000", "123456"),
    (e) => e.status === 403,
  );
  const dup = createCrRepository({ run: async () => [CR, CR] });
  await assert.rejects(
    dup.requireOwned(USER_UUID, "7000000000", "123456"),
    (e) => e.status === 403,
  );
});

test("C4C client queries only filtered account and quote collections via destination", async () => {
  const calls = [];
  const client = createC4cClient({
    executeHttpRequest: async (d, r, o) => {
      calls.push({ d, r, o });
      const value = r.url.includes("CorporateAccountCollection")
        ? [
            {
              AccountID: "A1",
              CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER,
              CommercialRegisterNumber_KUT: CR.CR_NUMBER,
            },
          ]
        : [{ ObjectID: "Q1", ID: "77", BuyerPartyID: "A1" }];
      return { status: 200, data: { d: { results: value } } };
    },
  });
  assert.equal((await client.findAccountsForCr(CR))[0].AccountID, "A1");
  assert.equal((await client.findQuotesForAccount("A1"))[0].ObjectID, "Q1");
  assert.ok(
    calls.every(
      (c) =>
        c.r.method === "GET" &&
        c.r.url.startsWith("/c4codataapi/") &&
        c.d.destinationName === "C4C_DES",
    ),
  );
  assert.ok(
    decodeURIComponent(calls[0].r.url).includes(
      "CRNationalNumber_KUT eq '7000000000'",
    ),
  );
  assert.ok(
    decodeURIComponent(calls[1].r.url).includes("BuyerPartyID eq 'A1'"),
  );
});

test("C4C client prevents ignored filters and pagination leakage", async () => {
  const bad = createC4cClient({
    executeHttpRequest: async () => ({
      status: 200,
      data: {
        d: {
          results: [
            {
              AccountID: "A1",
              CRNationalNumber_KUT: "OTHER",
              CommercialRegisterNumber_KUT: "123456",
            },
          ],
        },
      },
    }),
  });
  await assert.rejects(
    bad.findAccountsForCr(CR),
    (e) => e.code === "C4C_SCOPE_MISMATCH",
  );
  const paged = createC4cClient({
    executeHttpRequest: async () => ({
      status: 200,
      data: { d: { results: [], __next: "https://other-host/" } },
    }),
  });
  await assert.rejects(
    paged.findAccountsForCr(CR),
    (e) => e.code === "C4C_INVALID_PAGE",
  );
});

test("read queries skip synthetic CRs; no C4C call for dummy row", async () => {
  let callCount = 0;
  const q = createLicenseQueries({
    crs: { listForUser: async () => [{ ...CR, IS_TEST_DATA: true }] },
    c4c: {
      findAccountsForCr: async () => {
        callCount++;
        return [];
      },
    },
  });
  assert.deepEqual(await q.getMyLicenses(USER_UUID), []);
  assert.deepEqual(await q.getMyRequests(USER_UUID), []);
  assert.equal(callCount, 0);
});

test("My Licenses and My Requests scoped to verified C4C account", async () => {
  const account = {
    AccountID: "A1",
    ObjectID: "C1",
    RoleCode: "ZSA010",
    LicenseNumber_KUT: "LIC-1",
    LicenseStatus_KUTText: "Active",
    Port3_KUT: "JED",
    LicenseValidFrom_KUT: "/Date(1735689600000)/",
    LicenseValidTo_KUT: "/Date(1830211200000)/",
  };
  const c4c = {
    findAccountsForCr: async () => [account],
    findQuotesForAccount: async () => [
      {
        BuyerPartyID: "A1",
        ID: "900",
        ObjectID: "Q1",
        Role1_KUT: "ZSA010",
        RequestType_KUT: "NEW",
        Type1_KUT: "LICENSE",
        Port3_KUT: "JED",
        LiscenceStatus_KUTText: "Open",
        NetAmount: "1500",
        CreationDateTime: "/Date(1794643200000)/",
      },
    ],
  };
  const q = createLicenseQueries({
    crs: { listForUser: async () => [CR] },
    c4c,
    loadList: async code => ({ items: ({
      LICENSE_TYPE: [{ key: "ZSA010", title: "Ship supplier", titleAr: "مورد سفن", active: true }],
      PORT_FOR_PERMIT: [{ key: "JED", title: "Jeddah", titleAr: "جدة", active: true }],
      SERVICE_TYPE: [{ key: "LICENSE", title: "License", titleAr: "ترخيص", active: true }],
    })[code] }),
  });
  assert.deepEqual(await q.getMyLicenses(USER_UUID), [
    {
      AccountID: "A1",
      ObjectID: "C1",
      LicenseNumber: "LIC-1",
      LicenseType: "ZSA010",
      LicenseTypeText: "Ship supplier",
      LicenseTypeTextAr: "مورد سفن",
      CRNationalNumber: CR.CR_NATIONAL_NUMBER,
      CommercialRegistrationNumber: CR.CR_NUMBER,
      CompanyName: "Client",
      Port: "JED",
      PortText: "Jeddah",
      PortTextAr: "جدة",
      Status: "Active",
      StartDate: "2025-01-01",
      ExpiryDate: "2027-12-31",
      Amount: "",
      QuoteID: "",
      QuoteObjectID: "",
    },
  ]);
  assert.deepEqual(await q.getMyRequests(USER_UUID), [
    {
      ID: "900",
      ObjectID: "Q1",
      BuyerPartyID: "A1",
      LicenseType: "ZSA010",
      LicenseTypeText: "Ship supplier",
      LicenseTypeTextAr: "مورد سفن",
      RequestType: "NEW",
      ServiceType: "LICENSE",
      ServiceTypeText: "License",
      ServiceTypeTextAr: "ترخيص",
      Port: "JED",
      PortText: "Jeddah",
      PortTextAr: "جدة",
      Status: "Open",
      Amount: "1500",
      CreatedAt: "2026-11-14",
      CRNationalNumber: CR.CR_NATIONAL_NUMBER,
      CommercialRegistrationNumber: CR.CR_NUMBER,
      CompanyName: "Client",
    },
  ]);
});

test("attachment reads use only a scoped license account or request", async () => {
  const account = {
    AccountID: "A1", ObjectID: "C1", RoleCode: "ZSA010", LicenseNumber_KUT: "LIC-1",
    CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER, CommercialRegisterNumber_KUT: CR.CR_NUMBER,
  };
  const quote = {
    ID: "900", ObjectID: "Q1", BuyerPartyID: "A1", LicenceType_KUT: "ZSA010",
    LiscenceStatus_KUT: "121", CreationDateTime: "2026-11-14T08:00:00",
  };
  const calls = [];
  const q = createLicenseQueries({
    crs: { listForUser: async () => [CR] },
    c4c: {
      findAccountsForCr: async () => [account],
      findQuotesForAccount: async () => [quote],
      salesQuoteAttachments: async objectId => { calls.push(objectId); return [{ Name: "proof.pdf" }]; },
    },
  });
  assert.deepEqual(await q.getLicenseAttachments(USER_UUID, "A1"), [{ Name: "proof.pdf" }]);
  assert.deepEqual(await q.getRequestAttachments(USER_UUID, "900"), [{ Name: "proof.pdf" }]);
  assert.deepEqual(calls, ["Q1", "Q1"]);
  await assert.rejects(q.getLicenseAttachments(USER_UUID, "OTHER"), error => error.code === "LICENSE_NOT_FOUND");
  await assert.rejects(q.getRequestAttachments(USER_UUID, "OTHER"), error => error.code === "REQUEST_NOT_FOUND");
});

test("legacy license and request status codes are translated when C4C text is absent", async () => {
  const account = {
    AccountID: "A1", RoleCode: "ZSA010", LicenseNumber_KUT: "LIC-1", LicenseStatus_KUT: "111",
    CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER, CommercialRegisterNumber_KUT: CR.CR_NUMBER,
  };
  const q = createLicenseQueries({
    crs: { listForUser: async () => [CR] },
    c4c: {
      findAccountsForCr: async () => [account],
      findQuotesForAccount: async () => [{ ID: "1", ObjectID: "Q1", BuyerPartyID: "A1", LiscenceStatus_KUT: "121" }],
    },
  });
  assert.equal((await q.getMyLicenses(USER_UUID))[0].Status, "Expired");
  assert.equal((await q.getMyRequests(USER_UUID))[0].Status, "Approved");
});

test("C4C paging retains filter and never follows next-link host", async () => {
  const calls = [];
  const c4c = createC4cClient({
    executeHttpRequest: async (_, req) => {
      calls.push(req.url);
      return req.url.includes("$skiptoken=abc")
        ? {
            status: 200,
            data: {
              d: {
                results: [
                  {
                    AccountID: "A2",
                    CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER,
                    CommercialRegisterNumber_KUT: CR.CR_NUMBER,
                  },
                ],
              },
            },
          }
        : {
            status: 200,
            data: {
              d: {
                results: [
                  {
                    AccountID: "A1",
                    CRNationalNumber_KUT: CR.CR_NATIONAL_NUMBER,
                    CommercialRegisterNumber_KUT: CR.CR_NUMBER,
                  },
                ],
                __next: "https://evil.example/other?$skiptoken=abc",
              },
            },
          };
    },
  });
  assert.equal((await c4c.findAccountsForCr(CR)).length, 2);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every((s) =>
      s.startsWith("/c4codataapi/CorporateAccountCollection?"),
    ),
  );
  assert.ok(
    calls.every((s) =>
      decodeURIComponent(s).includes("CRNationalNumber_KUT eq"),
    ),
  );
});
