import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ quiet: true });

const alias = {
  "@": path.resolve(__dirname, "src"),
  "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
};
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://agff:agff@localhost:5432/agff_logistics_test?schema=public";

export default defineConfig({
  resolve: { alias },
  test: {
    // Os testes de integração partilham uma BD: ficheiros correm em série.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: "test", MAIL_TRANSPORT: "memory" },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
