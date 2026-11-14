import { ArrowRight, BadgeCheck, Calculator, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CategoryChip } from "@/components/cards/category-chip";
import { CreditCardTile } from "@/components/cards/credit-card-tile";
import { MerchantCard } from "@/components/cards/merchant-card";
import { EmptyState } from "@/components/common/empty-state";
import { DealCard } from "@/components/deals/deal-card";
import { SearchBox } from "@/components/search/search-box";
import { config } from "@/lib/config";
import { NO_VERIFIED_DATA } from "@/lib/copy";
import { todayInVietnam } from "@/lib/domain/validity";
import { listActiveDeals, listCards, listCategories, listMerchants } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

function Section({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14" aria-labelledby={`h-${title}`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id={`h-${title}`} className="text-xl font-bold sm:text-2xl">
          {title}
        </h2>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline">
            {linkLabel} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const today = todayInVietnam();
  const [categories, merchants, featuredDeals, featuredCards] = await Promise.all([
    listCategories({ browsableOnly: true }),
    listMerchants({ featuredOnly: true }),
    listActiveDeals({ featuredOnly: true, limit: 50 }),
    listCards({ featuredOnly: true }),
  ]);
  const offerCounts = await Promise.all(
    merchants.map((m) => listActiveDeals({ forMerchant: { id: m.id, categoryId: m.category.id } }).then((d) => d.filter((x) => x.merchantScope === "specific_merchant").length)),
  );

  return (
    <>
      <section className="pt-12 pb-4 text-center sm:pt-20">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Thẻ nào có lợi nhất cho <span className="text-brand">thứ bạn sắp mua?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">
          So sánh ưu đãi thẻ tín dụng theo cửa hàng và thói quen chi tiêu. Mỗi ưu đãi đều có nguồn, ngày xác minh và điều kiện rõ ràng.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <SearchBox />
        </div>
        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2" aria-label="Gợi ý tìm kiếm">
          {categories.map((c) => (
            <CategoryChip key={c.slug} slug={c.slug} name={c.name} icon={c.icon} />
          ))}
        </div>
        <ul className="mx-auto mt-10 grid max-w-4xl gap-3 text-left text-sm sm:grid-cols-3">
          <li className="flex gap-3 rounded-2xl bg-surface p-4">
            <BadgeCheck className="size-5 shrink-0 text-savings" aria-hidden />
            <span>Chỉ hiển thị ưu đãi đã xác minh, kèm nguồn chính thức.</span>
          </li>
          <li className="flex gap-3 rounded-2xl bg-surface p-4">
            <Calculator className="size-5 shrink-0 text-brand" aria-hidden />
            <span>Tính tiết kiệm thực tế theo số tiền, mức tối đa và điều kiện.</span>
          </li>
          <li className="flex gap-3 rounded-2xl bg-surface p-4">
            <ShieldCheck className="size-5 shrink-0 text-info" aria-hidden />
            <span>Không cần đăng ký. DealHoi không nhận hồ sơ mở thẻ.</span>
          </li>
        </ul>
      </section>

      <Section title="Cửa hàng phổ biến để so sánh" href="/uu-dai" linkLabel="Tất cả ưu đãi">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {merchants.map((m, i) => (
            <MerchantCard key={m.slug} merchant={m} offerCount={offerCounts[i]} />
          ))}
        </div>
      </Section>

      <Section title="Ưu đãi nổi bật" href="/uu-dai" linkLabel="Xem tất cả">
        {featuredDeals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDeals.slice(0, 6).map((d) => (
              <DealCard key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} />
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có ưu đãi nổi bật">{NO_VERIFIED_DATA}</EmptyState>
        )}
      </Section>

      <Section title="Thẻ tín dụng nổi bật" href="/the-tin-dung" linkLabel="Danh mục thẻ">
        {featuredCards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCards.slice(0, 4).map((c) => (
              <CreditCardTile key={c.slug} card={c} />
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có thẻ đã xác minh">DealHoi đang cập nhật thông tin thẻ từ nguồn chính thức của ngân hàng.</EmptyState>
        )}
        <p className="mt-4 text-xs text-ink-subtle">“Nổi bật” là lựa chọn của biên tập viên, không phải xếp hạng mức độ phổ biến.</p>
      </Section>
    </>
  );
}
