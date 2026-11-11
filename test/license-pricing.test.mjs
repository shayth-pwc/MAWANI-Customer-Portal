import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePreview, displaySar } from '../src/services/licensePricing.js'

test('UI totals use precise integer halalas when selecting multiple services', () => {
  const prices = [{ serviceCode: 'A', priceHalalas: '10050' }, { serviceCode: 'B', priceHalalas: '2499' }]
  assert.equal(calculatePreview(['A', 'B'], prices), '12549')
  assert.equal(calculatePreview(['B'], prices), '2499')
  assert.equal(displaySar('12549'), '125.49 SAR')
})
test('invalid and absent prices cannot silently become zero', () => {
  assert.throws(() => calculatePreview(['A'], []), /active price/)
  assert.throws(() => calculatePreview(['A'], [{ serviceCode: 'A', priceHalalas: '-20' }]), /Invalid service price/)
  assert.throws(() => calculatePreview(['A','A'], [{ serviceCode: 'A', priceHalalas: '100' }]), /Duplicate/)
  assert.equal(calculatePreview(['FREE'], [{ serviceCode: 'FREE', priceHalalas: '0' }]), '0')
})
