import { describe, expect, it } from "vitest";
import { daysBetween, getDealLifecycle, isVerificationStale, todayInVietnam } from "@/lib/domain/validity";
import { TODAY, makeDeal } from "../fixtures/builders";

describe("promotion validity", () => {
  it("is active inside the validity window, inclusive of both ends", () => {
    expect(getDealLifecycle(makeDeal({ startDate: TODAY, endDate: TODAY }), TODAY)).toBe("active");
  });
  it("is expired after the end date", () => {
    expect(getDealLifecycle(makeDeal({ startDate: "2026-10-01", endDate: "2026-11-13" }), TODAY)).toBe("expired");
  });
  it("is upcoming before the start date", () => {
    expect(getDealLifecycle(makeDeal({ startDate: "2026-11-15", endDate: "2026-12-01" }), TODAY)).toBe("upcoming");
  });
  it("treats a temporary promotion without a verified period as not active", () => {
    expect(getDealLifecycle(makeDeal({ startDate: null, endDate: "2026-12-01" }), TODAY)).toBe("validity_unknown");
    expect(getDealLifecycle(makeDeal({ startDate: "2026-11-01", endDate: null }), TODAY)).toBe("validity_unknown");
  });
  it("allows ongoing benefits with no fixed expiry", () => {
    expect(getDealLifecycle(makeDeal({ offerType: "ongoing", startDate: null, endDate: null }), TODAY)).toBe("active");
  });
  it("still respects an end date on ongoing benefits", () => {
    expect(getDealLifecycle(makeDeal({ offerType: "ongoing", startDate: null, endDate: "2026-01-01" }), TODAY)).toBe("expired");
  });
  it("excludes withdrawn and unverified deals", () => {
    expect(getDealLifecycle(makeDeal({ publicationStatus: "withdrawn" }), TODAY)).toBe("withdrawn");
    expect(getDealLifecycle(makeDeal({ verificationStatus: "needs_review" }), TODAY)).toBe("unverified");
    expect(getDealLifecycle(makeDeal({ publicationStatus: "draft" }), TODAY)).toBe("unverified");
  });
  it("computes today in Asia/Ho_Chi_Minh (UTC+7)", () => {
    expect(todayInVietnam(new Date("2026-11-14T16:59:59Z"))).toBe("2026-11-14");
    expect(todayInVietnam(new Date("2026-11-14T17:00:00Z"))).toBe("2026-11-15");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-11-14", "2026-12-14")).toBe(30);
    expect(daysBetween("2026-11-14", "2026-11-10")).toBe(-4);
  });
  it("flags stale or missing verification", () => {
    const now = new Date("2026-11-14T00:00:00Z");
    expect(isVerificationStale(null, now, 90)).toBe(true);
    expect(isVerificationStale("2026-05-01T00:00:00Z", now, 90)).toBe(true);
    expect(isVerificationStale("2026-11-01T00:00:00Z", now, 90)).toBe(false);
  });
});
