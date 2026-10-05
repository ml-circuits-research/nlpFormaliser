# Experiment log

> The early runs below evaluated partially restrictive adapters. They are retained for provenance and infrastructure diagnosis, not as a ranking of the faithful source strategies. Fidelity restoration and imported source benchmarks are documented in [restoration audit](restoration-audit.md). No new model comparisons were launched during restoration.

Every run has an immutable directory under `docs/experiments/`. This log explains why a run was attempted and what can be concluded. Raw outputs are not edited after review.

## 001 — Offline calibration

Five diverse cases, symbolic and lab-heuristic. Symbolic produced CNL on two cases but has no validated reasoning export. Lab-heuristic produced an executable representation for one case, but it asserted `approved(who,...)` instead of asking a question. No model calls or semantic verdicts. Outcome: exposed coverage and question-force failures before spending model quota.

## 002 — All imported strategies, small formalizer / medium judge

Seven strategies × five calibration cases, batch size five, no repairs, cache off. The small tier served Openference Gemma 4 26B and returned HTTP 529 for all five formalizer batches (25 items). These are infrastructure failures, not evidence that the formalizers are inaccurate. Medium served Nemotron-3-120B and judged three deterministic outputs. It correctly rejected the heuristic question, but accepted both symbolic outputs.

Independent agent review identified a false positive on the symbolic negation case: the AST stored `x2 you flagged` in a label and never linked it to the quantified variable. Eligibility screening excluded it because no reasoning compiler was available. The other symbolic question lost explicit past tense. Therefore 002 establishes neither a successful formalization nor a strategy ranking.

Seven client requests were recorded, with 0.7 reported credit headers. Some requests involved proxy retries; these final-response headers are not a complete charge ledger. USD prices were absent. No semantic repairs occurred.

## 003 — Medium judge, bidirectional controls

Ten fixed known pairs, two batches. Nine were correctly classified, no false accepts or false rejects, and one contradictory reply for conjunction order was rejected as a judge error. This shows that JSON validity and consistency checks matter even on simple positive controls. The controls do not negate the false positive found on symbolic CNL in 002.

## Implementation changes after initial evidence

Ploinky Workers now accepts bounded request options in predefined task phases, separates batches with different request options, rejects unexpected batch IDs and truncated output, and handles arrow callbacks inside statement code. Regression tests exercise these cases. The evaluator distinguishes judge errors from semantic rejections and uses the correct three-valued conjunction for directional judgments: false plus unknown is false. No provider credentials were copied into the repository.

Further run outcomes are recorded in each experiment's `report.md` or `summary.json`; this log is updated after inspection.

## 004 — MicroIR nano

One five-case formalizer batch on configured Qwen3.8 27b reached the 180-second client timeout. No CNL or judge verdict resulted. This says nothing about semantic capability. The failed client's billing is unknown; a provider may finish after a client timeout.

## 005 — All strategies on medium

Five calibration cases per strategy, Nemotron-3-120B for formalizer and bidirectional judge, 8,000 output-token cap. MicroIR: 5 valid, 3 judge-equivalent, 2 uncertain. EVL: the combined response exhausted 8,000 tokens and was rejected. Lab-direct: 3 valid, none equivalent; lab-proto: 1 valid, not equivalent. CNL-Core: 5 valid, 4 equivalent but all excluded as surface-only. Deterministic strategy outcomes repeated their earlier failures.

Independent review found the MicroIR negation scope genuinely compositional, but conditional/imperative and coreference examples lost information. Modal nested propositions require an intensional interpretation, which the finite model checker deliberately does not claim to implement. Judge uncertainty does not excuse identifiable omissions. Same-model formalizer/judge agreement remains a bias risk.

## 006 — Stronger judge controls

GLM-5.3 (best) correctly classified the first five controls. The second batch timed out, producing five judge errors. This is not 50% semantic accuracy: it is five correct answers and five unavailable answers. A stronger tier did not solve service latency.

## 007 — EVL individual tasks with 16k budget

After 005's truncation, batch size one and a 16,000-token output budget produced four valid formalizations out of five; three were judged equivalent by medium. This establishes that request sizing matters for EVL. It changes both batching and budget, so it is a troubleshooting intervention, not an isolated causal estimate of batching's effect. No previous response was repaired or fed into these calls.

## 008 — Direct judge controls

Medium/direct classified all ten controls correctly in two requests, compared with nine correct and one malformed/contradictory verdict in 003/bidirectional. This is promising operational evidence for the shorter direct task, not proof that it is universally more accurate. Tests on real formal CNL and independent audits remain necessary.

## 009 — Deterministic coverage across all 138 cases

Zero model calls. Symbolic produced valid CNL on 67/138 but no validated reasoning export. Lab heuristic produced 3/138 nonempty valid outputs, of which 2 passed the export/opacity screen. These are coverage counts, not semantic successes. The full corpus has now been mechanically scanned; no claim is made that it is an untouched external test set.

## Historical first-pass changes — superseded

