import highwayPaths from "@/lib/map/generated/highway-paths.json";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, project } from "@/lib/map/preview-projection";
import {
  DIMMED_OPACITY,
  HALO_WIDTH,
  MAP_CITIES,
  MAP_PEAKS,
  PALETTES,
  SELECTED_WIDTH,
  dotRadius,
  riskWidth,
  type MapTone,
} from "@/lib/map/style";

export interface MapDot {
  key: string;
  lon: number;
  lat: number;
  killed: number;
  precise: boolean;
}

/**
 * A static map: the official border and the national highways, drawn without map JavaScript
 * (SPEC 6.2). Used for the home hero (ink) and the small maps on inner pages (light).
 *
 * Layers: pre-rendered base (land, border, every highway in the lowest risk colour) → highways
 * coloured by risk → the selected highway with its halo → crash dots → latest-crash rings and
 * label chip → city labels. Sizes follow the README map style; `pxPerUnit` converts them into
 * viewBox units for the size the map is shown at.
 */
export function StaticMap({
  tone,
  dots = [],
  risk = {},
  selected,
  latest,
  tag,
  view,
  labels = true,
  graticule = true,
  pxPerUnit = 1.3,
  locale,
  title,
  className = "",
}: {
  tone: MapTone;
  dots?: MapDot[];
  risk?: Record<string, number>;
  selected?: string;
  latest?: { lon: number; lat: number };
  tag?: { lon: number; lat: number; text: string };
  /** Crop: centre and width in degrees of longitude. Omit for the whole country. */
  view?: { lon: number; lat: number; spanLon: number; aspect: number };
  labels?: boolean;
  graticule?: boolean;
  /** Screen pixels per viewBox unit at the intended display size. */
  pxPerUnit?: number;
  locale: "ne" | "en";
  /** Accessible description of what the map shows. */
  title: string;
  className?: string;
}) {
  const P = PALETTES[tone];
  const u = (px: number) => px / pxPerUnit; // screen px -> viewBox units

  let vb = `0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`;
  if (view) {
    const [cx, cy] = project(view.lon, view.lat);
    const [x0] = project(view.lon - view.spanLon / 2, view.lat);
    const w = (cx - x0) * 2;
    const h = w / view.aspect;
    vb = `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }

  const paths = highwayPaths as Record<string, string>;
  const coloured = Object.entries(risk)
    .filter(([ref, step]) => step > 0 && paths[ref] && ref !== selected)
    .sort((a, b) => a[1] - b[1]);

  const lonLines = [81, 82, 83, 84, 85, 86, 87, 88];
  const latLines = [27, 28, 29, 30];

  return (
    <svg
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      className={`block h-full w-full ${className}`}
      style={{ overflow: "visible" }}
    >
      <title>{title}</title>

      {graticule &&
        lonLines.map((lon) => {
          const [x] = project(lon, 28);
          return (
            <g key={`lon${lon}`}>
              <line x1={x} x2={x} y1={-200} y2={PREVIEW_HEIGHT + 200} stroke={P.grid} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {labels && (
                <text x={x + u(4)} y={u(12)} fill={P.sub} fontSize={u(10)} fontWeight={600} letterSpacing=".06em">
                  {lon}°E
                </text>
              )}
            </g>
          );
        })}
      {graticule &&
        latLines.map((lat) => {
          const [, y] = project(84, lat);
          return (
            <g key={`lat${lat}`}>
              <line x1={-200} x2={PREVIEW_WIDTH + 200} y1={y} y2={y} stroke={P.grid} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {labels && (
                <text x={PREVIEW_WIDTH - u(34)} y={y - u(4)} fill={P.sub} fontSize={u(10)} fontWeight={600} letterSpacing=".06em">
                  {lat}°N
                </text>
              )}
            </g>
          );
        })}

      <image href={`/map/base-${tone}.svg`} x={0} y={0} width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} />

      <g opacity={selected ? DIMMED_OPACITY : 1}>
        {coloured.map(([ref, step]) => (
          <path
            key={ref}
            d={paths[ref]}
            fill="none"
            stroke={P.risk[step as 0 | 1 | 2 | 3]}
            strokeWidth={riskWidth(step)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {selected && paths[selected] && (
        <g>
          <path d={paths[selected]} fill="none" stroke={P.halo} strokeWidth={HALO_WIDTH} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={paths[selected]} fill="none" stroke={P.selected} strokeWidth={SELECTED_WIDTH} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
      )}

      {labels &&
        MAP_PEAKS.map((p) => {
          const [x, y] = project(p.lon, p.lat);
          return (
            <g key={p.en} fill={P.sub}>
              <path d={`M${x} ${y - u(7)}L${x + u(6)} ${y + u(3)}L${x - u(6)} ${y + u(3)}Z`} />
              <text x={p.lon > 88 ? x - u(8) : x + u(9)} y={y + u(3)} fontSize={u(10)} fontWeight={600} textAnchor={p.lon > 88 ? "end" : "start"}>
                {p[locale]}
              </text>
            </g>
          );
        })}

      {dots.map((d) => {
        const [x, y] = project(d.lon, d.lat);
        const r = u(dotRadius(d.killed));
        return d.precise ? (
          <circle key={d.key} cx={x} cy={y} r={r} fill={P.dot} stroke={P.dotStroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.92} />
        ) : (
          <circle key={d.key} cx={x} cy={y} r={r} fill="none" stroke={P.dot} strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.92} />
        );
      })}

      {latest &&
        (() => {
          const [x, y] = project(latest.lon, latest.lat);
          return (
            <g fill="none" stroke={P.dot} strokeWidth={1.5}>
              <circle cx={x} cy={y} r={u(22)} opacity={0.7} vectorEffect="non-scaling-stroke" />
              <circle cx={x} cy={y} r={u(34)} opacity={0.3} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })()}

      {labels &&
        MAP_CITIES.map((c) => {
          const [x, y] = project(c.lon, c.lat);
          const left = c.lon < 84.2 && c.lon > 83.5; // Pokhara, Butwal: label to the left
          return (
            <g key={c.en}>
              <rect x={x - u(3)} y={y - u(3)} width={u(6)} height={u(6)} fill={P.label} />
              <text
                x={left ? x - u(8) : x + u(8)}
                y={y + u(4)}
                textAnchor={left ? "end" : "start"}
                fontSize={u(12)}
                fontWeight={600}
                fill={P.label}
                stroke={P.land}
                strokeWidth={u(3)}
                paintOrder="stroke"
              >
                {c[locale]}
              </text>
            </g>
          );
        })}

      {tag &&
        (() => {
          const [x, y] = project(tag.lon, tag.lat);
          const w = u(tag.text.length * 7.4 + 16);
          return (
            <g>
              <rect x={x + u(28)} y={y - u(2)} width={w} height={u(20)} fill={P.tagBg} />
              <text x={x + u(36)} y={y + u(12)} fontSize={u(11)} fontWeight={800} fill={P.tagFg} letterSpacing=".04em">
                {tag.text}
              </text>
            </g>
          );
        })()}
    </svg>
  );
}

/**
 * The faded Kathmandu Valley street layer at the right edge of the ink map (README "Faded city").
 * Real OSM streets, used as a CSS mask so one file serves both tones.
 */
export function CityLayer({ tone, className = "" }: { tone: MapTone; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 right-0 opacity-50 ${className}`}
      style={{
        backgroundColor: tone === "ink" ? "rgb(243 242 242 / .7)" : "rgb(32 30 29 / .7)",
        maskImage: "url(/map/kathmandu-streets.svg), linear-gradient(90deg, transparent, #000 75%)",
        WebkitMaskImage: "url(/map/kathmandu-streets.svg), linear-gradient(90deg, transparent, #000 75%)",
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
        maskSize: "cover, 100% 100%",
        WebkitMaskSize: "cover, 100% 100%",
        maskPosition: "center",
        maskRepeat: "no-repeat",
      }}
    />
  );
}
