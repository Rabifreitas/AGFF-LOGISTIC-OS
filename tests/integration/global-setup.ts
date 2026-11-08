import { execSync } from "node:child_process";
import { config as loadEnv } from "dotenv";

export default function setup() {
  loadEnv({ quiet: true });
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://agff:agff@localhost:5432/agff_logistics_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
