# Judge calibration for consolidated documents

Experiments 024–027 compare four models through predefined Ploinky Workers tasks and the configured Openference subscription. No direct model API calls or repair are used. Each control is an individual request, with at most two concurrent requests, a 6,000-token output cap, 90-second timeout and caching disabled.

The 16 controls contain six positives and ten negatives: long-document identity, lexical and question paraphrases, conjunction ordering, deterministic scoped CNL with ordered arguments, omitted emotion/question/instruction, invented authorization, question-to-assertion and instruction-to-completion changes, negation scope, role reversal, modality and attribution. Labels follow controlled transformations, not another LLM. Identity positives calibrate the judge only; copying input is not an acceptable formalization.

The judge compares NL against CNL in both directions. For questions and requests it compares requested information/action and constraints, not truth entailment. Both directions must be true without reported differences for equivalence. False in either direction means non-equivalence; unknown remains uncertain. Malformed or contradictory JSON is a judge error, never a semantic rejection.

| Requested model | Correct / attempted | False accepts | False rejects | Errors | Reported subscription credits |
|---|---:|---:|---:|---:|---:|
| GPT-OSS-120B | 16/16 | 0 | 0 | 0 | 1.6 |
| DeepSeek-V4-Flash-0731 | 15/16 | 0 | 1 | 0 | 12 |
| Qwen3.8 27b | 12/16 | 0 | 0 | 4 | 1.4 known; two requests unknown |
| DeepSeek-V4.1-Flash | 0/2 | 0 | 0 | 2 | Unknown |

DeepSeek V4 rejected the positive ordered-argument native CNL. Qwen errors occurred on question paraphrase, conjunction ordering, modality and formal ordered arguments. V4.1 stopped after two provider failures: availability evidence, not an accuracy estimate. Missing costs are not zero. Catalog token-price estimates are separate and are not subscription charges.

Decision: **GPT-OSS-120B is the provisional judge**. This small control set does not establish general reliability on long imperfect generated CNL. Independent artifact review remains necessary.

Evidence: [Qwen](../experiments/024-judge-qwen-consolidated/summary.json), [GPT-OSS](../experiments/025-judge-gptoss-consolidated/summary.json), [DeepSeek V4](../experiments/026-judge-deepseek-flash-consolidated/summary.json), [DeepSeek V4.1](../experiments/027-judge-deepseek41-consolidated/summary.json). Each directory preserves controls, rubric, requests, responses, progress, settings and catalog. The served-header list is empty for explicitly routed requests; requested upstream/model and raw responses are preserved. An empty list is not independent confirmation of the serving model.

Run 028 also uses GPT-OSS for generation, with one fixed model across strategies. Judge calibration does not calibrate generation. Shared model errors can correlate: do not treat agreement as proof. The ten cases are selected development material, not heldout data. No formalization is repaired during this run.

## Correction: the earlier choice rested on a mislabeled control

Post-hoc label audit (no new model calls; experiment directories 024–027 are unchanged). The `formal-ordered-arguments` control paired "Ada owns a printer and Bob owns a scanner." with native CNL in which `printer` and `scanner` are **constants** (`$.owns("Ada","printer")`). A constant names one individual; it does not say that the individual is a printer, so the indefinite description is lost. By the rubric ("do not assume that a named predicate contains unstated facts") this pair is **not equivalent**, yet it was labelled positive.

Re-scored with the corrected label:

| Requested model | Recorded | Corrected |
|---|---|---|
| GPT-OSS-120B | 16/16 | 15/16, one false accept (`formal-ordered-arguments`) |
| DeepSeek-V4-Flash-0731 | 15/16, one false reject | 16/16 |
| Qwen3.8 27b | 12/16, 4 errors | unchanged (that control was a judge error) |
| DeepSeek-V4.1-Flash | 0/2 | unchanged (availability evidence only) |

The provisional selection of GPT-OSS-120B therefore rested on a mislabeled control: on the corrected labels the only false accept belongs to the selected judge, and the only "error" of the runner-up was a correct rejection. Sixteen controls with one decisive item cannot rank judges in either direction. In addition, run 028 used the same model as formalizer and judge, which the harness now refuses unless `--allow-self-judge` is given; treat 028–031 verdicts as self-judged development evidence.

