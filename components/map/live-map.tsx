"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, LngLatBoundsLike, Map as MlMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { LayersIcon, LocateIcon, MaximizeIcon, MinusIcon, PlusIcon } from "@/components/site/icons";
import { LAYER, LAYER_GROUPS, buildStyle, type LayerGroup, type MapLocale } from "@/lib/map/live-style";
import { DIMMED_OPACITY, PALETTES, type MapTone } from "@/lib/map/style";

export interface LiveDot {
  key: string;
  lon: number;
  lat: number;
  killed: number;
  precise: boolean;
  /** Shown in the tooltip when the dot is hovered or focused. */
  label?: string;
}

export interface LiveMapText {
  zoomIn: string;
  zoomOut: string;
  locate: string;
  layers: string;
  expand: string;
  fullscreen: string;
  loading: string;
  failed: string;
  layerHighways: string;
  layerCrashes: string;
  layerDistricts: string;
  gestureHint: string;
}

/** Where the map opens. */
export type LiveView =
  | { kind: "country"; padding?: number | { top: number; right: number; bottom: number; left: number } }
  | { kind: "highway"; ref: string; padding?: number }
  | { kind: "point"; lon: number; lat: number; zoom: number };

export interface LiveMapProps {
  tone: MapTone;
  locale: MapLocale;
  view: LiveView;
  dots?: LiveDot[];
  /** Highway ref → risk step 0-3. */
  risk?: Record<string, number>;
  /** Highway to draw as selected (6 px line, halo; the others fade). */
  selected?: string;
  latest?: { lon: number; lat: number };
  /** Red chip beside the latest crash ("14 KILLED"). */
  tag?: { lon: number; lat: number; text: string };
  /** A click on a dot opens `${dotPath}/${key}` (for example "/crash"). Omit for dots that do nothing. */
  dotPath?: string;
  /** Highways that have a page: a click opens `/highway/${ref}`. */
  highwayLinks?: string[];
  /** Zoom rail: none, "+ −" only, or the full five buttons. */
  rail?: "none" | "compact" | "full";
  /** Classes that place the rail inside the map box. */
  railClassName?: string;
  /** Full rail: the expand button links here (home hero). Without it, it toggles full screen. */
  expandHref?: string;
  /** Ask for two fingers to pan on touch screens, so the page can still scroll past the map. */
  cooperativeGestures?: boolean;
  /** The server-drawn static map. Shown until the live map is drawn, and kept if it cannot start. */
  children?: ReactNode;
  text: LiveMapText;
  className?: string;
}

const COUNTRY: LngLatBoundsLike = [
  [80.0, 26.3],
  [88.25, 30.5],
];
// Wide on purpose: a tighter box makes MapLibre re-centre the view and clip the country on wide screens.
const MAX_BOUNDS: LngLatBoundsLike = [
  [72.0, 20.0],
  [96.0, 38.0],
];

function dotCollection(dots: LiveDot[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: dots.map((d) => ({
      type: "Feature",
      properties: { key: d.key, killed: d.killed, precise: d.precise, label: d.label ?? "" },
      geometry: { type: "Point", coordinates: [d.lon, d.lat] },
    })),
  };
}

function pointCollection(p?: { lon: number; lat: number }): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: p ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lon, p.lat] } }] : [],
  };
}

/** Bounding box of one highway's lines, from the highways GeoJSON. */
function highwayBounds(fc: GeoJSON.FeatureCollection, ref: string): [[number, number], [number, number]] | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const f of fc.features) {
    if ((f.properties as { ref?: string } | null)?.ref !== ref) continue;
    const g = f.geometry;
    const lines: GeoJSON.Position[][] = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const line of lines) {
      for (const [x, y] of line) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
    }
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

let highwayCache: Promise<GeoJSON.FeatureCollection> | null = null;
function loadHighways(): Promise<GeoJSON.FeatureCollection> {
  highwayCache ??= fetch("/map/highways.geojson").then((r) => {
    if (!r.ok) throw new Error(`highways ${r.status}`);
    return r.json() as Promise<GeoJSON.FeatureCollection>;
  });
  highwayCache.catch(() => {
    highwayCache = null;
  });
  return highwayCache;
}

