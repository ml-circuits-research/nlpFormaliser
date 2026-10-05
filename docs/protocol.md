# Research protocol

The starting point is fidelity to each archive's architecture, not reducing every candidate to one small language. Read the [strategy map](strategies.md), [restoration audit](restoration-audit.md) and [corpus contract](../eval/README.md). Each strategy's `docs/original/` contains recovered design and evaluation instructions.

## Methodology

**Primary endpoint: unit-level preservation among eligible outputs.** Each source document is split into units — sentences, carrying atomic-record or dialogue-turn provenance where the corpus records it (`tools/lib/units.mjs`). Units come from the source only, never from a strategy's output, so every strategy is scored on identical units. One call per document to the predefined `tasks/judge-units.mjs` task returns a strict JSON verdict per unit id (`preserved: true|false|null`); missing, duplicate or unknown ids are judge errors. The primary statistic is the micro mean of preserved units among valid, reasoning-eligible, unit-judged outputs; uncertain units count as not preserved and are reported separately. Valid-only and intention-to-treat (invalid or ineligible outputs score 0) populations are reported alongside.

**Secondary endpoint: whole-document equivalence.** The existing direct/bidirectional judge remains a strict whole-document flag: losing one meaningful question or instruction fails the document. It has little statistical power on a few long documents, which is why it is secondary.

**Eligibility is reported separately.** Reasoning eligibility (the export/opacity screen) and semantic equivalence are distinct columns. Neither is folded into a single success flag; `eligibleEquivalent` and the mirror buckets are joint diagnostics only. Validity, formalization failures and budget/infrastructure failures are separate again; only formalization failures are semantic evidence.

**Judge independence.** The judge must not be the formalizer: `run-eval` refuses equal models (or equal tiers) unless `--allow-self-judge`, which marks the run as development evidence. Use a judge from a different model family; same-family pairs, tier-routed pairs and served-model overlap are recorded and flagged.

**Controls and gating.** `--controls` injects the fixed control set (`tools/lib/judge-controls.mjs`: a dedicated control document outside every evaluation selection, long native-CNL gold renderings and deterministic corruptions with per-unit expectations, short rubric controls and the eleven archive scope-corruption pairs) into the run. The summary reports judge sensitivity (negative controls rejected) and specificity (positive controls accepted) at document and unit level with Wilson intervals. Any false accept, rates below the thresholds or failed control judgments fail the gate; `--control-gate abort` stops before formalization spending, otherwise the run is flagged and cannot be ranking-eligible. Judge prompts are not batched by default (`--judge-batch-size 1`): batching places several documents in one prompt.

**Intervals and paired tests.** Units within a document are correlated, so 95% intervals are percentile bootstraps that resample documents (clusters), with a fixed seed. Strategy comparisons are paired on shared documents and units: the difference in micro preservation with a paired clustered bootstrap interval, an exact sign test on discordant units (which ignores clustering and is reported with that caveat) and an exact sign test on per-document differences. Control-only strategies (Speech Act Normalization) are reported but excluded from rankings, pairs and oracle diagnostics.

**Power.** With roughly 300 units (about 15–20 consolidated documents) per strategy, a paired comparison can detect differences of about 10–15 percentage points in unit preservation; intra-document correlation raises the required number. Ten documents or a whole-document flag cannot support such claims. Plan the unit count before spending.

**Held-out data is used once.** Calibration cases (the first five structured records) are debugging material and are excluded from development and held-out partitions. Prompts, renderers, thresholds and judge choice are frozen on development data; the held-out partition is run once, for the final comparison, and never used to tune or route.

**Judge output policy.** The first complete JSON object is parsed (balanced braces, strings respected). Verdict fields must be JSON booleans or null: string booleans are rejected consistently as judge errors, never coerced. Trivially-empty notes ("none", "wording only") are normalized away; a positive verdict that still lists substantive differences is recorded as `equivalent_with_notes` (equivalent=null), counted separately from both successes and judge errors. Resolving a relative time ("tomorrow") to a calendar date that the source does not state is added content; it is flagged deterministically (`addedContent`) and the unit judge is instructed to treat it as added.

