import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoryChip } from "@/components/cards/category-chip";
import { CreditCardTile } from "@/components/cards/credit-card-tile";
import { MerchantCard } from "@/components/cards/merchant-card";
import { EmptyState } from "@/components/common/empty-state";
import { SearchBox } from "@/components/search/search-box";
import { normalizeText } from "@/lib/domain/text";
import { listCategories, searchCatalog } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tìm kiếm" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const results = await searchCatalog(q);
  const total = results.merchants.length + results.categories.length + results.cards.length;

  // An exact merchant match goes straight to its comparison page.
  const exact = results.merchants.find((m) => normalizeText(m.name) === normalizeText(q));
  if (exact && results.cards.length === 0) redirect(`/so-sanh?merchant=${exact.slug}`);

  const categories = total === 0 ? await listCategories({ browsableOnly: true }) : [];

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="sr-only">Kết quả tìm kiếm</h1>
      <SearchBox defaultValue={q} size="md" />
      {!q.trim() ? (
        <div className="mt-8">
          <EmptyState title="Bạn đang muốn mua gì?">Nhập tên cửa hàng (ví dụ Starbucks, Shopee), sản phẩm (iPhone, vé máy bay) hoặc tên thẻ.</EmptyState>
        </div>
      ) : total === 0 ? (
        <div className="mt-8 space-y-6">
          <EmptyState title={`Không tìm thấy kết quả cho “${q}”`}>Hãy thử từ khóa khác hoặc chọn một danh mục bên dưới.</EmptyState>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <CategoryChip key={c.slug} slug={c.slug} name={c.name} icon={c.icon} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <p className="text-sm text-ink-muted">
            {total} kết quả cho “{q}”
          </p>
          {results.merchants.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Cửa hàng</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.merchants.map((m) => (
                  <MerchantCard key={m.slug} merchant={m} />
                ))}
              </div>
            </section>
          )}
          {results.categories.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Danh mục</h2>
              <div className="flex flex-wrap gap-2">
                {results.categories.map((c) => (
                  <CategoryChip key={c.slug} slug={c.slug} name={c.name} icon={c.icon} />
                ))}
              </div>
            </section>
          )}
          {results.cards.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Thẻ tín dụng</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {results.cards.map((c) => (
                  <CreditCardTile key={c.slug} card={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
