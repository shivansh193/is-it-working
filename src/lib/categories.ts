import { Concern } from "./types";

export interface Category {
  id: string;
  label: string;
  /** Earliest day a visible effect is plausible; before this we say "too early". */
  minDays: number;
  /** Length of the published trials (their endpoint). */
  typicalDays: number;
  suggested: Concern[];
  /**
   * Published trial behind typicalDays. `verified` = citation, design and duration checked against the abstract
   * (2026-10-30). minDays is our own conservative judgement, not a figure from these papers.
   */
  source: string;
  verified: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: "moisturizer",
    label: "Moisturiser / barrier cream",
    minDays: 14,
    typicalDays: 28,
    suggested: ["moisture", "texture"],
    source: "Hydration changes show within days; barrier-repair trials typically report at 2–4 weeks.",
    verified: false,
  },
  {
    id: "niacinamide",
    label: "Niacinamide serum",
    minDays: 28,
    typicalDays: 84,
    suggested: ["age_spot", "redness", "pore"],
    source:
      "Bissett et al., Int J Cosmet Sci 2004: 12-week split-face trial, 5% niacinamide vs control, 50 women. Hakozaki et al., Br J Dermatol 2002;147:20–31: paired 5% niacinamide vs vehicle.",
    verified: true,
  },
  {
    id: "vitamin_c",
    label: "Vitamin C serum",
    minDays: 56,
    typicalDays: 90,
    suggested: ["age_spot", "texture"],
    source: "Humbert et al., Exp Dermatol 2003;12:237–44: 5% vitamin C vs vehicle, assessed at 3 and 6 months.",
    verified: true,
  },
  {
    id: "retinoid",
    label: "Retinol / retinal (OTC retinoid)",
    minDays: 56,
    typicalDays: 168,
    suggested: ["wrinkle", "texture", "age_spot"],
    source: "Kafi et al., Arch Dermatol 2007;143:606–12: 0.4% retinol vs vehicle on opposite arms, 24 weeks.",
    verified: true,
  },
  {
    id: "acne",
    label: "Acne treatment (BPO, salicylic, adapalene)",
    minDays: 28,
    typicalDays: 84,
    suggested: ["acne", "redness", "pore"],
    source: "Topical acne trials typically use 12-week endpoints (e.g. adapalene / benzoyl peroxide vs vehicle).",
    verified: false,
  },
  {
    id: "exfoliant",
    label: "Exfoliating acid (AHA / BHA)",
    minDays: 28,
    typicalDays: 56,
    suggested: ["texture", "pore", "oiliness"],
    source: "Glycolic / salicylic acid cosmetic trials typically report at 4–12 weeks.",
    verified: false,
  },
  {
    id: "brightening",
    label: "Dark-spot treatment (azelaic, tranexamic, arbutin)",
    minDays: 56,
    typicalDays: 84,
    suggested: ["age_spot"],
    source: "Hyperpigmentation trials (azelaic acid, tranexamic acid) mostly report at 8–12 weeks.",
    verified: false,
  },
  {
    id: "soothing",
    label: "Redness / soothing (azelaic, centella)",
    minDays: 28,
    typicalDays: 56,
    suggested: ["redness"],
    source: "Azelaic acid 15% gel rosacea trials (Thiboutot et al.) ran 12–15 weeks, with redness still improving at the end.",
    verified: false,
  },
  {
    id: "oil_control",
    label: "Oil control",
    minDays: 14,
    typicalDays: 28,
    suggested: ["oiliness", "pore"],
    source: "Sebum-control cosmetic studies commonly report at 2–4 weeks.",
    verified: false,
  },
  {
    id: "other",
    label: "Something else",
    minDays: 28,
    typicalDays: 56,
    suggested: [],
    source: "Conservative default: one skin-turnover cycle (~4 weeks) before judging.",
    verified: false,
  },
];

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
