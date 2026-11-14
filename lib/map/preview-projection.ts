/**
 * The projection for the static map preview on the home page (SPEC 6.2: no map JavaScript there).
 * Shared by scripts/map/build-map-data.ts, which draws public/map/preview.svg, and by the
 * component that places crash dots on top, so the two always line up.
 *
 * Equirectangular, with longitude scaled by cos(28.3°), Nepal's middle latitude. At this size
 * the distortion across Nepal is far below a pixel.
 */
export const PREVIEW_BOUNDS = { west: 79.95, east: 88.3, south: 26.3, north: 30.55 } as const;

const UNITS_PER_DEGREE = 100;
const LON_SCALE = Math.cos((28.3 * Math.PI) / 180);

export const PREVIEW_WIDTH = Math.round((PREVIEW_BOUNDS.east - PREVIEW_BOUNDS.west) * LON_SCALE * UNITS_PER_DEGREE);
export const PREVIEW_HEIGHT = Math.round((PREVIEW_BOUNDS.north - PREVIEW_BOUNDS.south) * UNITS_PER_DEGREE);

/**
 * Screen pixels per viewBox unit for a map cropped to `spanLon` degrees of longitude and shown
 * `widthPx` wide. Crash dots, line widths and labels are sized in screen pixels, so a cropped map
 * needs this to avoid giant dots (see StaticMap `pxPerUnit`).
 */
export function pxPerUnitForSpan(spanLon: number, widthPx: number): number {
  return widthPx / (spanLon * LON_SCALE * UNITS_PER_DEGREE);
}

/** [lon, lat] to [x, y] in the preview's viewBox units, rounded to 0.1. */
export function project(lon: number, lat: number): [number, number] {
  const x = (lon - PREVIEW_BOUNDS.west) * LON_SCALE * UNITS_PER_DEGREE;
  const y = (PREVIEW_BOUNDS.north - lat) * UNITS_PER_DEGREE;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}
