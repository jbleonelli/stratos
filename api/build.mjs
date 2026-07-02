// Bundle the Lambda handlers into self-contained files under dist/ for
// deployment. esbuild inlines dependencies (pg) so no node_modules ship.
// Terraform (infra/modules/*) zips dist/ as the function artifact.
//
//   npm run build   →   dist/resolver.mjs, dist/pre-token.mjs

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/resolver.mjs', 'src/pre-token.mjs', 'src/migrate.mjs'],
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
    '@aws-sdk/*', // provided by the Lambda Node.js runtime
  ],
  // pg uses require() internally; shim it under ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
