import { CATEGORIES } from "@/lib/categories";
import { K, MIN_CHECKINS } from "@/lib/verdict";
import { PRIOR_SIGMA } from "@/lib/noise";

export const metadata = { title: "How it works · Is it working?" };

export default function About() {
  return (
    <article className="space-y-5 leading-relaxed">
      <h1 className="display text-3xl font-semibold">How it works</h1>

      <Section title="Why the mirror lies">
        Lighting, sleep, mood and what you paid all change what you see. A ₹2,500 serum four weeks in <i>feels</i> like it should be working. We replace that
        with measurements and an honest rule.
      </Section>

      <Section title="Split-face: the strong design">
        You apply the product to one cheek only. Every photo then contains its own control: the other side of the same face, under the same light, on the same day.
        We find the face midline with MediaPipe Face Mesh and measure YouCam’s per-concern detection mask on each side. What we track is the gap between the sides
        compared with the gap at baseline. Published trials use this design for the same reason: Bissett et al. (2004) tested niacinamide on one half of the face against a control on the other, and Kafi et al. (2007) tested retinol on one arm against vehicle on the other.
      </Section>

      <Section title="Your own noise">
        Two selfies taken a minute apart don’t score the same. Your baseline is 3 photos, and every 3rd check-in takes 2, so we can measure how much <i>your</i>{" "}
        scores wobble. Until there are enough repeats we use a starting guess of ±{PRIOR_SIGMA} points and blend in your own as they arrive.
      </Section>

      <Section title="The rule">
        A concern is “Working” only when the change since baseline is bigger than {K}× its standard error <b>and</b> bigger than {K}× your noise, after at least{" "}
        {MIN_CHECKINS} check-ins, and not before the product type’s earliest-effect day. “Getting worse” is the mirror image, and can show earlier, because
        stopping early is the safe side. Otherwise it’s “No effect beyond noise”, “Too early to tell” or “Not enough data”. The rule is plain code with tests. No AI
        decides your verdict.
      </Section>

      <Section title="Raw score, not UI score">
        YouCam returns two scores per concern. The “UI score” is adjusted upward to motivate users; the raw score isn’t. Every number here is the raw score.
      </Section>

      <Section title="What YouCam does">
        Each photo goes to the YouCam Skin Analysis API (HD): upload the file, create a task with the concerns you chose plus redness and texture as controls, then
        fetch the result. That costs 12 units per photo for up to 4 concerns. The result holds a raw score and a detection mask per concern.
      </Section>

      <Section title="Time to effect">
        <ul className="mt-1 space-y-1 text-sm">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <b>{c.label}</b>: judged from day {c.minDays}; trials ran ~{c.typicalDays} days.{" "}
              <span className="text-muted">
                {c.source} {c.verified ? "✓ checked" : "(not yet checked)"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">Trial lengths come from the papers. The “judged from” day is our own conservative cut-off, set earlier than the trial endpoints.</p>
      </Section>

      <Section title="Privacy">
        Trials, scores and photo thumbnails are stored only in this browser (IndexedDB). There’s no account. Each photo is sent to YouCam to be analysed, and
        nowhere else. You can export or delete everything.
      </Section>

      <Section title="Limits">
        Phone cameras, light and angle still add noise; split-face cancels most of it, not all. Few check-ins means wide error bars, which is why “not enough
        data” is a real answer. This is not medical advice. See a dermatologist for skin conditions.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display text-xl font-semibold">{title}</h2>
      <div className="mt-1 text-[0.97rem] text-ink/85">{children}</div>
    </section>
  );
}
