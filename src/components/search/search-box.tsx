"use client";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Suggestion {
  kind: "merchant" | "category" | "card";
  label: string;
  hint: string;
  href: string;
}

interface SearchResponse {
  merchants: { slug: string; name: string; category: string }[];
  categories: { slug: string; name: string }[];
  cards: { slug: string; name: string; bank: string }[];
}

const KIND_LABEL = { merchant: "Cửa hàng", category: "Danh mục", card: "Thẻ" } as const;

export function SearchBox({ defaultValue = "", size = "lg", autoFocus = false }: { defaultValue?: string; size?: "lg" | "md"; autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const errorId = useId();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SearchResponse;
        setItems([
          ...data.merchants.map((m) => ({ kind: "merchant" as const, label: m.name, hint: m.category, href: `/so-sanh?merchant=${m.slug}` })),
          ...data.categories.map((c) => ({ kind: "category" as const, label: c.name, hint: "Danh mục chi tiêu", href: `/so-sanh?category=${c.slug}` })),
          ...data.cards.map((c) => ({ kind: "card" as const, label: c.name, hint: c.bank, href: `/the-tin-dung/${c.slug}` })),
        ].slice(0, 8));
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (active >= 0 && items[active]) {
      router.push(items[active].href);
      return;
    }
    const q = query.trim();
    if (!q) {
      setError("Vui lòng nhập tên cửa hàng, sản phẩm hoặc thẻ bạn muốn tìm.");
      return;
    }
    setError(null);
    setOpen(false);
    router.push(`/tim-kiem?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = open && query.trim().length > 0 && items.length > 0;

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Tìm cửa hàng, sản phẩm hoặc thẻ tín dụng
      </label>
      <div className={cn("flex items-center gap-2 rounded-2xl border border-line-strong bg-surface-2 pl-4 transition-colors duration-200 focus-within:border-brand-bright hover:border-ink-subtle", size === "lg" ? "h-16 shadow-[0_0_0_6px_rgb(36_87_255/0.08)]" : "h-12")}>
        <Search className="size-5 shrink-0 text-ink-subtle" aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={100}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={size === "lg" ? "Bạn muốn mua gì? Starbucks, iPhone, vé concert..." : "Bạn muốn mua gì?"}
          className={cn("min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:outline-none", size === "lg" ? "text-base sm:text-lg" : "text-base sm:text-sm")}
        />
        {loading && <Loader2 className="size-4 animate-spin text-ink-subtle" aria-label="Đang tìm" />}
        <button type="submit" className={cn("mr-2 shrink-0 rounded-xl bg-brand font-semibold text-white transition-colors duration-200 hover:bg-brand-hover", size === "lg" ? "h-12 px-4 sm:px-6" : "h-9 px-4 text-sm")}>
          {size === "lg" ? (<><span className="hidden sm:inline">Tìm deal ngay</span><span className="sm:hidden">Tìm</span></>) : "Tìm"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 px-4 text-sm text-danger">
          {error}
        </p>
      )}
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line-strong bg-surface-2 py-1 text-left shadow-2xl">
          {items.map((it, i) => (
            <li
              key={`${it.kind}-${it.href}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                router.push(it.href);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5", i === active && "bg-brand-soft")}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{it.label}</span>
                <span className="block truncate text-xs text-ink-muted">{it.hint}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-subtle">{KIND_LABEL[it.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
