import type { LiveMapText } from "@/components/map/live-map";

/** The strings the interactive map needs, from the "Map" message namespace (server side). */
export function liveMapText(t: (key: string) => string): LiveMapText {
  return {
    zoomIn: t("zoomIn"),
    zoomOut: t("zoomOut"),
    locate: t("locate"),
    layers: t("layers"),
    expand: t("expand"),
    fullscreen: t("expand"),
    loading: t("loading"),
    failed: t("failed"),
    layerHighways: t("layerHighways"),
    layerCrashes: t("layerCrashes"),
    layerDistricts: t("layerDistricts"),
    gestureHint: t("gestureHint"),
  };
}
