const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * React Native 0.87.1's @react-native/virtualized-lists imports this private
 * module directly. It is not listed in react-native's "exports" map, so Metro
 * warns and falls back to file-based resolution. Resolve it explicitly to keep
 * the bundler output clean without disabling package exports globally.
 */
const FEATURE_FLAGS_MODULE =
  'react-native/src/private/featureflags/ReactNativeFeatureFlags';
const FEATURE_FLAGS_PATH = path.join(
  path.dirname(require.resolve('react-native/package.json')),
  'src/private/featureflags/ReactNativeFeatureFlags.js',
);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * blockList keeps the file watcher out of Android/Gradle build outputs
 * (including per-library android/build dirs inside node_modules). Gradle
 * creates and deletes these while compiling, which otherwise surfaces as
 * ENOENT "skipping — add this directory to your ignore list" warnings.
 * JS resolution is unaffected: only watcher crawling is excluded.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /.*\/android\/build\/.*/,
      /.*\/android\/app\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/android\/app\/\.cxx\/.*/,
    ],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === FEATURE_FLAGS_MODULE) {
        return { filePath: FEATURE_FLAGS_PATH, type: 'sourceFile' };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
