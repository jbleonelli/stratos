/// <reference types="vite/client" />
//
// Brings Vite's ambient types into the frontend type-check net (jsconfig.json):
//   • asset imports — `import x from './foo.png'` (and .svg/.jpg/.css/?url/?raw)
//   • `import.meta.env.VITE_*` typing
// Without this, any `// @ts-check` file that imports an image or reads
// import.meta.env errors (TS2307 "Cannot find module './*.png'"). jsconfig's
// `include` lists `src/**/*.d.ts` so this file is picked up.
