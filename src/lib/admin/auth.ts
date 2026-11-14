import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getSql } from "@/lib/db/client";
import { verifyPassword } from "./password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type AdminSession } from "./session-token";

export function adminAuthConfigured(): { ok: boolean; reason?: string } {
  if (!config.admin.sessionSecret) return { ok: false, reason: "ADMIN_SESSION_SECRET chưa được cấu hình (tối thiểu 32 ký tự)." };
  if (config.admin.provider === "supabase") {
    if (!config.admin.supabaseUrl || !config.admin.supabaseAnonKey) return { ok: false, reason: "Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY." };
    return { ok: true };
  }
  if (!config.admin.email || !config.admin.passwordHash) return { ok: false, reason: "Thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD_HASH." };
  return { ok: true };
}

function safeEqualIgnoreCase(a: string, b: string) {
  const x = Buffer.from(a.trim().toLowerCase());
  const y = Buffer.from(b.trim().toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Verifies credentials with the configured provider. Returns the admin email or null. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  if (!adminAuthConfigured().ok) return null;
  if (config.admin.provider === "env") {
    const passOk = await verifyPassword(password, config.admin.passwordHash);
    const emailOk = safeEqualIgnoreCase(email, config.admin.email!);
    return emailOk && passOk ? config.admin.email! : null;
  }
  // Supabase Auth: verify the password, then require an entry in admin_users.
  const res = await fetch(`${config.admin.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: config.admin.supabaseAnonKey! },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: { id?: string; email?: string } };
  const userId = data.user?.id;
  const userEmail = data.user?.email;
  if (!userId || !userEmail) return null;
  const rows = await getSql()`select email from admin_users where auth_user_id = ${userId} or lower(email) = lower(${userEmail}) limit 1`;
  return rows.length ? userEmail : null;
}

export async function createSession(email: string) {
  const session: AdminSession = { email, provider: config.admin.provider, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const token = await signSession(session, config.admin.sessionSecret!);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, config.admin.sessionSecret);
}

/** Use at the top of every admin page and server action (defence in depth beyond middleware). */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}
