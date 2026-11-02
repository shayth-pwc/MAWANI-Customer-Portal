"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const validate = require("../srv/core/utils/validation");

test("reject malformed UUIDs before database calls", () => {
  assert.throws(() => validate.uuid("x' OR TRUE--"), /Invalid user UUID/);
  assert.equal(
    validate.uuid("01234567-89ab-4cde-8fab-0123456789ab"),
    "01234567-89ab-4cde-8fab-0123456789ab",
  );
});
test("reject negative page offsets and huge limits", () => {
  assert.throws(() => validate.int(-1, "offset", 0, 0, 100), /Invalid offset/);
  assert.throws(() => validate.int(500, "limit", 50, 1, 100), /Invalid limit/);
});
