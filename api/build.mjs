// Bundle the Lambda handlers into self-contained files under dist/ for
// deployment. esbuild inlines dependencies (pg) so no node_modules ship.
// Terraform (infra/modules/*) zips dist/ as the function artifact.
//
//   npm run build   →   dist/resolver.mjs, dist/pre-token.mjs

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/resolver.mjs', 'src/pre-token.mjs'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  // pg-native is an optional pg dependency we don't use; keep it out of the bundle.
  external: ['pg-native'],
  // pg uses require() internally; shim it under ESM output.
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
