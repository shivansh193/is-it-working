"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { putTrial, uid } from "@/lib/db";
import { userSideToImage } from "@/lib/split";
import { localDate } from "@/lib/analysis";
import { CONCERNS, CONCERN_LABEL, Concern, TrialMode } from "@/lib/types";

export default function NewTrial() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("niacinamide");
  const [concerns, setConcerns] = useState<Concern[]>(getCategory("niacinamide").suggested.slice(0, 2));
  const [startDate, setStartDate] = useState(localDate());
  const [link, setLink] = useState("");
  const [price, setPrice] = useState("");
  const [supplyDays, setSupplyDays] = useState("60");
  const [mode, setMode] = useState<TrialMode>("split");
  const [side, setSide] = useState<"my-left" | "my-right">("my-left");
  const cat = getCategory(category);

  const toggle = (c: Concern) => setConcerns((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= 3 ? cs : [...cs, c]));
  const valid = name.trim() && concerns.length > 0;

  const save = async () => {
    const id = uid();
    await putTrial({
      id,
      name: name.trim(),
      category,
      concerns,
      startDate,
      link: link.trim() || undefined,
      price: price ? Number(price) : undefined,
      supplyDays: supplyDays ? Number(supplyDays) : undefined,
      mode,
      treatedSide: mode === "split" ? userSideToImage(side) : undefined,
      createdAt: new Date().toISOString(),
    });
    router.push(`/capture?id=${id}&kind=baseline`);
  };

  return (
    <div className="space-y-6">
      <h1 className="display text-3xl font-semibold">Start a trial</h1>

      <Field label="Product">
        <input className="field" placeholder="e.g. 10% niacinamide serum" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Type of product">
        <select
          className="field"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            const s = getCategory(e.target.value).suggested;
            if (s.length) setConcerns(s.slice(0, 2));
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-2 rounded-xl bg-[var(--v-early-bg)] p-3 text-sm text-[var(--v-early)]">
          ◔ Products like this usually need <b>{cat.minDays} days</b> before an effect can show, and about {cat.typicalDays} days in published trials. We’ll say “too
          early” until then.
        </p>
      </Field>

      <Field label="What do you hope it fixes? (up to 3)" group>
        <div className="flex flex-wrap gap-2">
          {CONCERNS.map((c) => (
            <button key={c} className="chip" aria-pressed={concerns.includes(c)} onClick={() => toggle(c)}>
              {CONCERN_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="How to test" group>
        <div className="grid gap-2">
          <Choice on={mode === "split"} onClick={() => setMode("split")} title="Split-face (recommended)">
            Use the product on one side of your face only. Each check compares the two sides in the same photo, so lighting, sleep and the camera cancel out.
            This is how dermatology trials control for everything else.
          </Choice>
          <Choice on={mode === "whole"} onClick={() => setMode("whole")} title="Whole face">
            Simpler, but every check is compared with a different day’s photo, so the change has to be bigger to count.
          </Choice>
        </div>
        {mode === "split" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="whitespace-nowrap">Apply only to</span>
            {(["my-left", "my-right"] as const).map((s) => (
              <button key={s} className="chip whitespace-nowrap" aria-pressed={side === s} onClick={() => setSide(s)}>
                {s === "my-left" ? "my left cheek" : "my right cheek"}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Started on">
          <input type="date" className="field" value={startDate} max={localDate()} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Price (₹, optional)">
          <input inputMode="numeric" className="field" placeholder="2500" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bottle lasts (days)">
          <input inputMode="numeric" className="field" value={supplyDays} onChange={(e) => setSupplyDays(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Product link (optional)">
          <input className="field" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
      </div>

      <div className="card p-4 text-sm text-muted">
        <b className="text-ink">Next: your baseline.</b> 3 photos, a minute apart. The small differences between them tell us how much your scans wobble on their own,
        so we never mistake that wobble for an effect.
      </div>

      <button className="btn btn-primary w-full py-4 text-lg" disabled={!valid} onClick={save}>
        Take baseline photos
      </button>
    </div>
  );
}

/** `group` for sets of buttons: a <label> around several buttons would forward clicks on its text to the first one. */
function Field({ label, group, children }: { label: string; group?: boolean; children: React.ReactNode }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block space-y-1.5" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="label block">{label}</span>
      {children}
    </Tag>
  );
}

function Choice({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="card p-4 text-left" style={on ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined} aria-pressed={on}>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </button>
  );
}
