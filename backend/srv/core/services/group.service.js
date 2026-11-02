'use strict';
const IasClient = require('../clients/ias.client');
const validate = require('../utils/validation');
const { AppError } = require('../utils/errors');

function shapeGroup(group) {
  if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !group.id)
    throw new AppError(502, 'IAS returned an invalid group');
  return {
    id: group.id,
    displayName: typeof group.displayName === 'string' ? group.displayName : '',
    externalId: typeof group.externalId === 'string' ? group.externalId : ''
  };
}

class GroupService {
  constructor(client = new IasClient()) { this.client = client; }

  async listGroups({ startIndex, count } = {}) {
    const start = validate.int(startIndex, 'startIndex', 1, 1, 1000000);
    const size = validate.int(count, 'count', 50, 1, 100);
    // Exclude members to avoid pulling unnecessary personally identifying data.
    const result = await this.client.request(
      'GET', `/Groups?startIndex=${start}&count=${size}&excludedAttributes=members`
    );
    if (!result || !Array.isArray(result.Resources) ||
        !Number.isSafeInteger(result.totalResults) || result.totalResults < 0)
      throw new AppError(502, 'Invalid IAS group list response');
    return {
      totalResults: result.totalResults,
      itemsPerPage: result.Resources.length,
      startIndex: Number.isSafeInteger(result.startIndex) ? result.startIndex : start,
      groups: result.Resources.map(shapeGroup)
    };
  }

  async getGroup(id) {
    const groupId = validate.text(id, 'IAS group ID', { max: 255, required: true });
    const result = await this.client.request(
      'GET', `/Groups/${encodeURIComponent(groupId)}?excludedAttributes=members`
    );
    return shapeGroup(result);
  }
}

module.exports = GroupService;
module.exports.shapeGroup = shapeGroup;
