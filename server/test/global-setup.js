const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Prisma resolves a relative sqlite `file:` URL relative to prisma/, not
// the process cwd — this must match test/setup-env.js's DATABASE_URL.
const dbPath = path.join(__dirname, "..", "prisma", "jest-test.db");

module.exports = async function globalSetup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./jest-test.db" },
    stdio: "inherit"
  });
};
