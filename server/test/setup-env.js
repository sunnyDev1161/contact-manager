// Runs before each test file's module graph loads, so every `require`d
// module (including the Prisma client) sees these values from the start.
process.env.DATABASE_URL = "file:./jest-test.db";
process.env.JWT_SECRET = "jest-test-secret-do-not-use-in-production";
process.env.CORS_ORIGIN = "*";
