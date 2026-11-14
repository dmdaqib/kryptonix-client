module.exports = {
  project: {
    android: {
      sourceDir: "./android",
      appName: "app",
      packageName: "digital.kryptonix.client",
    },
    ios: {
      sourceDir: "./ios",
    },
  },
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
        },
      },
    },
  },
};
