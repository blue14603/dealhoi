/**
 * Art direction for the homepage editorial deal cards.
 * Only presentation lives here. Every financial value shown on a card is read
 * from verified, active offers in the database (see services/discovery.ts).
 */
export interface DiscoveryArt {
  src: string;
  width: number;
  height: number;
  /** Tailwind classes positioning the asset inside the card. */
  position: string;
  /** Rest rotation and hover motion (CSS custom properties). */
  restRotate: string;
  hover: { x: string; y: string; rotate: string; scale: number };
  /** Where the localized glow sits behind the asset. */
  glow: string;
}

export interface DiscoveryConcept {
  key: string;
  index: string;
  label: string;
  headline: string;
  /** Small line under the headline (e.g. which merchant the product is sold at). */
  subhead?: string;
  target: { merchantSlug: string } | { categorySlug: string };
  art: DiscoveryArt;
  /** Bento span on large screens. */
  span: string;
}

export const DISCOVERY_CONCEPTS: DiscoveryConcept[] = [
  {
    key: "coffee",
    index: "01",
    label: "Coffee Culture",
    headline: "Starbucks",
    target: { merchantSlug: "starbucks" },
    art: {
      src: "/illustrations/coffee.svg",
      width: 240,
      height: 320,
      position: "right-[2%] bottom-[-6%] w-[40%] max-w-[230px] sm:right-[5%]",
      restRotate: "5deg",
      hover: { x: "0px", y: "-12px", rotate: "2deg", scale: 1.05 },
      glow: "right-[6%] bottom-[10%]",
    },
    span: "lg:col-span-7",
  },
  {
    key: "tech",
    index: "02",
    label: "Tech & Lifestyle",
    headline: "iPhone",
    subhead: "Sản phẩm Apple",
    target: { merchantSlug: "apple" },
    art: {
      src: "/illustrations/phone.svg",
      width: 260,
      height: 340,
      position: "right-[-4%] top-[8%] w-[44%] max-w-[230px]",
      restRotate: "0deg",
      hover: { x: "4px", y: "-10px", rotate: "-6deg", scale: 1.06 },
      glow: "right-[4%] top-[18%]",
    },
    span: "lg:col-span-5",
  },
  {
    key: "shop",
    index: "03",
    label: "Shop Smarter",
    headline: "Shopee",
    target: { merchantSlug: "shopee" },
    art: {
      src: "/illustrations/bag.svg",
      width: 260,
      height: 320,
      position: "right-[0%] bottom-[-4%] w-[42%] max-w-[230px]",
      restRotate: "-6deg",
      hover: { x: "0px", y: "-8px", rotate: "-2deg", scale: 1.05 },
      glow: "right-[8%] bottom-[14%]",
    },
    span: "lg:col-span-5",
  },
  {
    key: "travel",
    index: "04",
    label: "Go Places",
    headline: "Vé máy bay",
    subhead: "Du lịch & hàng không",
    target: { categorySlug: "du-lich-hang-khong" },
    art: {
      src: "/illustrations/plane.svg",
      width: 340,
      height: 260,
      position: "right-[-10%] top-[2%] w-[56%] max-w-[380px]",
      restRotate: "0deg",
      hover: { x: "14px", y: "-12px", rotate: "-3deg", scale: 1.04 },
      glow: "right-[12%] top-[16%]",
    },
    span: "lg:col-span-7",
  },
];

/** Category illustration by category icon key (reference data). */
export const CATEGORY_ART: Record<string, string> = {
  coffee: "/illustrations/coffee.svg",
  smartphone: "/illustrations/phone.svg",
  "shopping-bag": "/illustrations/bag.svg",
  plane: "/illustrations/plane.svg",
  ticket: "/illustrations/ticket.svg",
};
