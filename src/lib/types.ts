export const CONCERNS = [
  "redness",
  "acne",
  "texture",
  "pore",
  "age_spot",
  "moisture",
  "oiliness",
  "wrinkle",
] as const;
export type Concern = (typeof CONCERNS)[number];

export const CONCERN_LABEL: Record<Concern, string> = {
  redness: "Redness",
  acne: "Acne",
  texture: "Texture",
  pore: "Pores",
  age_spot: "Dark spots",
  moisture: "Moisture",
  oiliness: "Oiliness",
  wrinkle: "Fine lines",
};

export function isConcern(s: string): s is Concern {
  return (CONCERNS as readonly string[]).includes(s);
}

export type TrialMode = "split" | "whole";
/** Side of the *image* (not mirrored). The user's own left cheek appears on image-right. */
export type ImageSide = "image-left" | "image-right";

export interface Trial {
  id: string;
  name: string;
  category: string;
  concerns: Concern[];
  startDate: string; // YYYY-MM-DD
  link?: string;
  price?: number;
  supplyDays?: number;
  mode: TrialMode;
  treatedSide?: ImageSide;
  createdAt: string;
  demo?: boolean;
}

export interface SideScores {
  left: number; // image-left, 0–100, higher = less detected
  right: number;
}

export interface Shot {
  id: string;
  takenAt: string; // ISO
  taskId?: string;
  raw: Partial<Record<Concern, number>>;
  sides?: Partial<Record<Concern, SideScores>>;
  thumb?: string; // small data URL, only if the user keeps photos
  units?: number;
  mock?: boolean;
}

export interface Session {
  id: string;
  trialId: string;
  date: string; // ISO
  kind: "baseline" | "checkin";
  shots: Shot[];
}
