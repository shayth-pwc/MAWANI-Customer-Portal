"use strict";
const IasClient = require("../clients/ias.client");
const validate = require("../utils/validation");
const { AppError } = require("../utils/errors");

const PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
function resourceId(id) {
  return encodeURIComponent(
    validate.text(id, "IAS user ID", { max: 150, required: true }),
  );
}
function shape(user) {
  if (!user) throw new AppError(502, "IAS returned no user");
  return {
    id: user.id || "",
    userName: user.userName || "",
    displayName:
      typeof user.displayName === "string" &&
      user.displayName.trim() &&
      user.displayName.trim().toLowerCase() !== "none"
        ? user.displayName
        : [user.name?.givenName, user.name?.familyName]
            .filter(Boolean)
            .join(" "),
    email:
      user.emails?.find((e) => e.primary)?.value ||
      user.emails?.[0]?.value ||
      "",
    active: typeof user.active === "boolean" ? user.active : null,
    givenName: user.name?.givenName || "",
    familyName: user.name?.familyName || "",
    middleName: user.name?.middleName || "",
    mobile: user.phoneNumbers?.find((p) => p?.type === "mobile")?.value || "",
    title: user.title || "",
    locale: user.locale || "",
    timezone: user.timezone || "",
    preferredLanguage: user.preferredLanguage || "",
    externalId: user.externalId || "",
    userType: user.userType || "",
    nickName: user.nickName || "",
    groupsSummary: (Array.isArray(user.groups) ? user.groups : [])
      .slice(0, 50)
      .map((g) => g?.display || g?.value)
      .filter(Boolean)
      .join(", ")
      .slice(0, 4000),
    groupIds: Array.isArray(user.groups)
      ? [
          ...new Set(
            user.groups
              .map((group) => group?.value)
              .filter((value) => typeof value === "string" && value),
          ),
        ]
      : null,

    addressesSummary: (Array.isArray(user.addresses) ? user.addresses : [])
      .slice(0, 10)
      .filter((a) => a && typeof a === "object")
      .map((a) =>
        [
          a.type,
          a.formatted ||
            [a.streetAddress, a.locality, a.region, a.country]
              .filter(Boolean)
              .join(", "),
        ]
          .filter(Boolean)
          .join(": "),
      )
      .join("; ")
      .slice(0, 4000),
    organization:
      user["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"]
        ?.organization || "",
    department:
      user["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"]
        ?.department || "",
    created: user.meta?.created || "",
    lastModified: user.meta?.lastModified || "",
  };
}

