#!/bin/sh
set -eu

PI_VERSION="${PI_VERSION:-0.84.1}"
FORK_REF=""
CHECK_ONLY=0
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

usage() {
	printf '%s\n' "Usage: $0 --ref <commit> [--check] [--opencode-key-stdin]" >&2
	exit 2
}

READ_OPENCODE_KEY=0
while [ "$#" -gt 0 ]; do
	case "$1" in
		--ref)
			[ "$#" -ge 2 ] || usage
			FORK_REF=$2
			shift 2
			;;
		--check)
			CHECK_ONLY=1
			shift
			;;
		--opencode-key-stdin)
			READ_OPENCODE_KEY=1
			shift
			;;
		*) usage ;;
	esac
done

[ -n "$FORK_REF" ] || usage
command -v node >/dev/null 2>&1 || { printf '%s\n' "Node.js is required" >&2; exit 1; }

if [ "$CHECK_ONLY" -eq 1 ]; then
	node "$SCRIPT_DIR/univers-profile.mjs" --ref "$FORK_REF" --check
	exit
fi

command -v npm >/dev/null 2>&1 || { printf '%s\n' "npm is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { printf '%s\n' "curl is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { printf '%s\n' "sha256sum is required" >&2; exit 1; }
[ -f "$HOME/.codex/auth.json" ] || { printf '%s\n' "Workbench Codex auth is missing" >&2; exit 1; }
OPENCODE_KEY=""
if [ "$READ_OPENCODE_KEY" -eq 1 ]; then
	IFS= read -r OPENCODE_KEY || [ -n "$OPENCODE_KEY" ]
	[ -n "$OPENCODE_KEY" ] || { printf '%s\n' "OpenCode Go key is empty" >&2; exit 1; }
fi

mkdir -p "$HOME/.local/bin"
PI_BIN="$HOME/.local/bin/pi"
if [ ! -x "$PI_BIN" ] || [ "$("$PI_BIN" --version 2>/dev/null || true)" != "$PI_VERSION" ]; then
	npm install --global --prefix "$HOME/.local" "@earendil-works/pi-coding-agent@$PI_VERSION"
fi

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT HUP INT TERM
RELEASE_URL="https://github.com/hsudatalks/pi-extensions/releases/download/univers-$FORK_REF"
curl -fsSL "$RELEASE_URL/pi-goal.tgz" -o "$TEMP_DIR/pi-goal.tgz"
curl -fsSL "$RELEASE_URL/pi-subagents.tgz" -o "$TEMP_DIR/pi-subagents.tgz"
curl -fsSL "$RELEASE_URL/SHA256SUMS" -o "$TEMP_DIR/SHA256SUMS"
(cd "$TEMP_DIR" && sha256sum -c SHA256SUMS)

UNIVERS_ROOT="$HOME/.pi/agent/univers"
mkdir -p "$UNIVERS_ROOT"
npm install --prefix "$UNIVERS_ROOT" --legacy-peer-deps \
	"$TEMP_DIR/pi-goal.tgz" \
	"$TEMP_DIR/pi-subagents.tgz"
[ -f "$UNIVERS_ROOT/node_modules/@narumitw/pi-goal/src/index.ts" ]
[ -f "$UNIVERS_ROOT/node_modules/@narumitw/pi-subagents/src/index.ts" ]
if [ "$READ_OPENCODE_KEY" -eq 1 ]; then
	printf '%s' "$OPENCODE_KEY" | node "$SCRIPT_DIR/univers-profile.mjs" \
		--ref "$FORK_REF" \
		--opencode-key-stdin
else
	node "$SCRIPT_DIR/univers-profile.mjs" --ref "$FORK_REF"
fi
OPENCODE_KEY=""

node "$SCRIPT_DIR/univers-profile.mjs" --ref "$FORK_REF" --check
"$PI_BIN" auth print-bearer-token --provider openai-codex >/dev/null
"$PI_BIN" --list-models gpt-5.6 | grep -q 'openai-codex.*gpt-5.6-luna'
"$PI_BIN" --list-models gpt-5.6 | grep -q 'openai-codex.*gpt-5.6-sol'
"$PI_BIN" --list-models deepseek-v4-flash | grep -q 'opencode-go.*deepseek-v4-flash'
rm -rf "$HOME/.pi/agent/git/github.com/hsudatalks/pi-extensions"
printf '%s\n' "Univers Pi profile ready: pi=$PI_VERSION ref=$FORK_REF"
