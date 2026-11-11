/** All amounts are nonnegative integers in SAR halalas; this is only a display preview.
 * The backend must recalculate an authoritative quote before any C4C mutation. */
export function calculatePreview(serviceCodes, priceRows) {
  if (!Array.isArray(serviceCodes) || !Array.isArray(priceRows)) throw new Error('Service pricing is unavailable')
  if (new Set(serviceCodes).size !== serviceCodes.length) throw new Error('Duplicate services selected')
  const prices = new Map()
  for (const row of priceRows) {
    if (!row || typeof row.serviceCode !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(String(row.priceHalalas)))
      throw new Error('Invalid service price configured')
    prices.set(row.serviceCode, BigInt(row.priceHalalas))
  }
  let total = 0n
  for (const code of serviceCodes) {
    if (!prices.has(code)) throw new Error('A selected service does not have an active price')
    total += prices.get(code)
  }
  return total.toString()
}
export function displaySar(halalas, locale = 'en-SA') {
  const value = BigInt(halalas)
  const units = value / 100n
  const fractions = String(value % 100n).padStart(2, '0')
  return `${units.toLocaleString(locale)}.${fractions} SAR`
}
