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
      <Link href={`/the-tin-dung/${card.slug}`} className="text-sm text-ink-muted hover:text-brand">
        ← {card.name}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Thẻ này có phù hợp với bạn không?</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Trả lời 6 câu hỏi ngắn để xem quyền lợi của {card.name} khớp với thói quen chi tiêu của bạn đến mức nào. Kết quả không phải đánh giá tín dụng hay khả năng được duyệt thẻ.
      </p>
      <div className="mt-6">
        <CompatibilityQuiz cardSlug={card.slug} cardName={card.name} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
      </div>
    </div>
  );
}