The control set has been rebuilt in `tools/lib/judge-controls.mjs` (45 controls, 18 positive, 27 negative):

- a dedicated control document (`docs/evaluation/controls/judge-control-document.json`) that is outside every corpus, partition and selection — the earlier long controls reused `consolidated/base/01`, an evaluated (and calibration) document;
- long NL edits of that document (identity, omitted emotion/question/instruction, invented fact, question→answer, instruction→completion) with per-unit expectations;
- long native-CNL controls of both polarities: gold renderings (two orders) and deterministic corruptions of exactly one unit each — argument swap, negation scope move, quantifier drop, request→assertion, attribution→fact;
- short rubric controls, with `formal-ordered-arguments` now rendered with existential indefinites (positive) and the old constant rendering kept as the negative `constant-for-indefinite`;
- the eleven archive scope-corruption pairs (`docs/evaluation/atomic/archive-scope-corruptions`), both gold (archive-provided, not independently adjudicated) and corrupted renderings.

Judge choice must be re-established on this set, with a judge from a different model family than the formalizer, before any ranked run. `run-eval --controls` injects the same set into a run and reports sensitivity/specificity.

## 033–038 — Batched calibration on the 45-control set

Each judge task (document verdicts, unit verdicts) sends the whole control set as **one batched request** per model (`tools/calibrate-judge.mjs` default). A request is repeated only for items whose part of the reply was malformed: Pworker keeps every item that parses on its own. Cache off, no repairs. Only models with a low Openference quota multiplier were tried.

| Run | Requested model | Quota × | Requests | Correct | Sensitivity (neg. rejected) | Specificity (pos. accepted) | False accepts | Unit level (126) | Credits |
|---|---|---:|---:|---:|---:|---:|---|---|---:|
| 035 | Qwen3.8 27b | 0.1 | 3 | 44/45 | 26/27 | 18/18 | `archive-unless_flip-bad` | 126/126 | 0.30 |
| 036 | Nemotron-3-120B | 0.1 | 5 | 43/45 | 25/27 | 18/18 | `long-cnl-negation-scope-move`, `archive-omit_time-bad` | 126/126 | 0.50 |
| 033 | GLM-4.7-Flash | 0.1 | 3 | 38/45 | 22/27 | 16/18 | 5 (incl. argument swap, request→assertion) | 125/126 (1 fp) | 0.30 |
| 038 | DeepSeek-V4-Flash-0731 | 0.75 | 2 | 36/45 | 24/27 | 12/18 | 3 | 126/126 | 1.50 |

Gemma 4 26B was stopped after repeated provider 529 (overloaded) responses; GPT-OSS-120B returned only provider 429 responses for over 20 minutes (a per-model capacity limit: `x-ratelimit-remaining` stayed above zero). Neither is accuracy evidence. Every model fails the strict control gate (any false accept). The unit-level judge, the primary endpoint, makes no error on the 126 units for three of four models; the document-level flag is where the models differ.

**Choice:** Qwen3.8 27b is the provisional judge (cheapest tier, best document-level result). Its only false accept is a scope flip of `unless`; a second judge from another family (Nemotron-3-120B) is the cross-check. Strategies formalized by Qwen-family models must use another judge. Forty-five controls cannot rank judges whose results differ by one item.

## Non-LLM similarity cannot replace the judge

`tools/similarity-baseline.mjs` scores each control with a hyperdimensional (VSA/HDC) bundle of content words plus permuted bigrams. Small sentence-embedding models (all-MiniLM-L6-v2, bge-small-en-v1.5, nomic-embed-text-v1.5) were tried the same way, with cosine similarity of the two texts. No threshold does better than rejecting everything (27/45): HDC 28/45, MiniLM 29/45, bge 28/45, nomic 28/45. On the eleven archive pairs, the good rendering scores above its corrupted twin only 5–7 times out of 11, which is chance. The corruptions (argument swap, negation scope, `unless` flip, attribution as fact, question as answer) keep the same words, so synonym dictionaries cannot help either. Similarity can flag gross omissions or topic drift, not equivalence.
