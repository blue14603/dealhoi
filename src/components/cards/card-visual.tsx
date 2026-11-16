import { cn } from "@/lib/utils";

/** Three metallic finishes; a bank keeps the same finish everywhere. */
const FINISHES = [
  {
    name: "titanium",
    body: "bg-[linear-gradient(135deg,#f4f6fa_0%,#b9c0cc_18%,#5d6575_38%,#dfe3ea_52%,#8a93a3_70%,#2d3443_88%,#c4cad4_100%)] text-[#141720]",
    sub: "text-[#2d3443]",
  },
  {
    name: "obsidian",
    body: "bg-[linear-gradient(135deg,#2d3443_0%,#0b0d14_40%,#1c202c_62%,#08090d_100%)] text-ink ring-1 ring-inset ring-[#c4cad4]/40",
    sub: "text-chrome",
  },
  {
    name: "cobalt",
    body: "bg-[linear-gradient(135deg,#6f93ff_0%,#2457ff_35%,#1636a8_70%,#08123d_100%)] text-white",
    sub: "text-ice",
  },
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Card artwork. Uses the official image when one is stored; otherwise an original,
 * clearly generic metallic illustration (not a reproduction of any bank's design).
 */
export function CardVisual({
  name,
  bankName,
  network,
  tier,
  imageUrl,
  className,
}: {
  name: string;
  bankName: string;
  network: string | null;
  tier: string | null;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={`Hình thẻ ${name}`} className={cn("aspect-[1.586] w-full rounded-2xl object-cover", className)} />;
  }
  const f = FINISHES[hash(bankName) % FINISHES.length];
  return (
    <div
      role="img"
      aria-label={`Hình minh họa thẻ ${name} (không phải thiết kế thẻ thật)`}
      className={cn("relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-[6%] shadow-[0_24px_48px_-20px_rgb(0_0_0/0.9),0_0_0_1px_rgb(65_109_255/0.25)]", f.body, className)}
    >
      {/* brushed texture + light sweep */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(115deg,rgb(255_255_255/0.05)_0_1px,transparent_1px_5px)]" />
      <span aria-hidden className="pointer-events-none absolute -inset-y-6 left-[30%] w-[22%] rotate-[22deg] bg-white/25 blur-md" />
      <div className={cn("relative flex items-start justify-between gap-2 text-[0.65rem] font-semibold tracking-[0.14em] uppercase sm:text-xs", f.sub)}>
        <span className="line-clamp-1">{bankName.replace(/\s*\(Demo\)\s*/, "")}</span>
        {tier && <span className="shrink-0">{tier}</span>}
      </div>
      <div className="relative flex items-center gap-3">
        <span aria-hidden className="h-[22%] min-h-6 w-[14%] min-w-9 rounded-md bg-[linear-gradient(135deg,#ffffff,#9aa3b2_55%,#e3e7ee)] ring-1 ring-black/20" />
        <span aria-hidden className={cn("font-display text-lg leading-none opacity-70", f.sub)}>)))</span>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <span className="font-display line-clamp-2 text-sm leading-tight font-bold sm:text-base">{name.replace(/\s*\(Demo\)\s*/, "")}</span>
        {network && <span className="font-display shrink-0 text-sm font-bold italic opacity-90">{network}</span>}
      </div>
    </div>
  );
}
