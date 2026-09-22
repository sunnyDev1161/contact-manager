// Vite provides `import.meta.env` at build/dev time; under Jest there's no
// Vite, so `import.meta` is bare ESM-only syntax that would otherwise crash
// parsing the moment jest-runtime tries to execute the transformed output as
// CommonJS. This replaces the whole `import.meta` expression with `({})`,
// so `import.meta.env?.VITE_API_URL` (note the optional chaining in
// src/api.js) safely resolves to `undefined` under test, same as any env
// var Vite hasn't set.
module.exports = function stubImportMeta({ types: t }) {
  return {
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name === "import" && path.node.property.name === "meta") {
          path.replaceWith(t.objectExpression([]));
        }
      }
    }
  };
};
