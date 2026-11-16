import Link from "next/link";

/** Typographic wordmark: "dealhoi." with an electric-blue full stop. */
export function Logo() {
  return (
    <Link href="/" className="font-display text-[1.6rem] leading-none font-bold tracking-[-0.05em] text-ink" aria-label="DealHoi – trang chủ">
      dealhoi<span className="text-brand-bright">.</span>
    </Link>
  );
}
