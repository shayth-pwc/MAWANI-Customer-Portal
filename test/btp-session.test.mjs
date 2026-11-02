import test from 'node:test'
import assert from 'node:assert/strict'
import { PortalSessionError, bootstrapPortalProfile, provisionAndReadProfile, readOnlyProfile, validateProfile } from '../src/services/portalSession.js'
import { toPortalUser, toProfileDetails } from '../src/services/portalProfile.js'

const profile = Object.freeze({
  UUID: 'fc92c7ac-66b6-48a3-a96f-614ff384ad8f',
  IAS_ID: '83c30c52-6933-4223-b916-18f0a6b751dc',
  ACCOUNT_TYPE: 'PORTAL_USER',
  EMAIL: 'test@example.invalid',
  FNAME: 'Mawani',
  LNAME: 'Test',
  ACTIVE_STATUS: true,
})
const answer = (body, status = 200, headers = {}) => new Response(
  typeof body === 'string' ? body : JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json', ...headers } },
)

test('provisions via CSRF POST then verifies profile via read-only GET; no browser token', async () => {
  const calls = []
  const mock = async (url, options) => {
    calls.push({ url, options })
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'test-csrf' })
    if (url === '/profile/provision') return answer({ ...profile, created: false })
    if (url === '/profile/me()') return answer(profile)
    throw new Error(`unexpected URL: ${url}`)
  }
  const actual = await provisionAndReadProfile(mock)
  assert.deepEqual(actual, profile)
  assert.deepEqual(calls.map((c) => [c.url, c.options.method]), [
    ['/profile/$metadata', 'GET'],
    ['/profile/provision', 'POST'],
    ['/profile/me()', 'GET'],
  ])
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'test-csrf')
  assert.equal(calls[1].options.body, '{}')
  for (const call of calls) {
    assert.equal(call.options.credentials, 'same-origin')
    assert.equal(call.options.headers?.Authorization, undefined)
  }
})

test('missing CSRF token prevents any write', async () => {
  const calls = []
  await assert.rejects(provisionAndReadProfile(async (url) => {
    calls.push(url)
    return answer('', 200)
  }), /No CSRF token/)
  assert.deepEqual(calls, ['/profile/$metadata'])
})

test('HTTP 403 response never marks session as authenticated', async () => {
  await assert.rejects(provisionAndReadProfile(async (url) => {
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'csrf' })
    return answer({ error: { message: 'denied' } }, 403)
  }), (e) => e instanceof PortalSessionError && e.status === 403)
})

test('HTML login redirect cannot be mistaken for JSON API success', async () => {
  await assert.rejects(provisionAndReadProfile(async (url) => {
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'csrf' })
    return new Response('<html>IAS Login</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  }), /non-JSON/)
})

test('inactive profile is rejected, even after a successful POST', async () => {
  await assert.rejects(provisionAndReadProfile(async (url) => {
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'csrf' })
    return answer({ ...profile, ACTIVE_STATUS: false })
  }), (e) => e instanceof PortalSessionError && e.status === 403)
})

test('missing IAS identity or UUID is rejected', () => {
  assert.throws(() => validateProfile({ ...profile, IAS_ID: null }), /incomplete/)
  assert.throws(() => validateProfile({ ...profile, UUID: '' }), /incomplete/)
})

test('read-only profile performs no POST and checks identity', async () => {
  const calls = []
  const result = await readOnlyProfile(async (url, opts) => {
    calls.push([url, opts.method])
    return answer(profile)
  })
  assert.equal(result.UUID, profile.UUID)
  assert.deepEqual(calls, [['/profile/me()', 'GET']])
})

test('profile mapping uses server-owned identity, never template sample values', () => {
  const user = toPortalUser(profile)
  assert.deepEqual([user.firstName, user.lastName, user.name, user.welcomeName], ['Mawani', 'Test', 'Mawani Test', 'Mawani'])
  assert.equal(user.email, 'test@example.invalid')
  assert.equal(user.uuid, profile.UUID)
  const details = toProfileDetails(profile, { photo: '', firstName: 'Loki', documentNo: '1001743333', city: 'Riyadh' })
  assert.deepEqual([details.firstName, details.lastName, details.email, details.documentNo, details.city],
    ['Mawani', 'Test', 'test@example.invalid', '', ''])
})


test('different portal identity on GET read-back is refused', async () => {
  await assert.rejects(provisionAndReadProfile(async (url) => {
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'csrf' })
    if (url === '/profile/provision') return answer(profile)
    return answer({ ...profile, UUID: '7b5e8ab9-c911-4a3d-a813-c54d3b84c693' })
  }), (e) => e instanceof PortalSessionError && e.status === 409)
})


test('concurrent React bootstrap calls share one provisioning request', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    if (url === '/profile/$metadata') return answer('', 200, { 'x-csrf-token': 'csrf' })
    return answer(profile)
  }
  try {
    const [one, two] = await Promise.all([bootstrapPortalProfile(), bootstrapPortalProfile()])
    assert.equal(one.UUID, two.UUID)
    assert.deepEqual(calls, ['/profile/$metadata', '/profile/provision', '/profile/me()'])
  } finally {
    globalThis.fetch = original
  }
})
