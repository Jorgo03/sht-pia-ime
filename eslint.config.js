// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import expoExtensions from 'eslint-config-expo/utils/extensions.js';

const { jsExtensions, tsExtensions, platformSubextensions, computeExpoExtensions } =
  expoExtensions;

// eslint-config-expo passes Metro's platform-suffix extension list
// (.native.tsx, .web.tsx, .ios.tsx, ...) to the *node* import resolver, but
// enables the TypeScript resolver as a bare `typescript: true` with no options
// (flat/utils/core.js). Bare means stock extensions — .ts/.tsx/.d.ts/.js/.jsx.
//
// `@/...` is a tsconfig `paths` alias, which only the TypeScript resolver can
// follow, so every aliased import is resolved by the one resolver that doesn't
// know about platform suffixes. Imports of modules that exist *only* as
// `foo.native.tsx` + `foo.web.tsx` (location-picker, location-preview-map,
// map-canvas) therefore reported false `import/no-unresolved` errors, while
// Metro and `tsc` (via tsconfig's `moduleSuffixes`) both resolve them fine.
//
// Re-declaring the resolver with the same extension list fixes it. Reusing
// expo's own computeExpoExtensions rather than hand-listing the suffixes keeps
// this in step with whatever platforms they support.
const allExtensions = computeExpoExtensions(
  [...jsExtensions, ...tsExtensions],
  platformSubextensions,
);

export default defineConfig([
  expoConfig,
  {
    settings: {
      'import/extensions': allExtensions,
      'import/resolver': {
        node: { extensions: allExtensions },
        typescript: { extensions: allExtensions, alwaysTryTypes: true },
      },
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
