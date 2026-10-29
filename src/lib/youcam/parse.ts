import { Concern, isConcern } from "../types";

/**
 * Parser for the `format: "json"` skin-analysis task response.
 * Docs shape: { status, data: { task_status, results: { output: [{ type, ui_score, raw_score, mask_urls }] } } }
 * We keep raw_score for every decision. ui_score is kept only so it can be shown, labelled, on the info sheet.
 */
export type TaskStatus = "running" | "success" | "error";

export interface ConcernResult {
  raw: number;
  ui?: number;
  masks: string[];
  /** Per-region scores (e.g. hd_pore: forehead, nose, cheek). The top-level score is region "whole". */
  regions?: Record<string, { raw: number; ui?: number; masks: string[] }>;
}

export interface ParsedTask {
  status: TaskStatus;
  error?: string;
  concerns: Partial<Record<Concern, ConcernResult>>;
  /** Types we didn't recognise, kept so nothing is silently dropped. */
  other: Record<string, { raw?: number; ui?: number; masks: string[] }>;
  overall?: number;
  skinAge?: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(+v) ? +v : undefined;

/** "hd_redness" -> "redness", "hd_age_spot" -> "age_spot". */
export function baseConcern(type: string): string {
  return type.replace(/^hd_/, "").replace(/_v\d+$/, "");
}

export function parseTask(body: unknown): ParsedTask {
  const out: ParsedTask = { status: "running", concerns: {}, other: {} };
  if (!isObj(body)) return { ...out, status: "error", error: "Response is not an object" };
  const data = isObj(body.data) ? body.data : body;

  const st = String(data.task_status ?? data.status ?? "running").toLowerCase();
  out.status = st === "success" ? "success" : st === "error" || st === "failed" ? "error" : "running";
  if (out.status === "error") {
    out.error = String(data.error ?? data.error_message ?? body.error ?? "unknown_error");
    return out;
  }
  if (out.status !== "success") return out;

  const results = isObj(data.results) ? data.results : undefined;
  const output = results && Array.isArray(results.output) ? results.output : Array.isArray(data.output) ? data.output : [];
  const byConcern: Partial<Record<Concern, Record<string, { raw: number; ui?: number; masks: string[] }>>> = {};
  for (const item of output) {
    if (!isObj(item) || typeof item.type !== "string") continue;
    const base = baseConcern(item.type);
    const raw = num(item.raw_score);
    const ui = num(item.ui_score);
    const masks = Array.isArray(item.mask_urls) ? item.mask_urls.filter((u): u is string => typeof u === "string") : [];
    if (base === "all") {
      out.overall = raw ?? num(item.score) ?? ui;
    } else if (base === "skin_age") {
      out.skinAge = num(item.score) ?? raw ?? ui;
    } else if (isConcern(base) && raw !== undefined) {
      // Real responses repeat a type once per region (hd_pore: forehead, nose, cheek, whole), in any order.
      const region = typeof item.region === "string" ? item.region : "whole";
      (byConcern[base] ??= {})[region] = { raw, ui, masks };
    } else if (base === "resize_image") {
      // The image YouCam actually analysed; masks are in its coordinates.
    } else {
      out.other[item.type] = { raw, ui, masks };
    }
  }
  for (const [c, regs] of Object.entries(byConcern) as [Concern, Record<string, { raw: number; ui?: number; masks: string[] }>][]) {
    const { whole, ...rest } = regs;
    if (!whole) continue; // no overall score for this concern: don't invent one from regions
    out.concerns[c] = Object.keys(rest).length ? { ...whole, regions: rest } : whole;
  }
  if (out.overall === undefined && isObj(results?.all)) out.overall = num(results.all.score);
  if (out.skinAge === undefined && results) out.skinAge = num(results.skin_age);
  if (Object.keys(out.concerns).length === 0) {
    return { ...out, status: "error", error: "Task succeeded but no concern scores were found" };
  }
  return out;
}

export function toDstActions(concerns: Concern[]): string[] {
  return concerns.map((c) => `hd_${c}`);
}