## Common boundary, distinct mechanisms

Strategies implement `formalize(text, ctx)`, structural `check`, and deterministic `toCNL`. `toReasoning` returns the complete artifact and any known backend-coverage gaps. The lab family additionally evaluates native structural/behavioral references. Contexts, ambiguity, discourse state, symbol metadata and unresolved nodes remain in their native representation; lack of an executor is not permission to delete them.

Record at least four distinct outcomes: representational validity, semantic preservation, backend coverage and executable behavior. A compiled module that prints CNL is executable but is not a proof engine. A template can preserve readable meaning without giving the reasoner its semantics. Metadata diagnostics therefore supplement the original rendering; they do not silently replace it.

## CNL alignment: native baseline and common comparison view

Current status: `tools/lib/common-cnl.mjs` implements versioned comparison nodes and a deterministic renderer for the scoped-logic family and a conservative facts/rules subset of Lab. Other families and unadapted native sections remain explicit residuals. Native renderers remain the reproducible baseline. Similar-looking English is not evidence of equivalent formal semantics.

A common comparison view must be a deterministic projection from each formal representation, never a paraphrase of the source NL or an LLM rewrite. Keep both native CNL and common CNL in experiment artifacts. Align explicit variable binding, argument order, conjunction/disjunction, negation scope, quantifiers, conditions, speech acts, context attribution, time and modality where the native representation supports them. Do not infer missing operators or resolve ambiguity just to fit the common view. Native textual glosses must remain labeled opaque, not promoted to executable propositions.

Implement adapters against a typed, versioned comparison schema with source-node provenance and explicit unsupported/residual nodes. Report projection coverage separately; a partially projected document cannot receive a whole-document equivalence result based only on its supported fragment. Preserve alternative readings rather than flattening them. This schema is an additional measurement boundary, not a replacement for richer native IRs or a claim of a universal reasoning backend.

Before using a common view for rankings, test binding, nested scope, role reversal, questions versus assertions, ambiguity and context boundaries. Compare judge decisions on native and common renderings of the **same stored formalizations**, using controlled corruptions and token/latency measurements. This isolates rendering bias from formalization changes. Use `--cnl-view common --rejudge PATH/items.jsonl`; the default remains native. Incomplete projections cannot be judged as complete documents. The common view retains predicate names and argument order; it does not infer ontology alignment or unknown predicate signatures.

## Sparse repair policy

First measure deterministic formalization alone, then first-pass task-backed formalization where required by the strategy; both prohibit LLM repair. Prefer principled deterministic improvements supported by failure classes and counterexamples, not sentence-specific patches. Keep generation, semantic judging and repair calls in separate cost categories: no formalizer call does not imply a zero-LLM evaluation.

Only promising strategies or explicitly tested combinations enter a later repair experiment. Define and freeze its trigger on development data: a structural violation, failed executable probe or a specific semantic discrepancy can justify a repair; judge uncertainty alone is not proof of an error. Measure trigger precision/recall and audit some untriggered cases. Preserve the original candidate, cap repair attempts explicitly, and record the smallest affected formal fragment plus the diagnostic supplied to the repair task. All repair calls use predefined Ploinky Workers tasks.

Report repair rate, independently verified recovery, regressions of initially correct outputs, unresolved failures and marginal cost per recovered case. Compare against the unchanged no-repair baseline on identical inputs. A good strategy should not depend on routinely repairing almost every output.

## Model task boundary

Every runtime model operation uses a predefined Ploinky Workers `.mjs` task. There are no direct model HTTP/SDK/CLI clients. Pworker loads the task module and explicitly enqueues/flushes instances. Matching phases can batch independent inputs; IDs are checked and results are routed back to the correct task. Token budget, cache, timeout and actual served model are recorded.

