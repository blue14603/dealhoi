/* Prints an ADMIN_PASSWORD_HASH value. Usage: npm run admin:hash-password -- 'your-long-password' (or pipe it via stdin) */
import { hashPassword } from "../src/lib/admin/password";

async function main() {
  let pw = process.argv[2];
  if (!pw) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    pw = Buffer.concat(chunks).toString("utf8").trim();
  }
  if (!pw || pw.length < 12) throw new Error("Password must be at least 12 characters");
  console.log(await hashPassword(pw));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
