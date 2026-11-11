"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeServices,
  parseHalalas,
  createServicePricing,
} = require("../srv/core/licenses/service-pricing");

function database() {
  const calls = [];
  return {
    calls,
    async run(sql, values) {
      calls.push({ sql, values });
      const data = [
        { SERVICE_CODE: "PORT", PRICE_HALALAS: "12500" },
        { SERVICE_CODE: "AGENT", PRICE_HALALAS: "500" },
        { SERVICE_CODE: "FREE", PRICE_HALALAS: "0" },
      ];
      return values
        ? data.filter((row) => values.includes(row.SERVICE_CODE))
        : data;
    },
  };
}
test("multi-service price quote sums halalas exactly and uses SQL binding", async () => {
  const db = database();
  const quote = await createServicePricing(db).quote(["PORT", "AGENT", "FREE"]);
  assert.equal(quote.totalHalalas, "13000");
  assert.equal(quote.currency, "SAR");
  assert.deepEqual(
    quote.items.map((row) => row.serviceCode),
    ["PORT", "AGENT", "FREE"],
  );
  assert.match(db.calls[0].sql, /IN \(\$1::text, \$2::text, \$3::text\)/);

  assert.deepEqual(db.calls[0].values, ["PORT", "AGENT", "FREE"]);
});
test("inactive or unpriced services cannot be quoted as zero", async () => {
  await assert.rejects(
    createServicePricing(database()).quote(["UNKNOWN"]),
    (error) => error.code === "PRICE_NOT_CONFIGURED" && error.status === 409,
  );
});
test("duplicates, injection and invalid list sizes are rejected before SQL", async () => {
  for (const input of [
    [],
    ["PORT", "PORT"],
    ["PORT; DROP TABLE"],
    Array(31).fill("PORT"),
  ]) {
    const db = database();
    await assert.rejects(createServicePricing(db).quote(input));
    assert.equal(db.calls.length, 0);
  }
});
test("halalas use lossless integers and reject invalid prices", () => {
  assert.equal(parseHalalas("9999999999999999"), 9999999999999999n);
  for (const v of [-1, "1.25", "NaN", null, "-1"])
    assert.throws(() => parseHalalas(v));
});
test("only active prices are returned and zero-valued service is valid", async () => {
  const price = await createServicePricing(database()).getActivePrices();
  assert.equal(price.length, 3);
  assert.equal(
    price.find((row) => row.serviceCode === "FREE").priceHalalas,
    "0",
  );
});
