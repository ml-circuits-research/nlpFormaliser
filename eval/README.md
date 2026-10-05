# Consolidated evaluation texts

The active input corpus is `consolidated/`: **29 plain-text cases**, each in its own `.txt` file, with **13–33 sentences**. They combine 280 original formalization examples and include questions, instructions and emotional statements.

| Directory | Cases |
|---|---:|
| `consolidated/base` | 14 |
| `consolidated/lab-development` | 3 |
| `consolidated/lab-heldout` | 3 |
| `consolidated/scope` | 3 |
| `consolidated/speech-acts` | 5 |
| `consolidated/dialogue` | 1 |

The connected dialogue preserves all 30 original turns and adds three mixed-act turns. Other cases combine source records with a sentence explicitly stating that unrelated situations remain separate. These are synthetic stress tests, not recorded natural conversations. Additions and source provenance are recorded in [consolidation.json](../docs/evaluation/consolidation.json).

All **291 original texts** remain under [docs/evaluation/atomic](../docs/evaluation/atomic/). Eleven are paired judge-corruption controls, not formalization inputs; they are not concatenated. Original gold programs, behavioral probes and context remain in [metadata](../docs/evaluation/metadata/) and [source datasets](../docs/evaluation/sources/). Atomic references are not gold for a combined document: combination can change reference and consistency.

When a consolidated case is loaded, each source record's behavioral probes and gold (Lab formal IR and probes, scoped wires, speech-act CNL) are attached under `reference.atomic` with the record's character span in the document, and the probes are listed in `reference.behavior` with `sourceId` and `scope: "atomic-span"`. Strategies with a native probe runner (the Lab family) therefore execute probes on consolidated documents; runs report probe coverage per strategy. No whole-document gold IR is invented. Base records carry no probes; scoped records carry gold wires but no behavioral probes.

## First ten cases

[consolidated-first10.json](../docs/evaluation/selections/consolidated-first10.json) fixes the shared selection: five base cases, two Lab development cases, one scope case, one speech-act case and the connected dialogue. No Lab heldout case is included. This is development evidence, not an independent generalization estimate.

Visible text is authoritative. Editing it invalidates stale annotations. Only source text, context and turns enter model tasks; reference answers remain private to the evaluator. Archived sets remain explicitly loadable for reproducibility, but are not active sets.

## CNL result mirrors

Runs using `--mirrors` write generated CNL under:

`success/<experiment>/<strategy>/consolidated/<category>/<case>.txt`

`fail/<experiment>/<strategy>/consolidated/<category>/<case>.txt`

The relative case path mirrors the input. Files contain actual deterministic native CNL, not summaries or original input. If no CNL was produced, the file is empty; no substitute is invented.

The success bucket is a joint diagnostic: valid formalization, positive whole-document equivalence and passage of the reasoning-eligibility screen. `mirror-index.json` records equivalence and eligibility as separate fields; neither is folded into the other in summaries. Fail means **not accepted**, not necessarily semantically false: it includes parser failures, judge errors, uncertainty and unsupported reasoning. Exact reasons and output availability are recorded in each experiment's `mirror-index.json`. Neither output directory is an input corpus.

## Comparison discipline

Report validity, equivalence, reasoning eligibility, budget/infrastructure errors and costs separately. The primary endpoint is unit-level: each document is split into sentence units (with atomic-source or turn provenance) and the judge returns a verdict per unit; per-document proportions, macro/micro means, clustered bootstrap intervals and paired comparisons follow. Whole-document equivalence is a strict secondary flag: losing one meaningful question or instruction is a failure.

The five calibration cases (`consolidated/base/01`–`05`) are excluded from the development and held-out partitions. The `consolidated-first10` selection predates that rule and includes `base/01` and `base/04`; runs using it are labelled `selection` and flagged. Judge controls never use corpus documents: they use the dedicated [control document](../docs/evaluation/controls/judge-control-document.json). Opaque source-text copies are not reasoning representations even if a judge accepts their wording. The eligibility audit is a screen, not a proof of logical adequacy.

Native CNL is judged in the first consolidated run. Common-CNL projections are saved alongside it; incomplete projections are not silently judged as complete documents. Strategies without a complete reasoning backend and the surface-normalization control cannot enter the reasoning success ranking.
