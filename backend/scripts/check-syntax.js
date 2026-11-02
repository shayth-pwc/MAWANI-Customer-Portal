'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function* find(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* find(full);
    else if (entry.name.endsWith('.js')) yield full;
  }
}
let failed = 0;
for (const file of ['srv', 'scripts', 'test'].flatMap(dir => [...find(dir)])) {
  const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (run.status !== 0) { failed++; process.stderr.write(`${file}: ${run.stderr}`); }
}
if (failed) process.exitCode = 1;
else console.log('All JavaScript files passed Node syntax checking.');
