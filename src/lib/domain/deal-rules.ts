import type { BenefitType, CapPeriod, MerchantScope, OfferType, PublicationStatus, VerificationStatus } from "./types";

/** Fields needed to check benefit-type-specific business rules. */
export interface DealRuleInput {
  benefitType: BenefitType;
  offerType: OfferType;
  merchantScope: MerchantScope;
  hasMerchant: boolean;
  percentage: number | null;
  fixedAmountVnd: number | null;
  maximumBenefitVnd: number | null;
  capPeriod: CapPeriod | null;
  capIsUnlimited: boolean | null;
  minimumSpendVnd: number | null;
  installmentMonths: number | null;
  installmentFeeVnd: number | null;
  paymentChannel: string;
  startDate: string | null;
  endDate: string | null;
  verificationStatus: VerificationStatus;
  publicationStatus: PublicationStatus;
  hasSource: boolean;
  sourceReviewed: boolean;
  cardCount: number;
}

export interface RuleReport {
  /** The record cannot be saved. */
  errors: string[];
  /** The record can be saved but not published. */
  publishBlockers: string[];
  /** Information that will make estimates conditional. */
  warnings: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function checkDealRules(d: DealRuleInput): RuleReport {
  const errors: string[] = [];
  const publishBlockers: string[] = [];
  const warnings: string[] = [];

  if (d.startDate && !DATE.test(d.startDate)) errors.push("start_date phải có dạng YYYY-MM-DD");
  if (d.endDate && !DATE.test(d.endDate)) errors.push("end_date phải có dạng YYYY-MM-DD");
  if (d.startDate && d.endDate && d.endDate < d.startDate) errors.push("end_date phải sau hoặc bằng start_date");
  if (d.capIsUnlimited === true && d.maximumBenefitVnd !== null) errors.push("Không thể vừa không giới hạn vừa có mức tối đa");
  if (d.capPeriod && d.maximumBenefitVnd === null) errors.push("cap_period cần maximum_benefit_vnd");
  if (d.merchantScope === "specific_merchant" && !d.hasMerchant) errors.push("Ưu đãi riêng tại cửa hàng cần merchant");
  if (d.merchantScope !== "specific_merchant" && d.hasMerchant) warnings.push("Ưu đãi không phải 'specific_merchant' nhưng có merchant; merchant sẽ chỉ dùng để hiển thị");

  if (d.publicationStatus === "published") {
    if (!d.hasSource) publishBlockers.push("Cần nguồn chính thức trước khi xuất bản");
    else if (!d.sourceReviewed) publishBlockers.push("Nguồn chưa được duyệt (verified_at trống)");
    if (d.verificationStatus !== "verified") publishBlockers.push("Chỉ xuất bản ưu đãi đã xác minh (verification_status = verified)");
    if (d.cardCount === 0) publishBlockers.push("Cần ít nhất một thẻ tín dụng đủ điều kiện");
    if (d.offerType === "temporary" && (!d.startDate || !d.endDate)) publishBlockers.push("Khuyến mãi có thời hạn cần ngày bắt đầu và kết thúc đã xác minh");
    if ((d.benefitType === "cashback" || d.benefitType === "discount") && d.percentage === null && d.fixedAmountVnd === null)
      publishBlockers.push("Hoàn tiền/giảm giá cần tỷ lệ phần trăm hoặc số tiền cố định");
    if (d.benefitType === "installment" && d.installmentMonths === null) publishBlockers.push("Trả góp cần số tháng");
  }

  if (d.benefitType === "cashback" || d.benefitType === "discount") {
    if (d.percentage !== null && d.fixedAmountVnd !== null) warnings.push("Có cả tỷ lệ % và số tiền cố định: không thể tự động tính tiết kiệm");
    if (d.percentage !== null && d.maximumBenefitVnd === null && d.capIsUnlimited !== true) warnings.push("Chưa rõ mức tối đa: ước tính tiết kiệm sẽ ở trạng thái thiếu thông tin");
  }
  if (d.minimumSpendVnd === null) warnings.push("Chưa rõ chi tiêu tối thiểu (dùng 0 nếu nguồn xác nhận không yêu cầu)");
  if (d.benefitType === "installment" && d.installmentFeeVnd === null) warnings.push("Chưa rõ phí trả góp");
  if (d.paymentChannel === "unknown") warnings.push("Chưa rõ kênh thanh toán");

  return { errors, publishBlockers, warnings };
}
