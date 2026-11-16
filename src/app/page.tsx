import { ArrowRight, BadgeCheck, Calculator, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CategoryTile } from "@/components/cards/category-chip";
import { CreditCardTile } from "@/components/cards/credit-card-tile";
import { MerchantCard } from "@/components/cards/merchant-card";
import { EmptyState } from "@/components/common/empty-state";
import { DealCard } from "@/components/deals/deal-card";
import { EditorialDealCard } from "@/components/home/editorial-deal-card";
import { SearchBox } from "@/components/search/search-box";
import { config } from "@/lib/config";
import { NO_VERIFIED_DATA } from "@/lib/copy";
import { todayInVietnam } from "@/lib/domain/validity";
import { listActiveDeals, listCards, listCategories, listMerchants } from "@/lib/services/catalog";
import { getCardHeadlineDeals, getDiscoveryHighlights } from "@/lib/services/discovery";

export const dynamic = "force-dynamic";

function SectionHead({ eyebrow, title, href, linkLabel, id }: { eyebrow: string; title: string; href?: string; linkLabel?: string; id: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="font-display mt-3 text-[2rem] leading-[1] font-bold sm:text-[2.5rem]">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent hover:text-ice">
          {linkLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const today = todayInVietnam();
  const [categories, merchants, featuredDeals, featuredCards, highlights] = await Promise.all([
    listCategories({ browsableOnly: true }),
    listMerchants({ featuredOnly: true }),
    listActiveDeals({ featuredOnly: true, limit: 50 }),
    listCards({ featuredOnly: true }),
    getDiscoveryHighlights(),
  ]);
  const cardsToShow = featuredCards.slice(0, 3);
  const [cardHeadlines, categoryCounts, merchantCounts] = await Promise.all([
    getCardHeadlineDeals(cardsToShow.map((c) => c.id)),
    Promise.all(categories.map((c) => listActiveDeals({ forCategory: { id: c.id } }).then((d) => d.filter((x) => x.merchantScope !== "general").length))),
    Promise.all(
      merchants.map((m) => listActiveDeals({ forMerchant: { id: m.id, categoryId: m.category.id } }).then((d) => d.filter((x) => x.merchantScope === "specific_merchant").length)),
    ),
  ]);
  const editorPicks = featuredDeals.filter((d) => !highlights.some((h) => h.deal?.id === d.id)).slice(0, 3);

  return (
    <>
      {/* ------------------------------------------------------------------ Hero */}
      <section className="relative grid items-center gap-10 pt-10 pb-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pt-20" aria-labelledby="hero-title">
        <div className="relative z-10">
          <p className="eyebrow">Your money. Your rules.</p>
          <h1 id="hero-title" className="font-display mt-5 text-[2.75rem] leading-[0.95] font-bold tracking-[-0.045em] sm:text-[4rem] lg:text-[5.25rem]">
            Chi thông minh.
            <br />
            <span className="text-brand-bright">Hời</span> mỗi ngày.
          </h1>
          <p className="mt-6 max-w-xl text-base text-ink-muted sm:text-lg">Khám phá ưu đãi thẻ tín dụng phù hợp với cách bạn sống và chi tiêu.</p>
          <div className="mt-8 max-w-2xl">
            <SearchBox />
          </div>
          <p className="mt-4 text-sm text-ink-subtle">
            Gợi ý:{" "}
            {[
              ["Starbucks", "/so-sanh?merchant=starbucks"],
              ["Shopee", "/so-sanh?merchant=shopee"],
              ["iPhone", "/so-sanh?merchant=apple"],
              ["Vé concert", "/so-sanh?merchant=ticketbox"],
            ].map(([label, href], i) => (
              <span key={href}>
                {i > 0 && <span aria-hidden> · </span>}
                <Link href={href} className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                  {label}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[480px] lg:mr-[-4%] lg:max-w-[560px]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/hero-cards.svg" alt="" width={560} height={460} fetchPriority="high" className="h-auto w-full" />
        </div>
      </section>

      <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-3">
        {[
          { Icon: BadgeCheck, tone: "text-savings", text: "Chỉ hiển thị ưu đãi đã xác minh, kèm nguồn và ngày kiểm tra." },
          { Icon: Calculator, tone: "text-ice", text: "Tính số tiền tiết kiệm thực tế theo mức tối đa và điều kiện." },
          { Icon: ShieldCheck, tone: "text-chrome", text: "Không cần đăng ký. DealHoi không nhận hồ sơ mở thẻ." },
        ].map(({ Icon, tone, text }) => (
          <li key={text} className="flex gap-3 bg-surface p-4 sm:p-5">
            <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden />
            <span className="text-ink-muted">{text}</span>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------- Category discovery */}
      <section className="mt-20" aria-labelledby="h-lifestyle">
        <SectionHead id="h-lifestyle" eyebrow="Khám phá theo lifestyle" title="Bạn chi cho điều gì?" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c, i) => (
            <CategoryTile key={c.slug} slug={c.slug} name={c.name} icon={c.icon} offerCount={categoryCounts[i]} />
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- Editorial deal cards */}
      <section className="mt-20" aria-labelledby="h-deals">
        <SectionHead id="h-deals" eyebrow="Find your next deal" title="Ưu đãi theo phong cách sống." href="/uu-dai" linkLabel="Tất cả ưu đãi" />
        <div className="grid gap-4 lg:grid-cols-12">
          {highlights.map((h) => (
            <EditorialDealCard key={h.concept.key} concept={h.concept} deal={h.deal} href={h.href} activeOfferCount={h.activeOfferCount} />
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-subtle">
          Mỗi thẻ hiển thị một ưu đãi đã xác minh đang áp dụng, chọn theo quy tắc cố định: ưu đãi riêng tại cửa hàng trước, hoàn tiền/giảm giá có giá trị
          xác định trước. Hình ảnh là minh họa.
        </p>
      </section>

      {/* ------------------------------------------------------------ Editor picks */}
      {editorPicks.length > 0 && (
        <section className="mt-20" aria-labelledby="h-picks">
          <SectionHead id="h-picks" eyebrow="Biên tập viên chọn" title="Lựa chọn của biên tập." href="/uu-dai" linkLabel="Xem tất cả" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editorPicks.map((d) => (
              <DealCard key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} />
            ))}
          </div>
        </section>
      )}
      {featuredDeals.length === 0 && (
        <div className="mt-20">
          <EmptyState title="Chưa có ưu đãi nổi bật">{NO_VERIFIED_DATA}</EmptyState>
        </div>
      )}

      {/* ------------------------------------------------------------ Featured cards */}
      <section className="mt-24" aria-labelledby="h-cards">
        <SectionHead id="h-cards" eyebrow="Thẻ tín dụng" title="Meet your next card." href="/the-tin-dung" linkLabel="Danh mục thẻ" />
        {cardsToShow.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cardsToShow.map((c) => (
              <CreditCardTile key={c.slug} card={c} headline={cardHeadlines.get(c.id)?.deal ?? null} categories={cardHeadlines.get(c.id)?.categories ?? []} />
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có thẻ đã xác minh">DealHoi đang cập nhật thông tin thẻ từ nguồn chính thức của ngân hàng.</EmptyState>
        )}
        <p className="mt-4 text-xs text-ink-subtle">“Nổi bật” là lựa chọn của biên tập viên, không phải xếp hạng mức độ phổ biến. DealHoi không phát hành thẻ.</p>
      </section>

      {/* ---------------------------------------------------------------- Merchants */}
      <section className="mt-24" aria-labelledby="h-merchants">
        <SectionHead id="h-merchants" eyebrow="So sánh theo cửa hàng" title="Mua ở đâu hôm nay?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {merchants.map((m, i) => (
            <MerchantCard key={m.slug} merchant={m} offerCount={merchantCounts[i]} />
          ))}
        </div>
      </section>
    </>
  );
}
