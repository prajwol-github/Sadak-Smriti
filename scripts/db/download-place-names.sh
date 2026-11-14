#!/usr/bin/env bash
# Downloads Nepali and English names of provinces, districts and local units into data/raw/names/
# (git-ignored). Run with: pnpm db:places:download
#
# Source: sagautam5/local-states-nepal, MIT licence, (c) 2020 Sagar Gautam. Pinned to a commit so
# an import gives the same names every time. See docs/adr/0002-map-sources.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/data/raw/names"
COMMIT="035cb3d2ce2420ad04d7aac1d0ce4d08960c57f0"
BASE="https://raw.githubusercontent.com/sagautam5/local-states-nepal/$COMMIT/dataset"
UA="sadak-smriti-data-build/0.1 (open road-safety memorial project)"

mkdir -p "$OUT"
for kind in provinces districts municipalities categories; do
  for lang in en np; do
    curl -fsSL -A "$UA" "$BASE/$kind/$lang.json" -o "$OUT/$kind.$lang.json"
  done
done
curl -fsSL -A "$UA" "https://raw.githubusercontent.com/sagautam5/local-states-nepal/$COMMIT/LICENSE" -o "$OUT/LICENSE"
echo "Place names @ ${COMMIT:0:7} saved to data/raw/names/"
