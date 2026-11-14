import { Suspense } from "react";

/** A row of dashboard panels. Each panel is a direct child of the grid, even inside <Suspense>. */
export function Row({ cols, last = false, children }: { cols: string; last?: boolean; children: React.ReactNode }) {
  return <div className={`grid ${cols} ${last ? "" : "border-b-2 border-ink"} [&>section]:border-neutral-400 [&>section:not(:last-child)]:border-b xl:[&>section:not(:last-child)]:border-b-0 xl:[&>section:not(:last-child)]:border-r md:[&>section]:min-w-0`}>{children}</div>;
}

export function Panel({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 px-4 py-6 lg:px-6">
      <h2 className="text-h4">{title}</h2>
      {body && <p className="mt-1 text-small text-neutral-700">{body}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Same box as <Panel>, with grey bars where the chart will be. The heading is real, so the page reads at once. */
export function PanelSkeleton({ title, height }: { title: string; height: number }) {
  return (
    <section aria-busy="true" className="min-w-0 px-4 py-6 lg:px-6">
      <h2 className="text-h4">{title}</h2>
      <div className="mt-4 animate-pulse motion-reduce:animate-none" style={{ height }}>
        <div className="h-full bg-neutral-300" />
      </div>
      <div className="mt-3 h-4 w-24 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
    </section>
  );
}

/**
 * One independent dashboard module: its own loading boundary. A slow query here shows this
 * panel's skeleton and leaves every other panel, and the page around them, free to render.
 */
export function Slot({ title, height, children }: { title: string; height: number; children: React.ReactNode }) {
  return <Suspense fallback={<PanelSkeleton title={title} height={height} />}>{children}</Suspense>;
}

/** The KPI strip's loading state: five empty cells in the real grid. */
export function KpiSkeleton() {
  return (
    <dl aria-busy="true" className="grid grid-cols-2 border-b-2 border-ink sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="border-b border-r border-neutral-400 px-4 py-4 lg:px-6 lg:py-5 xl:border-b-0">
          <div className="h-3 w-16 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
          <div className="mt-2 h-8 w-24 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-28 animate-pulse bg-neutral-300 motion-reduce:animate-none" />
        </div>
      ))}
    </dl>
  );
}

export function Labels({ items }: { items: string[] }) {
  return (
    <div aria-hidden className="mt-1 flex text-[10px] text-neutral-700">
      {items.map((l) => <span key={l} className="flex-1 truncate text-center">{l}</span>)}
    </div>
  );
}
