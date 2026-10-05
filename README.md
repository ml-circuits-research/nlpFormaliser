# NLP Formaliser research

Compare natural language → formal representation → deterministic CNL, with independent semantic evaluation and reasoning checks. Every model operation runs a predefined `.mjs` task through the sibling **Ploinky Workers** project. There is no provider SDK, external model CLI, or direct model HTTP adapter in the active strategies or evaluator.

The archive architectures have been restored after an initially restrictive integration. Read the [fidelity audit](docs/restoration-audit.md) before interpreting old results. Each strategy has a `docs/` folder containing recovered original documentation and current integration notes. The [evaluation corpus](eval/README.md) now preserves source gold representations, behavioral controls, corrupted pairs and a connected 30-turn dialogue.

```sh
npm install
node ../Ploinky-Worker/bin/pworker.mjs start
npm test
npm run eval -- --strategy all --stage calibration --tier medium --judge-tier medium --batch-size 5
```

The five calibration cases are debugging material, never a strategy ranking. See [protocol](docs/protocol.md), [strategy inventory](docs/strategies.md), and [experiment log](docs/experiments.md). Results, prompts, responses, task progress, source hashes and model catalog snapshots are stored in `docs/experiments/<id>/`. Existing experiment directories are never overwritten.

```sh
# No model calls: inspect deterministic coverage across all 138 base cases.
npm run eval -- --strategy symbolic --strategy lab-heuristic --stage full --offline
# Development and held-out partitions exclude the calibration cases.
npm run eval -- --strategy compact-scope-logic --stage development --tier medium --judge-tier best
npm run eval -- --strategy compact-scope-logic --stage heldout --tier medium --judge-tier best
# Rejudge identical saved formalizations, without paying for formalization again.
npm run eval -- --rejudge docs/experiments/RUN/items.jsonl --judge-tier best
# Calibrate the judge separately on identity, paraphrase, and semantic corruptions.
node tools/calibrate-judge.mjs --tier medium --mode bidirectional
```

`strategies/` is the existing canonical directory; `draftStrategies/` remains untouched research input. The legacy draft programs are not entry points for this project. Explicit CNL-only controls cannot enter the reasoning-success ranking.
