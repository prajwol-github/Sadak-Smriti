/**
 * The MapLibre style for every interactive map (home hero, /map, crash and highway pages).
 *
 * Layers, bottom to top:
 *   1. our basemap (Protomaps tiles from /tiles, re-coloured to the Modernist palette), without its
 *      border and POI layers; place and road labels come last of this group
 *   2. a mask that paints everything outside the official border with the ground colour, so India
 *      and China never show (docs/adr/0002-map-sources.md)
 *   3. district and province lines, the border, a graticule
 *   4. national highways: every road in its risk colour, the selected one with a halo
 *   5. highway numbers, crash dots, latest-crash rings
 *
 * Colours and sizes come from lib/map/style.ts, so the live map and the static SVG agree.
 */
import { layers as protomapsLayers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { DIMMED_OPACITY, HALO_WIDTH, PALETTES, SELECTED_WIDTH, riskWidth, type MapTone } from "@/lib/map/style";

export type MapLocale = "ne" | "en";

/** Layer ids other code toggles or listens to. */
export const LAYER = {
  highwaysBase: "sk-highways-base",
  highwaysHalo: "sk-highways-halo",
  highwaysSelected: "sk-highways-selected",
  highwayLabels: "sk-highway-labels",
  highwayHit: "sk-highways-hit",
  districts: "sk-districts",
  provinces: "sk-provinces",
  crashes: "sk-crashes",
  crashesApprox: "sk-crashes-approx",
  crashesHit: "sk-crashes-hit",
  latestRings: ["sk-latest-outer", "sk-latest-inner"],
} as const;

/** Groups the Layers menu can switch. */
export const LAYER_GROUPS = {
  highways: [LAYER.highwaysBase, LAYER.highwaysSelected, LAYER.highwaysHalo, LAYER.highwayLabels],
  crashes: [LAYER.crashes, LAYER.crashesApprox, "sk-latest-outer", "sk-latest-inner"],
  districts: [LAYER.districts],
} as const;
export type LayerGroup = keyof typeof LAYER_GROUPS;

interface Colours {
  ground: string;
  land: string;
  water: string;
  glacier: string;
  wood: string;
  built: string;
  minor: string;
  major: string;
  highway: string;
  rail: string;
  label: string;
  sub: string;
  faint: string;
  district: string;
  province: string;
}

const COLOURS: Record<MapTone, Colours> = {
  ink: {
    ground: "#201e1d",
    land: "#2d2b2b",
    water: "#171615",
    glacier: "#3a3737",
    wood: "#302e2e",
    built: "#383535",
    minor: "#3d3a3a",
    major: "#4d4a4a",
    highway: "#5d5a5a",
    rail: "#4d4a4a",
    label: "#eae7e7",
    sub: "#9b9797",
    faint: "#7d7979",
    district: "rgba(243,242,242,.14)",
    province: "rgba(243,242,242,.3)",
  },
  light: {
    ground: "#eae7e7",
    land: "#f8f4f4",
    water: "#dcd8d8",
    glacier: "#ffffff",
    wood: "#f1eded",
    built: "#ebe7e7",
    minor: "#e3dfdf",
    major: "#d3cfcf",
    highway: "#bfbbbb",
    rail: "#cfcaca",
    label: "#201e1d",
    sub: "#605d5d",
    faint: "#7d7979",
    district: "rgba(32,30,29,.14)",
    province: "rgba(32,30,29,.32)",
  },
};

/** The Protomaps flavor with every colour replaced by our neutrals; nothing else shows hue. */
export function flavorFor(tone: MapTone): Flavor {
  const c = COLOURS[tone];
  const base = namedFlavor(tone === "ink" ? "dark" : "light");
  const f: Record<string, unknown> = { ...base };
  const roadColour = (kind: string): string =>
    kind === "highway" ? c.highway : kind === "major" || kind === "link" ? c.major : c.minor;

  for (const key of Object.keys(base)) {
    const road = key.match(/^(?:tunnel_|bridges_)?(other|minor_service|minor|link|major|highway)(_casing)?(?:_early|_late)?$/);
    if (road) {
      f[key] = road[2] || key.endsWith("_early") || key.endsWith("_late") ? c.land : roadColour(road[1]);
    }
  }
  Object.assign(f, {
    background: c.ground,
    earth: c.land,
    water: c.water,
    glacier: c.glacier,
    park_a: c.wood,
    park_b: c.wood,
    wood_a: c.wood,
    wood_b: c.wood,
    scrub_a: c.wood,
    scrub_b: c.wood,
    hospital: c.land,
    industrial: c.land,
    school: c.land,
    pedestrian: c.land,
    sand: c.land,
    beach: c.land,
    zoo: c.land,
    military: c.land,
    aerodrome: c.built,
    runway: c.major,
    pier: c.land,
    buildings: c.built,
    railway: c.rail,
    boundaries: "rgba(0,0,0,0)",
    roads_label_minor: c.sub,
    roads_label_minor_halo: c.land,
    roads_label_major: c.sub,
    roads_label_major_halo: c.land,
    ocean_label: c.faint,
    subplace_label: c.sub,
    subplace_label_halo: c.land,
    city_label: c.label,
    city_label_halo: c.land,
    state_label: c.faint,
    state_label_halo: c.land,
    country_label: c.faint,
    address_label: c.sub,
    address_label_halo: c.land,
    regular: "Noto Sans Regular",
    bold: "Noto Sans Medium",
    italic: "Noto Sans Italic",
    landcover: {
      barren: c.land,
      farmland: c.land,
      forest: c.wood,
      glacier: c.glacier,
      grassland: c.land,
      scrub: c.wood,
      urban_area: c.built,
    },
  });
  return f as unknown as Flavor;
}

/** Expression: the value for a highway ref, from a ref → value table, else the fallback. */
function byRef(table: Record<string, number | string>, fallback: number | string): ExpressionSpecification {
  const entries = Object.entries(table);
  if (entries.length === 0) return fallback as unknown as ExpressionSpecification;
  const args: (string | number)[] = [];
  for (const [ref, v] of entries) args.push(ref, v);
  return ["match", ["get", "ref"], ...args, fallback] as unknown as ExpressionSpecification;
}

/** Scale a pixel size with zoom so roads keep their weight from the country view to street level. */
function zoomScaled(px: number | ExpressionSpecification, stops: [number, number][]): ExpressionSpecification {
  const flat: (number | ExpressionSpecification)[] = [];
  for (const [z, k] of stops) flat.push(z, ["*", k, px] as unknown as ExpressionSpecification);
  return ["interpolate", ["linear"], ["zoom"], ...flat] as unknown as ExpressionSpecification;
}

const ROAD_ZOOM: [number, number][] = [[4, 0.7], [8, 1], [12, 1.6], [15, 2.6]];
const HALO_ZOOM: [number, number][] = [[4, 0.5], [8, 0.8], [12, 1], [15, 1.4]];
const DOT_ZOOM: [number, number][] = [[4, 0.8], [10, 1], [14, 1.5]];

export interface StyleInput {
  tone: MapTone;
  locale: MapLocale;
  /** Absolute origin, e.g. "https://sadaksmriti.org": the worker needs absolute URLs. */
  origin: string;
  risk: Record<string, number>;
  selected?: string;
  /** Initial highway GeoJSON, fetched once by the component. */
  highways: GeoJSON.FeatureCollection | string;
  crashes: GeoJSON.FeatureCollection;
  latest: GeoJSON.FeatureCollection;
}

const ATTRIBUTION =
  'Boundaries: <a href="https://github.com/okfnepal/localboundaries" target="_blank" rel="noopener">Survey Department via Open Knowledge Nepal</a> (CC BY 4.0) · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';

export function buildStyle(input: StyleInput): StyleSpecification {
  const { tone, locale, origin, risk, selected } = input;
  const P = PALETTES[tone];
  const C = COLOURS[tone];

  const base = protomapsLayers("basemap", flavorFor(tone), { lang: locale }).filter(
    (l) => !("source-layer" in l) || (l["source-layer"] !== "boundaries" && l["source-layer"] !== "pois"),
  );
  // No sprite sheet: place labels are type only, so drop the icon the Protomaps style asks for.
  for (const l of base) {
    if (l.type === "symbol" && l.layout) {
      for (const k of Object.keys(l.layout)) if (k.startsWith("icon-")) delete (l.layout as Record<string, unknown>)[k];
    }
  }
  // Only Latin and Devanagari names: other scripts (Urdu, Tibetan, Chinese) sit outside our glyph files.
  // The Protomaps layers mix the old filter syntax and expressions; a combined filter must use one of them.
  const scriptExpr = ["any", ["!", ["has", "script"]], ["==", ["get", "script"], "Latin"], ["==", ["get", "script"], "Devanagari"]];
  const scriptLegacy = ["any", ["!has", "script"], ["==", "script", "Latin"], ["==", "script", "Devanagari"]];
  for (const l of base) {
    if (l.type !== "symbol") continue;
    const f = l.filter as unknown;
    const isExpression = f !== undefined && /"(get|literal|zoom|has|case|match|coalesce)"/.test(JSON.stringify(f)) && !/"!has"/.test(JSON.stringify(f));
    (l as { filter?: unknown }).filter = f === undefined ? scriptExpr : ["all", f, isExpression ? scriptExpr : scriptLegacy];
  }
  const isLabel = (l: LayerSpecification) => l.type === "symbol";
  const groundLayers = base.filter((l) => !isLabel(l));
  const labelLayers = base.filter(isLabel);

  const colourTable: Record<string, string> = {};
  const widthTable: Record<string, number> = {};
  for (const [ref, step] of Object.entries(risk)) {
    const s = Math.max(0, Math.min(3, step));
    colourTable[ref] = P.risk[s as 0 | 1 | 2 | 3];
    widthTable[ref] = riskWidth(s);
  }
  const lineColour = byRef(colourTable, P.risk[0]);
  const lineWidth = zoomScaled(byRef(widthTable, riskWidth(0)), ROAD_ZOOM);
  const isSelected: ExpressionSpecification = ["==", ["get", "ref"], selected ?? ""];

  const dotRadius = ["+", 3, ["*", 2.6, ["sqrt", ["get", "killed"]]]] as unknown as ExpressionSpecification;
  const font = ["Noto Sans Medium"];

  const ours: LayerSpecification[] = [
    { id: "sk-mask", type: "fill", source: "mask", paint: { "fill-color": C.ground, "fill-opacity": 1 } },
    {
      id: LAYER.districts,
      type: "line",
      source: "districts",
      minzoom: 6.5,
      paint: {
        "line-color": C.district,
        "line-width": 1,
        "line-dasharray": [3, 3],
      },
    },
    {
      id: LAYER.provinces,
      type: "line",
      source: "provinces",
      paint: { "line-color": C.province, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 9, 1.2] },
    },
    {
      id: "sk-border",
      type: "line",
      source: "border",
      layout: { "line-join": "round" },
      paint: { "line-color": P.edge, "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 10, 2.5] },
    },
    {
      id: LAYER.highwaysBase,
      type: "line",
      source: "highways",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": lineColour,
        "line-width": lineWidth,
        "line-opacity": selected ? ["case", isSelected, 0, DIMMED_OPACITY] : 1,
      },
    },
    {
      id: LAYER.highwaysHalo,
      type: "line",
      source: "highways",
      filter: isSelected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": P.halo, "line-width": zoomScaled(HALO_WIDTH, HALO_ZOOM) },
    },
    {
      id: LAYER.highwaysSelected,
      type: "line",
      source: "highways",
      filter: isSelected,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": P.selected, "line-width": zoomScaled(SELECTED_WIDTH, [[4, 0.6], [8, 0.9], [12, 1.2], [15, 1.8]]) },
    },
    {
      // Wide invisible line so thin highways are easy to hit with a finger.
      id: LAYER.highwayHit,
      type: "line",
      source: "highways",
      layout: { "line-cap": "round" },
      paint: { "line-color": "#000", "line-opacity": 0, "line-width": 18 },
    },
    {
      id: LAYER.highwayLabels,
      type: "symbol",
      source: "highways",
      minzoom: 7.5,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "ref"],
        "text-font": font,
        "text-size": 11,
        "text-letter-spacing": 0.06,
        "symbol-spacing": 420,
        "text-padding": 4,
      },
      paint: { "text-color": C.label, "text-halo-color": C.land, "text-halo-width": 2 },
    },
    {
      id: "sk-latest-outer",
      type: "circle",
      source: "latest",
      paint: { "circle-radius": 34, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": P.dot, "circle-stroke-width": 1.5, "circle-stroke-opacity": 0.3 },
    },
    {
      id: "sk-latest-inner",
      type: "circle",
      source: "latest",
      paint: { "circle-radius": 22, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": P.dot, "circle-stroke-width": 1.5, "circle-stroke-opacity": 0.7 },
    },
    {
      // Approximate place: hollow ring, 2 px stroke (README "Crash dots").
      id: LAYER.crashesApprox,
      type: "circle",
      source: "crashes",
      filter: ["!=", ["get", "precise"], true],
      paint: {
        "circle-radius": zoomScaled(dotRadius, DOT_ZOOM),
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": P.dot,
        "circle-stroke-width": 2,
        "circle-opacity": 0.92,
      },
    },
    {
      // Exact place: filled, 1.5 px ground-colour stroke.
      id: LAYER.crashes,
      type: "circle",
      source: "crashes",
      filter: ["==", ["get", "precise"], true],
      paint: {
        "circle-radius": zoomScaled(dotRadius, DOT_ZOOM),
        "circle-color": P.dot,
        "circle-stroke-color": P.dotStroke,
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.92,
      },
    },
  ];

  const origin_ = origin.replace(/\/$/, "");
  const tilesOrigin = (process.env.NEXT_PUBLIC_TILES_ORIGIN || origin_).replace(/\/$/, "");
  return {
    version: 8,
    glyphs: `${origin_}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      basemap: {
        type: "vector",
        url: `pmtiles://${tilesOrigin}/tiles/nepal-basemap.pmtiles`,
        attribution: ATTRIBUTION,
      },
      mask: { type: "geojson", data: `${origin_}/map/mask.geojson` },
      border: { type: "geojson", data: `${origin_}/map/nepal.geojson` },
      provinces: { type: "geojson", data: `${origin_}/map/provinces.geojson` },
      districts: { type: "geojson", data: `${origin_}/map/districts.geojson` },
      highways: { type: "geojson", data: input.highways },
      crashes: { type: "geojson", data: input.crashes },
      latest: { type: "geojson", data: input.latest },
    },
    layers: [
      ...groundLayers,
      ...labelLayers,
      ...ours,
    ],
  };
}
