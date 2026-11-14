/**
 * Map style rules from the design handoff (README "Map style"). Shared by the static map renders
 * (home hero, small maps on inner pages) and the MapLibre full map, so they always match.
 */
export type MapTone = "ink" | "light";

export interface MapPalette {
  ground: string;
  land: string;
  edge: string;
  edgeWidth: number;
  grid: string;
  label: string;
  sub: string;
  minor: string;
  halo: string;
  /** Highway colour by risk step, lowest to highest (killed per km). */
  risk: [string, string, string, string];
  dot: string;
  dotStroke: string;
  selected: string;
  street: string;
  tagBg: string;
  tagFg: string;
}

export const PALETTES: Record<MapTone, MapPalette> = {
  ink: {
    ground: "#201e1d",
    land: "#2d2b2b",
    edge: "#7d7979",
    edgeWidth: 2,
    grid: "rgba(243,242,242,.07)",
    label: "#eae7e7",
    sub: "#9b9797",
    minor: "#605d5d",
    halo: "rgba(255,86,60,.28)",
    risk: ["#7d7979", "#ff9783", "#ff563c", "#ec3013"],
    dot: "#ff563c",
    dotStroke: "#201e1d",
    selected: "#ff563c",
    street: "rgba(243,242,242,.35)",
    tagBg: "#ec3013",
    tagFg: "#f8f4f4",
  },
  light: {
    ground: "#eae7e7",
    land: "#f8f4f4",
    edge: "#201e1d",
    edgeWidth: 2,
    grid: "rgba(32,30,29,.08)",
    label: "#201e1d",
    sub: "#605d5d",
    minor: "#bab6b6",
    halo: "rgba(236,48,19,.18)",
    risk: ["#9b9797", "#ff9783", "#ec3013", "#ae1800"],
    dot: "#ec3013",
    dotStroke: "#f8f4f4",
    selected: "#ec3013",
    street: "rgba(32,30,29,.35)",
    tagBg: "#201e1d",
    tagFg: "#f8f4f4",
  },
};

/** Line width for a highway at risk step 0-3: 2.2px plus 0.9px per step. */
export function riskWidth(step: number): number {
  return 2.2 + step * 0.9;
}

/** Selected highway: a 6px accent line over a 16px halo; other roads fade to 40%. */
export const SELECTED_WIDTH = 6;
export const HALO_WIDTH = 16;
export const DIMMED_OPACITY = 0.4;

/** Crash dot radius in px: 3 + 2.6·√killed. */
export function dotRadius(killed: number): number {
  return 3 + 2.6 * Math.sqrt(Math.max(0, killed));
}

/**
 * Risk step 0-3 from killed per km, with fixed breaks so maps stay comparable over time.
 * Breaks are provisional until real data exists (PLAN P4-01); kept here so there is one place to tune.
 */
export function riskStep(killedPerKm: number): 0 | 1 | 2 | 3 {
  if (killedPerKm >= 0.35) return 3;
  if (killedPerKm >= 0.25) return 2;
  if (killedPerKm >= 0.1) return 1;
  return 0;
}

/** Cities labelled on the overview map (real coordinates). */
export const MAP_CITIES: { en: string; ne: string; lon: number; lat: number }[] = [
  { en: "Kathmandu", ne: "काठमाडौं", lon: 85.324, lat: 27.717 },
  { en: "Pokhara", ne: "पोखरा", lon: 83.985, lat: 28.209 },
  { en: "Bharatpur", ne: "भरतपुर", lon: 84.435, lat: 27.683 },
  { en: "Hetauda", ne: "हेटौंडा", lon: 85.032, lat: 27.428 },
  { en: "Butwal", ne: "बुटवल", lon: 83.448, lat: 27.7 },
  { en: "Nepalgunj", ne: "नेपालगन्ज", lon: 81.617, lat: 28.05 },
  { en: "Dhangadhi", ne: "धनगढी", lon: 80.589, lat: 28.683 },
  { en: "Biratnagar", ne: "विराटनगर", lon: 87.283, lat: 26.455 },
  { en: "Birgunj", ne: "वीरगन्ज", lon: 84.877, lat: 27.012 },
  { en: "Janakpur", ne: "जनकपुर", lon: 85.926, lat: 26.729 },
  { en: "Surkhet", ne: "सुर्खेत", lon: 81.633, lat: 28.6 },
  { en: "Jumla", ne: "जुम्ला", lon: 82.184, lat: 29.275 },
  { en: "Dharan", ne: "धरान", lon: 87.283, lat: 26.812 },
];

export const MAP_PEAKS: { en: string; ne: string; lon: number; lat: number }[] = [
  { en: "Sagarmatha 8,849", ne: "सगरमाथा ८,८४९", lon: 86.925, lat: 27.988 },
  { en: "Annapurna", ne: "अन्नपूर्ण", lon: 83.82, lat: 28.596 },
  { en: "Dhaulagiri", ne: "धौलागिरि", lon: 83.493, lat: 28.698 },
  { en: "Kanchenjunga", ne: "कञ्चनजङ्घा", lon: 88.147, lat: 27.703 },
];
