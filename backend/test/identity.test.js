"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { trustedIdentity } = require("../srv/core/security/identity");

function req(iss = "https://tenant.example.com", sub = "s-42") {
  const jwt = `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ iss, sub })).toString("base64url")}.sig`;
  return {
    user: {
      id: sub,
      is: (role) => role === "authenticated-user",
      authInfo: { token: { jwt } },
    },
  };
}
test("Admin identity derives issuer+subject from verified security context only", () => {
  const data = trustedIdentity(req());
  assert.deepEqual(data, {
    issuer: "https://tenant.example.com",
    subject: "s-42",
  });
});
test("Reject missing security context, even if user ID appears present", () => {
  assert.throws(
    () => trustedIdentity({ user: { id: "s-42", is: () => true } }),
    /token information unavailable/,
  );
});
test("Reject mismatched token subject and caller", () => {
  const request = req();
  request.user.id = "someone-else";
  assert.throws(() => trustedIdentity(request), /issuer and subject/);
});
test("Reject unauthenticated callers", () => {
  assert.throws(
    () => trustedIdentity({ user: { id: "a", is: () => false } }),
    /authentication required/,
  );
});
