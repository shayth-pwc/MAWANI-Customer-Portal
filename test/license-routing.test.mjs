import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const frontend = JSON.parse(readFileSync(new URL('../deploy/xs-app.btp.json', import.meta.url)))
const backend = JSON.parse(readFileSync(new URL('../backend/.deploy/app-router/xs-app.json', import.meta.url)))
test('C4C CAP license API is routed through authenticated, CSRF-protected srv-api', () => {
  for (const config of [frontend, backend]) {
    const rule = config.routes.find(row => row.source === '^/licenses-api/(.*)$')
    assert.ok(rule)
    assert.equal(rule.destination, 'srv-api')
    assert.equal(rule.authenticationType, 'ias')
    assert.equal(rule.csrfProtection, true)
    assert.equal(rule.cacheControl, 'no-store')
    assert.ok(config.routes.findIndex(row => row.source === '^/licenses-api/(.*)$') <
      config.routes.findIndex(row => row.source === '^/(.*)$'))
  }
})
