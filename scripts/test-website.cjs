#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · test runner (Wave 0).
// Discovers every *.test.ts under src/website-platform/__tests__ and runs it via
// tsx + node's built-in test runner. Cross-platform (no shell globbing).
// ─────────────────────────────────────────────────────────────────────────────
const { readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const testDir = join(__dirname, '..', 'src', 'website-platform', '__tests__');
const files = readdirSync(testDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => join('src', 'website-platform', '__tests__', f));

if (files.length === 0) {
  console.error('No website-platform test files found.');
  process.exit(1);
}

const result = spawnSync('npx', ['tsx', '--test', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
