import { ImportPanel } from "@/components/admin/import-panel";
import { requireAdmin } from "@/lib/admin/auth";

export default async function ImportPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nhập dữ liệu</h1>
      <p className="text-sm text-ink-muted">
        Dùng mẫu trong thư mục <code>data/templates</code>. Bản ghi được đối chiếu theo slug (thẻ, cửa hàng), URL (nguồn) và import_key (ưu đãi) để phát hiện trùng lặp.
      </p>
      <ImportPanel />
    </div>
  );
}
