'use strict';

const GroupService = require('../services/group.service');
const AuditService = require('../services/audit.service');
const { AppError } = require('../utils/errors');

class GroupController {
  constructor(
    groups = new GroupService(),
    audit = new AuditService()
  ) {
    this.groups = groups;
    this.audit = audit;
  }

  async listIasGroups(data) {
    const result = await this.groups.listGroups(data);

    return {
      ...result,
      groups: result.groups.map(group => ({
        ...group,
        manageable: this.groups.canManage(group.id)
      }))
    };
  }

  getIasGroup(data) {
    return this.groups.getGroup(data.id);
  }

  async setIasUserGroupMembership(data, req) {
    const actorId = req.mawaniIdentity?.globalUserId;

    if (!actorId) {
      throw new AppError(403, 'Verified administrator required');
    }

    if (actorId === data.userId) {
      throw new AppError(
        403,
        'Administrators cannot change their own group memberships'
      );
    }

    const action = data.assigned
      ? 'IAS_GROUP_ASSIGN'
      : 'IAS_GROUP_REMOVE';

    let result;

    try {
      result = await this.groups.setUserMembership(data);
    } catch (error) {
      if (error.code === 'IAS_RESULT_UNCERTAIN') {
        await this.audit.uncertain(
          req, action, 'IAS_GROUP', data.groupId
        );
      } else {
        await this.audit.failure(
          req, action, 'IAS_GROUP', data.groupId
        );
      }

      throw error;
    }

    try {
      await this.audit.record(
        req,
        action,
        'IAS_GROUP',
        data.groupId,
        'SUCCESS',
        `Verified membership operation for IAS user ${data.userId}`
      );
    } catch {
      throw new AppError(
        503,
        'IAS membership was verified, but audit logging failed. Refresh before retrying.',
        'IAS_RESULT_UNCERTAIN'
      );
    }

    return result;
  }
}

module.exports = GroupController;