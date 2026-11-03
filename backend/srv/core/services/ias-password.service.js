"use strict";
// SAP IAS Password Service REST API, not Identity Directory SCIM.
// https://help.sap.com/docs/cloud-identity-services/cloud-identity-services/forgot-password-rest-api
const { AppError } = require("../utils/errors");
class IasPasswordService {
  constructor({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
    this.fetch = fetchImpl;
    this.env = env;
  }
  async requestReset(identifier) {
    const hasDedicatedConfig = [
      this.env.IAS_PASSWORD_API_BASE_URL,
      this.env.IAS_PASSWORD_CLIENT_ID,
      this.env.IAS_PASSWORD_CLIENT_SECRET,
    ].some(Boolean);

    const scimBasic = (this.env.IAS_SCIM_AUTH_MODE || "basic") === "basic";

    const base = hasDedicatedConfig
      ? this.env.IAS_PASSWORD_API_BASE_URL
      : scimBasic
        ? this.env.IAS_SCIM_BASE_URL
        : null;

    const clientId = hasDedicatedConfig
      ? this.env.IAS_PASSWORD_CLIENT_ID
      : scimBasic
        ? this.env.IAS_SCIM_CLIENT_ID
        : null;

    const clientSecret = hasDedicatedConfig
      ? this.env.IAS_PASSWORD_CLIENT_SECRET
      : scimBasic
        ? this.env.IAS_SCIM_CLIENT_SECRET
        : null;
    if (!base || !clientId || !clientSecret)
      throw new AppError(
        503,
        "IAS password email service is not configured for the portal",
        "IAS_PASSWORD_API_NOT_CONFIGURED",
      );
    let url;
    try {
      url = new URL(base);
      if (!hasDedicatedConfig) {
        url = new URL(url.origin);
      }
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        !(
          /(^|\.)accounts\.ondemand\.com$/i.test(url.hostname) ||
          /(^|\.)accounts\.cloud\.sap$/i.test(url.hostname)
        )
      ) {
        throw new Error("Invalid IAS origin");
      }
    } catch {
      throw new AppError(500, "Invalid IAS password service configuration");
    }
    const safeIdentifier =
      typeof identifier === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) &&
      identifier.length <= 254
        ? identifier
        : null;
    if (!safeIdentifier)
      throw new AppError(400, "IAS account must have a valid email address");
    let response;
    try {
      response = await this.fetch(
        new URL("/service/users/forgotPassword", url),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: JSON.stringify({ identifier: safeIdentifier }),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new AppError(
        503,
        "IAS email request status is uncertain; check IAS before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    }
    if (!response.ok) {
      if (response.status === 400)
        throw new AppError(
          400,
          "IAS rejected the password reset request; account may be inactive or password-reset restricted",
        );
      if (response.status === 401 || response.status === 403)
        throw new AppError(
          502,
          "IAS password service technical account is not authorized",
        );
      throw new AppError(
        503,
        "IAS password reset request could not be confirmed",
      );
    }
    // A 200 from SAP does NOT guarantee an email was sent (rate limit/nonexistent user).
    return {
      accepted: true,
      message: "Reset request accepted by IAS; delivery is not guaranteed",
    };
  }
}
module.exports = IasPasswordService;
