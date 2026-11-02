'use strict';
// Read-only network check. No usernames, personal data, credentials or tokens printed.
const IasClient = require('../srv/core/clients/ias.client');
async function main() {
  const api = new IasClient();
  const result = await api.request('GET', '/Users?startIndex=1&count=1');
  if (!result || !Array.isArray(result.Resources)) {
    throw new Error('IAS response did not contain SCIM Resources array');
  }
  console.log(JSON.stringify({
    iasDirectoryReachable: true,
    schema: result.schemas || [],
    totalResults: Number.isSafeInteger(result.totalResults) ? result.totalResults : null,
    inspectedUserRecords: 0
  }, null, 2));
}
main().catch(error => {
  // Never leak Authorization headers, endpoints with credentials, or provider response bodies.
  console.error('IAS read-only check failed:', error.message);
  process.exitCode = 1;
});
