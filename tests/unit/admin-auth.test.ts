import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/admin/password";
import { signSession, verifySession } from "@/lib/admin/session-token";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const SECRET = "x".repeat(40);

describe("admin session tokens", () => {
  it("round-trips and rejects tampering, expiry and wrong secrets", async () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signSession({ email: "a@b.c", provider: "env", exp }, SECRET);
    expect((await verifySession(token, SECRET))?.email).toBe("a@b.c");
    expect(await verifySession(token, "y".repeat(40))).toBeNull();
    const [p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ email: "evil@x.y", provider: "env", exp })).toString("base64url");
    expect(await verifySession(`${forged}.${s}`, SECRET)).toBeNull();
    expect(await verifySession(`${p}.${s}`, SECRET, exp + 1)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession(token, "short")).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", () => {
    const now = 1_000_000;
    expect(checkRateLimit("t", 2, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit("t", 2, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit("t", 2, 60_000, now).allowed).toBe(false);
    expect(checkRateLimit("t", 2, 60_000, now + 60_001).allowed).toBe(true);
  });
});
