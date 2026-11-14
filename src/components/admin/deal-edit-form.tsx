"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveDealAction } from "@/app/admin/actions";
import { CAP_PERIOD_LABELS, CHANNEL_LABELS } from "@/lib/domain/format";
import { CAP_PERIODS, PAYMENT_CHANNELS, PUBLICATION_STATUSES, VERIFICATION_STATUSES } from "@/lib/domain/types";
import { ActionFeedback } from "./action-feedback";

type DealValues = Record<string, string | number | boolean | null>;

function Field({ name, label, value, type = "text", hint }: { name: string; label: string; value: unknown; type?: string; hint?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value === null || value === undefined ? "" : String(value)} />
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function DealEditForm({ id, deal }: { id: string; deal: DealValues }) {
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
