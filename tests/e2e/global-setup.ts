import { execSync } from "node:child_process";
import { E2E_DATABASE_URL } from "./env";

export default function globalSetup() {
  execSync("npx tsx --conditions=react-server tests/e2e/seed-e2e.ts", {
    stdio: "inherit",
    env: { ...process.env, TEST_DATABASE_URL: E2E_DATABASE_URL, DATABASE_URL: E2E_DATABASE_URL },
  });
}
