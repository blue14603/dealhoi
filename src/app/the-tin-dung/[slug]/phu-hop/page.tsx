import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompatibilityQuiz } from "@/components/quiz/compatibility-quiz";
import { getCardBySlug, listCategories } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thẻ này có phù hợp với bạn không?" };

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) notFound();
  const [card, categories] = await Promise.all([getCardBySlug(slug), listCategories({ browsableOnly: true })]);
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-3xl py-8">
      <Link href={`/the-tin-dung/${card.slug}`} className="text-sm text-ink-muted hover:text-accent">
        ← {card.name}
      </Link>
      <p className="eyebrow mt-6">Lifestyle fit</p>
      <h1 className="font-display mt-3 text-[2.5rem] leading-[1] font-bold sm:text-[3.5rem]">Is this your card?</h1>
      <p className="mt-4 text-base text-ink-muted">
        Thẻ này có phù hợp với bạn không? Trả lời 6 câu hỏi ngắn để xem quyền lợi của {card.name} khớp với cách bạn chi tiêu đến mức nào. Kết quả không phải đánh giá tín dụng hay khả năng được duyệt thẻ.
      </p>
      <div className="mt-6">
        <CompatibilityQuiz cardSlug={card.slug} cardName={card.name} categories={categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))} />
      </div>
    </div>
  );
}
