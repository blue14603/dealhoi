"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  CardEditSchema,
  DealEditSchema,
  setDealPublication,
  setSourceReviewed,
  updateCard,
  updateDeal,
  withdrawExpiredDeals,
  type ActionResult,
} from "@/lib/admin/admin-data";
import { adminAuthConfigured, authenticate, createSession, destroySession, requireAdmin } from "@/lib/admin/auth";

const uuid = z.uuid();

export async function loginAction(_prev: { error?: string; email?: string } | undefined, form: FormData): Promise<{ error?: string; email?: string }> {
  const cfg = adminAuthConfigured();
  if (!cfg.ok) return { error: `Đăng nhập quản trị chưa được cấu hình: ${cfg.reason}` };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(`login:${ip}`, 5, 15 * 60_000).allowed) return { error: "Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút." };
  const email = String(form.get("email") ?? "").slice(0, 320);
  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Vui lòng nhập email và mật khẩu.", email };
  const admin = await authenticate(email, password);
  if (!admin) return { error: "Email hoặc mật khẩu không đúng, hoặc tài khoản không có quyền quản trị.", email };
  await createSession(admin);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

function revalidatePublic() {
  revalidatePath("/", "layout");
}

export async function saveDealAction(id: string, _prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Mã không hợp lệ." };
  const parsed = DealEditSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Dữ liệu không hợp lệ.", errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const r = await updateDeal(id, parsed.data, session.email);
  if (r.ok) revalidatePublic();
  return r;
}

export async function setDealStatusAction(form: FormData) {
  const session = await requireAdmin();
  const id = String(form.get("id"));
  const status = z.enum(["published", "draft", "withdrawn"]).safeParse(form.get("status"));
  if (!uuid.safeParse(id).success || !status.success) return;
  await setDealPublication(id, status.data, session.email);
  revalidatePublic();
}

export async function withdrawExpiredAction() {
  const session = await requireAdmin();
  await withdrawExpiredDeals(session.email);
  revalidatePublic();
}

export async function saveCardAction(id: string, _prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, message: "Mã không hợp lệ." };
  const parsed = CardEditSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Dữ liệu không hợp lệ.", errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const r = await updateCard(id, parsed.data, session.email);
  if (r.ok) revalidatePublic();
  return r;
}

export async function reviewSourceAction(form: FormData) {
  const session = await requireAdmin();
  const id = String(form.get("id"));
  if (!uuid.safeParse(id).success) return;
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  await setSourceReviewed(id, form.get("reviewed") === "true", notes, session.email);
  revalidatePublic();
}
