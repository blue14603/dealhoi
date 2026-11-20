import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-black/5 px-3 py-2 text-xs"><code>{children}</code></pre>;
}

export default async function AdminGuide() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hướng dẫn quản trị</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Quy trình đưa ưu đãi từ trang ngân hàng lên DealHoi. Không có gì tự động công khai: mỗi nguồn, thẻ và ưu đãi đều cần bạn duyệt.
        </p>
      </div>

      <nav aria-label="Mục lục" className="flex flex-wrap gap-2 text-sm">
        {[
          ["thu-thap", "1. Thu thập"],
          ["nhap", "2. Nhập"],
          ["nguon", "3. Duyệt nguồn"],
          ["the", "4. Thẻ"],
          ["uu-dai", "5. Ưu đãi"],
          ["dinh-ky", "Chạy định kỳ"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1 hover:bg-black/5">{label}</a>
        ))}
      </nav>

      <Section id="thu-thap" title="1. Thu thập dữ liệu (máy của bạn)">
        <p>Crawler đọc trang ưu đãi và trang thẻ của ngân hàng, dùng AI tách điều kiện, rồi kiểm tra mọi con số với nội dung trang. Khóa API OpenAI và chuỗi kết nối database đặt trong <code>.env.local</code>, không gõ trên dòng lệnh.</p>
        <Code>npm run crawl -- techcombank</Code>
        <p>Kết quả nằm trong <code>.crawl/out/techcombank/&lt;ngày&gt;/</code>. Đọc <code>report.md</code> trước:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Cần chú ý khi duyệt</b>: ưu đãi chia mức theo thẻ, hoặc không có số tiền VND. Sửa ở bước 5.</li>
          <li><b>Ưu đãi cần nhập tay</b>: AI trả kết quả không khớp với trang. Nhập tay nếu cần.</li>
          <li><b>Ưu đãi bị bỏ qua</b>: chỉ cho thẻ ghi nợ, hoặc chỉ cho khách được ngân hàng mời.</li>
          <li><b>Thông tin thẻ đọc được / Đề xuất cập nhật thẻ</b>: phí thường niên và điều kiện đọc từ trang thẻ.</li>
        </ul>
      </Section>

      <Section id="nhap" title="2. Nhập dữ liệu">
        <p>Ở <Link href="/admin/import" className="text-brand hover:underline">Nhập dữ liệu</Link>, chọn <b>JSON (gói nhiều loại)</b>, bấm <b>Kiểm tra (không ghi)</b>, rồi <b>Nhập dữ liệu</b> nếu hợp lệ. Thứ tự:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li><code>stubs.json</code>: thẻ, cửa hàng mới và trang thẻ (làm nguồn). Mỗi thẻ chỉ có ở lần chạy đầu tiên thấy nó, nên nhập lại không xóa phí bạn đã điền.</li>
          <li><code>bundle.json</code>: nguồn và ưu đãi. Mọi thứ vào ở trạng thái nháp.</li>
        </ol>
        <p className="text-warn">Không nhập <code>bundle.json</code> của lần chạy <code>--force</code> sau khi đã sửa ưu đãi trong admin: nó chứa lại mọi ưu đãi và ghi đè phần bạn sửa.</p>
      </Section>

      <Section id="nguon" title="3. Duyệt nguồn">
        <p>Ở <Link href="/admin/sources" className="text-brand hover:underline">Nguồn</Link>: bấm <b>Mở nguồn</b>, so trang ngân hàng với dữ liệu đã nhập, rồi <b>Đánh dấu đã duyệt</b>. Database không cho xuất bản ưu đãi hay xác minh thẻ khi nguồn chưa duyệt. Bỏ duyệt một nguồn sẽ tự gỡ xuất bản các ưu đãi dựa trên nó.</p>
      </Section>

      <Section id="the" title="4. Hoàn thiện và xác minh thẻ">
        <p>Ở <Link href="/admin/cards" className="text-brand hover:underline">Thẻ</Link>, bấm <b>Sửa</b> từng thẻ. Phí thường niên, tổ chức thẻ, hạng thẻ và điều kiện miễn phí có thể đã được điền từ trang thẻ: đối chiếu với trang (nguồn của thẻ), sửa nếu sai, rồi chọn trạng thái <b>verified</b>. Để trống = chưa rõ; 0 = miễn phí đã xác nhận.</p>
        <p>Khi <code>report.md</code> có <b>Đề xuất cập nhật thẻ</b> (ngân hàng đổi phí…), cập nhật tay ở đây: crawler không ghi đè thẻ đã nhập.</p>
      </Section>

      <Section id="uu-dai" title="5. Kiểm tra và xuất bản ưu đãi">
        <p>Ở <Link href="/admin/deals" className="text-brand hover:underline">Ưu đãi</Link>, bấm <b>Sửa</b>, đối chiếu tỷ lệ, số tiền, mức tối đa, chi tiêu tối thiểu, ngày và điều kiện với trang nguồn.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Thẻ đủ điều kiện</b>: bỏ chọn thẻ không hưởng đúng mức này (ví dụ ưu đãi chia 12% / 10% theo 6 số đầu thẻ).</li>
          <li>Chọn <b>verified</b> rồi <b>Xuất bản</b>. Cần: nguồn đã duyệt và ít nhất một thẻ.</li>
          <li>Ưu đãi không có số tiền VND (ghi bằng USD, SGD…) vẫn xuất bản được; trang so sánh sẽ ghi “thiếu thông tin”.</li>
        </ul>
      </Section>

      <Section id="dinh-ky" title="Chạy định kỳ">
        <p>Chạy crawler mỗi tuần, không dùng <code>--force</code>. Chỉ ưu đãi mới hoặc đã thay đổi được gửi cho AI và có trong <code>bundle.json</code>. Nếu ngân hàng đổi một ưu đãi đã xuất bản, lần nhập sẽ tự gỡ xuất bản và chuyển nó sang <b>needs_review</b>.</p>
        <p>Trên <Link href="/admin" className="text-brand hover:underline">Tổng quan</Link>, mục <b>Việc cần làm</b> cho biết còn bao nhiêu việc ở từng bước; nút <b>Ngừng hiển thị tất cả ưu đãi đã hết hạn</b> dọn ưu đãi quá hạn.</p>
      </Section>
    </div>
  );
}
