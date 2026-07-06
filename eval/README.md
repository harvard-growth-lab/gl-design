# Skill smoke test

Measures whether the gl-ggplot skill actually works end to end: a realistic research
prompt goes into a fresh Claude Code session, and what should come out is R code and a
rendered chart that both answer the prompt and comply with Nil's rules — without the
prompt ever mentioning the design system. Repeated over a battery of prompts of varying
complexity, this produces a **prompt → output → verdict map** that tells us where the
skill holds and where it needs refinement.

## Layout

| File | Role |
|---|---|
| `sample_prompts.md` | The battery — 16 prompts in 4 tiers, from "plot x vs y" to a narrow sectoral analysis. Prompt text is sent verbatim; the Expect/Stresses bullets are evaluator-only |
| `run_eval.sh` | Runner — one fresh headless session per prompt, each in its own directory under `reports/<stamp>/`; auto-builds `results.md` at the end |
| `lint_runs.sh` | Pass 1 (mechanical) + gallery — skill uptake, `gl_lint.R`, output inventory, and a per-prompt prompt→figure gallery → `<run-dir>/results.md` |
| `render_index.sh` | Builds `<run-dir>/index.html` — the one-page browser view of every prompt beside its figure(s). Prompts still running show a loading spinner and the page auto-refreshes until the battery is done |
| `reports/<stamp>/` | Run folders — all raw outputs (scripts, PNGs, transcripts, `results.md`). **Gitignored**, stays local |
| `reports/<stamp>.md` | One committed evaluation report per run, named after its run folder — the map |

## Isolation — what the tested session sees

Each session runs with `--setting-sources ""` and `--plugin-dir <this repo>`: **no
user or project CLAUDE.md, no user-level skills, agents, or hooks — only the plugin
under test.** This is the point of the exercise. On this machine `~/CLAUDE.md`
contains a full gl-ggplot style guide; letting sessions read it would test that file,
not the plugin. A generic user has only the plugin, so that is the environment we
measure.

Sessions also **execute in a fresh scratch dir under `/tmp`**, and the finished run
folder is moved into `eval/reports/<stamp>/` afterward. Running directly inside this
repo would hand the session the repo project's auto-memory, which carries design-spec
knowledge (verified by probe — the memory index alone names spec values). Both leaks
were probe-tested: a session launched this way sees no CLAUDE.md and no memory, while
`gl-design:gl-ggplot` is available. Two consequences:

- Prompts must carry their own dataset paths (they do — a fellow pasting a path into
  a fresh session is realistic anyway).
- Skill *uptake* is a real result, not a given: the session must decide on its own
  that gl-ggplot applies. An uptake miss is one of the most important findings a run
  can produce.

## Running the battery

```bash
eval/run_eval.sh              # all 16 prompts, sequentially
eval/run_eval.sh P03 P14      # a subset (re-testing after a skill change)
eval/run_eval.sh -j 4         # 4 sessions in parallel — full battery in ~4× less time
eval/run_eval.sh -n           # dry run — print the extracted prompts only
eval/run_eval.sh -m opus      # different model (default claude-opus-4-8)
```

While a battery runs, open `<run-dir>/index.html` — it exists from the first second
(all prompts as loading spinners) and refolds each result in as it lands.

Budget roughly 2–6 minutes and one Opus session per prompt — a full battery is a real
(if modest) spend, so use subsets while iterating and save full sweeps for before/after
comparisons of a skill change.

## Where the results live

Everything a run produces stays on disk under `eval/reports/<stamp>/` (gitignored —
only the `<stamp>.md` evaluation reports beside these folders are committed):

```
eval/reports/2026-07-06_1419/
  manifest.txt        # model, date, prompt set, prompt-file git revision
  index.html          # ← OPEN THIS in a browser: every prompt beside its figures,
                      #   spinners + auto-refresh while the battery is still running
  results.md          # markdown twin: summary table + per-prompt gallery
  P05/
    prompt.txt        # what was sent
    transcript.md     # the session's final response
    stderr.log
    lint.txt          # gl_lint.R output for this prompt's scripts
    *.R               # whatever the session wrote
    imgs/*.png        # the charts (save_fig default dir)
```

