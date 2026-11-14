/**
 * Small server-rendered charts (no chart library, no JavaScript; SPEC 11.4).
 * Follows the dataviz method with this site's design system:
 * - single series, so no legend box; the heading names what is plotted;
 * - square bar ends (the handoff never rounds a corner), thin gaps between bars;
 * - every bar has a hover label (SVG <title>) on a full-height hit area, and every chart
 *   has a table view and a CSV download, so no value depends on colour or hovering alone.
 * Colours: ink for counts, accent for deaths over time, neutral-600 + accent for the
 * blackspot highlight (validated: CVD ΔE 13.1, contrast ≥ 3:1 on the light ground).
 */

export interface Bar {
  key: string;
  value: number;
  /** Hover / screen-reader text, e.g. "km 112–113: 6 killed". */
  title: string;
  highlight?: boolean;
}

/** Vertical bars. Labels are rendered by the caller in HTML (SVG text would stretch). */
export function Columns({
  bars, height, fill, highlightFill, gap = 0.15, label,
}: { bars: Bar[]; height: number; fill: string; highlightFill?: string; gap?: number; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const w = 10;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${bars.length * w} 100`}
      preserveAspectRatio="none"
      className="block w-full border-b-2 border-ink"
      style={{ height }}
      shapeRendering="crispEdges"
    >
      {bars.map((b, i) => {
        const h = (b.value / max) * 100;
        return (
          <g key={b.key}>
            <title>{b.title}</title>
            {/* hit area: the whole column, so thin bars are easy to hover */}
            <rect x={i * w} y={0} width={w} height={100} fill="transparent" />
            <rect
              x={i * w + (w * gap) / 2}
              y={100 - h}
              width={w * (1 - gap)}
              height={h}
              className={b.highlight && highlightFill ? highlightFill : fill}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars with the label and value as text (the handoff's "by vehicle type"). */
export function HBars({
  rows, valueLabel, fill = "bg-ink", labelWidth = 100,
}: {
  rows: { key: string; label: string; value: number; display: string; href?: string }[];
  valueLabel: string;
  /** Background class of the bar: ink for counts, accent for deaths by place (the handoff). */
  fill?: string;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={valueLabel}>
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid items-center gap-3 py-1.5 text-ui"
          style={{ gridTemplateColumns: `${labelWidth}px 1fr auto` }}
          title={`${r.label}: ${r.display}`}
        >
          {r.href ? <a href={r.href} className="truncate font-semibold">{r.label}</a> : <span className="truncate">{r.label}</span>}
          <span aria-hidden className="block h-3 bg-neutral-300">
            <span className={`block h-3 ${fill}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <b className="min-w-8 text-right tabular">{r.display}</b>
        </li>
      ))}
    </ul>
  );
}

