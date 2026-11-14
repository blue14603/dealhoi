"use client";
import { AlertTriangle, ExternalLink, Loader2, MessageCircle, RotateCcw, Send, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AI_UNAVAILABLE } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface ChatContext {
  page: "home" | "compare" | "deals" | "card" | "quiz";
  merchantSlug?: string;
  categorySlug?: string;
  cardSlug?: string;
  purchaseAmountVnd?: number | null;
}

interface Reply {
  answer: string;
  sources: { id: string; url: string; publisher: string; isDemo: boolean }[];
  relatedDeals: { id: string; title: string }[];
  suggestedQuestions: string[];
  uncertainties: string[];
  grounded: boolean;
}

type Message = { role: "user"; content: string } | { role: "assistant"; content: string; reply: Reply };

const MAX_LEN = 500;

function storageKey(ctx: ChatContext) {
  return `dealhoi-chat:${ctx.page}:${ctx.merchantSlug ?? ctx.categorySlug ?? ctx.cardSlug ?? "general"}`;
}

function useChat(ctx: ChatContext) {
  const key = storageKey(ctx);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; question: string } | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setMessages(JSON.parse(raw) as Message[]);
    } catch {
      /* storage unavailable: start empty */
    }
  }, [key]);

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [key, messages]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || pending) return; // prevents repeated submissions
      setError(null);
      setPending(true);
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
      setMessages((m) => [...m, { role: "user", content: q }]);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: q, context: ctxRef.current, history }),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = res.status === 429 || res.status === 400 ? (data?.error?.message ?? AI_UNAVAILABLE) : AI_UNAVAILABLE;
          throw new Error(msg);
        }
        setMessages((m) => [...m, { role: "assistant", content: (data as Reply).answer, reply: data as Reply }]);
      } catch (e) {
        const msg = e instanceof Error && e.name !== "AbortError" && e.message && !e.message.includes("fetch") ? e.message : AI_UNAVAILABLE;
        setMessages((m) => m.slice(0, -1)); // remove the unanswered question; it is offered for retry
        setError({ message: msg, question: q });
      } finally {
        clearTimeout(timer);
        setPending(false);
      }
    },
    [messages, pending],
  );

  const clear = () => {
    setMessages([]);
    setError(null);
  };

  return { messages, pending, error, send, clear };
}

function AssistantMessage({ reply, onAsk, disabled }: { reply: Reply; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div className={cn("rounded-2xl rounded-tl-sm border px-3.5 py-3 text-sm", reply.grounded ? "border-line bg-surface" : "border-amber-200 bg-warn-soft")}>
      <p className="whitespace-pre-line leading-relaxed">{reply.answer}</p>
      {reply.uncertainties.length > 0 && (
        <div className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          <p className="font-semibold">Thông tin chưa rõ</p>
          <ul className="mt-1 list-disc pl-4">
            {reply.uncertainties.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
      {reply.relatedDeals.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">
          <span className="font-medium text-ink">Ưu đãi liên quan:</span> {reply.relatedDeals.map((d) => d.title).join("; ")}
        </p>
      )}
      {reply.sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">Nguồn:</span>
          {reply.sources.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand hover:underline">
              {s.isDemo ? "Nguồn minh họa" : s.publisher}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ))}
        </div>
      )}
      {reply.suggestedQuestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {reply.suggestedQuestions.map((q) => (
            <button key={q} type="button" disabled={disabled} onClick={() => onAsk(q)} className="rounded-full border border-line-strong px-3 py-1 text-xs hover:border-brand hover:text-brand disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBody({ chat, suggestions, intro }: { chat: ReturnType<typeof useChat>; suggestions: string[]; intro: string }) {
  const [input, setInput] = useState("");
  const inputId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [chat.messages.length, chat.pending]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || chat.pending) return;
    void chat.send(input);
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-busy={chat.pending}>
        {chat.messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">{intro}</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((q) => (
                <button key={q} type="button" disabled={chat.pending} onClick={() => void chat.send(q)} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-left text-sm hover:border-brand hover:text-brand disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <AssistantMessage key={i} reply={m.reply} onAsk={(q) => void chat.send(q)} disabled={chat.pending} />
          ),
        )}
        {chat.pending && (
          <div className="flex items-center gap-2 text-sm text-ink-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> DealHoi đang soạn câu trả lời từ dữ liệu đã xác minh…
          </div>
        )}
        {chat.error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-brand-soft p-3 text-sm text-brand-hover">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {chat.error.message}
            </p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => void chat.send(chat.error!.question)}>
              <RotateCcw aria-hidden /> Thử lại
            </Button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-line p-3">
        <label htmlFor={inputId} className="sr-only">
          Câu hỏi của bạn
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={inputId}
            rows={2}
            maxLength={MAX_LEN}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Hỏi về ưu đãi, giới hạn, điều kiện…"
            className="min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2 text-base sm:text-sm"
          />
          <Button type="submit" size="icon" disabled={chat.pending || !input.trim()} aria-label="Gửi câu hỏi">
            {chat.pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-subtle">
          <span>AI chỉ dùng dữ liệu đã xác minh trên trang. Hãy kiểm tra nguồn chính thức.</span>
          <span className="tabular">
            {input.length}/{MAX_LEN}
          </span>
        </div>
      </form>
    </div>
  );
}

const DEFAULT_SUGGESTIONS = [
  "Thẻ nào có lợi nhất cho giao dịch này?",
  "Ưu đãi này có giới hạn hoàn tiền không?",
  "Tôi cần chi tiêu tối thiểu bao nhiêu?",
  "Tôi có thể kết hợp hai ưu đãi này không?",
];

export function ChatPanel({ context, suggestions = DEFAULT_SUGGESTIONS, title = "Hỏi DealHoi" }: { context: ChatContext; suggestions?: string[]; title?: string }) {
  const chat = useChat(context);
  const intro = "Hỏi về các ưu đãi trên trang này. Câu trả lời dựa trên dữ liệu đã xác minh và các phép tính của DealHoi.";
  const header = (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-brand" aria-hidden /> {title}
      </h2>
      {chat.messages.length > 0 && (
        <button type="button" onClick={chat.clear} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-muted hover:bg-black/5" aria-label="Xóa cuộc trò chuyện">
          <Trash2 className="size-3.5" aria-hidden /> Xóa
        </button>
      )}
    </div>
  );
  return (
    <>
      <aside aria-label={title} className="sticky top-20 hidden h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:flex">
        {header}
        <ChatBody chat={chat} suggestions={suggestions} intro={intro} />
      </aside>
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="fixed right-4 bottom-4 z-30 shadow-lg" aria-label="Mở trợ lý hỏi đáp DealHoi">
              <MessageCircle aria-hidden /> {title}
            </Button>
          </SheetTrigger>
          <SheetContent title={title} className="h-[85dvh]">
            <ChatBody chat={chat} suggestions={suggestions} intro={intro} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
