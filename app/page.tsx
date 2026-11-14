import Link from "next/link";

// Placeholder until phase 3 (directory). Deliberately has no stats: real counts come from the database.
export default function Home() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-4xl sm:text-5xl">Find the right AI tool, faster</h1>
      <p className="mt-4 text-lg text-muted">
        Aivoke is being built in phases. The directory, assistant and community arrive in the next phases.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/design" className="btn btn-primary">View the design system</Link>
      </div>
    </section>
  );
}
