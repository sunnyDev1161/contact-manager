module.exports = {
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false, // each test file owns/launches its own Electron app + shares one SQLite db file
  workers: 1,
  reporter: [["list"]],
  globalSetup: require.resolve("./global-setup.js"),
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
};
