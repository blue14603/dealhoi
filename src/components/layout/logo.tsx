import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight" aria-label="DealHoi – trang chủ">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-extrabold text-white">
        Đ
      </span>
      <span>
        Deal<span className="text-brand">Hoi</span>
      </span>
    </Link>
  );
}
