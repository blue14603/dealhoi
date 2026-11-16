import { Badge } from "@/components/ui/badge";
import { listAdminSources } from "@/lib/admin/admin-data";
import { requireAdmin } from "@/lib/admin/auth";
import { formatTimestampDate } from "@/lib/domain/format";
import { reviewSourceAction } from "../../actions";

function urlLooksValid(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
}

export default async function AdminSources() {
  await requireAdmin();
  const sources = await listAdminSources();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nguồn dữ liệu ({sources.length})</h1>
      <p className="text-sm text-ink-muted">Mở từng nguồn, đối chiếu với điều khoản đã nhập rồi đánh dấu đã duyệt. Bỏ duyệt sẽ tự động gỡ xuất bản các ưu đãi phụ thuộc.</p>
      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={String(s.id)} className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <a href={String(s.url)} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-accent hover:underline">{String(s.url)}</a>
                <p className="text-xs text-ink-muted">
                  {String(s.publisher)} · {String(s.source_type)} · lấy ngày {formatTimestampDate(new Date(s.retrieved_at as string).toISOString())} · {Number(s.deal_count)} ưu đãi, {Number(s.card_count)} thẻ
                </p>
                {s.source_excerpt ? <p className="mt-1 text-xs text-ink-muted">“{String(s.source_excerpt)}”</p> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {s.verified_at ? <Badge tone="savings">Đã duyệt {formatTimestampDate(new Date(s.verified_at as string).toISOString())}</Badge> : <Badge tone="warn">Chưa duyệt</Badge>}
                {!urlLooksValid(String(s.url)) && <Badge tone="brand">URL không hợp lệ</Badge>}
                {s.is_demo && <Badge tone="warn">Demo</Badge>}
              </div>
            </div>
            <form action={reviewSourceAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={String(s.id)} />
              <input type="hidden" name="reviewed" value={s.verified_at ? "false" : "true"} />
              <label htmlFor={`notes-${s.id}`} className="sr-only">Ghi chú kiểm duyệt</label>
              <input id={`notes-${s.id}`} name="notes" placeholder="Ghi chú kiểm duyệt (tùy chọn)" className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong px-3" />
              <button type="submit" className={`h-9 rounded-full px-4 font-medium ${s.verified_at ? "border border-line-strong" : "bg-brand text-white"}`}>
                {s.verified_at ? "Bỏ duyệt" : "Đánh dấu đã duyệt"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
