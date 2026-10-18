import { RequestError } from './requestError'

function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export function requireSuccess(value) {
  const record = asRecord(value)
  const succeeded = record?.isSuccess === true || record?.success === true
  if (!succeeded) {
    const message = typeof record?.message === 'string'
      ? record.message
      : typeof record?.error === 'string'
        ? record.error
        : 'The service returned an unsuccessful or malformed response.'
    throw new RequestError('invalidResponse', message, value)
  }
  return Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : record
}

export function unwrap(value) {
  if (value == null) return null
  return requireSuccess(value)
}
