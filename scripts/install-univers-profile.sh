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
[ -f "$HOME/.codex/auth.json" ] || { printf '%s\n' "Workbench Codex auth is missing" >&2; exit 1; }
[ "$READ_OPENCODE_KEY" -eq 1 ] || usage

OPENCODE_KEY=""
IFS= read -r OPENCODE_KEY || [ -n "$OPENCODE_KEY" ]
[ -n "$OPENCODE_KEY" ] || { printf '%s\n' "OpenCode Go key is empty" >&2; exit 1; }

mkdir -p "$HOME/.local/bin"
npm install --global --prefix "$HOME/.local" "@earendil-works/pi-coding-agent@$PI_VERSION"
PI_BIN="$HOME/.local/bin/pi"
"$PI_BIN" install "git:github.com/hsudatalks/pi-extensions@$FORK_REF"
printf '%s' "$OPENCODE_KEY" | node "$SCRIPT_DIR/univers-profile.mjs" \
	--ref "$FORK_REF" \
	--opencode-key-stdin
OPENCODE_KEY=""

node "$SCRIPT_DIR/univers-profile.mjs" --ref "$FORK_REF" --check
"$PI_BIN" auth print-bearer-token --provider openai-codex >/dev/null
"$PI_BIN" --list-models gpt-5.6 | grep -q 'openai-codex.*gpt-5.6-luna'
"$PI_BIN" --list-models gpt-5.6 | grep -q 'openai-codex.*gpt-5.6-sol'
"$PI_BIN" --list-models deepseek-v4-flash | grep -q 'opencode-go.*deepseek-v4-flash'
printf '%s\n' "Univers Pi profile ready: pi=$PI_VERSION ref=$FORK_REF"
