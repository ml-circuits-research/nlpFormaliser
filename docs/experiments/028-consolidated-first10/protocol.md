# First consolidated comparison: fixed protocol

Eight registered first-pass variants receive the same ten texts selected by `docs/evaluation/selections/consolidated-first10.json`. Repair is excluded. Native source-derived strategies are retained, not replaced by simplified rules.

Generation and bidirectional judging use `openference/GPT-OSS-120B` through predefined Pworker phase-map files. Five tasks may run concurrently, but prompt aggregation is disabled (`batch-size=1`) so a malformed batch cannot discard several documents. Generation cap: 16,000 tokens; judge cap: 6,000; per-call timeout: 120 seconds. Cache, fallback, cut-response retries and repair are disabled. Deterministic strategies make no generation calls. Speech Act Normalization is a surface-only control.

Primary endpoint: **whole-document acceptance out of ten**: valid formalization, positive bidirectional equivalence, and no reasoning-screen disqualifier. Report components separately, plus parser/transport errors, uncertainty, judge errors and costs. Zero accepted cases does not mean every proposition is wrong. No majority voting: models and related families have correlated errors.

Original formalization, deterministic native CNL, reasoning export, common-CNL projection, audit and judge differences are retained in `items.jsonl`. Native CNL, not a partial common projection, is judged. Mirrors under `eval/success` and `eval/fail` contain native CNL only; reasons and empty-output indicators are in `mirror-index.json`.

Source hashes and input snapshots are fixed in `manifest.json`. Changes require a new experiment ID. Independently review actual NL/formalization/CNL triples and judge reasons. Targeted larger-model checks belong in a separate experiment, not a silent substitution.
