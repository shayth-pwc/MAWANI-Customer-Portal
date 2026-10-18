export class RequestError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'RequestError'
    this.code = code
    this.cause = cause
  }
}
