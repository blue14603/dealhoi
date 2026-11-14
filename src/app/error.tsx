"use client";
import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <Alert tone="danger" title="DealHoi đang gặp sự cố. Bạn vui lòng thử lại sau.">
        <p>Không thể tải dữ liệu lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
          <RotateCcw aria-hidden /> Thử lại
        </Button>
      </Alert>
    </div>
  );
}
