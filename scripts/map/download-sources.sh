#!/usr/bin/env bash
# Downloads the raw inputs for the Nepal map into data/raw/ (git-ignored).
# Run with: pnpm map:download   (needs curl and Docker)
#
# Sources and licences (see docs/adr/0002-map-sources.md):
#   - Boundaries: Open Knowledge Nepal "localboundaries", CC BY 4.0, republished from the
#     Survey Department. Follows the official 2020 map (Lipulekh, Kalapani, Limpiyadhura in Nepal).
#   - National highways: OpenStreetMap via Overpass, ODbL.
#   - Basemap tiles: Protomaps daily build (OpenStreetMap data, ODbL), cut to Nepal's bounding box.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RAW="$ROOT/data/raw"
mkdir -p "$RAW/okfn" "$RAW/osm" "$ROOT/public/tiles"

# Pinned so a rebuild gives the same boundaries. Bump deliberately and re-check the Lipulekh test.
OKFN_COMMIT="54f496a289670ab4fd781d8191c12a0f4cad7c15"
OKFN_BASE="https://raw.githubusercontent.com/okfnepal/localboundaries/$OKFN_COMMIT/source"

# Protomaps build to extract from. List builds: https://build-metadata.protomaps.dev/builds.json
PROTOMAPS_BUILD="${PROTOMAPS_BUILD:-20261112}"
# Nepal's bounding box (official map) with a small margin; west,south,east,north.
BBOX="79.9,26.2,88.35,30.6"
MAXZOOM="${MAXZOOM:-14}"

UA="sadak-smriti-map-build/0.1 (+https://github.com/; open road-safety memorial project)"

echo "1/3 Boundaries (Open Knowledge Nepal @ ${OKFN_COMMIT:0:7})"
curl -fsSL -A "$UA" "$OKFN_BASE/province.geojson"     -o "$RAW/okfn/province.geojson"
curl -fsSL -A "$UA" "$OKFN_BASE/municipality.geojson" -o "$RAW/okfn/municipality.geojson"

echo "2/3 National highways (OpenStreetMap via Overpass)"
QUERY='[out:json][timeout:240];area["ISO3166-1"="NP"][admin_level=2]->.np;(way(area.np)["highway"]["ref"~"^ *NH"];);out tags geom;'
curl -fsS -A "$UA" --data-urlencode "data=$QUERY" https://overpass-api.de/api/interpreter -o "$RAW/osm/nh_ways.json"

echo "2b/3 Kathmandu Valley streets for the faded city layer (OpenStreetMap via Overpass)"
CITY_QUERY='[out:json][timeout:180];(way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential)$"](27.60,85.20,27.80,85.50););out geom;'
curl -fsS -A "$UA" --data-urlencode "data=$CITY_QUERY" https://overpass-api.de/api/interpreter -o "$RAW/osm/kathmandu_streets.json"

echo "3/3 Basemap tiles (Protomaps $PROTOMAPS_BUILD, z0-$MAXZOOM)"
docker run --rm -v "$ROOT/public/tiles:/out" protomaps/go-pmtiles:v1.31.2 \
  extract "https://build.protomaps.com/$PROTOMAPS_BUILD.pmtiles" /out/nepal-basemap.pmtiles \
  --bbox="$BBOX" --maxzoom="$MAXZOOM"

echo "Done. Next: pnpm map:build"
