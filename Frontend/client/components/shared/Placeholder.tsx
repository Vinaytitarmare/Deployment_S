import { Link } from "react-router-dom";

export default function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground">
        Coming soon
      </div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-gradient-to-br from-[hsl(var(--brand-start))] to-[hsl(var(--brand-end))] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