let protocolReady = false;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The interactive map: our PMTiles basemap in the Modernist palette, the official border, the
 * national highways coloured by risk, crash dots, and a working zoom rail. It starts only when its
 * box is visible and on screen, so hidden phone/desktop twins and off-screen maps cost nothing.
 * The static SVG passed as `children` stays underneath as the no-JavaScript and failure fallback.
 */
export function LiveMap(props: LiveMapProps) {
  const {
    tone, locale, view, dots = [], risk = {}, selected, latest, tag, dotPath, highwayLinks,
    rail = "none", railClassName = "", expandHref, cooperativeGestures = false, children, text, className = "",
  } = props;

  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [layersOpen, setLayersOpen] = useState(false);
  const [visible, setVisible] = useState<Record<LayerGroup, boolean>>({ highways: true, crashes: true, districts: true });

  // Latest props for handlers that outlive a render.
  const live = useRef({ dotPath, highwayLinks, router });
  useEffect(() => {
    live.current = { dotPath, highwayLinks, router };
  });

  const dataKey = JSON.stringify([dots, latest, selected]);
  const initial = useRef({ text, dots, latest, selected, risk, view, tag, tone, locale, cooperativeGestures });

  // Start the map once its box has a size and is near the screen.
  const [start, setStart] = useState(false);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let sized = el.clientWidth > 0 && el.clientHeight > 0;
    let near = false;
    const check = () => {
      if (sized && near) setStart(true);
    };
    const ro = new ResizeObserver(() => {
      sized = el.clientWidth > 0 && el.clientHeight > 0;
      check();
    });
    const io = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        check();
      },
      { rootMargin: "300px" },
    );
    ro.observe(el);
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!start || !canvasRef.current) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let tagMarker: Marker | null = null;
    let popup: Popup | null = null;
    setState("loading");

    (async () => {
      try {
        const [ml, { Protocol }, highways] = await Promise.all([import("maplibre-gl"), import("pmtiles"), loadHighways()]);
        if (cancelled || !canvasRef.current) return;
        if (!protocolReady) {
          // The bundler does not find MapLibre's worker on its own; give it the packaged file as an asset.
          ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
          ml.addProtocol("pmtiles", new Protocol().tile);
          protocolReady = true;
        }
        const i = initial.current;
        const { text } = i;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const style = buildStyle({
          tone: i.tone,
          locale: i.locale,
          origin: window.location.origin,
          risk: i.risk,
          selected: i.selected,
          highways,
          crashes: dotCollection(i.dots),
          latest: pointCollection(i.latest),
        });

        const opts: ConstructorParameters<typeof ml.Map>[0] = {
          container: canvasRef.current,
          style,
          minZoom: 4,
          maxZoom: 17.5,
          maxBounds: MAX_BOUNDS,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: i.cooperativeGestures,
          fadeDuration: reduce ? 0 : 250,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": text.gestureHint,
            "CooperativeGesturesHandler.MacHelpText": text.gestureHint,
            "CooperativeGesturesHandler.MobileHelpText": text.gestureHint,
          },
        };
        if (i.view.kind === "point") {
          opts.center = [i.view.lon, i.view.lat];
          opts.zoom = i.view.zoom;
        } else if (i.view.kind === "highway") {
          opts.bounds = highwayBounds(highways, i.view.ref) ?? COUNTRY;
          opts.fitBoundsOptions = { padding: i.view.padding ?? 48, maxZoom: 12 };
        } else {
          opts.bounds = COUNTRY;
          opts.fitBoundsOptions = { padding: i.view.padding ?? 24 };
        }
        map = new ml.Map(opts);
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        // Small boxes get the collapsed (i) button; big ones show the credit line.
        map.addControl(new ml.AttributionControl({ compact: canvasRef.current.clientWidth < 700 }), "bottom-right");

        map.on("error", (e) => {
          const id = (e as { sourceId?: string }).sourceId;
          if (id === "basemap" && !cancelled) setState("failed");
        });
        map.once("idle", () => {
          if (!cancelled) setState((s) => (s === "failed" ? s : "ready"));
        });

        const canvas = map.getCanvas();
        // Clicks on dots and highways; dots win where both overlap.
        map.on("click", (e) => {
          if (!map) return;
          const hit = (ids: string[]) => map!.queryRenderedFeatures(e.point, { layers: ids.filter((id) => map!.getLayer(id)) })[0];
          const dot = hit([LAYER.crashes, LAYER.crashesApprox]);
          const { dotPath: path, highwayLinks: links, router: r } = live.current;
          if (dot && path) {
            r.push(`${path}/${String(dot.properties?.key)}` as never);
            return;
          }
          const ref = String(hit([LAYER.highwayHit])?.properties?.ref ?? "");
          if (ref && links?.includes(ref)) r.push(`/highway/${ref}` as never);
        });
        for (const id of [LAYER.crashes, LAYER.crashesApprox]) {
          map.on("mousemove", id, (e) => {
            const f = e.features?.[0];
            if (!f || !map) return;
            canvas.style.cursor = live.current.dotPath ? "pointer" : "";
            const label = String(f.properties?.label ?? "");
            if (!label) return;
            popup ??= new ml.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "sk-popup" });
            const node = document.createElement("span");
            node.textContent = label;
            popup.setLngLat(e.lngLat).setDOMContent(node).addTo(map);
          });
          map.on("mouseleave", id, () => {
            canvas.style.cursor = "";
            popup?.remove();
          });
        }
        map.on("mousemove", LAYER.highwayHit, (e) => {
          const ref = e.features?.[0]?.properties?.ref;
          if (!popup?.isOpen() && ref && live.current.highwayLinks?.includes(String(ref))) canvas.style.cursor = "pointer";
        });
        map.on("mouseleave", LAYER.highwayHit, () => {
          canvas.style.cursor = "";
        });

        if (i.tag) {
          const P = PALETTES[i.tone];
          const el = document.createElement("div");
          el.textContent = i.tag.text;
          el.style.cssText = `background:${P.tagBg};color:${P.tagFg};font:800 11px/20px var(--font-sans, sans-serif);letter-spacing:.04em;padding:0 8px;pointer-events:none`;
          tagMarker = new ml.Marker({ element: el, anchor: "left", offset: [28, 8] }).setLngLat([i.tag.lon, i.tag.lat]).addTo(map);
        }
      } catch {
        if (!cancelled) setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      popup?.remove();
      tagMarker?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, [start]);

  // Props that change after the map exists: dots, latest crash, selected highway.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== "ready") return;
    (map.getSource("crashes") as GeoJSONSource | undefined)?.setData(dotCollection(dots));
    (map.getSource("latest") as GeoJSONSource | undefined)?.setData(pointCollection(latest));
    const filter = ["==", ["get", "ref"], selected ?? ""] as never;
    map.setFilter(LAYER.highwaysHalo, filter);
    map.setFilter(LAYER.highwaysSelected, filter);
    map.setPaintProperty(LAYER.highwaysBase, "line-opacity", selected ? (["case", filter, 0, DIMMED_OPACITY] as never) : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, state]);

  const zoomBy = useCallback((delta: number) => {
    const m = mapRef.current;
    if (m) m.easeTo({ zoom: m.getZoom() + delta, duration: prefersReducedMotion() ? 0 : 250 });
  }, []);
  const locate = useCallback(() => {
    const m = mapRef.current;
    if (!m || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        m.flyTo({ center: [longitude, latitude], zoom: Math.max(m.getZoom(), 11), duration: prefersReducedMotion() ? 0 : 1200 });
      },
      () => {},
      { maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);
  const fullscreen = useCallback(() => {
    const el = wrapRef.current?.parentElement ?? wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);
  const toggleGroup = useCallback((g: LayerGroup) => {
    setVisible((v) => {
      const next = !v[g];
      const m = mapRef.current;
      if (m) for (const id of LAYER_GROUPS[g]) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", next ? "visible" : "none");
      return { ...v, [g]: next };
    });
  }, []);

  const ready = state === "ready";
  const ink = tone === "ink";
  const btn = `flex size-12 items-center justify-center border-b last:border-b-0 disabled:cursor-wait disabled:opacity-50 ${
    ink ? "border-neutral-800 hover:bg-neutral-800" : "border-ink/20 hover:bg-neutral-200"
  }`;
  const compactBtn = "!size-11";

  const btnClass = (red?: boolean) => `${btn} ${rail === "compact" ? compactBtn : ""} ${red ? (ink ? "!bg-accent-500 !text-ink" : "!bg-accent-600 !text-bg") : ""}`;

  return (
    <div ref={wrapRef} className={`relative size-full overflow-hidden ${className}`}>
      {/* Static map: first paint, no-JavaScript view, and the fallback if the live map cannot start. */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${ready ? "opacity-0" : "opacity-100"}`} aria-hidden={ready}>
        {children}
      </div>

      {/* MapLibre adds its own classes to its container, so React must never re-render this div's className. */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
        <div ref={canvasRef} className="h-full w-full" aria-label={text.layerHighways} role="application" />
      </div>

      {state === "loading" && (
        <p role="status" className={`absolute bottom-3 left-3 z-10 px-2 py-1 text-meta font-semibold ${ink ? "bg-ink/80 text-neutral-300" : "bg-bg text-neutral-700"}`}>
          {text.loading}
        </p>
      )}
      {state === "failed" && (
        <p role="status" className={`absolute bottom-3 left-3 z-10 max-w-[80%] px-2 py-1 text-meta font-semibold ${ink ? "bg-ink/90 text-bg" : "bg-bg text-ink"}`}>
          {text.failed}
        </p>
      )}

      {rail !== "none" && (
        <div className={`z-20 ${railClassName}`}>
          <div
            role="group"
            aria-label={text.layers}
            className={`flex flex-col ${ink ? "border border-neutral-700 bg-ink/90 text-bg" : "border-2 border-ink bg-bg text-ink"}`}
          >
            <button type="button" aria-label={text.zoomIn} title={text.zoomIn} disabled={!ready} onClick={() => zoomBy(1)} className={btnClass()}>
              <PlusIcon />
            </button>
            <button type="button" aria-label={text.zoomOut} title={text.zoomOut} disabled={!ready} onClick={() => zoomBy(-1)} className={btnClass()}>
              <MinusIcon />
            </button>
            {rail === "full" && (
              <>
                <button type="button" aria-label={text.locate} title={text.locate} disabled={!ready} onClick={() => locate()} className={btnClass()}>
                  <LocateIcon />
                </button>
                <button
                  type="button"
                  aria-label={text.layers}
                  title={text.layers}
                  aria-expanded={layersOpen}
                  disabled={!ready}
                  onClick={() => setLayersOpen((o) => !o)}
                  className={btnClass()}
                >
                  <LayersIcon />
                </button>
                {expandHref ? (
                  <Link href={expandHref as never} aria-label={text.expand} title={text.expand} className={`${btnClass(true)} no-underline`}>
                    <MaximizeIcon />
                  </Link>
                ) : (
                  <button type="button" aria-label={text.fullscreen} title={text.fullscreen} disabled={!ready} onClick={() => fullscreen()} className={btnClass(true)}>
                    <MaximizeIcon />
                  </button>
                )}
              </>
            )}
          </div>
          {rail === "full" && layersOpen && (
            <fieldset
              className={`absolute top-0 w-56 p-3 ${railClassName.includes("right-") ? "right-full mr-2" : "left-full ml-2"} ${
                ink ? "border border-neutral-700 bg-ink text-bg" : "border-2 border-ink bg-bg text-ink"
              }`}
            >
              <legend className="sr-only">{text.layers}</legend>
              {(
                [
                  ["highways", text.layerHighways],
                  ["crashes", text.layerCrashes],
                  ["districts", text.layerDistricts],
                ] as [LayerGroup, string][]
              ).map(([g, label]) => (
                <label key={g} className="flex min-h-11 cursor-pointer items-center gap-3 text-small font-semibold">
                  <input type="checkbox" className="size-5 accent-accent-600" checked={visible[g]} onChange={() => toggleGroup(g)} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
