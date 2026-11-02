'use strict';
const { getIasConfig } = require('../config/ias.config');
const { AppError } = require('../utils/errors');

class IasClient {
  constructor({ config = getIasConfig, fetchImpl = globalThis.fetch } = {}) {
    this.configSource = config;
    this.fetch = fetchImpl;
    this.token = null;
    this.expiresAt = 0;
  }
  get config() { return typeof this.configSource === 'function' ? this.configSource() : this.configSource; }
  async authorization() {
    const cfg = this.config;
    if (cfg.authMode === 'basic') {
      return `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`;
    }
    if (this.token && Date.now() < this.expiresAt - 60000) return `Bearer ${this.token}`;
    let resp;
    try {
      resp = await this.fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(cfg.timeoutMs)
      });
    } catch { throw new AppError(502, 'Unable to authenticate with IAS'); }
    if (!resp.ok) throw new AppError(502, 'Unable to authenticate with IAS');
    let result;
    try { result = await resp.json(); } catch { throw new AppError(502, 'Invalid IAS token response'); }
    if (!result.access_token) throw new AppError(502, 'IAS token is missing');
    this.token = result.access_token;
    this.expiresAt = Date.now() + Math.max(1, Number(result.expires_in) || 300) * 1000;
    return `Bearer ${this.token}`;
  }
  async request(method, path, payload) {
    if (!/^\/(Users|Groups)(\/|\?|$)/.test(path)) throw new AppError(500, 'Unsupported IAS resource path');
    const cfg = this.config;
    let response;
    try {
      response = await this.fetch(`${cfg.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: await this.authorization(),
          Accept: 'application/scim+json, application/json',
          ...(payload !== undefined ? { 'Content-Type': 'application/scim+json' } : {})
        },
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(cfg.timeoutMs)
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (!['GET', 'HEAD'].includes(method))
        throw new AppError(503, 'IAS operation may have completed; verify IAS state before retrying', 'IAS_RESULT_UNCERTAIN');
      throw new AppError(502, 'IAS is unavailable');
    }
    if (!response.ok) {
      const map = {
        400: [400, 'IAS rejected the submitted fields'],
        401: [502, 'IAS technical credentials were rejected'],
        403: [502, 'IAS technical client lacks required permissions'],
        404: [404, 'IAS resource not found'],
        409: [409, 'IAS user conflict'],
        412: [409, 'IAS resource has changed; refresh and retry'],
        429: [503, 'IAS request limit reached']
      };
      const [status, msg] = map[response.status] || [502, 'IAS request failed'];
      throw new AppError(status, msg, 'IAS_REQUEST_ERROR');
    }
    if (response.status === 204) return null;
    const raw = await response.text();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch {
      if (!['GET', 'HEAD'].includes(method))
        throw new AppError(503, 'IAS operation may have completed, but returned an invalid response; verify before retrying', 'IAS_RESULT_UNCERTAIN');
      throw new AppError(502, 'Invalid IAS response');
    }
  }
}
module.exports = IasClient;
