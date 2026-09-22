module.exports = {
  testEnvironment: "node",
  globalSetup: "./test/global-setup.js",
  setupFiles: ["./test/setup-env.js"],
  testMatch: ["**/test/**/*.test.js"],
  // SQLite serializes writers; running suites in parallel against the same
  // test database file causes lock timeouts and flaky failures. The suite
  // is small enough that running in-band costs little.
  maxWorkers: 1,
  collectCoverageFrom: ["src/**/*.js"],
  coverageDirectory: "coverage"
};
