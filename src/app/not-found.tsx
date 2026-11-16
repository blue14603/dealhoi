import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState title="Không tìm thấy trang">
        Trang hoặc thẻ bạn tìm không tồn tại, hoặc chưa được xác minh.{" "}
        <Link href="/" className="font-medium text-accent hover:underline">
          Về trang chủ
        </Link>
      </EmptyState>
    </div>
  );
}