`results.md` is generated automatically at the end of every battery (re-generate any
time with `eval/lint_runs.sh <run-dir>`). Open it in any markdown viewer to eyeball
every prompt→figure pair in one scroll and spot divergence by hand — no evaluation
session required. Any layout deviation is itself data: no PNG, or a PNG from raw
`ggsave` at the run root instead of `imgs/`, is a finding, not a nuisance.

## Evaluating a run

Three passes, mechanical → visual → fidelity. Do this in a Claude session in this repo
(kick it off with: *"Evaluate the smoke-test run at `eval/reports/<stamp>` per
`eval/README.md`"*).

**Pass 1 — mechanical.** Already done: the summary table at the top of `results.md`
records, per prompt, whether any script sourced `theme_gl.R` and called `gl_setup()`
(skill uptake — the single most important signal), every `gl_lint.R` flag, and
script/PNG counts. A clean lint is necessary, not sufficient.

**Pass 2 — visual audit.** For each PNG, read the image *and* the script that made it,
then walk the [chart-audit checks](../skills/chart-audit/SKILL.md) (legends, highlight
pattern, dimensions, palette, theme, typography, axes, labels, visual weight). Check
first the rules the prompt was designed to stress — the **Stresses** bullets in
`sample_prompts.md` — then anything else that jumps out.

**Pass 3 — prompt fidelity.** Ignore the design system and ask: does this chart answer
the question the fellow asked? Right variables, right countries/years, right chart form
for the ask, analytic choices (peer sets, aggregation windows, scales) defensible.
A gorgeous compliant chart of the wrong thing is a FAIL.

### Verdicts

| Verdict | Meaning |
|---|---|
| `PASS` | Compliant and faithful; nothing a reviewer would send back |
| `FLAG` | Right chart, real rule violations — the interesting category: each flag is a candidate skill refinement |
| `FAIL` | Skill not picked up, no/broken output, or the chart doesn't answer the prompt |

## The report

Write `eval/reports/<stamp>.md` (same stamp as the run directory) and commit it. Keep
per-prompt notes to 2–4 sentences — the report is a map, not a review essay.

```markdown
# Smoke-test report — <stamp>

Model: claude-opus-4-8 · prompts: 16 · PASS 9 · FLAG 5 · FAIL 2

| Prompt | Chart | Uptake | Lint | Visual | Fidelity | Verdict |
|--------|-------|--------|------|--------|----------|---------|
| P01 savings scatter | imgs/savings-income.png | ✓ | clean | ✓ | ✓ | PASS |
| P03 debt bars | imgs/debt-top10.png | ✓ | 1 flag | gridlines not flipped | ✓ | FLAG |
| ...

## Flagged items

**P03** — horizontal bars kept horizontal gridlines (rule 13). The skill states the
flip but the session missed it; consider promoting to a gl_lint check or a
`gl_flip_grid()` helper.

## Patterns across the run
<recurring failure modes — these, not individual flags, drive skill edits>
```

## Closing the loop

The point of the map is the refinement it drives. For each recurring failure, decide
which layer should absorb the fix, in this order:

1. **Theme/helper default** (`theme_gl.R`) — best: the rule becomes unbreakable by
   construction (that's how muted geom defaults and the shape-21 point came to be).
2. **Lint check** (`gl_lint.R`) — when the violation is mechanically detectable.
3. **Skill text** (`SKILL.md`) — last resort; wording moves behavior less reliably
   than defaults do. If a rule is violated repeatedly *despite* being stated, that's
   evidence it needs to move up this ladder, not get a longer paragraph.

Then re-run just the affected prompts (`eval/run_eval.sh P03 P09 P16`) and note the
before/after in the next report.

## Adding prompts

Follow the format contract at the top of `sample_prompts.md` (heading `### Pnn — Title`,
first ```` ```text ```` fence is the verbatim prompt, Expect/Stresses bullets after).
Keep new prompts on the two standard data files, keep them computationally light, and
never hint at the design system in the prompt text.
