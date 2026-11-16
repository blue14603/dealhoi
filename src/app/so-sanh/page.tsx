import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryChip } from "@/components/cards/category-chip";
import { EmptyState } from "@/components/common/empty-state";
import { ComparisonWorkspace } from "@/components/deals/comparison-workspace";
import { SearchBox } from "@/components/search/search-box";
import { config } from "@/lib/config";
import { formatTimestampDate } from "@/lib/domain/format";
import { listCategories } from "@/lib/services/catalog";
import { dealsForTarget, resolveTarget, runComparison } from "@/lib/services/comparison";

export const dynamic = "force-dynamic";

type SP = Promise<{ merchant?: string; category?: string; amount?: string }>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const target = await resolveTarget({ merchantSlug: sp.merchant && SLUG.test(sp.merchant) ? sp.merchant : null, categorySlug: sp.category && SLUG.test(sp.category) ? sp.category : null });
  const name = target.merchant?.name ?? target.category?.name;
  return { title: name ? `So sánh ưu đãi thẻ cho ${name}` : "So sánh ưu đãi" };
}

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const merchantSlug = sp.merchant && SLUG.test(sp.merchant) ? sp.merchant : null;
  const categorySlug = sp.category && SLUG.test(sp.category) ? sp.category : null;
  const target = await resolveTarget({ merchantSlug, categorySlug });

  if (!target.merchant && !target.category) {
    const categories = await listCategories({ browsableOnly: true });
    return (
      <div className="mx-auto max-w-2xl py-12">
        <h1 className="font-display mb-6 text-4xl font-bold">So sánh ưu đãi</h1>
        <EmptyState title={merchantSlug || categorySlug ? "Không tìm thấy cửa hàng hoặc danh mục này" : "Bạn muốn so sánh ưu đãi cho gì?"}>
          Tìm theo cửa hàng, sản phẩm hoặc chọn một danh mục.
        </EmptyState>
        <div className="mt-6">
          <SearchBox size="md" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <CategoryChip key={c.slug} slug={c.slug} name={c.name} icon={c.icon} />
          ))}
        </div>
      </div>
    );
  }

  const amountParam = sp.amount && /^\d{1,12}$/.test(sp.amount) ? Number(sp.amount) : null;
  const deals = await dealsForTarget(target);
  const data = runComparison(deals, amountParam, target);
  const name = target.merchant?.name ?? target.category!.name;
  const specificCount = data.activeDeals.filter((d) => d.merchantScope === "specific_merchant").length;

  return (
    <div className="py-8">
      <nav aria-label="Đường dẫn" className="mb-6 text-sm text-ink-muted">
        {target.merchant ? (
          <>
            Danh mục: <a href={`/so-sanh?category=${target.merchant.category.slug}`} className="hover:text-accent">{target.merchant.category.name}</a>
          </>
        ) : (
          "Danh mục chi tiêu"
        )}
      </nav>
      <p className="eyebrow">So sánh ưu đãi</p>
      <h1 className="font-display mt-3 text-[2.25rem] leading-[1] font-bold sm:text-5xl">
        Ưu đãi thẻ cho <span className="text-ice">{name}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-muted" data-testid="offer-summary">
        <strong className="text-ink">{data.activeDeals.length}</strong> ưu đãi đã xác minh đang áp dụng
        {target.merchant && ` (${specificCount} ưu đãi riêng tại ${name}, ${data.activeDeals.length - specificCount} ưu đãi theo danh mục hoặc chi tiêu chung)`}
        {data.lastVerifiedAt && ` · Cập nhật xác minh gần nhất: ${formatTimestampDate(data.lastVerifiedAt)}`}
      </p>
      <div className="mt-6">
        {data.activeDeals.length === 0 && data.inactiveDeals.length === 0 ? (
          <EmptyState title="Chưa có ưu đãi">DealHoi chưa có thông tin ưu đãi đã được xác minh cho nội dung này.</EmptyState>
        ) : (
          <Suspense>
            <ComparisonWorkspace
              activeDeals={data.activeDeals}
              inactiveDeals={data.inactiveDeals}
              today={data.today}
              staleAfterDays={config.staleAfterDays}
              initialAmount={amountParam}
              target={{ kind: target.merchant ? "merchant" : "category", slug: target.merchant?.slug ?? target.category!.slug, name, merchantId: target.merchant?.id ?? null }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
