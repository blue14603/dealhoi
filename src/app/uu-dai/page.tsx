import type { Metadata } from "next";
import { EmptyState } from "@/components/common/empty-state";
import { FilterForm } from "@/components/common/filter-form";
import { DealCard } from "@/components/deals/deal-card";
import { Alert } from "@/components/ui/alert";
import { Input, Label, Select } from "@/components/ui/input";
import { config } from "@/lib/config";
import { NO_VERIFIED_DATA } from "@/lib/copy";
import { BENEFIT_TYPE_LABELS, CHANNEL_LABELS, formatVnd } from "@/lib/domain/format";
import { compareDeals } from "@/lib/domain/savings";
import { BENEFIT_TYPES, type BenefitType, type PaymentChannel } from "@/lib/domain/types";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { listBanks, listCategories, listDeals } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ưu đãi thẻ tín dụng" };

type SP = Promise<Record<string, string | undefined>>;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default async function DealsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const bank = sp.bank && SLUG.test(sp.bank) ? sp.bank : undefined;
  const category = sp.category && SLUG.test(sp.category) ? sp.category : undefined;
  const type = BENEFIT_TYPES.includes(sp.type as BenefitType) ? (sp.type as BenefitType) : undefined;
  const channel = sp.channel === "online" || sp.channel === "offline" ? (sp.channel as PaymentChannel) : undefined;
  const showInactive = sp.include === "all";
  const amountRaw = (sp.amount ?? "").replace(/[.,\s]/g, "");
  const amountInvalid = amountRaw !== "" && !/^\d{1,12}$/.test(amountRaw);
  const amount = !amountInvalid && amountRaw ? Number(amountRaw) : null;

  const today = todayInVietnam();
  const [banks, categories] = await Promise.all([listBanks(), listCategories({ browsableOnly: true })]);
  const cat = categories.find((c) => c.slug === category);
  let deals = await listDeals({ query: q || undefined, bankSlug: bank, benefitType: type, channel, forCategory: cat ? { id: cat.id } : undefined, includeWelcome: true });
  if (!showInactive) deals = deals.filter((d) => getDealLifecycle(d, today) === "active");
  const outcome = compareDeals(deals, { amountVnd: amount, today });
  const calc = new Map(outcome.results.map((r) => [r.dealId, r]));
  if (amount) {
    // Sort by estimated savings when an amount is provided.
    const order = new Map(outcome.results.map((r, i) => [r.dealId, i]));
    deals = [...deals].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  return (
    <div className="py-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Ưu đãi thẻ tín dụng</h1>
      <p className="mt-2 text-sm text-ink-muted">Mặc định chỉ hiển thị ưu đãi đã xác minh và đang áp dụng. {deals.length} ưu đãi.</p>
      <div className="mt-6">
        <FilterForm action="/uu-dai" resetHref="/uu-dai">
          <div>
            <Label htmlFor="q">Cửa hàng, sản phẩm hoặc danh mục</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Ví dụ: Shopee, iPhone" maxLength={100} />
          </div>
          <div>
            <Label htmlFor="category">Danh mục</Label>
            <Select id="category" name="category" defaultValue={category ?? ""}>
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </Select>
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
            <Label htmlFor="type">Loại ưu đãi</Label>
            <Select id="type" name="type" defaultValue={type ?? ""}>
              <option value="">Tất cả loại</option>
              {BENEFIT_TYPES.map((t) => (
                <option key={t} value={t}>{BENEFIT_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="channel">Kênh thanh toán</Label>
            <Select id="channel" name="channel" defaultValue={channel ?? ""}>
              <option value="">Tất cả kênh</option>
              <option value="online">{CHANNEL_LABELS.online}</option>
              <option value="offline">{CHANNEL_LABELS.offline}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Số tiền giao dịch (VND)</Label>
            <Input id="amount" name="amount" inputMode="numeric" defaultValue={sp.amount ?? ""} placeholder="Để sắp xếp theo tiết kiệm" aria-invalid={amountInvalid || undefined} />
          </div>
          <div>
            <Label htmlFor="include">Trạng thái</Label>
            <Select id="include" name="include" defaultValue={showInactive ? "all" : "active"}>
              <option value="active">Đang áp dụng</option>
              <option value="all">Gồm cả đã hết hạn / sắp diễn ra</option>
            </Select>
          </div>
        </FilterForm>
      </div>
      {amountInvalid && (
        <Alert tone="danger" className="mt-4">
          <p>Số tiền không hợp lệ. Vui lòng chỉ nhập chữ số.</p>
        </Alert>
      )}
      {amount && (
        <p className="mt-4 text-sm text-ink-muted">
          Sắp xếp theo tiết kiệm ước tính cho giao dịch {formatVnd(amount)}. Ưu đãi không quy đổi ra tiền được xếp sau.
        </p>
      )}
      <div className="mt-6">
        {deals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} savings={amount ? calc.get(d.id) : undefined} />
            ))}
          </div>
        ) : (
          <EmptyState title="Không có ưu đãi phù hợp">{q || bank || type || channel || category ? "Hãy thử bỏ bớt bộ lọc." : NO_VERIFIED_DATA}</EmptyState>
        )}
      </div>
    </div>
  );
}
