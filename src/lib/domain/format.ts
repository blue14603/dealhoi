import type { BenefitType, CapPeriod, MerchantScope, OfferType, PaymentChannel } from "./types";

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

export function formatVnd(value: number): string {
  return vnd.format(value);
}

export function formatNumber(value: number): string {
  return num.format(value);
}

export function formatPercent(value: number): string {
  return `${num.format(value)}%`;
}

/** Formats a YYYY-MM-DD date as DD/MM/YYYY. */
export function formatDate(date: string | null): string {
  if (!date) return "—";
  const d = date.slice(0, 10);
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Formats an ISO timestamp as a date in Vietnam time. */
export function formatTimestampDate(ts: string | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ts));
}

/** Parses user-entered VND such as "1.500.000", "1,500,000", "1500000". */
export function parseVndInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s.,₫đ]/gi, "").replace(/vnd$/i, "");
  if (!/^\d{1,13}$/.test(cleaned)) return null;
  return Number(cleaned);
}

export const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  cashback: "Hoàn tiền",
  discount: "Giảm giá",
  points: "Tích điểm",
  installment: "Trả góp",
  voucher: "Voucher",
  travel_perk: "Đặc quyền du lịch",
  other: "Khác",
};

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  ongoing: "Quyền lợi thường xuyên",
  temporary: "Khuyến mãi có thời hạn",
  welcome: "Ưu đãi chào mừng",
};

export const CAP_PERIOD_LABELS: Record<CapPeriod, string> = {
  transaction: "mỗi giao dịch",
  month: "mỗi tháng",
  quarter: "mỗi quý",
  year: "mỗi năm",
  campaign: "cả chương trình",
};

export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  online: "Trực tuyến",
  offline: "Tại cửa hàng",
  both: "Trực tuyến & tại cửa hàng",
  unknown: "Chưa rõ kênh",
};

export const SCOPE_LABELS: Record<MerchantScope, string> = {
  specific_merchant: "Ưu đãi riêng tại cửa hàng",
  category_wide: "Ưu đãi theo danh mục",
  general: "Ưu đãi chi tiêu chung",
};
