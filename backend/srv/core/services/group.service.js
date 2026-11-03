"use strict";
const IasClient = require("../clients/ias.client");
const validate = require("../utils/validation");
const { AppError } = require("../utils/errors");

function shapeGroup(group) {
  if (
    !group ||
    typeof group !== "object" ||
    typeof group.id !== "string" ||
    !group.id
  )
    throw new AppError(502, "IAS returned an invalid group");
  return {
    id: group.id,
    displayName: typeof group.displayName === "string" ? group.displayName : "",
    externalId: typeof group.externalId === "string" ? group.externalId : "",
  };
}

class GroupService {
  async setUserMembership({ userId, groupId, assigned }) {
    userId = validate.uuid(userId);
    groupId = validate.text(groupId, "IAS group ID", {
      max: 255,
      required: true,
    });
    assigned = validate.boolean(assigned, "assigned");

    if (!this.canManage(groupId)) {
      throw new AppError(
        403,
        "Editing membership of this IAS group is not permitted",
      );
    }

    const group = await this.getGroup(groupId);

    if (group.id !== groupId) {
      throw new AppError(502, "IAS group identity mismatch");
    }

    const readMembership = async () => {
      const user = await this.client.request(
        "GET",
        `/Users/${encodeURIComponent(userId)}?attributes=id,groups`,
      );

      if (!user || user.id !== userId || !Array.isArray(user.groups)) {
        throw new AppError(502, "IAS user membership could not be verified");
      }

      return user.groups.some((member) => member?.value === groupId);
    };

    const current = await readMembership();

    // Already in the requested state; don't send an unnecessary PATCH.
    if (current === assigned) {
      return { userId, groupId, assigned };
    }

    const operation = assigned
      ? {
          op: "add",
          path: "members",
          value: [{ value: userId }],
        }
      : {
          op: "remove",
          path: `members[value eq "${userId}"]`,
        };

    await this.client.request(
      "PATCH",
      `/Groups/${encodeURIComponent(groupId)}`,
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [operation],
      },
    );

    let verified;

    try {
      verified = await readMembership();
    } catch {
      throw new AppError(
        503,
        "IAS may have updated the membership. Refresh before retrying.",
        "IAS_RESULT_UNCERTAIN",
      );
    }

    if (verified !== assigned) {
      throw new AppError(
        503,
        "IAS membership change was not confirmed. Refresh before retrying.",
        "IAS_RESULT_UNCERTAIN",
      );
    }

    return { userId, groupId, assigned };
  }
  constructor(client = new IasClient(), env = process.env) {
    this.client = client;
    this.env = env;
  }

  canManage(groupId) {
    const allowed = (this.env.MAWANI_IAS_ASSIGNABLE_GROUP_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    return (
      Boolean(groupId) &&
      groupId !== this.env.MAWANI_PORTAL_ADMIN_GROUP_ID &&
      allowed.includes(groupId)
    );
  }

  async listGroups({ startIndex, count } = {}) {
    const start = validate.int(startIndex, "startIndex", 1, 1, 1000000);
    const size = validate.int(count, "count", 50, 1, 100);
    // Exclude members to avoid pulling unnecessary personally identifying data.
    const result = await this.client.request(
      "GET",
      `/Groups?startIndex=${start}&count=${size}&excludedAttributes=members`,
    );
    if (
      !result ||
      !Array.isArray(result.Resources) ||
      !Number.isSafeInteger(result.totalResults) ||
      result.totalResults < 0
    )
      throw new AppError(502, "Invalid IAS group list response");
    return {
      totalResults: result.totalResults,
      itemsPerPage: result.Resources.length,
      startIndex: Number.isSafeInteger(result.startIndex)
        ? result.startIndex
        : start,
      groups: result.Resources.map(shapeGroup),
    };
  }

  async getGroup(id) {
    const groupId = validate.text(id, "IAS group ID", {
      max: 255,
      required: true,
    });
    const result = await this.client.request(
      "GET",
      `/Groups/${encodeURIComponent(groupId)}?excludedAttributes=members`,
    );
    return shapeGroup(result);
  }
}

module.exports = GroupService;
module.exports.shapeGroup = shapeGroup;
