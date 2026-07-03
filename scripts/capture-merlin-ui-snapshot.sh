#!/usr/bin/env bash
# Re-capture Merlin UI into reference/merlin-ui-snapshot/ (manual, intentional).
# Default Merlin path is the local Dropbox clone — NOT GitHub.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MERLIN="${MERLIN_ROOT:-$HOME/Library/CloudStorage/Dropbox-ADAPTIV/Jean-Baptiste Leonelli/DESIGN/WORK/CLAUDE/PROJECTS/MERLIN}"
DEST="$ROOT/reference/merlin-ui-snapshot"

if [[ ! -d "$MERLIN/src" ]]; then
  echo "Merlin not found at: $MERLIN" >&2
  echo "Set MERLIN_ROOT to your local Merlin checkout." >&2
  exit 1
fi

COMMIT="$(git -C "$MERLIN" rev-parse HEAD 2>/dev/null || echo unknown)"
MSG="$(git -C "$MERLIN" log -1 --format='%s' 2>/dev/null || echo unknown)"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'dist-e2e/' \
  --exclude 'playwright-report/' \
  --exclude 'test-results/' \
  --exclude 'infra/' \
  --exclude '.terraform/' \
  --exclude '.venv-deliverables/' \
  --exclude '.claude/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'Merlin keys.txt' \
  "$MERLIN/" "$DEST/"

cat > "$DEST/SNAPSHOT.md" <<EOF
# Merlin UI reference snapshot (frozen)

**This is not Merlin.** Read-only copy for Stratos UI porting.

| Field | Value |
| --- | --- |
| Captured | $DATE |
| Source commit | \`$COMMIT\` |
| Source message | \`$MSG\` |
| Source repo (historical) | \`github.com/jbleonelli/merlin\` — **do not pull or sync** |

Re-captured via \`scripts/capture-merlin-ui-snapshot.sh\`.
See \`reference/README.md\` for usage rules.
EOF

echo "Snapshot updated at $DEST"
echo "Commit: $COMMIT"
du -sh "$DEST"
