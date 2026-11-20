"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveDealAction } from "@/app/admin/actions";
import { CAP_PERIOD_LABELS, CHANNEL_LABELS } from "@/lib/domain/format";
import { CAP_PERIODS, PAYMENT_CHANNELS, PUBLICATION_STATUSES, VERIFICATION_STATUSES } from "@/lib/domain/types";
import { ActionFeedback } from "./action-feedback";

type DealValues = Record<string, string | number | boolean | null>;
export interface CardOption {
  id: string;
  name: string;
  bank_name: string;
  is_active: boolean;
  is_demo: boolean;
}

function Field({ name, label, value, type = "text", hint }: { name: string; label: string; value: unknown; type?: string; hint?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value === null || value === undefined ? "" : String(value)} />
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

function CardPicker({ options, selected }: { options: CardOption[]; selected: string[] }) {
  const chosen = new Set(selected);
  const groups = new Map<string, CardOption[]>();
  for (const o of options) {
    const key = o.is_demo && !/demo/i.test(o.bank_name) ? `${o.bank_name} (minh họa)` : o.bank_name;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-5">
      <legend className="px-1 text-sm font-semibold">Thẻ đủ điều kiện</legend>
      <p className="mb-3 text-xs text-ink-subtle">
        Chỉ chọn thẻ được hưởng đúng mức ưu đãi này. Ví dụ ưu đãi chia mức theo 6 số đầu thẻ: bỏ chọn thẻ thuộc mức khác. Ưu đãi đã xuất bản cần ít nhất một thẻ.
      </p>
      <input type="hidden" name="cards_present" value="1" />
      {options.length === 0 ? (
        <p className="text-sm text-ink-muted">Chưa có thẻ nào. Nhập thẻ trước (stubs.json) rồi quay lại.</p>
      ) : (
        <div className="space-y-4">
          {[...groups].map(([bank, cards]) => (
            <div key={bank}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{bank}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {cards.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="card_ids" value={c.id} defaultChecked={chosen.has(c.id)} className="size-4 accent-[var(--color-brand)]" />
                    <span className={c.is_active ? "" : "text-ink-subtle line-through"}>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function DealEditForm({ id, deal, cardOptions, selectedCardIds }: { id: string; deal: DealValues; cardOptions: CardOption[]; selectedCardIds: string[] }) {
  const [state, action, pending] = useActionState(saveDealAction.bind(null, id), undefined);
  return (
    <form action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field name="title" label="Tiêu đề" value={deal.title} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={String(deal.description ?? "")} />
        </div>
        <Field name="percentage" label="Tỷ lệ (%)" value={deal.percentage} hint="Để trống nếu không áp dụng hoặc chưa rõ." />
        <Field name="fixed_amount_vnd" label="Số tiền cố định (VND)" value={deal.fixed_amount_vnd} />
        <Field name="maximum_benefit_vnd" label="Mức tối đa (VND)" value={deal.maximum_benefit_vnd} hint="Để trống = chưa rõ (không phải không giới hạn)." />
        <div>
          <Label htmlFor="cap_period">Kỳ áp dụng mức tối đa</Label>
          <Select id="cap_period" name="cap_period" defaultValue={String(deal.cap_period ?? "")}>
            <option value="">Chưa rõ / không áp dụng</option>
            {CAP_PERIODS.map((p) => (
              <option key={p} value={p}>{CAP_PERIOD_LABELS[p]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cap_is_unlimited">Không giới hạn mức hoàn?</Label>
          <Select id="cap_is_unlimited" name="cap_is_unlimited" defaultValue={deal.cap_is_unlimited === true ? "true" : deal.cap_is_unlimited === false ? "false" : ""}>
            <option value="">Chưa rõ</option>
            <option value="true">Có — nguồn xác nhận không giới hạn</option>
            <option value="false">Không</option>
          </Select>
        </div>
        <Field name="minimum_spend_vnd" label="Chi tiêu tối thiểu (VND)" value={deal.minimum_spend_vnd} hint="0 = nguồn xác nhận không yêu cầu. Để trống = chưa rõ." />
        <div>
          <Label htmlFor="minimum_spend_period">Tối thiểu tính theo</Label>
          <Select id="minimum_spend_period" name="minimum_spend_period" defaultValue={String(deal.minimum_spend_period ?? "")}>
            <option value="">Chưa rõ</option>
            {CAP_PERIODS.map((p) => (
              <option key={p} value={p}>{CAP_PERIOD_LABELS[p]}</option>
            ))}
          </Select>
        </div>
        <Field name="installment_months" label="Kỳ hạn trả góp (tháng)" value={deal.installment_months} />
        <Field name="installment_fee_vnd" label="Phí trả góp (VND)" value={deal.installment_fee_vnd} />
        <div>
          <Label htmlFor="payment_channel">Kênh thanh toán</Label>
          <Select id="payment_channel" name="payment_channel" defaultValue={String(deal.payment_channel)}>
            {PAYMENT_CHANNELS.map((p) => (
              <option key={p} value={p}>{CHANNEL_LABELS[p]}</option>
            ))}
          </Select>
        </div>
        <Field name="start_date" label="Ngày bắt đầu" type="date" value={deal.start_date} />
        <Field name="end_date" label="Ngày kết thúc" type="date" value={deal.end_date} />
        <div className="md:col-span-2">
          <Label htmlFor="eligibility_terms">Điều kiện áp dụng</Label>
          <Textarea id="eligibility_terms" name="eligibility_terms" rows={3} defaultValue={String(deal.eligibility_terms ?? "")} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="terms_and_conditions">Điều khoản & điều kiện</Label>
          <Textarea id="terms_and_conditions" name="terms_and_conditions" rows={3} defaultValue={String(deal.terms_and_conditions ?? "")} />
        </div>
      </div>
      <CardPicker options={cardOptions} selected={selectedCardIds} />
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-3">
        <div>
          <Label htmlFor="verification_status">Trạng thái xác minh</Label>
          <Select id="verification_status" name="verification_status" defaultValue={String(deal.verification_status)}>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="publication_status">Trạng thái xuất bản</Label>
          <Select id="publication_status" name="publication_status" defaultValue={String(deal.publication_status)}>
            {PUBLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" name="is_featured" defaultChecked={Boolean(deal.is_featured)} className="size-4 accent-[var(--color-brand)]" />
          Đánh dấu nổi bật
        </label>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu thay đổi"}</Button>
    </form>
  );
}
