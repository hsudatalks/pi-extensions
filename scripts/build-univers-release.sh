#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT=${1:-"$ROOT/dist/univers"}

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"
npm pack --workspace @narumitw/pi-goal --pack-destination "$OUTPUT" >/dev/null
npm pack --workspace @narumitw/pi-subagents --pack-destination "$OUTPUT" >/dev/null
mv "$OUTPUT"/narumitw-pi-goal-*.tgz "$OUTPUT/pi-goal.tgz"
mv "$OUTPUT"/narumitw-pi-subagents-*.tgz "$OUTPUT/pi-subagents.tgz"
(cd "$OUTPUT" && sha256sum pi-goal.tgz pi-subagents.tgz > SHA256SUMS)

du -h "$OUTPUT/pi-goal.tgz" "$OUTPUT/pi-subagents.tgz"
