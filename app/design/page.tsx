import type { Metadata } from "next";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

const swatches = [
  ["bg", "bg-bg"], ["surface", "bg-surface"], ["surface-2", "bg-surface-2"], ["border", "bg-border"],
  ["text", "bg-text"], ["muted", "bg-muted"], ["accent", "bg-accent"], ["accent-soft", "bg-accent-soft"],
] as const;

export default function DesignPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl">Design system</h1>
        <p className="mt-2 text-muted">Tokens and base components. Toggle dark mode in the header to check both themes.</p>
      </header>

      <section aria-labelledby="colors" className="space-y-3">
        <h2 id="colors" className="text-xl">Colors</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(([name, cls]) => (
            <li key={name} className="card p-3">
              <div className={`h-10 rounded-[8px] border border-border ${cls}`} />
              <p className="mt-2 text-sm font-semibold">{name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="buttons" className="space-y-3">
        <h2 id="buttons" className="text-xl">Buttons and inputs</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary">Save changes</button>
          <button className="btn btn-secondary">Cancel</button>
          <button className="btn btn-ghost">Learn more</button>
          <button className="btn btn-primary" disabled>Disabled</button>
        </div>
        <label className="block max-w-sm text-sm font-semibold">
          Username
          <input className="input mt-1 font-normal" placeholder="your_name" />
          <span className="mt-1 block text-xs font-normal text-muted">3 to 20 characters. Letters, numbers, underscore.</span>
        </label>
      </section>

      <section aria-labelledby="cards" className="space-y-3">
        <h2 id="cards" className="text-xl">Tool card (sample)</h2>
        <article className="card max-w-md p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base">Sample tool</h3>
              <p className="mt-1 text-sm text-muted">One-line description of what the tool does and who it is for.</p>
            </div>
            <span className="chip chip-accent">New</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><span className="chip">writing</span><span className="chip">research</span></div>
        </article>
      </section>

      <section aria-labelledby="states" className="space-y-3">
        <h2 id="states" className="text-xl">Loading and empty states</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-3 p-4" aria-hidden>
            <div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" />
          </div>
          <div className="card p-6 text-center">
            <p className="font-semibold">No saved tools yet</p>
            <p className="mt-1 text-sm text-muted">Save a tool from its page and it will show up here.</p>
            <button className="btn btn-primary mt-4">Browse tools</button>
          </div>
        </div>
      </section>
    </div>
  );
}
