#!/usr/bin/env node
/**
 * Sync frozen Merlin UI snapshot into web/merlin-vendor and apply Stratos stubs.
 * Source: reference/merlin-ui-snapshot (commit pinned in manifest).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const snapshot = path.join(repoRoot, 'reference/merlin-ui-snapshot');
const vendor = path.join(webRoot, 'merlin-vendor');
const stubs = path.join(webRoot, 'src/visual-clone');

if (!existsSync(snapshot)) {
  console.error('Missing Merlin snapshot at', snapshot);
  process.exit(1);
}

mkdirSync(vendor, { recursive: true });

execSync(`rsync -a --delete --exclude node_modules "${snapshot}/src/" "${vendor}/src/"`, { stdio: 'inherit' });
execSync(`rsync -a "${snapshot}/docs/" "${vendor}/docs/"`, { stdio: 'inherit' });
execSync(`rsync -a "${snapshot}/public/" "${vendor}/public/"`, { stdio: 'inherit' });
execSync(`rsync -a "${vendor}/public/" "${webRoot}/public/"`, { stdio: 'inherit' });

for (const file of ['supabase.js', 'auth.js', 'demo-data.js']) {
  cpSync(path.join(stubs, file), path.join(vendor, 'src/app', file));
}

console.log('Merlin vendor synced from snapshot + stubs applied.');
