"use client";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import type { ImportReport } from "@/lib/admin/import";

const ENTITIES = ["banks", "categories", "merchants", "sources", "cards", "deals"] as const;

export function ImportPanel() {
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [entity, setEntity] = useState<(typeof ENTITIES)[number]>("deals");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [committed, setCommitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      setError("Tệp tối đa 2 MB.");
      return;
    }
    setFormat(f.name.toLowerCase().endsWith(".csv") ? "csv" : "json");
    setContent(await f.text());
    setReport(null);
    setCommitted(false);
  }

  async function run(dryRun: boolean) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, entity: format === "csv" ? entity : undefined, content, dryRun }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      if (!data || (!res.ok && !("counts" in data))) throw new Error(data?.error?.message ?? "Không thể nhập dữ liệu.");
      setReport(data as ImportReport);
      setCommitted(!dryRun && (data as ImportReport).ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nhập dữ liệu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-3">
        <div>
          <Label htmlFor="file">Chọn tệp JSON hoặc CSV</Label>
          <label htmlFor="file" className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 text-sm hover:border-brand">
            <FileUp className="size-4" aria-hidden /> Tải tệp lên
          </label>
          <input id="file" type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" onChange={onFile} />
        </div>
        <div>
          <Label htmlFor="format">Định dạng</Label>
          <Select id="format" value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv")}>
            <option value="json">JSON (gói nhiều loại)</option>
            <option value="csv">CSV (một loại)</option>
          </Select>
        </div>
        {format === "csv" && (
          <div>
            <Label htmlFor="entity">Loại dữ liệu CSV</Label>
            <Select id="entity" value={entity} onChange={(e) => setEntity(e.target.value as (typeof ENTITIES)[number])}>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="md:col-span-3">
          <Label htmlFor="content">Nội dung</Label>
          <Textarea id="content" rows={10} className="font-mono text-xs" value={content} onChange={(e) => { setContent(e.target.value); setReport(null); setCommitted(false); }} placeholder='{"sources": [...], "cards": [...], "deals": [...]}' />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <Button variant="secondary" disabled={!content || pending} onClick={() => run(true)}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Kiểm tra (không ghi)
          </Button>
          <Button disabled={!content || pending || !report?.ok || committed} onClick={() => run(false)}>
            Nhập vào cơ sở dữ liệu
          </Button>
        </div>
        <p className="text-xs text-ink-subtle md:col-span-3">
          Bản ghi mới hoặc thay đổi luôn ở trạng thái nháp/cần xác minh. Hãy duyệt nguồn và xuất bản trong mục Ưu đãi sau khi kiểm tra.
        </p>
      </div>

      {error && (
        <Alert tone="danger" title="Lỗi">
          <p>{error}</p>
        </Alert>
      )}
      {committed && (
        <Alert tone="success" title="Nhập dữ liệu thành công">
          <p>Dữ liệu đã được lưu. Các bản ghi mới cần được xác minh trước khi hiển thị công khai.</p>
        </Alert>
      )}
      {report && (
        <section aria-label="Kết quả kiểm tra" className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            {report.ok ? <CheckCircle2 className="size-4 text-savings" aria-hidden /> : null}
            {report.ok ? (report.dryRun ? "Hợp lệ — sẵn sàng nhập" : "Đã nhập") : `${report.errors.length} lỗi cần sửa`}
          </p>
          <table className="w-full max-w-md text-left">
            <thead className="text-xs text-ink-muted">
              <tr><th>Loại</th><th>Tạo mới</th><th>Cập nhật</th><th>Không đổi</th></tr>
            </thead>
            <tbody>
              {Object.entries(report.counts).filter(([, c]) => c.create + c.update + c.unchanged > 0).map(([k, c]) => (
                <tr key={k}><td>{k}</td><td>{c.create}</td><td>{c.update}</td><td>{c.unchanged}</td></tr>
              ))}
            </tbody>
          </table>
          {report.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-danger">
              {report.errors.map((e, i) => (
                <li key={i}>{e.entity}{e.index >= 0 ? `[${e.index}]` : ""} {e.key}: {e.message}</li>
              ))}
            </ul>
          )}
          {report.warnings.length > 0 && (
            <details>
              <summary className="cursor-pointer text-warn">{report.warnings.length} cảnh báo</summary>
              <ul className="mt-1 list-disc pl-5 text-warn">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w.entity} {w.key}: {w.message}</li>
                ))}
              </ul>
            </details>
          )}
          {report.items.some((i) => i.notes.length) && (
            <details>
              <summary className="cursor-pointer">Chi tiết thay đổi</summary>
              <ul className="mt-1 list-disc pl-5 text-ink-muted">
                {report.items.filter((i) => i.action !== "unchanged").map((i, n) => (
                  <li key={n}>{i.entity} {i.key}: {i.action}{i.notes.length ? ` — ${i.notes.join("; ")}` : ""}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
