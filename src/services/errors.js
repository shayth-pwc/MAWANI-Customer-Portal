export class ApiError extends Error {
  constructor({ status, code, message, cause }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.cause = cause
  }
}

function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function toApiError(cause) {
  if (cause instanceof ApiError) return cause

  const record = asRecord(cause)
  const response = asRecord(record?.response)
  const payload = asRecord(record?.payload) ?? asRecord(response?.data)
  const nestedError = asRecord(payload?.error)
  const status = typeof response?.status === 'number' ? response.status : null
  const errorText = nonEmptyString(payload?.error)
  const code = nonEmptyString(payload?.code)
    ?? nonEmptyString(nestedError?.code)
    ?? errorText
    ?? (status === null ? 'API_ERROR' : `HTTP_${status}`)
  const message = nonEmptyString(payload?.message)
    ?? nonEmptyString(nestedError?.message)
    ?? errorText
    ?? nonEmptyString(cause instanceof Error ? cause.message : null)
    ?? 'The request could not be completed.'

  return new ApiError({ status, code, message, cause })
}

export async function apiErrorFromResponse(response) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    // A non-JSON error body still becomes an ApiError from the status code.
  }
  return toApiError({ response, payload })
}
