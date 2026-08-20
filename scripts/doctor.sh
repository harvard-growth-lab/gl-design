#!/usr/bin/env bash
# doctor.sh — check that the tooling the Growth Lab design kit needs is present.
# Reports per-pipeline status and prints exact fix commands for whatever is missing.
# Does NOT install anything. Exit code 0 if all REQUIRED-by-nothing… see end.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- platform-aware install hint -------------------------------------------
case "$(uname -s)" in
  Darwin) PM="brew install" ;;
  Linux)  if command -v apt-get >/dev/null 2>&1; then PM="sudo apt-get install"
          elif command -v pacman >/dev/null 2>&1; then PM="sudo pacman -S"
          elif command -v dnf >/dev/null 2>&1; then PM="sudo dnf install"
          else PM="<your package manager> install"; fi ;;
  *)      PM="<your package manager> install" ;;
esac

green=$'\033[32m'; red=$'\033[31m'; yellow=$'\033[33m'; dim=$'\033[2m'; rst=$'\033[0m'
missing=0

ok()   { printf '  %s✓%s %s\n' "$green" "$rst" "$1"; }
bad()  { printf '  %s✗%s %s\n      %s↳ %s%s\n' "$red" "$rst" "$1" "$dim" "$2" "$rst"; missing=$((missing+1)); }
warn() { printf '  %s•%s %s\n      %s↳ %s%s\n' "$yellow" "$rst" "$1" "$dim" "$2" "$rst"; }

have() { command -v "$1" >/dev/null 2>&1; }

printf '\n%sGrowth Lab design kit — environment check%s\n' "$rst" "$rst"
printf '%sroot: %s%s\n\n' "$dim" "$ROOT" "$rst"

# ---- markdown → docx / pdf / html (pandoc path) ----------------------------
printf 'Markdown → Word / PDF / HTML (pandoc pipelines)\n'
have pandoc          && ok "pandoc"          || bad "pandoc"          "$PM pandoc"
have pandoc-crossref && ok "pandoc-crossref" || bad "pandoc-crossref" "see https://github.com/lierdakil/pandoc-crossref/releases (or 'brew install pandoc-crossref')"
# md2pdf prefers chrome-headless-shell from the puppeteer cache, then falls back
# to a system Chromium/Chrome — so check the cache too, not just PATH.
if find "$HOME/.cache/puppeteer" \( -name 'chrome-headless-shell' -o -name 'chrome' \) -type f 2>/dev/null | grep -q . \
   || have chromium || have chromium-browser || have google-chrome || have google-chrome-stable; then
  ok "headless Chromium (for PDF / slides)"
else
  bad "Chromium / Chrome (PDF rendering)" "$PM chromium  (or: npx puppeteer browsers install chrome-headless-shell)"
fi

# ---- slides (Marp) ----------------------------------------------------------
printf '\nMarkdown → slides (Marp)\n'
if have node; then ok "node ($(node --version 2>/dev/null))"; else bad "node" "$PM node  (or use nvm)"; fi
if have marp || npx --no-install @marp-team/marp-cli --version >/dev/null 2>&1; then
  ok "Marp CLI"
else
  warn "Marp CLI not found" "npm install -g @marp-team/marp-cli  (md2slides will npx it on demand)"
fi

# ---- slides (pptx) ----------------------------------------------------------
# gl-pptx needs nothing but Python: no pandoc, no Node, no Chromium, no fonts.
printf '\nAnalysis → pptx (python-pptx)\n'
# Probe candidates by actually running them: on Windows a `python3` shim exists on PATH
# that only advertises the Microsoft Store and exits 0, so `command -v` is not proof.
PY=""; PYV=""
for cand in python3 python py; do
  have "$cand" || continue
  v="$("$cand" -c 'import sys; print(sys.version.split()[0])' 2>/dev/null)"
  case "$v" in
    [0-9]*) PY="$cand"; PYV="$v"; break ;;
  esac
