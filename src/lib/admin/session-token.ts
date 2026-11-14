/**
 * HMAC-SHA256 signed admin session tokens (Web Crypto, so it also runs in middleware).
 * Format: base64url(payload JSON) + "." + base64url(signature)
 */
export interface AdminSession {
  email: string;
  provider: "supabase" | "env";
  exp: number; // epoch seconds
}

export const SESSION_COOKIE = "dh_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(session: AdminSession, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(session)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<AdminSession | null> {
  if (!token || !secret || secret.length < 32) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig) as BufferSource, enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as AdminSession;
    if (typeof s.email !== "string" || typeof s.exp !== "number" || s.exp < nowSec) return null;
    return s;
  } catch {
    return null;
  }
}
