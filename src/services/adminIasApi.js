/**
 * IAS administration via the existing protected CAP AdminService (v0.7.4).
 * Calls remain same-origin; NEVER expose IAS SCIM technical credentials here.
 * No automatic retry for any mutation: IAS may commit before the response.
 */
export class AdminIasError extends Error {
  constructor(message, status = null, code = '') {
    super(message)
    this.name = 'AdminIasError'
    this.status = status
    this.code = code
    this.pending = status === 503 || code === 'IAS_PORTAL_SYNC_PENDING' || code === 'IAS_RESULT_UNCERTAIN'
  }
}

const ACTIONS = new Set([
  'createIasUser', 'updateIasUser', 'setIasUserActive',
  'syncIasUserToPortal', 'reconcileIasUserToPortal',
])

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function unwrapOData(body) {
  // CAP's custom function/action response can be flat or wrapped in `value`.
  return object(body) && object(body.value) ? body.value : body
}

function requiredText(value, label, maxLength = 150) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > maxLength) throw new AdminIasError(`${label} is required (up to ${maxLength} characters).`)
  return text
}

function odataLiteral(id) {
  const value = requiredText(id, 'IAS user ID')
  // OData apostrophe escaping, followed by URL encoding of special characters.
  return `'${encodeURIComponent(value.replaceAll("'", "''"))}'`
}

async function adminRequest(path, { method = 'GET', payload, fetcher = fetch } = {}) {
  let csrf
  if (method === 'POST') {
    let metadata
    try {
      metadata = await fetcher('/admin/$metadata', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { 'X-CSRF-Token': 'Fetch' },
      })
    } catch {
      throw new AdminIasError('Unable to retrieve a CSRF token; no changes were sent.')
    }
    if (!metadata.ok) {
      throw new AdminIasError('Unable to authorize the admin operation; no changes were sent.', metadata.status)
    }
    csrf = metadata.headers.get('x-csrf-token')
    if (!csrf) throw new AdminIasError('CSRF token missing; no changes were sent.')
  }

  let response
  try {
    response = await fetcher(`/admin/${path}`, {
      method, credentials: 'same-origin', cache: 'no-store', redirect: 'follow',
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
    })
  } catch {
    throw new AdminIasError(method === 'POST'
      ? 'The response was lost. The IAS change may have succeeded; inspect the user before retrying.'
      : 'Unable to contact the administrative service.', null, method === 'POST' ? 'IAS_RESULT_UNCERTAIN' : '')
  }

  const contentType = response.headers.get('content-type') || ''
  let body
  if (contentType.toLowerCase().includes('application/json')) {
    try { body = await response.json() } catch { /* Deliberately no untrusted response text. */ }
  }
  if (!response.ok) {
    const code = typeof body?.error?.code === 'string' ? body.error.code : ''
    const providerMessage = typeof body?.error?.message === 'string' ? body.error.message.slice(0, 300) : ''
    if (response.status === 401 || response.status === 403) {
      throw new AdminIasError('You are not authorized to administer IAS users.', response.status, code)
    }
    throw new AdminIasError(
      providerMessage || (method === 'POST'
        ? `Admin operation failed (HTTP ${response.status}). Check IAS before retrying.`
        : `Admin request failed (HTTP ${response.status}).`),
      response.status, code,
    )
  }
  if (!contentType.toLowerCase().includes('application/json') || !object(body)) {
    throw new AdminIasError(method === 'POST'
      ? 'IAS may have changed, but the response was not valid JSON. Verify the user before retrying.'
      : 'The admin session returned an unexpected response; sign in through SAP IAS.', null, method === 'POST' ? 'IAS_RESULT_UNCERTAIN' : '')
  }
  return unwrapOData(body)
}

export async function checkAdminAccess(fetcher = fetch) {
  try {
    const result = await adminRequest('listIasGroups(startIndex=1,count=1)', { fetcher })
    if (!object(result) || !Array.isArray(result.groups)) throw new AdminIasError('Admin permission check returned invalid data.')
    return true
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) return false
    throw error
  }
}

