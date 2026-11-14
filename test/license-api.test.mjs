import test from 'node:test'
import assert from 'node:assert/strict'
import { getLicenseAttachments, getRequestAttachments, getServicePrices, getServiceQuote, submitLicenseRequest } from '../src/services/licensesApi.js'
const json = value => ({ ok: true, status: 200, headers: { get: name => name === 'content-type' ? 'application/json' : name === 'x-csrf-token' ? 'valid-token' : null }, json: async () => value })
test('service prices are read through authenticated same-origin license route', async () => {
  const calls = []
  const result = await getServicePrices(async (url, opts) => { calls.push([url, opts]); return json({ value: [{ serviceCode: 'A', priceHalalas: '500' }] }) })
  assert.equal(calls[0][0], '/licenses-api/getServicePrices()')
  assert.equal(calls[0][1].credentials,'same-origin')
  assert.equal(result[0].priceHalalas,'500')
})
test('authoritative quote serializes selected service codes as a single CAP parameter', async () => {
  const calls=[]
  await getServiceQuote(['A','B'], async url => { calls.push(url); return json({ totalHalalas: '1600', currency: 'SAR' }) })
  assert.match(calls[0], /^\/licenses-api\/quoteServices\(serviceCodes='/)
  assert.match(decodeURIComponent(calls[0]), /\["A","B"\]/)
})
test('writes fetch CSRF token, send once, and return structured result', async () => {
  const calls=[]
  const result=await submitLicenseRequest({ clientRequestId: 'abc' }, async (url, opts) => {
    calls.push([url,opts]); return url.endsWith('$metadata') ? json({}) : json({ value: JSON.stringify({ results: [{ status: 'SUCCEEDED' }] }) })
  })
  assert.equal(calls.length,2)
  assert.equal(calls[0][0],'/licenses-api/$metadata')
  assert.equal(calls[1][0],'/licenses-api/submitLicense')
  assert.equal(calls[1][1].headers['X-CSRF-Token'],'valid-token')
  assert.equal(result.results[0].status,'SUCCEEDED')
})
test('unknown POST outcome does not automatically resend', async () => {
  const calls=[]
  await assert.rejects(submitLicenseRequest({}, async (url,opts) => {
    calls.push(url)
    if (url.endsWith('$metadata')) return json({})
    throw new Error('network lost')
  }), error => error.uncertain && /do not resubmit/i.test(error.message))
  assert.equal(calls.length,2)
})
test('attachment reads use the scoped license and request endpoints', async () => {
  const calls = []
  const fetcher = async url => {
    calls.push(url)
    return json({ value: [{ Name: 'proof.pdf' }] })
  }
  assert.deepEqual(await getLicenseAttachments('A1', fetcher), [{ Name: 'proof.pdf' }])
  assert.deepEqual(await getRequestAttachments('900', fetcher), [{ Name: 'proof.pdf' }])
  assert.equal(calls[0], "/licenses-api/getLicenseAttachments(accountId='A1')")
  assert.equal(calls[1], "/licenses-api/getRequestAttachments(requestId='900')")
})
