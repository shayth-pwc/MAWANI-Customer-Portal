// Removes only the route/import introduced by the previous Phase 2 overlay.
// Does not delete files or modify the existing generic Admin Lists route.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const file = resolve(process.cwd(), 'src/routes/AppRoutes.jsx')
const check = process.argv.includes('--check')
let value = readFileSync(file, 'utf8')
const importLine = /^\s*import LicenseListsAdminPage from ['"]\.\.\/pages\/admin\/LicenseListsAdminPage['"]\s*\r?\n/gm
const routeLine = /^\s*<Route path=['"]license-lists-admin['"] element=\{<LicenseListsAdminPage \/>\} \/>\s*\r?\n/gm
const matchesImport = [...value.matchAll(importLine)].length
const matchesRoute = [...value.matchAll(routeLine)].length
if (matchesImport > 1 || matchesRoute > 1) throw new Error('Duplicate route definitions; inspect manually')
let revised = value.replace(importLine, '').replace(routeLine, '')
if (revised.includes('LicenseListsAdminPage')) throw new Error('Other references to LicenseListsAdminPage exist; inspect manually')
if (check) console.log(`Would remove ${matchesImport} legacy import(s) and ${matchesRoute} legacy route(s); no files changed.`)
else if (revised !== value) {
  writeFileSync(file, revised)
  console.log('Removed redundant /license-lists-admin route. Existing admin Lists route retained.')
} else console.log('No redundant license-list admin route found.')
