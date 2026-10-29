import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/docs/task-success.json";
import real from "../../../fixtures/docs/task-real-shape.json";
import { baseConcern, parseTask, toDstActions } from "../youcam/parse";

describe("parseTask (format: json)", () => {
  it("reads raw_score per concern and keeps masks", () => {
    const p = parseTask(fixture);
    expect(p.status).toBe("success");
    expect(p.concerns.redness).toEqual({ raw: 64.31, ui: 82, masks: ["https://example.com/hd_redness_output.png"] });
    expect(p.concerns.acne?.raw).toBe(71.5); // numeric strings accepted
    expect(p.concerns.pore?.masks).toHaveLength(2);
    expect(p.overall).toBe(75.76);
    expect(p.skinAge).toBe(37);
  });

  it("keeps unknown types instead of dropping them", () => {
    expect(parseTask(fixture).other["hd_mystery"]).toEqual({ raw: 40, ui: 50, masks: [] });
  });

  it("reports running and error states", () => {
    expect(parseTask({ data: { task_status: "running" } }).status).toBe("running");
    const e = parseTask({ data: { task_status: "error", error: "error_src_face_too_small" } });
    expect(e).toMatchObject({ status: "error", error: "error_src_face_too_small" });
  });

  it("treats success with no scores as an error, and junk as an error", () => {
    expect(parseTask({ data: { task_status: "success", results: { output: [] } } }).status).toBe("error");
    expect(parseTask("nope").status).toBe("error");
    expect(parseTask(null).status).toBe("error");
  });

  it("parses the real response shape: per-region entries, 'whole' as the score", () => {
    const p = parseTask(real);
    expect(p.status).toBe("success");
    expect(p.concerns.pore?.raw).toBeCloseTo(74.94, 1); // region "whole", not whichever region came last
    expect(Object.keys(p.concerns.pore?.regions ?? {}).sort()).toEqual(["cheek", "forehead", "nose"]);
    expect(p.concerns.pore?.regions?.nose.raw).toBe(100);
    expect(p.concerns.pore?.regions?.forehead.raw).toBeCloseTo(61.51, 1);
    expect(p.concerns.redness?.raw).toBeCloseTo(90.69, 1); // no region field = whole
    expect(p.concerns.texture?.masks).toHaveLength(1);
    expect(p.overall).toBeTypeOf("number");
    expect(p.skinAge).toBeTypeOf("number");
    expect(p.other).not.toHaveProperty("resize_image");
  });

  it("doesn't invent an overall score from regions alone", () => {
    const p = parseTask({
      data: {
        task_status: "success",
        results: { output: [{ type: "hd_pore", region: "nose", raw_score: 50, ui_score: 70, mask_urls: [] }, { type: "hd_redness", raw_score: 60, mask_urls: [] }] },
      },
    });
    expect(p.concerns.pore).toBeUndefined();
    expect(p.concerns.redness?.raw).toBe(60);
  });

  it("maps concern names", () => {
    expect(baseConcern("hd_age_spot")).toBe("age_spot");
    expect(baseConcern("dark_circle_v2")).toBe("dark_circle");
    expect(toDstActions(["redness", "pore"])).toEqual(["hd_redness", "hd_pore"]);
  });
});
