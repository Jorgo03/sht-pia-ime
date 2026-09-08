'use strict';

/**
 * Requires a package that belongs to Expo rather than to this project.
 *
 * `@expo/cli` and `@expo/config` are dependencies of `expo`, not of us. Where
 * npm places them is therefore not ours to assume, and it changes: under SDK 54
 * both hoisted to the top level and a bare `require('@expo/config')` worked;
 * the SDK 57 upgrade moved @expo/config to `expo/node_modules/@expo/config`,
 * and every bare require died with MODULE_NOT_FOUND — taking `npm start` down
 * with it, after Metro had already begun, which is the worst moment to learn a
 * module cannot be found.
 *
 * Resolving from the `expo` package root follows these packages wherever npm
 * decides to put them, which is the only assumption that survives an SDK bump.
 *
 * Declaring them in our own package.json would be worse, not better: we would
 * be pinning versions of Expo's internals independently of the Expo actually
 * installed, and they are explicitly not a public API. Following the installed
 * copy is the correct coupling.
 *
 * This is the same lesson as the vendored QR encoder in expo-qr.cjs, which
 * broke the same way for the same reason — a transitive dependency is only
 * importable while npm happens to hoist it.
 */
function requireFromExpo(request, label = 'expo') {
  const path = require('path');
  const roots = [];

  try {
    roots.push(path.dirname(require.resolve('expo/package.json', { paths: [process.cwd()] })));
  } catch {
    // No `expo` at all is a broken install; the message below reports it.
  }
  // The top level still works on plenty of installs, and __dirname covers a
  // script run from outside the project root.
  roots.push(process.cwd(), __dirname);

  for (const root of roots) {
    try {
      return require(require.resolve(request, { paths: [root] }));
    } catch {
      // Try the next root.
    }
  }

  console.error(
    `[${label}] Could not load ${request}, which ships with Expo itself.\n` +
      '          This usually means dependencies are not installed, or are\n' +
      '          mid-upgrade. Run:\n\n            npm install\n',
  );
  process.exit(1);
}

module.exports = { requireFromExpo };