The first-pass evaluator invokes a formalizer at most once per input and does not feed judge feedback back into it. Deterministic strategies use no formalizer model. Native repair pipelines are preserved with their own tasks and history, but repair must be explicitly enabled in a separate experiment. Transport/token failures are not semantic failures. A truncated response is not accepted as a completed candidate. Worker truncation is a budget failure; transport errors and batch-envelope errors (invalid batch response, missing or unexpected result IDs) are infrastructure failures. Both are retried on resume and never counted as semantic failures. Resume refuses offline sources and any change of set, stage, selection, tiers, models, batch sizes, CNL view or token caps; Ploinky-Worker source differences are listed explicitly. Rejudging reuses the exact stored model input.

## Corpus selection

The corpus has a fixed five-case debugging sample (calibration), excluded from both the development and held-out partitions, plus the source-provided development/heldout split (or a deterministic ID-based split for flat sets). Those five cases cannot support a ranking. `--selection` and `--rejudge` runs are labelled `selection`/`rejudge`, not by a partition name, and selections overlapping calibration cases are flagged. Imported corpora retain their original partitions, annotations, overlapping tags, context and connected turns; `--stage source` uses the full supplied partition. No new random split is imposed on native development/heldout files. Source-heldout is a provenance label, not a claim of fresh independent data.

Formalizer tasks receive only source text, context and turns. Every example in `eval/` is a separate plain-text `.txt` file. Reference IR/CNL, expected query answers and corruption labels stay evaluator-private under `docs/evaluation/`. A dialogue stays connected. Good/bad judge pairs belong to paired judge calibration, not ordinary formalizer accuracy. Duplicate source texts are reported in `docs/evaluation/coverage-inventory.json`, not merged or counted as independent evidence.

## Measurement

For each source and semantic category/tag, report validity, missing/added/changed meaning, uncertainty, backend coverage, behavioral semantic probes and control probes. Unsupported execution is distinct from wrong inference. Empty representations must still face relevant native probes; dropping failed cases from denominators inflates accuracy. Reports include probe coverage and accuracy over all annotated probes as well as tested-only accuracy. Missing annotations yield null metrics, not perfect scores.

The common judge offers direct equivalence and bidirectional checks. Either false direction disproves equivalence; otherwise an unknown direction leaves it unknown. Malformed and contradictory verdicts remain judge errors. Native strategy-specific judges and their protocols are preserved as separate instruments: discourse-context review and risk sampling, MicroIR compact difference scoring, lab coverage/faithfulness and repeated-judge variance.

Calibrate judges with native corrupted pairs, positive controls, scope/role/speech-act perturbations and independent review. Controls never reuse an evaluation document. Same-model generation and judging is development evidence only and requires `--allow-self-judge`. Stronger-tier rejudging reuses exact stored formalizations. Never infer semantic correctness from fluency or the judge's confidence alone.

## Reproducibility and costs

An experiment directory is immutable. Its manifest records source hashes, source cases, options and model catalog; per-item artifacts retain the native representation, provenance, CNL, diagnostics, references and available behavioral results. Calls/tasks are logged separately. Existing IDs are refused. Old restricted-adapter runs remain historical evidence and are not pooled with restored strategies.

Report client requests, upstream attempts where available, cache hits, token use, latency and known credit headers separately. Missing USD or credit values are unknown, not zero. Provider retries can outnumber client calls; a timed-out provider request may complete after the client exits. Tier names do not establish a model-size or quality ordering.

## Extension discipline

Establish parity with original tests before evaluating changes. Form a mechanism-specific hypothesis, preserve the baseline, document all schema/prompt/backend changes and add counterexamples plus controls. Compare on matched cases and report specialization rather than force a universal winner. Repair studies additionally require no-op preservation, corruption recovery, draft retention and final reuse. Hybrid stages must expose each intermediate artifact and its cost; no stage is assumed to improve meaning for free.
