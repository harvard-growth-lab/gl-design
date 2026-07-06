#!/usr/bin/env bash
# Mechanical pass + gallery over a smoke-test run directory. For every prompt run:
# check skill uptake (theme sourced + gl_setup called), run gl_lint.R on each R
# script, inventory the outputs — then write <run-dir>/results.md: a summary table
# followed by one section per prompt with the prompt text and the rendered figures
# embedded, so the whole run can be reviewed by eye from a single document.
#
# This is pass 1 of 3 — a clean result here is necessary, not sufficient. The
# judgment pass (chart-audit on the PNGs) and the prompt-fidelity pass follow;
# see eval/README.md. run_eval.sh invokes this automatically after a battery.
#
# Usage: eval/lint_runs.sh eval/reports/<stamp>
set -uo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINT="$(cd "$EVAL_DIR/.." && pwd)/skills/chart-audit/scripts/gl_lint.R"
RUN_DIR="${1:?usage: lint_runs.sh <run-dir, e.g. eval/reports/2026-07-06_1030>}"
RUN_DIR="${RUN_DIR%/}"

[[ -f "$LINT" ]] || { echo "gl_lint.R not found at $LINT" >&2; exit 1; }
[[ -d "$RUN_DIR" ]] || { echo "no such run dir: $RUN_DIR" >&2; exit 1; }

OUT="$RUN_DIR/results.md"
{
    echo "# Smoke-test run — $(basename "$RUN_DIR")"
    echo
    [[ -f "$RUN_DIR/manifest.txt" ]] && { sed 's/^/    /' "$RUN_DIR/manifest.txt"; echo; }
    echo "| Prompt | R scripts | PNGs | Skill uptake | Lint flags |"
    echo "|--------|-----------|------|--------------|------------|"

    for dir in "$RUN_DIR"/P*/; do
        [[ -d "$dir" ]] || continue
        id="$(basename "$dir")"
        mapfile -t scripts < <(find "$dir" -name '*.R' | sort)
        mapfile -t pngs    < <(find "$dir" -name '*.png' | sort)

        # Skill uptake: does any script source theme_gl.R AND call gl_setup()?
        uptake="✗ none"
        for s in "${scripts[@]}"; do
            if grep -q 'theme_gl\.R' "$s" && grep -q 'gl_setup' "$s"; then
                uptake="✓"
                break
            fi
        done
        [[ ${#scripts[@]} -eq 0 ]] && uptake="— (no script)"

        # Lint every script; collect flags in the run dir.
        : > "$dir/lint.txt"
        for s in "${scripts[@]}"; do
            echo "== $s" >> "$dir/lint.txt"
            Rscript "$LINT" "$s" >> "$dir/lint.txt" 2>&1 || true
        done
        flags=$(grep -cE '^\S+:[0-9]+: \[' "$dir/lint.txt" 2>/dev/null || true)
        flags=${flags:-0}
        lint_cell="clean"
        [[ $flags -gt 0 ]] && lint_cell="**$flags**"
        [[ ${#scripts[@]} -eq 0 ]] && lint_cell="—"

        echo "| [$id](#$(echo "$id" | tr 'A-Z' 'a-z')) | ${#scripts[@]} | ${#pngs[@]} | $uptake | $lint_cell |"
    done

    # ── Gallery: one section per prompt — the human-readable record of the run ──
    for dir in "$RUN_DIR"/P*/; do
        [[ -d "$dir" ]] || continue
        id="$(basename "$dir")"
        echo
        echo "---"
        echo
        echo "## $id"
        echo
        if [[ -f "$dir/prompt.txt" ]]; then
            echo "**Prompt:**"
            echo
            sed 's/^/> /' "$dir/prompt.txt"
            echo
        fi

        mapfile -t pngs < <(find "$dir" -name '*.png' | sort)
        if [[ ${#pngs[@]} -eq 0 ]]; then
            echo "**No figure produced.**"
            echo
        else
            for png in "${pngs[@]}"; do
                rel="${png#"$RUN_DIR"/}"
                echo "**\`$rel\`**"
                echo
                echo "![$rel]($rel)"
                echo
            done
        fi

        mapfile -t scripts < <(find "$dir" -name '*.R' | sort)
        if [[ ${#scripts[@]} -gt 0 ]]; then
            printf 'Scripts: '
            for s in "${scripts[@]}"; do printf '`%s` ' "${s#"$RUN_DIR"/}"; done
            printf '· [transcript](%s/transcript.md)\n' "$id"
            echo
        fi

        if grep -qE '^\S+:[0-9]+: \[' "$dir/lint.txt" 2>/dev/null; then
            echo "Lint flags:"
            echo
            echo '```'
            grep -E '^\S+:[0-9]+: \[' "$dir/lint.txt" | sed "s|^$dir||"
            echo '```'
            echo
        fi
    done
} > "$OUT"

# Refresh the run's index.html so lint chips appear next to the figures.
"$EVAL_DIR/render_index.sh" "$RUN_DIR" > /dev/null || true

# Console summary: just the table.
sed -n '1,/^---$/p' "$OUT" | sed '$d'
echo
echo "Full gallery written to $OUT (browse: $RUN_DIR/index.html)"
