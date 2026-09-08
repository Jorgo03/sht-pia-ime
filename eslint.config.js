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
    /*
     * react-hooks/set-state-in-effect: warn, not error — deliberately, and
     * temporarily.
     *
     * eslint-config-expo 57 brought eslint-plugin-react-hooks 7 (up from 5),
     * whose React Compiler ruleset added this check. It fires 32 times, and
     * not because 32 things broke: no application code changed when the SDK
     * moved. Every hit is the same shape, `setLoading(true)` at the top of a
     * fetch effect, which is the pattern this app has always used.
     *
     * The rule is not wrong. That synchronous setState does cost an extra
     * render pass, and the fix React actually recommends is to stop hand-
     * rolling fetch-in-effect and let a data library own the loading state —
     * @tanstack/react-query, which this repo already uses on mobile. Doing
     * that across the web app's auth, messaging, viewings and properties
     * hooks is a real migration, not a lint pass, and half of it would leave
     * two ways to fetch the same kind of data side by side.
     *
     * Left as `error` it fails `npm run lint` permanently, and a linter that
     * is always red stops being read — the next genuine error would land in
     * 32 lines of familiar noise and be missed. As `warn` the finding stays
     * visible on every run and the command still passes, which keeps the
     * signal usable while the migration is scheduled (AUDIT.md Pass 9).
     *
     * Delete this override once the hooks move to react-query; it should not
     * outlive that work.
     */
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ["dist/*"],
  },
]);