export async function listIasUsers(startIndex = 1, count = 25, fetcher = fetch) {
  if (!Number.isSafeInteger(startIndex) || startIndex < 1 || !Number.isSafeInteger(count) || count < 1 || count > 100) {
    throw new AdminIasError('Invalid IAS pagination request.')
  }
  const data = await adminRequest(`listIasUsers(startIndex=${startIndex},count=${count})`, { fetcher })
  if (!object(data) || !Array.isArray(data.users) || !Number.isSafeInteger(data.totalResults) || data.totalResults < 0) {
    throw new AdminIasError('IAS returned an invalid user list.')
  }
  return data
}

export async function listIasGroups(startIndex = 1, count = 50, fetcher = fetch) {
  if (!Number.isSafeInteger(startIndex) || startIndex < 1 || !Number.isSafeInteger(count) || count < 1 || count > 100) {
    throw new AdminIasError('Invalid IAS group pagination request.')
  }
  const data = await adminRequest(`listIasGroups(startIndex=${startIndex},count=${count})`, { fetcher })
  if (!object(data) || !Array.isArray(data.groups)) throw new AdminIasError('IAS returned an invalid group list.')
  return data
}

export async function getIasUser(id, fetcher = fetch) {
  const requestedId = requiredText(id, 'IAS user ID')
  const user = await adminRequest(`getIasUser(id=${odataLiteral(requestedId)})`, { fetcher })
  if (!object(user) || user.id !== requestedId) throw new AdminIasError('The IAS user identity did not match the request.')
  return user
}

async function postAdminAction(action, payload, fetcher = fetch) {
  if (!ACTIONS.has(action)) throw new AdminIasError('Admin action is not supported.')
  return adminRequest(action, { method: 'POST', payload, fetcher })
}

export async function createIasUser(form, fetcher = fetch) {
  const userName = requiredText(form.userName, 'Username')
  const email = requiredText(form.email, 'Email', 254)
  const givenName = requiredText(form.givenName, 'First name', 100)
  const familyName = requiredText(form.familyName, 'Last name', 100)
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AdminIasError('Enter a valid email address.')
  const result = await postAdminAction('createIasUser', { userName, email, givenName, familyName }, fetcher)
  // Backend v0.7.4 requires confirmed IAS create + one local PG profile.
  if (!object(result) || !result.id || !result.portalUserUuid) {
    throw new AdminIasError('IAS creation may have completed without a confirmed portal profile. Verify IAS and PostgreSQL before retrying.', 503)
  }
  return result
}

export async function updateIasUser(id, fields, fetcher = fetch) {
  const userId = requiredText(id, 'IAS user ID')
  const changes = {}
  for (const [key, maxLength] of [['email', 254], ['givenName', 100], ['familyName', 100]]) {
    if (fields[key] === undefined || fields[key] === null) continue
    changes[key] = requiredText(fields[key], key, maxLength)
  }
  if (!Object.keys(changes).length) throw new AdminIasError('No IAS changes requested.')
  if (changes.email && !/^\S+@\S+\.\S+$/.test(changes.email)) {
    throw new AdminIasError('Enter a valid email address.')
  }
  const result = await postAdminAction('updateIasUser', { id: userId, ...changes }, fetcher)
  if (!object(result) || result.id !== userId) throw new AdminIasError('IAS update could not be verified. Inspect the user before retrying.', 503)
  return result
}

export async function setIasUserActive(id, active, fetcher = fetch) {
  const userId = requiredText(id, 'IAS user ID')
  if (typeof active !== 'boolean') throw new AdminIasError('Account status must be a boolean.')
  const result = await postAdminAction('setIasUserActive', { id: userId, active }, fetcher)
  if (!object(result) || result.id !== userId || result.active !== active) {
    throw new AdminIasError('IAS status was not confirmed. Inspect the account before retrying.', 503)
  }
  return result
}

export async function syncIasUserToPortal(id, fetcher = fetch) {
  const result = await postAdminAction('syncIasUserToPortal', { id: requiredText(id, 'IAS user ID') }, fetcher)
  if (!object(result) || !object(result.profile) || !result.profile.UUID) {
    throw new AdminIasError('Portal synchronization could not be verified.', 503)
  }
  return result
}

export async function reconcileIasUserToPortal(id, fetcher = fetch) {
  const result = await postAdminAction('reconcileIasUserToPortal', { id: requiredText(id, 'IAS user ID') }, fetcher)
  if (!object(result) || !object(result.profile) || !result.profile.UUID) {
    throw new AdminIasError('Portal reconciliation could not be verified.', 503)
  }
  return result
}
