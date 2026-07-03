#!/usr/bin/env node
/**
 * Route-map drift check — ensures implemented pillar views are wired in Workspace.
 * Run: npm run check:routes (from web/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const subnavPath = path.join(root, 'src/app/pillar-subnav.ts');
const workspacePath = path.join(root, 'src/components/Workspace.tsx');

const subnav = fs.readFileSync(subnavPath, 'utf8');
const workspace = fs.readFileSync(workspacePath, 'utf8');

const implementedViews = [];
for (const m of subnav.matchAll(/view:\s*'([^']+)'[^}]*implemented:\s*true/g)) {
  implementedViews.push(m[1]);
}
implementedViews.push('admin', 'reports', 'agents', 'agent-detail');

const missing = [];
for (const view of implementedViews) {
  const caseNeedle = view === 'agent-detail' ? "case 'agent-detail'" : `case '${view}'`;
  if (!workspace.includes(caseNeedle)) missing.push(view);
}

const pathChecks = [
  ['/', 'briefing'],
  ['/briefing', 'briefing'],
  ['/now', 'now'],
  ['/insights-wellbeing', 'insights-wellbeing'],
  ['/insights-slas', 'insights-slas'],
  ['/innovate', 'innovate'],
  ['/innovate-catalog', 'innovate-catalog'],
  ['/agents', 'agents'],
  ['/admin', 'admin'],
];

function parseRouteSegment(segment) {
  if (!segment) return 'briefing';
  if (segment === 'agents') return 'agents';
  if (segment === 'overview') return 'briefing';
  return segment;
}

for (const [pathname, expected] of pathChecks) {
  const segment = pathname.replace(/^\//, '').split('/')[0];
  const got = parseRouteSegment(segment);
  if (got !== expected) {
    console.error(`parseRoute drift: ${pathname} expected ${expected}, got ${got}`);
    process.exit(1);
  }
}

if (missing.length) {
  console.error('Route-map drift — implemented views missing from ScreenRouter:');
  for (const v of missing) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`Route map OK (${implementedViews.length} implemented views wired).`);
