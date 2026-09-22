module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { configFile: require.resolve("./babel.jest.config.cjs") }]
  },
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  testMatch: ["**/test/**/*.test.jsx", "**/test/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.{js,jsx}", "!src/main.jsx"],
  coverageDirectory: "coverage"
};
