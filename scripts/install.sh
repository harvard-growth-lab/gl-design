#!/usr/bin/env bash
# install.sh — fallback installer for the Growth Lab design kit (non-plugin path).
#
# Preferred install is the Claude Code plugin:
#     claude plugin marketplace add <this-repo>
#     claude plugin install gl-design
#
# Use THIS script if you are not on the plugin system. It:
#   1. symlinks every skill in skills/ into ~/.claude/skills/
#   2. copies the bundled fonts into your user font dir (so the PDF/slide paths find them)
#   3. runs doctor.sh to report any remaining system dependencies (it does NOT install them)
#
# It does not touch system package managers — by design. Run doctor.sh's printed
# commands yourself for pandoc / Chromium / R, etc.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DST="${HOME}/.claude/skills"

echo "Growth Lab design kit — symlink install"
echo "  source: $ROOT"
echo

# ---- 1. skills --------------------------------------------------------------
mkdir -p "$SKILLS_DST"
for skill in "$ROOT"/skills/*/; do
  name="$(basename "$skill")"
  link="$SKILLS_DST/$name"
  if [ -L "$link" ] || [ -e "$link" ]; then
    target="$(readlink "$link" 2>/dev/null || true)"
    if [ "$target" = "${skill%/}" ]; then
      echo "  = $name (already linked here)"
      continue
    fi
    echo "  ! $name already exists at $link → $target"
    echo "    skipping; remove it first if you want this repo's copy."
    continue
  fi
  ln -s "${skill%/}" "$link"
  echo "  + $name → $link"
done

# ---- 2. fonts ---------------------------------------------------------------
echo
bash "$ROOT/scripts/install-fonts.sh"

# ---- 3. doctor --------------------------------------------------------------
echo
bash "$ROOT/scripts/doctor.sh" || {
  echo "Some system dependencies are missing — see the ✗ items above."
  exit 0   # symlink + fonts succeeded; system deps are the user's to install
}
