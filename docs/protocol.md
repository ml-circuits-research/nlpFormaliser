# Research protocol

The starting point is fidelity to each archive's architecture, not reducing every candidate to one small language. Read the [strategy map](strategies.md), [restoration audit](restoration-audit.md) and [corpus contract](../eval/README.md). Each strategy's `docs/original/` contains recovered design and evaluation instructions.

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

The first-pass evaluator invokes a formalizer at most once per input and does not feed judge feedback back into it. Deterministic strategies use no formalizer model. Native repair pipelines are preserved with their own tasks and history, but repair must be explicitly enabled in a separate experiment. Transport/token failures are not semantic failures. A truncated response is not accepted as a completed candidate.

## Corpus selection

The base corpus has a fixed five-case debugging sample, plus a deterministic ID-based development/heldout split. Those five cases cannot support a ranking. Imported corpora retain their original partitions, annotations, overlapping tags, context and connected turns; `--stage source` uses the full supplied partition. No new random split is imposed on native development/heldout files. Source-heldout is a provenance label, not a claim of fresh independent data.

Formalizer tasks receive only source text, context and turns. Every example in `eval/` is a separate plain-text `.txt` file. Reference IR/CNL, expected query answers and corruption labels stay evaluator-private under `docs/evaluation/`. A dialogue stays connected. Good/bad judge pairs belong to paired judge calibration, not ordinary formalizer accuracy. Duplicate source texts are reported in `docs/evaluation/coverage-inventory.json`, not merged or counted as independent evidence.

## Measurement

For each source and semantic category/tag, report validity, missing/added/changed meaning, uncertainty, backend coverage, behavioral semantic probes and control probes. Unsupported execution is distinct from wrong inference. Empty representations must still face relevant native probes; dropping failed cases from denominators inflates accuracy. Reports include probe coverage and accuracy over all annotated probes as well as tested-only accuracy. Missing annotations yield null metrics, not perfect scores.

The common judge offers direct equivalence and bidirectional checks. Either false direction disproves equivalence; otherwise an unknown direction leaves it unknown. Malformed and contradictory verdicts remain judge errors. Native strategy-specific judges and their protocols are preserved as separate instruments: discourse-context review and risk sampling, MicroIR compact difference scoring, lab coverage/faithfulness and repeated-judge variance.

Reasoning eligibility is screened separately from equivalence and reported per category: symbol length (every symbol has at most 3 words, see the [strategy map](strategies.md)), source echo (4+ consecutive source words inside one symbol, label or template, with an echo ratio), coverage, control-only and unresolved content. Explanatory fields required by this protocol (ambiguity descriptions, glosses) may be long, but they are never rendered into the CNL that the judge scores.

Calibrate judges with native corrupted pairs, positive controls, scope/role/speech-act perturbations and independent review. Same-model generation and judging is development evidence only. Stronger-tier rejudging reuses exact stored formalizations. Never infer semantic correctness from fluency or the judge's confidence alone.

## Reproducibility and costs

An experiment directory is immutable. Its manifest records source hashes, source cases, options and model catalog; per-item artifacts retain the native representation, provenance, CNL, diagnostics, references and available behavioral results. Calls/tasks are logged separately. Existing IDs are refused. Old restricted-adapter runs remain historical evidence and are not pooled with restored strategies.

Report client requests, upstream attempts where available, cache hits, token use, latency and known credit headers separately. Missing USD or credit values are unknown, not zero. Provider retries can outnumber client calls; a timed-out provider request may complete after the client exits. Tier names do not establish a model-size or quality ordering.

## Extension discipline

Establish parity with original tests before evaluating changes. Form a mechanism-specific hypothesis, preserve the baseline, document all schema/prompt/backend changes and add counterexamples plus controls. Compare on matched cases and report specialization rather than force a universal winner. Repair studies additionally require no-op preservation, corruption recovery, draft retention and final reuse. Hybrid stages must expose each intermediate artifact and its cost; no stage is assumed to improve meaning for free.
