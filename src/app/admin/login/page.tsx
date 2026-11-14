import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-bold">Quản trị dữ liệu</h1>
      <p className="mt-2 text-sm text-ink-muted">Chỉ dành cho biên tập viên đã được cấp quyền.</p>
      <LoginForm />
    </div>
  );
}
