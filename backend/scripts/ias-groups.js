'use strict';
const GroupService = require('../srv/core/services/group.service');

async function main() {
  const service = new GroupService();
  const groups = [];
  let startIndex = 1;
  const pageSize = 100;
  for (;;) {
    const page = await service.listGroups({ startIndex, count: pageSize });
    groups.push(...page.groups);
    if (groups.length >= page.totalResults) break;
    if (!page.groups.length) throw Error('IAS stopped returning group pages before totalResults');
    startIndex += page.groups.length;
    if (startIndex > 1000000) throw Error('Group pagination safety limit exceeded');
  }
  console.log(`IAS groups retrieved: ${groups.length}`);
  console.table(groups);
}

main().catch(err => {
  // No upstream response body or credentials are logged.
  console.error('IAS group check failed:', err.message);
  process.exitCode = 1;
});
