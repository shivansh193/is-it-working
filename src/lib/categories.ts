import { Concern } from "./types";

export interface Category {
  id: string;
  label: string;
  /** Earliest day a visible effect is plausible; before this we say "too early". */
  minDays: number;
  /** Typical endpoint in published trials. */
  typicalDays: number;
  suggested: Concern[];
  /**
   * Reference for the timing. [NEEDS SOURCE] — these are the studies the timings were drawn from;
   * each must be checked against the paper before the claim is shown as verified.
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
    typicalDays: 56,
    suggested: ["age_spot", "redness", "pore"],
    source: "Hakozaki et al., Br J Dermatol 2002; Bissett et al., Int J Cosmet Sci 2005 (topical niacinamide, 4–12 weeks).",
    verified: false,
  },
  {
    id: "vitamin_c",
    label: "Vitamin C serum",
    minDays: 56,
    typicalDays: 84,
    suggested: ["age_spot", "texture"],
    source: "Humbert et al., Exp Dermatol 2003 (topical vitamin C, 6 months); most trials report at 12 weeks.",
    verified: false,
  },
  {
    id: "retinoid",
    label: "Retinol / retinal (OTC retinoid)",
    minDays: 56,
    typicalDays: 84,
    suggested: ["wrinkle", "texture", "age_spot"],
    source: "Kafi et al., Arch Dermatol 2007 (0.4% retinol, 12 and 24 weeks).",
    verified: false,
  },
  {
    id: "acne",
    label: "Acne treatment (BPO, salicylic, adapalene)",
    minDays: 28,
    typicalDays: 84,
    suggested: ["acne", "redness", "pore"],
    source: "Topical acne trials use 12-week endpoints, with separation from vehicle often from week 2–4 (e.g. adapalene 0.1% vs vehicle).",
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
    source: "Azelaic acid 15% rosacea trials: 12-week endpoints, improvement visible from ~4 weeks.",
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
