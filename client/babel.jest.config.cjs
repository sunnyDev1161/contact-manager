// Deliberately named so @vitejs/plugin-react's auto-detection (which looks
// for babel.config.js/.cjs, .babelrc, etc.) never picks this up — Vite's own
// production build must keep using esbuild, untouched by this. Only Jest is
// pointed at this file, explicitly, via jest.config.cjs's transform option.
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }]
  ],
  // Vite provides import.meta.env at build time; under Jest there's no Vite,
  // so import.meta itself would be a syntax error without this.
  plugins: [require.resolve("./test/babel-plugin-stub-import-meta.cjs")]
};
