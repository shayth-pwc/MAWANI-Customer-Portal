/**
 * Authenticated SAP BTP App Router -> CAP ProfileService client.
 * No user credentials, IAS technical secrets or bearer tokens exist in this module.
 * Requests are same-origin so the App Router owns the authenticated IAS session.
 */

export class PortalSessionError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'PortalSessionError'
    this.status = status
  }
}

async function requestJson(url, options = {}, fetcher = fetch) {
  let response
  try {
    response = await fetcher(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'follow',
      ...options,
    })
  } catch {
    throw new PortalSessionError('Cannot reach the portal service.')
  }
  if (!response.ok) {
    throw new PortalSessionError(
      response.status === 401 || response.status === 403
        ? 'The portal session is not authorized for this operation.'
        : `Portal request failed (HTTP ${response.status}).`,
      response.status,
    )
  }
  const type = response.headers.get('content-type') || ''
  if (!type.toLowerCase().includes('application/json')) {
    throw new PortalSessionError('The session returned a non-JSON response. Sign in through SAP IAS.')
  }
  try {
    return await response.json()
  } catch {
    throw new PortalSessionError('The portal returned an invalid JSON response.')
  }
}

export function validateProfile(profile) {
  // ProfileService v0.7.4 returns a flat OData JSON object for function and action responses.
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
      typeof profile.UUID !== 'string' || !profile.UUID ||
      typeof profile.IAS_ID !== 'string' || !profile.IAS_ID) {
    throw new PortalSessionError('The portal returned an incomplete identity profile.')
  }
  if (profile.ACTIVE_STATUS !== true) {
    throw new PortalSessionError('Your portal account is inactive.', 403)
  }
  return profile
}

export async function provisionAndReadProfile(fetcher = fetch) {
  const tokenResponse = await (async () => {
    try {
      return await fetcher('/profile/$metadata', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-CSRF-Token': 'Fetch' },
      })
    } catch {
      throw new PortalSessionError('Unable to check the IAS session.')
    }
  })()

  if (!tokenResponse.ok) {
    throw new PortalSessionError('Unable to start the IAS session.', tokenResponse.status)
  }
  const csrf = tokenResponse.headers.get('x-csrf-token')
  if (!csrf) {
    throw new PortalSessionError('No CSRF token was provided by the Application Router.')
  }

  // The backend derives the IAS Global User ID from the trusted session, not the request body.
  const provisioned = await requestJson('/profile/provision', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: '{}',
  }, fetcher)
  validateProfile(provisioned)

  // Explicit read-back, never infer sign-in success from the POST alone.
  const profile = await requestJson('/profile/me()', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, fetcher)
  const verified = validateProfile(profile)
  if (verified.UUID !== provisioned.UUID || verified.IAS_ID !== provisioned.IAS_ID) {
    throw new PortalSessionError('Profile identity changed during session verification.', 409)
  }
  return verified
}

let inFlight = null
export function bootstrapPortalProfile() {
  if (!inFlight) {
    inFlight = provisionAndReadProfile().finally(() => { inFlight = null })
  }
  return inFlight
}

export function readOnlyProfile(fetcher = fetch) {
  return requestJson('/profile/me()', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, fetcher).then(validateProfile)
}

export function startIasSignIn() {
  window.location.assign('/')
}

export function logoutFromPortal() {
  // '/logout' is handled by SAP App Router's configured central logout endpoint.
  window.location.assign('/logout')
}
