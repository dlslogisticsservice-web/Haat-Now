#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · test runner (Wave 0).
// Discovers every *.test.ts under src/website-platform/__tests__ and runs it via
// tsx + node's built-in test runner. Cross-platform (no shell globbing).
// ─────────────────────────────────────────────────────────────────────────────
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

// Pure, dependency-injected layers whose tests run under tsx (no DOM, no Supabase).
const SUITE_DIRS = [
  ['src', 'website-platform', '__tests__'],
  ['src', 'guardian', '__tests__'],
];

const files = SUITE_DIRS.flatMap((parts) => {
  const dir = join(__dirname, '..', ...parts);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => join(...parts, f));
});

if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync('npx', ['tsx', '--test', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