Lab schema v2 explicitly describes queries, projected variables, ground facts and unsupported features. This fixes a prompt/validator contradiction identified independently in 005; it is not repair of an individual model response. The MicroIR hybrid adds a closed deterministic grammar before its unchanged fallback task. In both cases the first-pass outputs and source hashes are recorded in new runs. Finite reasoning tests distinguish negation scope, quantifier alternation and argument order; they reject modal proposition arguments and questions as unsupported assertions.

The restrictive Lab adapter and closed-grammar hybrid above were subsequently withdrawn from the active comparison: they do not preserve the source research architectures. See [restoration audit](restoration-audit.md). These historical outcomes must not be used to rank restored strategies.

## 014–016 — Offline restoration and measurement checks

No model calls or repairs. Run 014 exercised the original deterministic Lab strategy on all 31 native development examples. Its probe aggregation skipped empty CNL outputs, incorrectly reducing the denominator; run 016 supersedes that measurement and evaluates available formal IR even when its rendering is empty. All 82 annotated probes were executed: 3/64 semantic probes passed and 18/18 negative controls passed. The combined 21/82 is not a useful standalone semantic success rate: an empty theory can pass negative controls. Ten cases produced valid nonempty outputs; eight passed the reasoning-export eligibility screen, which does not establish semantic equivalence.

Run 015 exercised the discourse strategy on the complete ordered 30-turn archive dialogue, preserving state, unresolved references, helper requests and contextual review batches. This checks integration and information preservation, not semantic correctness. Source parity tests separately compare all 60 Lab examples, all 30 scoped gold representations, and the complete discourse session with the recovered implementations.

The next live comparisons require these restored implementations, per-category metrics, explicit backend limitations and independent audits. Earlier model-tier and batching measurements remain operational observations only.

## 017–020 — Matched development, grammar and batching

Eight deterministically selected examples from the recovered Lab development set; zero repairs. All live operations use predefined Ploinky Workers tasks with medium-tier formalization and direct judging, 16k output cap. These are development interventions, not heldout rankings.

017 compares three restored strategies with batches of two. The original Compact Scope Logic prompt yields 0/8 parseable outputs: responses contain bare predicates, infix conjunctions and placeholder wrappers. Direct Context Logic and Evidence Guided Logic each produce 8/8 valid outputs, but independent inspection identifies judge inconsistency, identifier-dependent meaning and reference-vocabulary mismatch. See the [case audit](experiments/017-restored-matched-development/independent-audit.md). Validity is not semantic success.

018 changes only the scoped generation prompt through the separately named Explicit Scope Logic variant: concrete grammar, generic structural examples and syntax constraints, preserving the original full language. Six of eight outputs are valid; a malformed outer batch JSON response loses the other two. Five candidates receive an equivalence label, one a non-equivalence label. This is not independently verified accuracy. Seven requests, 0.7 reported credits; USD unavailable.

019 repeats the explicit-grammar variant with batch size one and concurrency two. All eight outputs parse; judging reports four equivalent, two non-equivalent, one uncertain and one malformed judgment. Sixteen requests, 1.6 reported credits. Batch size changes output reliability and cost, but a single non-deterministic repeat does not establish causality or an optimal configuration.

020 is an offline matched complementarity report from 017 and 018. It keeps missing labels separate, reports per-category uncertainty and labels an oracle selection gain as a diagnostic upper bound, not an implemented voting system. Eight examples are insufficient to infer trustworthy specialization. Identical candidate outputs and correlated families cannot be counted as independent evidence.

023 reruns that offline comparison with explicit identical-judge-input groups and contradictory-label detection; the C10 inconsistency is now machine-visible. No additional model calls. It does not silently change the original labels or treat an oracle as an actual router.

The corpus was subsequently reorganized into one `.txt` per example, with annotations under `docs/evaluation/`. Previously recorded experiment manifests retain the original paths and complete inputs; they are not rewritten.

## 021 — Common CNL on exactly stored formalizations

Rejudges the eight formalizations from 019 without regenerating or repairing them. The scoped common-CNL projection is complete for all eight. Medium/direct, individual tasks: four equivalent labels, three non-equivalent, one uncertain, no malformed judgments; eight requests and 0.8 reported credits. C06 changes from false to uncertain, C07 from uncertain to false, and C05 from judge error to false. Other labels agree. This does not isolate rendering causality from model variability: matched repeated judgments and structural controls are still needed. Native CNL, common typed nodes and projected CNL are all retained in each item.

## 022 — Restored deterministic strategies across all base texts

All 138 base texts, both original deterministic architectures, zero model calls and zero repairs. Deterministic Rule Draft yields three nonempty valid outputs and two screen-eligible exports. Discourse Semantic Graph yields 138 structurally valid outputs but zero reasoning-eligible exports: the original architecture retains unresolved structure and has no downstream compiler. This is coverage, not 138 semantic successes. Restoring completeness changes the visibility of unsupported material; it does not make it executable.
