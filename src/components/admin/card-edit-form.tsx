"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveCardAction } from "@/app/admin/actions";
import { VERIFICATION_STATUSES } from "@/lib/domain/types";
import { ActionFeedback } from "./action-feedback";

type Values = Record<string, string | number | boolean | null>;

export function CardEditForm({ id, card }: { id: string; card: Values }) {
  const [state, action, pending] = useActionState(saveCardAction.bind(null, id), undefined);
  const v = (k: string) => (card[k] === null || card[k] === undefined ? "" : String(card[k]));
  return (
    <form action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="name">Tên thẻ</Label>
          <Input id="name" name="name" defaultValue={v("name")} />
        </div>
        <div>
          <Label htmlFor="network">Tổ chức thẻ</Label>
          <Input id="network" name="network" defaultValue={v("network")} />
        </div>
        <div>
          <Label htmlFor="card_tier">Hạng thẻ</Label>
          <Input id="card_tier" name="card_tier" defaultValue={v("card_tier")} />
        </div>
        <div>
          <Label htmlFor="annual_fee_vnd">Phí thường niên (VND)</Label>
          <Input id="annual_fee_vnd" name="annual_fee_vnd" defaultValue={v("annual_fee_vnd")} />
          <p className="mt-1 text-xs text-ink-subtle">Để trống = chưa rõ. 0 = miễn phí đã xác nhận.</p>
        </div>
        <div>
          <Label htmlFor="minimum_income_vnd">Thu nhập tối thiểu công bố (VND/tháng)</Label>
          <Input id="minimum_income_vnd" name="minimum_income_vnd" defaultValue={v("minimum_income_vnd")} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="annual_fee_waiver_terms">Điều kiện miễn phí thường niên</Label>
          <Textarea id="annual_fee_waiver_terms" name="annual_fee_waiver_terms" rows={2} defaultValue={v("annual_fee_waiver_terms")} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={v("description")} />
        </div>
        <div>
          <Label htmlFor="verification_status">Trạng thái xác minh</Label>
          <Select id="verification_status" name="verification_status" defaultValue={v("verification_status")}>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-6 pb-2 text-sm font-medium">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked={Boolean(card.is_active)} className="size-4 accent-[var(--color-brand)]" /> Đang phát hành
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_featured" defaultChecked={Boolean(card.is_featured)} className="size-4 accent-[var(--color-brand)]" /> Nổi bật
          </label>
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu thay đổi"}</Button>
    </form>
  );
}
