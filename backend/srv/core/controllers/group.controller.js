'use strict';
const GroupService = require('../services/group.service');

class GroupController {
  constructor(groups = new GroupService()) { this.groups = groups; }
  listIasGroups(data) { return this.groups.listGroups(data); }
  getIasGroup(data) { return this.groups.getGroup(data.id); }
}

module.exports = GroupController;
