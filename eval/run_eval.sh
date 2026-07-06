#!/usr/bin/env bash
# Run the chart-generation smoke test: one fresh headless Claude Code session per
# prompt in sample_prompts.md, each in its own run directory.
#
# Isolation: sessions run with `--setting-sources ""` (no user or project CLAUDE.md
# and no user-level skills/agents/hooks) and `--plugin-dir <this repo>` (the plugin
# under test, loaded explicitly). Each session also EXECUTES in a fresh scratch dir
# under /tmp — never inside this repo — because auto-memory is keyed to the working
# directory's project and this repo's memory contains design-spec knowledge that
# would contaminate the test. Finished run folders are then moved into
# eval/reports/<stamp>/ (gitignored); the committed evaluation reports are
# eval/reports/<stamp>.md. The session sees the prompt and the plugin — nothing else:
# the test measures what the PLUGIN achieves for a generic user. Prompts therefore
# carry their own dataset paths.
#
# Usage:
#   eval/run_eval.sh                 # run every prompt
#   eval/run_eval.sh P03 P14         # run a subset
#   eval/run_eval.sh -j 4            # run 4 sessions concurrently (default 1)
#   eval/run_eval.sh -n              # dry run: print extracted prompts, run nothing
#   eval/run_eval.sh -m <model>      # override model (default: claude-opus-4-8)
#
# Watch progress: open <run-dir>/index.html — regenerated after every prompt, with
# loading spinners + auto-refresh while sessions are still running.
#
# Env overrides: GL_EVAL_MODEL, GL_EVAL_RUNS (runs root), GL_EVAL_TIMEOUT (seconds),
# GL_EVAL_JOBS (concurrency).
set -uo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_DIR="$(cd "$EVAL_DIR/.." && pwd)"
PROMPTS_FILE="$EVAL_DIR/sample_prompts.md"

MODEL="${GL_EVAL_MODEL:-claude-opus-4-8}"
RUNS_ROOT="${GL_EVAL_RUNS:-$EVAL_DIR/reports}"   # run folders are gitignored; the
                                                 # committed <stamp>.md reports sit alongside
TIMEOUT_S="${GL_EVAL_TIMEOUT:-1500}"
JOBS="${GL_EVAL_JOBS:-1}"
DRY_RUN=0
IDS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        -m|--model)   MODEL="$2"; shift 2 ;;
        -j|--jobs)    JOBS="$2"; shift 2 ;;
        -n|--dry-run) DRY_RUN=1; shift ;;
        -h|--help)    awk 'NR > 1 && !/^#/ { exit } NR > 1 { print }' "${BASH_SOURCE[0]}"; exit 0 ;;
        P[0-9][0-9])  IDS+=("$1"); shift ;;
        *) echo "unknown argument: $1 (prompt ids look like P01)" >&2; exit 1 ;;
    esac
done

if [[ ${#IDS[@]} -eq 0 ]]; then
    mapfile -t IDS < <(grep -oE '^### P[0-9]{2}' "$PROMPTS_FILE" | awk '{print $2}')
fi

# First fenced block after the "### Pnn — ..." heading, verbatim.
extract_prompt() {
    awk -v id="$1" '
        $0 ~ "^### "id" "  { found = 1; next }
        found && /^```/    { if (infence) exit; infence = 1; next }
        infence            { print }
    ' "$PROMPTS_FILE"
}

if [[ $DRY_RUN -eq 1 ]]; then
    for id in "${IDS[@]}"; do
        printf '═══ %s ═══\n%s\n\n' "$id" "$(extract_prompt "$id")"
    done
    exit 0
fi

STAMP="$(date +%Y-%m-%d_%H%M)"
RUN_DIR="$RUNS_ROOT/$STAMP"
mkdir -p "$RUN_DIR"
WORK="$(mktemp -d /tmp/gl-eval-work.XXXXXX)"   # sessions execute here (no project
                                               # memory / CLAUDE.md), results move to RUN_DIR
{
    echo "model:   $MODEL"
    echo "date:    $(date -Iseconds)"
    echo "prompts: ${IDS[*]}"
    echo "source:  $PROMPTS_FILE @ $(git -C "$EVAL_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"
} > "$RUN_DIR/manifest.txt"

echo "Runs → $RUN_DIR  (model: $MODEL, timeout: ${TIMEOUT_S}s/prompt, jobs: $JOBS)"
"$EVAL_DIR/render_index.sh" "$RUN_DIR" > /dev/null || true   # all-pending page, up front
echo "Watch:  $RUN_DIR/index.html"

run_one() {
    local id="$1" prompt workdir status
    prompt="$(extract_prompt "$id")"
    if [[ -z "$prompt" ]]; then
        echo "!! $id: no prompt found in $PROMPTS_FILE — skipped"
        return
    fi
    workdir="$WORK/$id"
    mkdir -p "$workdir"
    printf '%s\n' "$prompt" > "$workdir/prompt.txt"

    echo "── $id  started $(date +%H:%M:%S)"
    if ( cd "$workdir" && timeout "$TIMEOUT_S" claude --model "$MODEL" \
            --setting-sources "" --plugin-dir "$KIT_DIR" \
            --allow-dangerously-skip-permissions --dangerously-skip-permissions \
            -p "$prompt" > transcript.md 2> stderr.log ); then
        status="done"
    else
        status="FAILED (exit $?)"
    fi

    mv "$workdir" "$RUN_DIR/$id"
    local n_r n_png
    n_r=$(find "$RUN_DIR/$id" -name '*.R' | wc -l)
    n_png=$(find "$RUN_DIR/$id" -name '*.png' | wc -l)
    echo "   $id  $status — ${n_r} R script(s), ${n_png} PNG(s)"
    "$EVAL_DIR/render_index.sh" "$RUN_DIR" > /dev/null || true   # fold result into the page
}

for id in "${IDS[@]}"; do
    if [[ "$JOBS" -gt 1 ]]; then
        run_one "$id" &
        while [[ $(jobs -rp | wc -l) -ge $JOBS ]]; do wait -n; done
    else
        run_one "$id"
    fi
done
wait
rmdir "$WORK" 2>/dev/null || echo "note: scratch left at $WORK"

echo
echo "Building results.md (mechanical pass + gallery)…"
"$EVAL_DIR/lint_runs.sh" "$RUN_DIR" > /dev/null || echo "!! lint_runs.sh failed — run it by hand"
echo "Done. Review: $RUN_DIR/results.md"
