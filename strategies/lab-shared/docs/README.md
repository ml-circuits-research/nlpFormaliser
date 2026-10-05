# Shared Formal IR runtime

This is not a separate strategy. It holds the restored lab runtime used by Direct Context Logic, Evidence Guided Logic, Deterministic Rule Draft and Draft Guided Repair. Source modules preserve the original IR, ProtoIR, renderer, standalone compiler, reasoner, evaluator, corruption generator and repairer. Provider transports are intentionally excluded.

`coverage.mjs` adds backend coverage and template-argument diagnostics without deleting fields or narrowing the original language. The adapters keep artifacts/provenance and separate structural validity from executable coverage. See the respective strategies' `docs/original/` for recovered source documentation.

`judge.mjs` exposes the native repeated coverage/faithfulness judge through `judge-task.mjs`. This preserves directional scores and variance as a distinct instrument, alongside the common evaluator's binary judge.
