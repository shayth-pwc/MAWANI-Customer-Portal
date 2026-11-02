// Calls return null while VITE_API_BASE_URL is empty, so screens keep their static data.
// Set VITE_API_BASE_URL to the mount that already includes /api or /mawani-api.
// Browser requests use same-origin IAS App Router cookies. Never bundle a bearer token.

import { ApiError, apiErrorFromResponse, toApiError } from './errors'
import { RequestError } from './requestError'

const listeners = new Set()

export function onApiError(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify(error, config) {
  if (config?.skipErrorToast) return
  listeners.forEach((listener) => listener(error))
}

function withQuery(url, params) {
  if (!params) return url
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  if (!query) return url
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

export function createApiClient(options = {}) {
  const baseURL = (options.baseURL ?? import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

  async function send(method, url, body, config = {}) {
    if (!baseURL) return null

    const headers = new Headers(config.headers)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')

    let payload
    if (body instanceof FormData) {
      payload = body
    } else if (body !== undefined) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      payload = JSON.stringify(body)
    }

    try {
      const response = await fetch(`${baseURL}${withQuery(url, config.params)}`, {
        method,
        credentials: 'same-origin',
        headers,
        body: payload,
        signal: config.signal,
      })

      if (!response.ok) {
        const error = await apiErrorFromResponse(response)
        notify(error, config)
        throw error
      }

      if (response.status === 204) return null
      const text = await response.text()
      if (!text) return null

      try {
        return JSON.parse(text)
      } catch (cause) {
        const error = new RequestError('invalidResponse', 'The service returned a malformed response.', cause)
        notify(error, config)
        throw error
      }
    } catch (cause) {
      if (cause instanceof ApiError || cause instanceof RequestError) throw cause
      const error = toApiError(cause)
      notify(error, config)
      throw error
    }
  }

  return {
    get: (url, config) => send('GET', url, undefined, config),
    post: (url, body, config) => send('POST', url, body, config),
    put: (url, body, config) => send('PUT', url, body, config),
    patch: (url, body, config) => send('PATCH', url, body, config),
    delete: (url, config) => send('DELETE', url, undefined, config),
  }
}

export const apiClient = createApiClient()

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
}