done
if [ -n "$PY" ]; then
  ok "python $PYV ($(command -v "$PY"))"
  "$PY" -c 'import pptx' 2>/dev/null \
    && ok "python-pptx" \
    || bad "python-pptx (gl-pptx)" "$PY -m pip install python-pptx pillow"
  "$PY" -c 'import PIL' 2>/dev/null \
    && ok "pillow (image fitting)" \
    || warn "pillow not found" "$PY -m pip install pillow  (without it images are not fitted to placeholders)"
  "$PY" -c 'import matplotlib' 2>/dev/null \
    && ok "matplotlib (gl_chart.py)" \
    || warn "matplotlib not found" "$PY -m pip install matplotlib  (only needed to draw charts in Python)"
else
  bad "python3 (gl-pptx)" "$PM python3"
fi

# ---- charts (R) -------------------------------------------------------------
printf '\nCharts (R / ggplot2)\n'
if have Rscript; then
  ok "Rscript ($(Rscript --version 2>&1 | head -1))"
  # R >= 4.1 is the real floor (theme_gl.R uses the \(x) lambda shorthand).
  rmajor=$(Rscript -e 'cat(as.character(getRversion()))' 2>/dev/null)
  if Rscript -e 'q(status = as.integer(getRversion() < "4.1"))' 2>/dev/null; then
    ok "R $rmajor (>= 4.1)"
  else
    warn "R $rmajor is below 4.1" "theme_gl.R needs R >= 4.1 (lambda syntax); upgrade R if charts error"
  fi
  pkgs=$(Rscript -e 'cat(setdiff(c("ggplot2","systemfonts","ragg","textshaping"), rownames(installed.packages())), sep=" ")' 2>/dev/null)
  if [ -z "${pkgs// }" ]; then
    ok "R packages: ggplot2, systemfonts, ragg, textshaping"
    # systemfonts >= 1.1.0 is required for match_fonts(); presence alone isn't enough.
    if ! Rscript -e 'q(status = as.integer(packageVersion("systemfonts") < "1.1.0"))' 2>/dev/null; then
      warn "systemfonts < 1.1.0" "gl_setup() needs systemfonts >= 1.1.0 (match_fonts); Rscript -e 'install.packages(\"systemfonts\")'"
    fi
  else
    bad "missing R packages:$pkgs" "Rscript -e 'install.packages(c($(echo $pkgs | sed "s/[^ ]*/\"&\"/g;s/ /,/g")))'"
  fi
else
  bad "Rscript" "$PM r-base  (or install R from CRAN)"
fi

# ---- fonts ------------------------------------------------------------------
printf '\nFonts (Source Serif 4 + Inter)\n'
if [ -f "$ROOT/assets/fonts/inter/ttf/InterVariable.ttf" ]; then
  ok "bundled fonts present in repo (R uses these directly)"
else
  bad "bundled fonts missing from repo" "re-clone the repo; assets/fonts must be intact"
fi
# fontconfig (fc-list) only exists on Linux. macOS/Windows resolve fonts without
# it, so don't treat its absence as "fonts missing" — check the user font dir.
if have fc-list; then
  # Capture first: `fc-list | grep -q` would SIGPIPE fc-list under `set -o pipefail`
  # and report a false negative even when the fonts are present.
  fc_all="$(fc-list 2>/dev/null || true)"
  if grep -qi "Inter" <<<"$fc_all" && grep -qi "Source Serif 4" <<<"$fc_all"; then
    ok "fonts registered with the system (needed for the PDF/xelatex + Chromium paths)"
  else
    warn "fonts not system-registered" "run scripts/install-fonts.sh (needed for the PDF / slides / xelatex paths; the R path works without it)"
  fi
else
  case "$(uname -s)" in
    Darwin)
      if [ -f "$HOME/Library/Fonts/InterVariable.ttf" ]; then
        ok "fonts present in ~/Library/Fonts (macOS resolves these directly)"
      else
        warn "GL fonts not in ~/Library/Fonts" "run scripts/install-fonts.sh (R path works without it)"
      fi ;;
    *)
      warn "cannot verify system fonts (no fontconfig)" "ensure Inter + Source Serif 4 are installed for the PDF/slides paths; the R path works without it" ;;
  esac
fi

# ---- summary ----------------------------------------------------------------
printf '\n'
if [ "$missing" -eq 0 ]; then
  printf '%sAll required tooling present.%s\n\n' "$green" "$rst"
  exit 0
else
  printf '%s%d required tool(s) missing — install the items marked ✗ above.%s\n\n' "$red" "$missing" "$rst"
  exit 1
fi
