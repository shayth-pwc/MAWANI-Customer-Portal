import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AdminIasError, checkAdminAccess, createIasUser, getIasUser, listIasUsers,
  reconcileIasUserToPortal, setIasUserActive, syncIasUserToPortal,
  updateIasUser,
} from '../src/services/adminIasApi.js'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function withCsrf(handler, calls = []) {
  return async (url, options) => {
    calls.push({ url, options })
    if (url === '/admin/$metadata') return new Response('', { headers: { 'X-CSRF-Token': 'safe-token' } })
    return handler(url, options)
  }
}

test('IAS list queries are server-paged; CAP value wrapper is supported', async () => {
  const calls = []
  const fetcher = async (url, options) => {
    calls.push({ url, options })
    return json({ value: { totalResults: 1, startIndex: 26, users: [{ id: 'abc', userName: 'test' }] } })
  }
  const result = await listIasUsers(26, 25, fetcher)
  assert.equal(result.totalResults, 1)
  assert.equal(calls[0].url, '/admin/listIasUsers(startIndex=26,count=25)')
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(calls[0].options.cache, 'no-store')
  assert.equal(calls[0].options.headers.Authorization, undefined)
})

test('admin access denied by CAP is never interpreted as permitted', async () => {
  assert.equal(await checkAdminAccess(async () => json({ error: { message: 'Forbidden' } }, 403)), false)
  await assert.rejects(() => checkAdminAccess(async () => json({ error: { message: 'oops' } }, 500)), AdminIasError)
})

test('read user identity must match the requested IAS ID', async () => {
  const fetcher = async () => json({ id: 'other-id' })
  await assert.rejects(() => getIasUser('expected-id', fetcher), /identity did not match/)
})

test('IAS create uses CSRF, same-origin, no password or client bearer, confirms PostgreSQL profile', async () => {
  const calls = []
  const fetcher = withCsrf((url) => {
    assert.equal(url, '/admin/createIasUser')
    return json({ id: 'new-ias', portalUserUuid: 'new-db', portalCreated: true })
  }, calls)
  const result = await createIasUser({ userName: 'test.user', email: 'test@example.com', givenName: 'Test', familyName: 'User' }, fetcher)
  assert.equal(result.portalUserUuid, 'new-db')
  assert.equal(calls.length, 2)
  const post = calls[1].options
  assert.equal(post.method, 'POST')
  assert.equal(post.credentials, 'same-origin')
  assert.equal(post.headers['X-CSRF-Token'], 'safe-token')
  assert.equal(post.headers.Authorization, undefined)
  assert.deepEqual(JSON.parse(post.body), { userName: 'test.user', email: 'test@example.com', givenName: 'Test', familyName: 'User' })
})

test('missing CSRF prevents ALL writes', async () => {
  const calls = []
  const fetcher = async (url) => {
    calls.push(url)
    return new Response('', { status: 200 })
  }
  await assert.rejects(() => setIasUserActive('ias-id', false, fetcher), /CSRF token missing/)
  assert.deepEqual(calls, ['/admin/$metadata'])
})

test('failed IAS create never silently retries and warns about uncertain remote outcome', async () => {
  const calls = []
  const fetcher = withCsrf(() => json({ error: { code: 'IAS_PORTAL_SYNC_PENDING', message: 'IAS user was created, but portal profile is pending. Do not retry.' } }, 503), calls)
  await assert.rejects(() => createIasUser({ userName: 'test.user', email: 'test@example.com', givenName: 'Test', familyName: 'User' }, fetcher),
    (error) => error.pending === true && error.status === 503)
  assert.equal(calls.filter((call) => call.url === '/admin/createIasUser').length, 1)
})

test('update transmits ONLY selected attributes; does not clear unmodified names', async () => {
  const calls = []
  const fetcher = withCsrf(() => json({ id: 'ias-id', email: 'updated@example.com' }), calls)
  await updateIasUser('ias-id', { email: 'updated@example.com' }, fetcher)
  assert.deepEqual(JSON.parse(calls[1].options.body), { id: 'ias-id', email: 'updated@example.com' })
})

test('IAS activation must confirm the requested status', async () => {
  const fetcher = withCsrf(() => json({ id: 'ias-id', active: true }))
  await assert.rejects(() => setIasUserActive('ias-id', false, fetcher), (error) => error.pending)
})

test('reconciliation and sync target existing IAS user, never create a second one', async () => {
  const calls = []
  const fetcher = withCsrf((url) => json({ profile: { UUID: 'profile-uuid' }, created: false }), calls)
  await syncIasUserToPortal('ias-id', fetcher)
  await reconcileIasUserToPortal('ias-id', fetcher)
  assert.deepEqual(calls.filter((call) => call.options.method === 'POST').map((call) => call.url),
    ['/admin/syncIasUserToPortal', '/admin/reconcileIasUserToPortal'])
})

test('HTML login response is never trusted as a successful admin result', async () => {
  await assert.rejects(() => listIasUsers(1, 25, async () => new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } })),
    /unexpected response/)
})

test('invalid pagination cannot trigger backend requests', async () => {
  let called = false
  const fetcher = () => { called = true; return json({}) }
  await assert.rejects(() => listIasUsers(0, 200, fetcher), /Invalid IAS pagination/)
  assert.equal(called, false)
})
