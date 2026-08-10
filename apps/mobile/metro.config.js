// Metro config for the ApeCheck monorepo.
// Watches the repo root so shared workspace packages (@apecheck/*) resolve,
// and lets Metro find hoisted dependencies in the root node_modules.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so edits to packages/* hot-reload).
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Don't let Metro walk up past the monorepo root looking for modules.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
