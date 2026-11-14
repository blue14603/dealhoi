import { randomBytes, scryptSync } from "node:crypto";

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5432/dealhoi_e2e";
export const E2E_ADMIN_EMAIL = "e2e-admin@example.com";
export const E2E_ADMIN_PASSWORD = "e2e-password-not-secret";

const salt = randomBytes(16);
const hash = scryptSync(E2E_ADMIN_PASSWORD, salt, 32, { N: 16384, r: 8, p: 1 });
export const E2E_ADMIN_PASSWORD_HASH = ["scrypt", 16384, 8, 1, salt.toString("base64"), hash.toString("base64")].join(":");
