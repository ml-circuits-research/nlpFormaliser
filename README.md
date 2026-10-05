# NLP Formaliser research

Compare natural language → formal representation → deterministic CNL, with independent semantic evaluation and reasoning checks. Every model operation runs a predefined `.mjs` task through the sibling **Ploinky Workers** project. There is no provider SDK, external model CLI, or direct model HTTP adapter in the active strategies or evaluator.

The archive architectures have been restored after an initially restrictive integration. Read the [fidelity audit](docs/restoration-audit.md) before interpreting old results. Each strategy has a `docs/` folder containing recovered original documentation and current integration notes. The [evaluation corpus](eval/README.md) now preserves source gold representations, behavioral controls, corrupted pairs and a connected 30-turn dialogue.

```sh
npm install
node ../Ploinky-Worker/bin/pworker.mjs start
npm test
npm run eval -- --strategy all --stage calibration --tier medium --judge-model UPSTREAM/OTHER-FAMILY-MODEL --batch-size 5
```

The five calibration cases are debugging material, never a strategy ranking. The judge must differ from the formalizer (`--allow-self-judge` marks an exception as development-only evidence). The primary endpoint is unit-level (sentence) preservation among eligible outputs, with clustered bootstrap intervals and paired comparisons; whole-document equivalence is secondary and eligibility is reported separately (see [protocol](docs/protocol.md#methodology)). See [protocol](docs/protocol.md), [strategy inventory](docs/strategies.md), and [experiment log](docs/experiments.md). Results, prompts, responses, task progress, source hashes and model catalog snapshots are stored in `docs/experiments/<id>/`. Existing experiment directories are never overwritten.

```sh
# No model calls: inspect deterministic coverage across all 29 consolidated cases.
npm run eval -- --strategy discourse-semantic-graph --strategy deterministic-rule-draft --stage full --offline
# The 138 archived base texts remain loadable explicitly:
npm run eval -- --set base --strategy discourse-semantic-graph --stage full --offline
# Development and held-out partitions exclude the five calibration cases.
# --controls injects the fixed judge control set and gates the run on it.
npm run eval -- --strategy compact-scope-logic --stage development --tier medium --judge-model UPSTREAM/OTHER-FAMILY-MODEL --controls
npm run eval -- --strategy compact-scope-logic --stage heldout --tier medium --judge-model UPSTREAM/OTHER-FAMILY-MODEL --controls
# Rejudge identical saved formalizations, without paying for formalization again.
npm run eval -- --rejudge docs/experiments/RUN/items.jsonl --judge-tier best
# Calibrate the judge on the fixed control set (dedicated control document,
# long native-CNL corruptions, rubric controls, archive scope-corruption pairs).
node tools/calibrate-judge.mjs --tier medium --mode bidirectional
```

`strategies/` is the existing canonical directory; `draftStrategies/` remains untouched research input. The legacy draft programs are not entry points for this project. Explicit CNL-only controls cannot enter the reasoning-success ranking.
