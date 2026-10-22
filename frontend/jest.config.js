module.exports = {
  preset: '@react-native/jest-preset',
  // Several dependencies ship untranspiled ESM; Babel must process them.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native(-community)?|@reduxjs/toolkit|immer|reselect|redux|react-redux|use-sync-external-store|lucide-react-native|react-native-svg|react-native-image-picker|@react-navigation/.*|react-native-screens|react-native-safe-area-context|@react-native-async-storage|react-native-keychain|@react-native-community/.*)/)',
  ],
  setupFiles: ['./jest.setup.js'],
  // lucide-react-native resolves to ESM (.mjs) under the react-native
  // condition, which babel-jest does not process; use its CJS build.
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};
