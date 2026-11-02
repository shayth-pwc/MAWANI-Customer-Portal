"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const IasClient = require("../srv/core/clients/ias.client");

const cfg = Object.freeze({
  baseUrl: "https://ias.example.com/service/scim",
  authMode: "basic",
  clientId: "technical",
  clientSecret: "secret",
  timeoutMs: 2000,
});

test("IAS Basic auth uses technical credentials only on HTTPS SCIM endpoint", async () => {
  const calls = [];
  const client = new IasClient({
    config: cfg,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, text: async () => '{"id":"u1"}' };
    },
  });
  const result = await client.request("GET", "/Users/u1");
  assert.equal(result.id, "u1");
  assert.equal(calls[0].url, "https://ias.example.com/service/scim/Users/u1");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Basic " + Buffer.from("technical:secret").toString("base64"),
  );
  await assert.rejects(
    () => client.request("GET", "/../admin"),
    /Unsupported IAS/,
  );
});

test("SCIM 409 maps to user conflict without disclosing provider body", async () => {
  const client = new IasClient({
    config: cfg,
    fetchImpl: async () => ({ ok: false, status: 409 }),
  });
  await assert.rejects(
    () => client.request("POST", "/Users", {}),
    (err) => err.status === 409 && err.message === "IAS user conflict",
  );
});

test("No hidden retry is attempted for potentially non-idempotent writes", async () => {
  let calls = 0;
  const client = new IasClient({
    config: cfg,
    fetchImpl: async () => {
      calls++;
      throw Error("timeout");
    },
  });
  await assert.rejects(
    () => client.request("POST", "/Users", {}),
    (err) => err.code === "IAS_RESULT_UNCERTAIN" && err.status === 503,
  );
  assert.equal(calls, 1);
});
