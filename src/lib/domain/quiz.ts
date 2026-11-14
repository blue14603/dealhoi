import { z } from "zod";

export const SPEND_RANGES = {
  under_5m: { label: "Dưới 5 triệu ₫", min: 0, max: 5_000_000 },
  "5_10m": { label: "5 – 10 triệu ₫", min: 5_000_000, max: 10_000_000 },
  "10_20m": { label: "10 – 20 triệu ₫", min: 10_000_000, max: 20_000_000 },
  "20_50m": { label: "20 – 50 triệu ₫", min: 20_000_000, max: 50_000_000 },
  over_50m: { label: "Trên 50 triệu ₫", min: 50_000_000, max: null },
} as const satisfies Record<string, { label: string; min: number; max: number | null }>;

export type SpendRange = keyof typeof SPEND_RANGES;

export const REWARD_PREFERENCES = {
  cashback: "Hoàn tiền",
  discount: "Giảm giá / voucher",
  points: "Tích điểm",
  installment: "Trả góp",
  travel: "Đặc quyền du lịch",
  no_preference: "Không có ưu tiên",
} as const;
export type RewardPreference = keyof typeof REWARD_PREFERENCES;

export const FEE_PREFERENCES = {
  free: { label: "Chỉ thẻ miễn phí thường niên", maxVnd: 0 },
  up_to_500k: { label: "Tối đa 500.000 ₫/năm", maxVnd: 500_000 },
  up_to_1m: { label: "Tối đa 1.000.000 ₫/năm", maxVnd: 1_000_000 },
  up_to_2m: { label: "Tối đa 2.000.000 ₫/năm", maxVnd: 2_000_000 },
  any: { label: "Phí không quan trọng nếu quyền lợi phù hợp", maxVnd: null },
} as const satisfies Record<string, { label: string; maxVnd: number | null }>;
export type FeePreference = keyof typeof FEE_PREFERENCES;

export const REPAYMENT_OPTIONS = {
  full: "Tôi sẽ thanh toán toàn bộ dư nợ mỗi tháng",
  partial: "Tôi có thể chỉ thanh toán một phần",
  unsure: "Tôi chưa chắc chắn",
} as const;
export type RepaymentPlan = keyof typeof REPAYMENT_OPTIONS;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);

export const QuizAnswersSchema = z.object({
  monthlySpend: z.enum(Object.keys(SPEND_RANGES) as [SpendRange, ...SpendRange[]]),
  categories: z.array(slug).max(12),
  /** Optional estimated monthly spend per category slug, in VND. */
  categorySpend: z.record(slug, z.number().int().min(0).max(10_000_000_000)).default({}),
  rewardPreference: z.enum(Object.keys(REWARD_PREFERENCES) as [RewardPreference, ...RewardPreference[]]),
  feePreference: z.enum(Object.keys(FEE_PREFERENCES) as [FeePreference, ...FeePreference[]]),
  repayment: z.enum(Object.keys(REPAYMENT_OPTIONS) as [RepaymentPlan, ...RepaymentPlan[]]),
});

export type QuizAnswers = z.infer<typeof QuizAnswersSchema>;