/** Round axis ticks for 0..v, about four of them: 203 → [50, 100, 150, 200, 250]. */
export function niceTicks(v: number, target = 4): number[] {
  const raw = Math.max(1, v * 1.05) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let t = step; t < v * 1.05 + step; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

/**
 * Lines over time on one axis (all series in the same unit). Lines and grid are SVG; the axis
 * labels, end labels and legend are HTML, so text never stretches with the chart. Every x step
 * has a full-height hover band with the values for that step.
 */
export function LineChart({
  xLabels, series, reference, stepTitles, height, format,
}: {
  xLabels: string[];
  series: { key: string; label: string; values: number[]; stroke: string; width: number }[];
  /** A flat comparison line, drawn dashed (e.g. the police monthly average). */
  reference?: { value: number; label: string };
  stepTitles: string[];
  height: number;
  format: (n: number) => string;
}) {
  const n = xLabels.length;
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.values), reference?.value ?? 0));
  const max = ticks[ticks.length - 1];
  const W = (n - 1) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  return (
    <div>
      {/* legend: always present for 2+ series */}
      <p className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-small">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-2">
            <svg aria-hidden width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" className={s.stroke} strokeWidth={s.width} /></svg>
            {s.label}
          </span>
        ))}
        {reference && (
          <span className="flex items-center gap-2">
            <svg aria-hidden width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" className="stroke-neutral-600" strokeWidth="2" strokeDasharray="4 3" /></svg>
            {reference.label}
          </span>
        )}
      </p>
      <div className="relative ml-10 mr-16" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} aria-hidden className="absolute -left-10 w-8 -translate-y-1/2 text-right text-meta text-neutral-700 tabular" style={{ top: `${y(t)}%` }}>
            {format(t)}
          </span>
        ))}
        <svg role="img" aria-label={series.map((s) => s.label).join(", ")} viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="block size-full overflow-visible">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-neutral-300" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={W} y1={100} y2={100} className="stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {reference && (
            <line x1={0} x2={W} y1={y(reference.value)} y2={y(reference.value)} className="stroke-neutral-600" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          )}
          {series.map((s) => (
            <polyline
              key={s.key}
              points={s.values.map((v, i) => `${i * 100},${y(v)}`).join(" ")}
              fill="none"
              className={s.stroke}
              strokeWidth={s.width}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {xLabels.map((_, i) => (
            <rect key={i} x={i * 100 - 50} y={0} width={100} height={100} fill="transparent">
              <title>{stepTitles[i]}</title>
            </rect>
          ))}
        </svg>
        {/* direct labels at the line ends */}
        {series.map((s) => (
          <span key={s.key} aria-hidden className="absolute -right-16 w-14 -translate-y-1/2 text-meta font-semibold" style={{ top: `${y(s.values[n - 1])}%` }}>
            {format(s.values[n - 1])}
          </span>
        ))}
      </div>
      <div aria-hidden className="ml-10 mr-16 mt-1.5 flex justify-between text-meta text-neutral-700">
        {xLabels.map((l) => <span key={l} className="w-0 whitespace-nowrap text-center [&:first-child]:text-left [&:last-child]:text-right">{l}</span>)}
      </div>
    </div>
  );
}

/** Population pyramid: two groups mirrored around the band labels, values at the bar ends. */
export function Pyramid({
  rows, left, right, format,
}: { rows: [string, number, number][]; left: string; right: string; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.flatMap(([, a, b]) => [a, b]));
  return (
    <div>
      <p aria-hidden className="mb-1 grid grid-cols-[1fr_52px_1fr] text-meta font-semibold">
        <span className="text-right">{left}</span>
        <span />
        <span>{right}</span>
      </p>
      <ul>
        {rows.map(([band, a, b]) => (
          <li key={band} className="grid grid-cols-[1fr_52px_1fr] items-center gap-1.5 py-0.5 text-meta" title={`${band}: ${left} ${format(a)}, ${right} ${format(b)}`}>
            <span className="flex items-center justify-end gap-1.5">
              <span className="tabular text-neutral-700">{format(a)}</span>
              <span aria-hidden className="block h-3 bg-ink" style={{ width: `${(a / max) * 80}%` }} />
            </span>
            <span className="text-center text-neutral-700 tabular">{band}</span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="block h-3 bg-neutral-600" style={{ width: `${(b / max) * 80}%` }} />
              <span className="tabular text-neutral-700">{format(b)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The table behind a chart, collapsed by default, plus a CSV of the same rows. */
export function ChartData({
  summary, csvName, columns, rows,
}: { summary: string; csvName: string; columns: string[]; rows: (string | number)[][] }) {
  const csv = [columns, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  return (
    <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2">
      <details className="min-w-0 flex-1">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-semibold underline underline-offset-4">{summary}</summary>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                {columns.map((c) => <th key={c} scope="col" className="label py-1.5 pr-4 text-neutral-700">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-neutral-400">
                  {r.map((c, j) => <td key={j} className="py-1.5 pr-4 tabular">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <a download={csvName} href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + csv)}`} className="inline-flex min-h-11 items-center text-small font-semibold">
        CSV ↓
      </a>
    </div>
  );
}
