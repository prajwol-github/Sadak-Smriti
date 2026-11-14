import districtPaths from "@/lib/map/generated/district-paths.json";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH } from "@/lib/map/preview-projection";

/**
 * Deaths by district on the official map (SPEC 9.2 "choropleth"). District outlines are built by
 * `pnpm map:build` (lib/map/generated/district-paths.json, about 1 km detail, 28 KB).
 *
 * Sequential, one hue (the accent ramp, light → dark = few → many), 5 classes by quantile, so
 * each shade holds about the same number of districts. Every district has a hover title, and
 * the legend gives each class's range; the table below the map has every value.
 */
const CLASSES = ["fill-accent-200", "fill-accent-300", "fill-accent-400", "fill-accent-600", "fill-accent-800"];
const SWATCHES = ["bg-accent-200", "bg-accent-300", "bg-accent-400", "bg-accent-600", "bg-accent-800"];

export type DistrictShape = (typeof districtPaths)[number];
export const DISTRICT_SHAPES: DistrictShape[] = districtPaths;

export function Choropleth({
  values, locale, label, legendTitle, format,
}: { values: Record<string, number>; locale: "ne" | "en"; label: string; legendTitle: string; format: (n: number) => string }) {
  const sorted = Object.values(values).sort((a, b) => a - b);
  // Upper bound of each class (quantiles), the last one is the maximum.
  const bounds = CLASSES.map((_, i) => sorted[Math.min(sorted.length - 1, Math.ceil(((i + 1) / CLASSES.length) * sorted.length) - 1)]);
  const classOf = (v: number) => Math.max(0, bounds.findIndex((b) => v <= b));
  const lower = (i: number) => (i === 0 ? sorted[0] : bounds[i - 1] + 1);

  return (
    <div>
      <svg role="img" aria-label={label} viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`} className="block h-auto w-full">
        {DISTRICT_SHAPES.map((d) => {
          const v = values[d.slug] ?? 0;
          return (
            <path key={d.slug} d={d.d} className={`${CLASSES[classOf(v)]} stroke-neutral-500 hover:stroke-ink`} strokeWidth={0.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
              <title>{`${locale === "ne" ? d.np : d.en}: ${format(v)}`}</title>
            </path>
          );
        })}
      </svg>
      <div className="mt-3">
        <p className="label mb-1.5 text-neutral-700">{legendTitle}</p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-meta">
          {SWATCHES.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block size-3 ${s}`} />
              <span className="tabular">{lower(i) === bounds[i] ? format(bounds[i]) : `${format(lower(i))}–${format(bounds[i])}`}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
