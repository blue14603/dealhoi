import type { Metadata } from "next";
import { CreditCardTile } from "@/components/cards/credit-card-tile";
import { EmptyState } from "@/components/common/empty-state";
import { FilterForm } from "@/components/common/filter-form";
import { Input, Label, Select } from "@/components/ui/input";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { listBanks, listCards, listCategories, listDeals } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thẻ tín dụng" };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default async function CardsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const bank = sp.bank && SLUG.test(sp.bank) ? sp.bank : undefined;
  const category = sp.category && SLUG.test(sp.category) ? sp.category : undefined;
  const q = (sp.q ?? "").slice(0, 100);
  const today = todayInVietnam();
  const [banks, categories, cards, deals] = await Promise.all([
    listBanks(),
    listCategories({ browsableOnly: true }),
    listCards({ bankSlug: bank, categorySlug: category, query: q || undefined }),
    listDeals({ includeWelcome: true }),
  ]);
  const counts = new Map<string, number>();
  deals.filter((d) => getDealLifecycle(d, today) === "active").forEach((d) => d.cards.forEach((c) => counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1)));
  const bankName = banks.find((b) => b.slug === bank)?.name;

  return (
    <div className="py-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Thẻ tín dụng</h1>
      <p className="mt-2 text-sm text-ink-muted">Chỉ hiển thị thẻ có thông tin đã xác minh từ nguồn. {cards.length} thẻ.</p>
      <div className="mt-6">
        <FilterForm action="/the-tin-dung" resetHref="/the-tin-dung">
          <div>
            <Label htmlFor="q">Tên thẻ</Label>
            <Input id="q" name="q" defaultValue={q} maxLength={100} placeholder="Tìm theo tên thẻ hoặc ngân hàng" />
          </div>
          <div>
            <Label htmlFor="bank">Ngân hàng</Label>
            <Select id="bank" name="bank" defaultValue={bank ?? ""}>
              <option value="">Tất cả ngân hàng</option>
              {banks.map((b) => (
                <option key={b.slug} value={b.slug}>{b.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Có quyền lợi cho</Label>
            <Select id="category" name="category" defaultValue={category ?? ""}>
              <option value="">Mọi danh mục</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </Select>
          </div>
        </FilterForm>
      </div>
      <div className="mt-6">
        {cards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <CreditCardTile key={c.slug} card={c} benefitCount={counts.get(c.id) ?? 0} />
            ))}
          </div>
        ) : (
          <EmptyState title={bankName ? `Chưa có thẻ ${bankName} đã xác minh` : "Không có thẻ phù hợp"}>
            {bankName ? "DealHoi chỉ hiển thị thẻ khi đã kiểm tra thông tin từ nguồn chính thức của ngân hàng. Dữ liệu sẽ được bổ sung sau khi xác minh." : "Hãy thử bỏ bớt bộ lọc."}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
