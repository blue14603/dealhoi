import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiSummary } from "@/components/ai/ai-summary";
import { BenefitItem } from "@/components/cards/benefit-item";
import { CardVisual } from "@/components/cards/card-visual";
import { ChatPanel } from "@/components/chat/chat-panel";
import { EmptyState } from "@/components/common/empty-state";
import { DemoBadge, SourceLink, VerificationText } from "@/components/deals/badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { NO_VERIFIED_DATA } from "@/lib/copy";
import { formatVnd } from "@/lib/domain/format";
import { HIGHLIGHT_RULE_DESCRIPTION, selectHighlights } from "@/lib/domain/highlights";
import { describeLifestyle } from "@/lib/domain/lifestyle";
import { getDealLifecycle, todayInVietnam } from "@/lib/domain/validity";
import { getCardBySlug } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const card = /^[a-z0-9-]{1,120}$/.test(slug) ? await getCardBySlug(slug) : null;
  return { title: card ? `${card.name} – ${card.bank.name}` : "Không tìm thấy thẻ" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-3 last:border-0 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium sm:mt-0">{children}</dd>
    </div>
  );
}

export default async function CardDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) notFound();
  const card = await getCardBySlug(slug);
  if (!card) notFound();
  const today = todayInVietnam();
  const active = card.deals.filter((d) => getDealLifecycle(d, today) === "active");
  const inactive = card.deals.filter((d) => getDealLifecycle(d, today) !== "active");
  const highlights = selectHighlights(active, 3);
  const ongoing = active.filter((d) => d.offerType !== "temporary");
  const promos = active.filter((d) => d.offerType === "temporary");
  const lifestyle = describeLifestyle(card, card.deals, today);

  return (
    <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <div className="min-w-0 space-y-10">
        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <CardVisual name={card.name} bankName={card.bank.name} network={card.network} tier={card.cardTier} imageUrl={card.imageUrl} />
          <div>
            <p className="text-sm text-ink-muted">{card.bank.name}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{card.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {card.isDemo && <DemoBadge />}
              <VerificationText source={card.source} staleAfterDays={config.staleAfterDays} />
            </div>
            {card.description && <p className="mt-3 text-sm text-ink-muted">{card.description}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/the-tin-dung/${card.slug}/phu-hop`}>
                  Thẻ này có phù hợp với bạn không? <ArrowRight aria-hidden />
                </Link>
              </Button>
              {card.officialUrl && (
                <Button asChild variant="secondary">
                  <a href={card.officialUrl} target="_blank" rel="noopener noreferrer nofollow">
                    {card.isDemo ? "Trang sản phẩm (minh họa)" : "Trang sản phẩm chính thức"} <ExternalLink aria-hidden />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="h-facts">
          <h2 id="h-facts" className="mb-3 text-lg font-bold">Thông tin thẻ</h2>
          <dl className="rounded-2xl border border-line bg-surface px-5">
            <Fact label="Ngân hàng phát hành">{card.bank.name}</Fact>
            <Fact label="Tổ chức thẻ">{card.network ?? "Chưa rõ"}</Fact>
            <Fact label="Hạng thẻ">{card.cardTier ?? "Chưa rõ"}</Fact>
            <Fact label="Phí thường niên">{card.annualFeeVnd === null ? <span className="text-warn">Chưa được xác minh</span> : card.annualFeeVnd === 0 ? "Miễn phí" : formatVnd(card.annualFeeVnd)}</Fact>
            <Fact label="Điều kiện miễn phí thường niên">{card.annualFeeWaiverTerms ?? "Chưa rõ / không công bố"}</Fact>
            <Fact label="Thu nhập tối thiểu công bố">{card.minimumIncomeVnd === null ? "Chưa rõ" : `${formatVnd(card.minimumIncomeVnd)}/tháng`}</Fact>
            <Fact label="Nguồn thông tin">
              <SourceLink source={card.source} />
            </Fact>
          </dl>
          <p className="mt-2 text-xs text-ink-subtle">Điều kiện mở thẻ do ngân hàng quyết định. DealHoi không dự đoán khả năng được duyệt.</p>
        </section>

        <section aria-labelledby="h-highlights">
          <h2 id="h-highlights" className="mb-1 text-lg font-bold">Quyền lợi nổi bật</h2>
          <p className="mb-4 text-xs text-ink-subtle">{HIGHLIGHT_RULE_DESCRIPTION}</p>
          {highlights.length ? (
            <div className="grid gap-4">
              {highlights.map((d) => (
                <BenefitItem key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} cardId={card.id} highlight />
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có quyền lợi đang áp dụng">{NO_VERIFIED_DATA}</EmptyState>
          )}
        </section>

        {lifestyle && (
          <section aria-labelledby="h-lifestyle" className="rounded-2xl bg-brand-soft p-6">
            <h2 id="h-lifestyle" className="text-lg font-bold">Ai có thể hưởng lợi từ thẻ này?</h2>
            <p className="mt-2 text-sm">{lifestyle.summary}</p>
            {lifestyle.considerations.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                {lifestyle.considerations.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-subtle">Mô tả được tạo tự động từ danh mục và điều kiện của các quyền lợi đã xác minh.</p>
            <Button asChild className="mt-4 w-full sm:w-auto">
              <Link href={`/the-tin-dung/${card.slug}/phu-hop`}>Thẻ này có phù hợp với bạn không?</Link>
            </Button>
          </section>
        )}

        <section aria-labelledby="h-all" className="space-y-6">
          <h2 id="h-all" className="text-lg font-bold">Tất cả quyền lợi đã xác minh ({active.length})</h2>
          <div>
            <h3 className="mb-3 font-semibold">Quyền lợi thường xuyên & ưu đãi chào mừng</h3>
            {ongoing.length ? (
              <div className="grid gap-4">
                {ongoing.map((d) => (
                  <BenefitItem key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} cardId={card.id} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có quyền lợi thường xuyên đã xác minh.</p>
            )}
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Khuyến mãi có thời hạn</h3>
            {promos.length ? (
              <div className="grid gap-4">
                {promos.map((d) => (
                  <BenefitItem key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} cardId={card.id} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Hiện không có khuyến mãi có thời hạn đã xác minh.</p>
            )}
          </div>
          {inactive.length > 0 && (
            <details className="rounded-2xl border border-line bg-surface p-4">
              <summary className="cursor-pointer font-medium">Ưu đãi đã hết hạn hoặc chưa bắt đầu ({inactive.length})</summary>
              <div className="mt-3 grid gap-4">
                {inactive.map((d) => (
                  <BenefitItem key={d.id} deal={d} today={today} staleAfterDays={config.staleAfterDays} cardId={card.id} />
                ))}
              </div>
            </details>
          )}
        </section>

        <AiSummary label="Tóm tắt thẻ bằng AI" request={{ kind: "card", cardSlug: card.slug }} />
        <Alert tone="warn" title="Sử dụng thẻ tín dụng có trách nhiệm">
          <p>Hoàn tiền và điểm thưởng chỉ có ý nghĩa khi bạn thanh toán đủ dư nợ đúng hạn. Lãi suất và phí trả chậm có thể lớn hơn nhiều so với giá trị ưu đãi.</p>
        </Alert>
      </div>
      <ChatPanel
        context={{ page: "card", cardSlug: card.slug }}
        suggestions={["Phí thường niên của thẻ này là bao nhiêu?", "Thẻ này có giới hạn hoàn tiền không?", "Ưu đãi nào sắp hết hạn?"]}
      />
    </div>
  );
}
