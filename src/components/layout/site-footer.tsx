import Link from "next/link";
import { DISCLAIMER } from "@/lib/copy";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_2fr]">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-ink-muted">Nền tảng độc lập giúp so sánh ưu đãi thẻ tín dụng tại Việt Nam.</p>
        </div>
        <div className="space-y-3 text-sm text-ink-muted">
          <p>{DISCLAIMER}</p>
          <p>
            DealHoi không phải ngân hàng, tổ chức cho vay hay đơn vị phát hành thẻ, không nhận hồ sơ mở thẻ và không cam kết khả năng được duyệt thẻ
            hay số tiền tiết kiệm. Hãy chỉ chi tiêu trong khả năng và thanh toán đủ dư nợ để tránh lãi, phí.
          </p>
          <nav aria-label="Liên kết chân trang" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/uu-dai" className="hover:text-ink">Ưu đãi</Link>
            <Link href="/the-tin-dung" className="hover:text-ink">Thẻ tín dụng</Link>
            <Link href="/phuong-phap" className="hover:text-ink">Phương pháp & nguồn dữ liệu</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
