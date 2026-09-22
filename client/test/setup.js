require("@testing-library/jest-dom");

// jsdom's environment doesn't provide these globals, but react-router v7
// requires them at import time.
const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
