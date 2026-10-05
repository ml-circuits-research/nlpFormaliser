# Architecture

## Design objective

The long-term target is a formalizer that can process ordinary NL and produce a formal program whose execution yields a CNL rendering close enough to the original meaning that an independent evaluator can quantify the remaining semantic gap.

The design avoids committing the whole project to one parser or one model.

## Stage 1 - ProtoIR

`buildProtoIR(text)` is intentionally conservative. It records:

- original source text;
- exact tokens and character spans;
- sentence and coarse clause spans;
- mention candidates;
- explicit negation, quantifier, modality, conditional, temporal, coordination and question markers;
- predicate candidates;
- a few surface-relation candidates.

ProtoIR is **not claimed to be semantic truth**. False-positive candidates are preferable to silent deletion of source evidence. The original source is retained.

This corrects the main failure observed in pilot v1: early regex canonicalization was brittle under paraphrase and caused the LLM repair stage to reconstruct most semantics from scratch.

## Stage 2 - Formalization strategy

A strategy implements:

```js
class MyStrategy {
  name = "my-strategy";
  async formalize(text, {proto}) {
    return { ir, proto, artifacts };
  }
}
```

Included strategies:

- `heuristic`: deterministic, deliberately limited baseline;
- `direct-llm`: NL -> Formal IR;
- `proto-llm`: NL + ProtoIR -> Formal IR;
- `heuristic+repair`: NL + ProtoIR + deterministic draft -> repaired Formal IR.

Future candidates can include dependency-parser based strategies, AMR/DRS adapters, a trained small formalizer, SOP Lang compilation, ensemble/voting approaches, or an agentic multi-pass formalizer.

## Stage 3 - Formal IR

Formal IR has a deliberately small executable core:

- facts (atoms);
- rules;
- contexts;
- queries;
- external predicates/procedures;
- explicit ambiguities;
- optional symbol metadata.

Facts and rules are directly executable by the bundled reasoner. Contexts and ambiguities are retained symbolically even where the tiny reasoner does not yet implement their full logic. This is preferable to flattening scope incorrectly.

## Stage 4 - deterministic CNL

`renderCNL(ir)` is deterministic. It never asks an LLM to paraphrase the program. This is important: the round-trip judge should evaluate the formal representation, not another generative rewrite that can repair or hallucinate meaning.

Predicate metadata may provide a CNL template such as:

```json
{"cnl":"{0} owns {1}"}
```

Without a template the renderer uses a deliberately mechanical controlled form.

## Stage 5 - executable formal module

`compileFormalModule(ir)` emits a standalone `.mjs` containing:

- the complete Formal IR as exported data;
- a deterministic CNL renderer;
- `toCNL()`;
- a main entrypoint that prints the CNL.

Thus the formal artifact is actual executable code and can be stored, inspected, diffed, tested, or passed to another reasoner.

## Stage 6 - evaluation

The same formal IR is evaluated through independent views:

1. structural comparison against optional gold IR;
2. executable semantic queries;
3. deterministic CNL round-trip judged against source NL;
4. draft/final reuse for repair strategies.

The desired research trajectory is not to maximize one number but to find a representation/strategy where these measurements agree.
