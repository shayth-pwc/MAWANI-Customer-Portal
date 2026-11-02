#!/usr/bin/env node
/**
 * Stage the existing React `dist/` into the v0.7.4 App Router module.
 * No Cloud Foundry deployment, login or credential modification occurs here.
 * Use: npm run stage:btp -- /path/to/mawani-customer-portal-phase1-configured [--check]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendArg = process.argv.find((arg, i) => i >= 2 && !arg.startsWith('--'))
const backend = backendArg ? path.resolve(backendArg) : null
const checkOnly = process.argv.includes('--check')
const fail = (m) => { throw new Error(m) }

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true })
  for (const item of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, item.name)
    const dest = path.join(target, item.name)
    if (item.isSymbolicLink()) fail(`Refusing to package symlink: ${src}`)
    if (item.isDirectory()) copyTree(src, dest)
    else if (item.isFile()) fs.copyFileSync(src, dest)
    else fail(`Unexpected distribution entry: ${src}`)
  }
}

try {
  if (!backend) fail('Pass the path of the existing v0.7.4 backend checkout.')
  const backendMta = fs.readFileSync(path.join(backend, 'mta.yaml'), 'utf8')
  if (!backendMta.includes('mawani-customer-portal-backend') ||
      !backendMta.includes('mawani-portal-router') ||
      !backendMta.includes('version: 0.7.4')) {
    fail('Target does not look like the validated Phase 1 backend v0.7.4 checkout.')
  }
  const router = path.join(backend, '.deploy', 'app-router')
  if (!fs.existsSync(path.join(router, 'package.json')) ||
      !fs.existsSync(path.join(router, 'xs-app.json'))) {
    fail('App Router module was not found in the backend project.')
  }
  const dist = path.join(frontend, 'dist')
  const index = path.join(dist, 'index.html')
  if (!fs.existsSync(index) || !fs.existsSync(path.join(dist, 'assets'))) {
    fail('React build missing. Run npm ci && npm run build first.')
  }
  const configPath = path.join(frontend, 'deploy', 'xs-app.btp.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (config.authenticationMethod !== 'route' ||
      config.logout?.logoutEndpoint !== '/logout' ||
      config.logout?.logoutPage !== '/signed-out' ||
      config.routes?.[0]?.source !== '^/profile(?:/(?:registration|password))?/?$' ||
      config.routes?.[0]?.target !== 'index.html' ||
      config.routes?.[0]?.localDir !== 'portal-bootstrap' ||
      config.routes?.[0]?.authenticationType !== 'ias' ||
      config.routes?.[1]?.source !== '^/(profile|admin)(/.*)?$' ||
      config.routes?.[1]?.destination !== 'srv-api' ||
      config.routes?.[1]?.authenticationType !== 'ias' ||
      config.routes?.[1]?.csrfProtection !== true) {
    fail('Router config is missing IAS/API/CSRF safeguards.')
  }
  const originalRouterConfig = JSON.parse(fs.readFileSync(path.join(router, 'xs-app.json'), 'utf8'))
  if (!originalRouterConfig.routes?.some((route) => route.destination === 'srv-api')) {
    fail('The existing App Router is not configured for srv-api; refusing to overwrite.')
  }
  // Validate public build output, not repository env files. No secret may be bundled.
  const filesToCopy = []
  function inspect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filepath = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) fail(`Symlink not allowed: ${filepath}`)
      if (entry.isDirectory()) inspect(filepath)
      else if (entry.isFile()) {
        if (/^(\.env|default-env\.json|\.cdsrc-private\.json)$/i.test(entry.name) ||
            /\.(?:pem|key|p12)$/i.test(entry.name)) fail(`Secret-bearing file name found in dist/: ${filepath}`)
        if (/\.(?:js|json|html|css)$/.test(entry.name)) {
          const content = fs.readFileSync(filepath, 'utf8')
          if (/VITE_API_TOKEN|IAS_SCIM_CLIENT_SECRET|BEGIN PRIVATE KEY|-----BEGIN CERTIFICATE-----/.test(content))
            fail(`Potential secret reference found in dist/: ${filepath}`)
        }
        filesToCopy.push(filepath)
      }
    }
  }
  inspect(dist)
  console.log(`Validated React build: ${filesToCopy.length} files; App Router API/IAS/logout routes ready.`)
  if (checkOnly) { console.log('Check only: no files changed.'); process.exit(0) }

  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const backupDir = path.join(frontend, `.mawani-phase2-router-backup-${stamp}`)
  fs.mkdirSync(backupDir)
  const liveStatic = path.join(router, 'portal-bootstrap')
  const oldConfig = path.join(router, 'xs-app.json')
  if (fs.existsSync(liveStatic)) copyTree(liveStatic, path.join(backupDir, 'portal-bootstrap'))
  fs.copyFileSync(oldConfig, path.join(backupDir, 'xs-app.json'))

  // Stage to a sibling first; replace after all static assets are copied.
  const staging = path.join(router, `portal-bootstrap-staging-${stamp}`)
  copyTree(dist, staging)
  try {
    fs.rmSync(liveStatic, { recursive: true, force: true })
    fs.renameSync(staging, liveStatic)
    fs.copyFileSync(configPath, oldConfig)
  } catch (error) {
    // Keep original router on staging failure.
    fs.rmSync(liveStatic, { recursive: true, force: true })
    if (fs.existsSync(path.join(backupDir, 'portal-bootstrap'))) {
      copyTree(path.join(backupDir, 'portal-bootstrap'), liveStatic)
    }
    fs.copyFileSync(path.join(backupDir, 'xs-app.json'), oldConfig)
    throw error
  }
  console.log(`Staged React build into ${liveStatic}`)
  console.log(`Router backup: ${backupDir}`)
  console.log('Next in backend checkout: mbt build; verify MTAR; deploy only after review.')
} catch (error) {
  console.error(`Staging failed: ${error.message}`)
  process.exitCode = 1
}
