/* Admin-only Dynamic Lists API. Backend enforces IAS admin group for every call. */
const adminActions = new Set(['saveDefinition', 'saveItem', 'setDefinitionActive', 'setItemActive'])

export class DynamicListsError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'DynamicListsError'
    this.status = status
  }
}

function lit(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,255}$/.test(value)) {
    throw new DynamicListsError('Invalid application, list or option key')
  }
  return `'${encodeURIComponent(value.replaceAll("'", "''"))}'`
}
function unwrap(value) { return value && typeof value === 'object' && value.value && typeof value.value === 'object' ? value.value : value }

async function call(base, relative, payload, fetcher = fetch) {
  const writing = payload !== undefined
  let csrf = ''
  if (writing) {
    const token = await fetcher(`${base}/$metadata`, {
      credentials: 'same-origin', cache: 'no-store', headers: { 'X-CSRF-Token': 'Fetch' },
    })
    if (!token.ok) throw new DynamicListsError('Not authorized to manage dynamic lists', token.status)
    csrf = token.headers.get('x-csrf-token')
    if (!csrf) throw new DynamicListsError('CSRF token missing; no changes submitted')
  }
  let response
  try {
    response = await fetcher(`${base}/${relative}`, {
      method: writing ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(writing ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
      },
      ...(writing ? { body: JSON.stringify(payload) } : {}),
    })
  } catch { throw new DynamicListsError(writing ? 'Save result is uncertain; refresh the list before retrying' : 'Unable to load dynamic lists') }
  let data
  if ((response.headers.get('content-type') || '').includes('application/json')) {
    try { data = await response.json() } catch { /* no raw error body */ }
  }
  if (!response.ok) {
    const error = typeof data?.error?.message === 'string' ? data.error.message.slice(0, 200) : ''
    throw new DynamicListsError(error || `Dynamic list request failed (HTTP ${response.status})`, response.status)
  }
  if (!data || typeof data !== 'object') throw new DynamicListsError('Unexpected response; check the list before retrying')
  return unwrap(data)
}
export async function getDefinitions(limit = 50, offset = 0, fetcher = fetch) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new DynamicListsError('Invalid paging')
  return call('/admin-lists', `getDefinitions(limit=${limit},offset=${offset})`, undefined, fetcher)
}
export const getDefinition = (app, code, fetcher = fetch) => call('/admin-lists', `getDefinition(app=${lit(app)},code=${lit(code)})`, undefined, fetcher)
export const getPublicList = (app, code, fetcher = fetch) => call('/lists', `getList(app=${lit(app)},code=${lit(code)})`, undefined, fetcher)
export async function listAction(action, input, fetcher = fetch) {
  if (!adminActions.has(action)) throw new DynamicListsError('Unsupported administrative action')
  return call('/admin-lists', action, input, fetcher)
}
