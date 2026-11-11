'use strict';
/** Safe CF preflight. Prints no service credentials, tokens or URLs.
 * A binding is necessary but does not prove C4C_DES or its OData API is reachable.
 */
function destinationBindingNames(services) {
  if (!services || typeof services !== 'object') return [];
  return Object.values(services).flatMap(instances => Array.isArray(instances) ? instances : [])
    .filter(service => service && (service.label === 'destination' || service.tags?.includes('destination')))
    .map(service => service.name).filter(name => typeof name === 'string');
}
if (require.main === module) {
  try {
    const services = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const bindings = destinationBindingNames(services);
    console.log(`Destination service instance bound: ${bindings.length > 0 ? 'yes' : 'no'}`);
    // The service instance label is not a secret. Never print VCAP_SERVICES or its credentials.
    if (bindings.length) console.log(`Bound instance count: ${bindings.length}`);
    else process.exitCode = 1;
  } catch (_) {
    console.error('Cannot inspect Cloud Foundry destination bindings');
    process.exitCode = 1;
  }
}
module.exports = { destinationBindingNames };
