# Evaluation corpus and provenance

Every example is a separate `.txt` file containing readable natural-language text. The original `base/` corpus remains unchanged. Archive examples follow the same simple convention; a connected conversation stays in one file with speakers and ordered lines.

For example, open `archive-lab-development/C10.txt` or `archive-discourse-dialogue/connected-chat.txt`. No JSON, formal programs or reference answers are needed to read an example. Add or edit text files normally.

| Set | Records | Preserved evaluation information |
|---|---:|---|
| `archive-lab-development` | 31 | source categories, gold IR, semantic queries, UNKNOWN/FALSE controls |
| `archive-lab-heldout` | 29 | original source-heldout designation, gold IR and behavioral probes |
| `archive-scope-semantics` | 30 | reference MicroIR wire and overlapping semantic tags |
| `archive-scope-corruptions` | 11 | good/bad formalizations and expected corruption; judge tests, not extraction examples |
| `archive-speech-acts` | 50 | gold CNL, tags and supplied conversational context |
| `archive-speech-sample` | 1 | paired multiline source/CNL sample |
| `archive-discourse-dialogue` | 1 session | all 30 ordered turns and speakers; never split into context-free examples |

Total: 153 imported records, including 11 judge pairs and one 30-turn session. These supplement the 138 existing base texts. Individual sample strings may overlap; counts do not imply 291 statistically independent samples. Source-heldout means held out by that archive's authors, not a newly certified independent test set for this project.

## Record contract

The `.txt` files are the authoritative evaluation inputs. Research annotations are stored separately under [`docs/evaluation/metadata/`](../docs/evaluation/metadata/), and original source datasets under [`docs/evaluation/sources/`](../docs/evaluation/sources/). The [import inventory](../docs/evaluation/archive-inventory.json) records their provenance. These files preserve references, queries, corruption pairs and source fields without cluttering the examples.

The loader attaches annotations only when the visible text still matches the imported source. Editing an example invalidates its old references and structured turns rather than silently evaluating the new text against stale answers. Adding a `.txt` file requires no metadata file. Removing a text file removes that example from the loaded set.

Only `text`, context and turns can enter model tasks through `sourceForModel`. Gold IR, reference CNL and expected behavioral answers remain evaluator-private. Tests enforce this boundary. Conversation-aware strategies receive ordered turns; generic model strategies receive an explicit speaker/turn serialization. The discourse parser preserves state across these turns.

Judge pairs must compare the CNL generated from both good and corrupted programs; they must not be counted as duplicate formalizer cases or silently discarded. Use representation-specific probes for gold IR/wire. Exact symbol F1 is secondary because open predicates can be synonymous.

## Comparison discipline

Report per source, construction/category, overlapping tag, context length, formalization status, backend coverage, behavioral controls and judge outcome. A strategy can specialize successfully. Missing operational semantics should be reported as unsupported, never as automatic false reasoning or silently flattened facts. Native benchmark references need independent review before being treated as ground truth.

Example offline inspection (no model requests):

```sh
node tools/formalize.mjs --list
node tools/run-eval.mjs --strategy deterministic-rule-draft --set archive-lab-development --stage source --offline
node tools/run-eval.mjs --strategy discourse-semantic-graph --set archive-discourse-dialogue --stage source --offline
```
