// Bundle the Lambda handlers into self-contained files under dist/ for
// deployment. esbuild inlines dependencies (pg) so no node_modules ship.
// Terraform (infra/modules/*) zips dist/ as the function artifact.
//
//   npm run build   →   dist/resolver.mjs, dist/pre-token.mjs, …

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: [
    'src/resolver.mjs',
    'src/pre-token.mjs',
    'src/post-confirmation.mjs',
    'src/migrate.mjs',
    'src/agent-worker.mjs',
    'src/simulator.mjs',
  ],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  // .sql slices are inlined as strings (used by the migration Lambda).
  loader: { '.sql': 'text' },
  external: [
    'pg-native', // optional pg dependency we don't use
    // The Node.js runtime bundles the v2-era clients we rely on; keep those
    // external. Everything not guaranteed present gets bundled: Bedrock Runtime
    // (agent act path) and the SigV4 signing stack + SSM (agent AppSync push).
    '@aws-sdk/client-secrets-manager',
  ],
  // pg uses require() internally; shim it under ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
