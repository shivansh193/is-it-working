import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/docs/task-success.json";
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

  it("maps concern names", () => {
    expect(baseConcern("hd_age_spot")).toBe("age_spot");
    expect(baseConcern("dark_circle_v2")).toBe("dark_circle");
    expect(toDstActions(["redness", "pore"])).toEqual(["hd_redness", "hd_pore"]);
  });
});
