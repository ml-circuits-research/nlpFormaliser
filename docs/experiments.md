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

## 024–027 — Judge calibration on consolidated controls

Four requested judge models, sixteen controls each, individual requests, cache off, no repairs; see [judge calibration](evaluation/judge-calibration-consolidated.md). As recorded: GPT-OSS-120B 16/16; DeepSeek-V4-Flash-0731 15/16 with one false reject; Qwen3.8 27b 12/16 with four judge errors; DeepSeek-V4.1-Flash stopped after two provider failures (availability evidence only). GPT-OSS-120B was chosen as provisional judge.

**Correction.** The decisive control, `formal-ordered-arguments`, was mislabeled: it paired "a printer" with the constant "printer", which loses the indefinite description and is not equivalent by the rubric. On corrected labels GPT-OSS-120B has one false accept and DeepSeek-V4 none, so the provisional choice rested on a mislabeled control. The long controls also reused `consolidated/base/01`, an evaluated document. The control set has been rebuilt on a dedicated document; the frozen 024–027 directories are unchanged.

## 028 — First consolidated comparison (stopped at 30/80)

Eight first-pass variants on the ten `consolidated-first10` documents, generation and bidirectional judging both with GPT-OSS-120B (self-judged: now refused without `--allow-self-judge`), batch size one, no repairs. The run was deliberately stopped at **30 of 80 rows** after provider 429 throttling and client deadlines; see `interrupted.json`. Recorded rows: Explicit Scope Logic 10 (8 valid, all 7 judged documents not equivalent, one judge timeout, one parse failure, one infrastructure timeout); Evidence Guided Logic 10 (7 valid, all judged not equivalent, 3 IR validation failures); Direct Context Logic 10 (5 valid, all judged not equivalent, 5 infrastructure timeouts). No document was accepted. Two independent audits ([audit](experiments/028-consolidated-first10/independent-audit.md)) find the negative verdicts largely justified but several judge explanations wrong in detail, and the reasoning screen passing outputs with lost request force.

Evidence Guided Logic concretized "tomorrow" in `base/01` to `2026_10_06t09_00`/`10_00`, i.e. the run date leaked into the representation. That is unanchored temporal resolution and must be scored as **added** content, not as source-grounded equivalence; the harness now flags it deterministically (`addedContent`) and the unit judge is instructed accordingly. Consolidated cases then carried `reference:{}`, so 028–032 executed **zero behavioral probes**; atomic probes are now attached to consolidated documents. The selection also includes calibration cases `base/01` and `base/04`. Results are development evidence only, with no ranking.

## 029 — Targeted second-model judge review

Three frozen Explicit Scope Logic rows from 028 (`base/01`, `base/10`, `speech-acts/01`) rejudged with DeepSeek-V4-Flash-0731; no regeneration. All three documents were judged not equivalent in both directions. Diagnostic, non-random selection: it estimates neither judge accuracy nor strategy success. The [independent audit](experiments/029-consolidated-judge-review/independent-audit.md) finds the verdicts defensible but the explanations mixed with formatting complaints and claims contradicted by the CNL.

## 030 — Resumed continuation (8 rows, interrupted)

Continuation of 028 with lower concurrency and longer deadlines. Interrupted after **8 rows**, all Explicit Scope Logic: seven reused 028 outcomes and `base/10` was rejudged and again produced a judge error. No new semantic evidence. Under the current resume rules a run with this protocol would also be compared against tier/selection/batch options and Ploinky-Worker source differences would be listed.

## 031 — Capacity-aware continuation (2 rows, incomplete)

Canonical continuation attempt after Worker capacity-wait hardening. Only **2 rows** were written (`base/01`, `base/04`, both reused from 028) before the run stopped while waiting on provider capacity (`live-capacity-observation.json`: ten 429 responses, task still waiting). It has no summary and no new evidence; the 028 comparison remains incomplete at 30/80.

## 032 — Deterministic baseline on the first ten

Deterministic Rule Draft and Discourse Semantic Graph on the same ten documents, offline, no judgments. Deterministic Rule Draft: 3/10 valid, 1/10 reasoning-eligible; Discourse Semantic Graph: 10/10 structurally valid, 0/10 eligible (no downstream compiler). Equivalence is unmeasured, not 0%. Coverage evidence only.

## Harness changes after 024–032

Calibration cases are excluded from development/held-out partitions; judge controls use a dedicated document; self-judging is refused by default; `--controls` injects the control set and gates the run on sensitivity/specificity; judge prompts are unbatched by default; truncation and batch-envelope errors are budget/infrastructure failures retried on resume; resume compares the full protocol and lists Worker source differences; rejudge reuses the stored model input. The primary endpoint is now unit-level preservation with clustered intervals and paired tests (see [protocol](protocol.md#methodology)). Earlier runs are not re-scored in place.

## 033–038 — Batched judge calibration and the symbolic baseline

033, 035, 036 and 038 calibrate four low-quota judges on the 45 controls with one batched request per judge task; see [judge calibration](evaluation/judge-calibration-consolidated.md#033038--batched-calibration-on-the-45-control-set). Qwen3.8 27b is the provisional judge (44/45, one false accept), with Nemotron-3-120B as the cross-check. ID 034 was used by an aborted, uncommitted Gemma attempt.

037 runs both deterministic strategies offline on all 29 consolidated cases with the current code. No model calls. Both are structurally valid on 29/29 and reasoning-eligible on 0/29:
- **Deterministic Rule Draft** formalizes almost nothing: of 521 sentences, 478 are refused (223 generic clauses, 90 questions, 76 conditionals, 55 modal, 33 attitude reports). Only 28 CNL lines remain. Even "The device shut down." and "Is the contract valid?" are refused.
- **Discourse Semantic Graph** parses more, but 67 turns stay raw, 95 carry structural residue (a clause collapsed into a string, e.g. the theme "landlord claims that the heating"), and there are 236 symbols over 3 words and 213 source echoes.

## 039–040 — Judged comparison of the symbolic parser (interrupted)

039 judges Discourse Semantic Graph v2 on the 26 development documents and 040 rejudges the archive parser's outputs from 037 on the same documents. Both use Qwen3.8 27b with one batched request per judge task, plus the control set. The document-level batch of 26 succeeded in one request in both runs. The control gate failed (039: 24/27 negatives rejected, 14/18 positives accepted), so neither run could be ranking-eligible. Both runs were stopped by hand after about 30 minutes without progress: Openference returned truncated replies (the content ends after `{"results":`, finish reason `stop`, no usage), then 429 and 502. Five of the 12 and 10 requests were truncated. No item verdict was recorded, so there is no semantic evidence yet; the offline measurements of the parser stand alone (see the strategy's docs). `interrupted.json` in each directory records the state.
