const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SERVER_DIR = path.join(__dirname, "..", "server");
// Prisma resolves a relative sqlite `file:` URL relative to prisma/, not the
// process cwd — this must match the DATABASE_URL every test file's
// electron.launch() env uses (see tests/fixtures.js).
const DB_FILE = path.join(SERVER_DIR, "prisma", "e2e-test.db");

module.exports = async function globalSetup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const f = DB_FILE + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  execSync("npx prisma migrate deploy", {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: "file:./e2e-test.db" },
    stdio: "inherit"
  });
};
