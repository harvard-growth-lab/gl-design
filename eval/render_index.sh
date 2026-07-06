#!/usr/bin/env bash
# Render <run-dir>/index.html — a single self-contained page showing every prompt
# in the run next to its rendered figure(s). Safe to run at any point in a
# battery: prompts whose run directory hasn't landed yet get a CSS loading
# spinner, and the page auto-refreshes every 20s while any prompt is pending.
# run_eval.sh calls this after the manifest is written and again after each
# prompt completes; you can also invoke it by hand to refresh the page.
#
# Usage: eval/render_index.sh <run-dir, e.g. eval/reports/2026-07-06_1527>
set -uo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_FILE="$EVAL_DIR/sample_prompts.md"
RUN_DIR="${1:?usage: render_index.sh <run-dir>}"
RUN_DIR="${RUN_DIR%/}"
[[ -d "$RUN_DIR" ]] || { echo "no such run dir: $RUN_DIR" >&2; exit 1; }

STAMP="$(basename "$RUN_DIR")"
OUT="$RUN_DIR/index.html"

esc() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

# Planned prompt ids: manifest if present, else the directories that exist.
if [[ -f "$RUN_DIR/manifest.txt" ]]; then
    IDS=($(awk '/^prompts:/ { $1=""; print }' "$RUN_DIR/manifest.txt"))
    MODEL="$(awk '/^model:/ { print $2 }' "$RUN_DIR/manifest.txt")"
else
    IDS=($(cd "$RUN_DIR" && ls -d P*/ 2>/dev/null | tr -d '/'))
    MODEL="?"
fi

title_of() {  # "### P01 — Savings vs income scatter" -> "Savings vs income scatter"
    grep -m1 "^### $1 " "$PROMPTS_FILE" 2>/dev/null | sed 's/^### P[0-9]* — //'
}

prompt_text_of() {
    if [[ -f "$RUN_DIR/$1/prompt.txt" ]]; then
        cat "$RUN_DIR/$1/prompt.txt"
    else
        awk -v id="$1" '
            $0 ~ "^### "id" "  { found = 1; next }
            found && /^```/    { if (infence) exit; infence = 1; next }
            infence            { print }
        ' "$PROMPTS_FILE"
    fi
}

n_done=0; n_pending=0
for id in "${IDS[@]}"; do
    if [[ -d "$RUN_DIR/$id" ]]; then n_done=$((n_done+1)); else n_pending=$((n_pending+1)); fi
done

{
cat <<HEAD
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>GL smoke test — $STAMP</title>
HEAD
# Auto-refresh only while prompts are still pending.
[[ $n_pending -gt 0 ]] && echo '<meta http-equiv="refresh" content="20">'
cat <<'CSS'
<style>
  :root { --ink:#1A1714; --ink2:#2C2823; --ink3:#4F4A42; --accent:#1A5A8E;
          --grid:#D8D4CC; --muted:#AFB5BE; --paper:#FFFFFF; --red:#8A2C2B; }
  body  { font-family: Inter, "Helvetica Neue", Arial, sans-serif; color: var(--ink2);
          background: var(--paper); margin: 2rem auto; max-width: 62rem; padding: 0 1rem; }
  h1    { font-family: "Source Serif 4", Georgia, serif; color: var(--ink); font-size: 1.6rem;
          margin-bottom: .2rem; }
  h2    { font-family: "Source Serif 4", Georgia, serif; color: var(--ink); font-size: 1.15rem;
          border-top: 1px solid var(--grid); padding-top: 1.4rem; margin-top: 2.2rem; }
  .meta { color: var(--ink3); font-size: .85rem; margin-bottom: 1.5rem; }
  .prompt { border-left: 3px solid var(--grid); padding: .1rem 0 .1rem .9rem;
            color: var(--ink3); white-space: pre-wrap; font-size: .9rem; }
  .files  { font-size: .8rem; color: var(--ink3); margin-top: .5rem; }
  .files a { color: var(--accent); }
  img   { max-width: 100%; height: auto; border: 1px solid var(--grid);
          margin-top: .8rem; display: block; }
  .chip { display: inline-block; font-size: .72rem; padding: .1rem .5rem;
          border-radius: 99px; margin-left: .5rem; vertical-align: 2px; }
  .ok    { background: #EAF2F8; color: var(--accent); }
  .warn  { background: #F8ECEC; color: var(--red); }
  .wait  { background: #F2F0EC; color: var(--ink3); }
  .spinner { width: 26px; height: 26px; border: 3px solid var(--grid);
             border-top-color: var(--accent); border-radius: 50%;
             animation: spin 0.9s linear infinite; margin: 1.4rem 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head><body>
CSS

echo "<h1>GL chart smoke test — $STAMP</h1>"
echo "<p class=\"meta\">model $MODEL · ${#IDS[@]} prompts · $n_done done, $n_pending pending$( [[ $n_pending -gt 0 ]] && echo ' · page auto-refreshes' )</p>"

for id in "${IDS[@]}"; do
    title="$(title_of "$id")"
    echo "<h2 id=\"$id\">$id — $(printf '%s' "$title" | esc)</h2>"
    echo "<div class=\"prompt\">$(prompt_text_of "$id" | esc)</div>"

    if [[ ! -d "$RUN_DIR/$id" ]]; then
        echo '<div class="spinner" title="waiting for this run"></div>'
        continue
    fi

    mapfile -t pngs < <(find "$RUN_DIR/$id" -name '*.png' | sort)
    if [[ ${#pngs[@]} -eq 0 ]]; then
        echo '<p><span class="chip warn">no figure produced</span></p>'
    else
        for png in "${pngs[@]}"; do
            rel="${png#"$RUN_DIR"/}"
            echo "<img src=\"$rel\" alt=\"$rel\" loading=\"lazy\">"
            echo "<div class=\"files\"><code>$rel</code></div>"
        done
    fi

    # links + lint chip
    links=""
    while IFS= read -r s; do
        rels="${s#"$RUN_DIR"/}"
        links+="<a href=\"$rels\">${rels#"$id"/}</a> · "
    done < <(find "$RUN_DIR/$id" -name '*.R' | sort)
    [[ -f "$RUN_DIR/$id/transcript.md" ]] && links+="<a href=\"$id/transcript.md\">transcript</a>"
    chip=""
    if [[ -f "$RUN_DIR/$id/lint.txt" ]]; then
        nfl=$(grep -cE '^\S+:[0-9]+: \[' "$RUN_DIR/$id/lint.txt" 2>/dev/null || true)
        if [[ "${nfl:-0}" -gt 0 ]]; then chip="<span class=\"chip warn\">lint: $nfl</span>"
        else chip="<span class=\"chip ok\">lint clean</span>"; fi
    fi
    echo "<div class=\"files\">$links$chip</div>"
done

echo "</body></html>"
} > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"   # atomic: a browser mid-refresh never sees a half-written page

echo "Wrote $OUT ($n_done done, $n_pending pending)"