class IasService {
  constructor(client = new IasClient()) {
    this.client = client;
  }
  async listUsers({ startIndex, count } = {}) {
    const start = validate.int(startIndex, "startIndex", 1, 1, 1000000);
    const size = validate.int(count, "count", 50, 1, 100);
    const result = await this.client.request(
      "GET",
      `/Users?startIndex=${start}&count=${size}`,
    );
    return {
      totalResults: result?.totalResults ?? 0,
      itemsPerPage: result?.itemsPerPage ?? (result?.Resources?.length || 0),
      startIndex: result?.startIndex ?? start,
      users: (result?.Resources || []).map(shape),
    };
  }
  async getUser(id) {
    return shape(await this.getRawUser(id));
  }
  async getRawUser(id) {
    const expectedId = validate.text(id, "IAS user ID", {
      max: 150,
      required: true,
    });
    const user = await this.client.request(
      "GET",
      `/Users/${resourceId(expectedId)}`,
    );
    if (!user || user.id !== expectedId)
      throw new AppError(502, "IAS returned an unexpected user identity");
    return user;
  }
  async createUser(data) {
    const userName = validate.text(data.userName, "userName", {
      max: 150,
      required: true,
    });
    const email = validate.email(data.email);
    const givenName = validate.text(data.givenName, "givenName", {
      max: 100,
      required: true,
    });
    const familyName = validate.text(data.familyName, "familyName", {
      max: 100,
      required: true,
    });
    const result = await this.client.request("POST", "/Users", {
      schemas: [USER_SCHEMA],
      userName,
      active: true,
      name: { givenName, familyName },
      emails: [{ value: email, primary: true }],
    });
    if (!result?.id)
      throw new AppError(
        503,
        "IAS create may have succeeded but no user ID was returned; verify IAS before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    return shape(result);
  }
  // A SCIM PATCH success status is NOT proof that IAS actually changed the
  // requested attributes. Compare the raw directory record, not displayName
  // (some tenants expose the literal string "None" in that field).
  async updateUser(data) {
    const id = resourceId(data.id);
    const requested = {};
    if (data.email !== undefined && data.email !== null)
      requested.email = validate.email(data.email);
    if (data.givenName !== undefined && data.givenName !== null)
      requested.givenName = validate.text(data.givenName, "givenName", {
        max: 100,
        required: true,
      });
    if (data.familyName !== undefined && data.familyName !== null)
      requested.familyName = validate.text(data.familyName, "familyName", {
        max: 100,
        required: true,
      });
    if (data.mobile !== undefined && data.mobile !== null) {
      const mobile = validate.text(data.mobile, "mobile", {
        max: 25,
        required: true,
      });
      if (!/^\+?[0-9() .-]{6,25}$/.test(mobile))
        throw new AppError(400, "Invalid mobile number");
      requested.mobile = mobile;
    }
    for (const [field, max] of [
      ["title", 150],
      ["locale", 40],
      ["timezone", 80],
      ["preferredLanguage", 40],
    ]) {
      if (data[field] !== undefined && data[field] !== null)
        requested[field] = validate.text(data[field], field, {
          max,
          required: true,
        });
    }
    if (!Object.keys(requested).length)
      throw new AppError(400, "No IAS fields supplied");

    const ops = [];
    if (requested.email !== undefined)
      ops.push({
        op: "replace",
        path: "emails",
        value: [{ value: requested.email, primary: true }],
      });
    if (
      requested.givenName !== undefined ||
      requested.familyName !== undefined
    ) {
      // Replace the complex name atomically. Individual subattribute PATCHes
      // have returned HTTP success without changing values in this tenant.
      // Preserve unrelated name components from the currently verified record.
      const prior = await this.getRawUser(data.id);
      const name = {};
      for (const field of [
        "givenName",
        "familyName",
        "middleName",
        "honorificPrefix",
        "honorificSuffix",
      ]) {
        if (typeof prior.name?.[field] === "string")
          name[field] = prior.name[field];
      }
      if (requested.givenName !== undefined)
        name.givenName = requested.givenName;
      if (requested.familyName !== undefined)
        name.familyName = requested.familyName;
      ops.push({ op: "replace", path: "name", value: name });
    }

    if (requested.mobile !== undefined) {
      const prior = await this.getRawUser(data.id);
      const otherPhones = (prior.phoneNumbers || []).filter(
        (p) => p?.type !== "mobile",
      );
      ops.push({
        op: "replace",
        path: "phoneNumbers",
        value: [...otherPhones, { type: "mobile", value: requested.mobile }],
      });
    }
    for (const field of ["title", "locale", "timezone", "preferredLanguage"]) {
      if (requested[field] !== undefined)
        ops.push({ op: "replace", path: field, value: requested[field] });
    }
    await this.client.request("PATCH", `/Users/${id}`, {
      schemas: [PATCH_SCHEMA],
      Operations: ops,
    });
    let raw;
    try {
      raw = await this.getRawUser(data.id);
    } catch {
      throw new AppError(
        503,
        "IAS PATCH may have succeeded; verify IAS state before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    }
    const primaryEmail =
      raw.emails?.find((e) => e?.primary)?.value || raw.emails?.[0]?.value;
    if (
      (requested.email !== undefined && primaryEmail !== requested.email) ||
      (requested.givenName !== undefined &&
        raw.name?.givenName !== requested.givenName) ||
      (requested.familyName !== undefined &&
        raw.name?.familyName !== requested.familyName) ||
      (requested.mobile !== undefined &&
        raw.phoneNumbers?.find((p) => p?.type === "mobile")?.value !==
          requested.mobile) ||
      ["title", "locale", "timezone", "preferredLanguage"].some(
        (field) =>
          requested[field] !== undefined && raw[field] !== requested[field],
      )
    ) {
      throw new AppError(
        503,
        "IAS accepted the update but the requested attributes were not confirmed. Inspect the IAS user before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    }
    return { user: shape(raw), raw, fields: Object.keys(requested) };
  }
  async setUserActive({ id, active }) {
    const encoded = resourceId(id);
    validate.boolean(active, "active");
    await this.client.request("PATCH", `/Users/${encoded}`, {
      schemas: [PATCH_SCHEMA],
      Operations: [{ op: "replace", path: "active", value: active }],
    });
    let raw;
    try {
      raw = await this.getRawUser(id);
    } catch {
      throw new AppError(
        503,
        "IAS status change may have succeeded; verify IAS state before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    }
    if (raw.active !== active)
      throw new AppError(
        503,
        "IAS status change was not verified; inspect IAS before retrying",
        "IAS_RESULT_UNCERTAIN",
      );
    return { user: shape(raw), raw, fields: ["active"] };
  }
}
module.exports = IasService;
module.exports.shape = shape;
