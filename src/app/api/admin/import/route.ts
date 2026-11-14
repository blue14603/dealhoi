import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleServiceError, readJson, zodDetails } from "@/lib/api";
import { getAdminSession } from "@/lib/admin/auth";
import { csvToRecords } from "@/lib/admin/csv";
import { runImport } from "@/lib/admin/import";
import { ENTITY_ORDER } from "@/lib/admin/import-schema";
import { withAdminTx } from "@/lib/db/client";

const MAX_BYTES = 2_000_000;
const Body = z.object({
  format: z.enum(["json", "csv"]),
  entity: z.enum(ENTITY_ORDER).optional(),
  content: z.string().min(1).max(MAX_BYTES),
  dryRun: z.boolean().default(true),
});

export async function POST(req: Request) {
  // Middleware already blocks anonymous requests; verify again here.
  const session = await getAdminSession();
  if (!session) return apiError("UNAUTHORIZED", "Cần đăng nhập quản trị.", 401);
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return apiError("FORBIDDEN", "Yêu cầu không hợp lệ.", 403);

  const json = await readJson(req, MAX_BYTES + 10_000);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return apiError("INVALID_INPUT", "Dữ liệu không hợp lệ.", 400, zodDetails(parsed.error));
  const { format, entity, content, dryRun } = parsed.data;

  let bundle: unknown;
  try {
    if (format === "csv") {
      if (!entity) return apiError("INVALID_INPUT", "Cần chọn loại dữ liệu cho tệp CSV.", 400);
      bundle = { [entity]: csvToRecords(content) };
    } else bundle = JSON.parse(content);
  } catch (e) {
    return apiError("INVALID_INPUT", `Không đọc được tệp: ${e instanceof Error ? e.message : "định dạng sai"}`, 400);
  }
  try {
    const report = await withAdminTx((tx) => runImport(tx, bundle, { mode: "admin", dryRun, actorEmail: session.email }));
    return NextResponse.json(report, { status: report.ok ? 200 : 422 });
  } catch (e) {
    return handleServiceError(e);
  }
}
