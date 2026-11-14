import { cn } from "@/lib/utils";

const PALETTES = [
  "from-zinc-800 to-zinc-600",
  "from-red-700 to-rose-500",
  "from-slate-700 to-sky-700",
  "from-emerald-800 to-teal-600",
  "from-amber-700 to-orange-500",
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Card artwork. Uses the official image when one is stored; otherwise a neutral
 * generated illustration (not a reproduction of the bank's card design).
 */
export function CardVisual({ name, bankName, network, tier, imageUrl, className }: { name: string; bankName: string; network: string | null; tier: string | null; imageUrl: string | null; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={`Hình thẻ ${name}`} className={cn("aspect-[1.586] w-full rounded-xl object-cover", className)} />;
  }
  return (
    <div
      role="img"
      aria-label={`Minh họa thẻ ${name}`}
      className={cn("relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-sm", PALETTES[hash(bankName) % PALETTES.length], className)}
    >
      <div className="flex items-start justify-between gap-2 text-xs font-medium opacity-90">
        <span className="line-clamp-1">{bankName}</span>
        {tier && <span className="shrink-0 uppercase tracking-wide">{tier}</span>}
      </div>
      <div className="h-7 w-10 rounded-md bg-gradient-to-br from-yellow-200/90 to-yellow-500/80" aria-hidden />
      <div className="flex items-end justify-between gap-2">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{name}</span>
        {network && <span className="shrink-0 text-sm font-bold italic opacity-90">{network}</span>}
      </div>
    </div>
  );
}
