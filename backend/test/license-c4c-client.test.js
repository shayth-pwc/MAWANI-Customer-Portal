"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createC4cClient } = require("../srv/core/licenses/c4c-client");

test("C4C connection checks only metadata through destination C4C_DES", async () => {
  const calls = [];
  const client = createC4cClient({
    executeHttpRequest: async (...args) => {
      calls.push(args);
      return {
        status: 200,
        data: '<?xml version="1.0"?><edmx:Edmx></edmx:Edmx>',
      };
    },
  });
  assert.deepEqual(await client.requestMetadata(), {
    connected: true,
    destination: "C4C_DES",
    status: "METADATA_REACHABLE",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], { destinationName: "C4C_DES" });
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].url, "/c4codataapi/$metadata");
});
test("C4C error details and destination credentials are not revealed", async () => {
  const client = createC4cClient({
    executeHttpRequest: async () => {
      throw new Error("supersecret password: abc123");
    },
  });
  await assert.rejects(
    client.requestMetadata(),
    (error) =>
      error.status === 503 &&
      !error.message.includes("supersecret") &&
      error.code === "C4C_UNAVAILABLE",
  );
});
test("HTTP 200 without OData metadata is not enough for connectivity success", async () => {
  const client = createC4cClient({
    executeHttpRequest: async () => ({
      status: 200,
      data: "<html>sign in</html>",
    }),
  });
  await assert.rejects(
    client.requestMetadata(),
    /C4C destination check failed/,
  );
});
