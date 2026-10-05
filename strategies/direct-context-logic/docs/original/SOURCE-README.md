# NL Formalizer Lab

Experimental, dependency-free Node.js/MJS library for comparing strategies that formalize natural language into an executable symbolic representation.

The central loop is:

```text
Natural Language
      |
      v
Conservative ProtoIR  (surface evidence; high recall; exact spans)
      |
      v
Formalization Strategy
      |-- heuristic
      |-- direct LLM
      |-- ProtoIR + LLM normalizer
      `-- heuristic + LLM repair
      |
      v
Formal IR 0.2
      |
      +--> deterministic reasoner / behavioral tests
      |
      +--> executable generated .mjs program
      |         `--> Controlled Natural Language (CNL)
      |
      `--> LLM semantic judge: NL <-> CNL fidelity
```

The library deliberately separates **formalization** from **evaluation**. A new strategy only needs to implement `formalize(text)`. The same CNL renderer, reasoner, gold tests, structural metrics, and optional independent LLM judge can then evaluate every strategy.

## Requirements

- Node.js 20+ (tested with Node 22)
- no npm dependencies
- an OpenAI-compatible chat-completions endpoint only for LLM strategies/judging

## Quick start

```bash
npm test
npm run demo

node bin/formalize.mjs \
  --text "Mira is a physicist. Mira owns a workstation." \
  --strategy heuristic --json --cnl
```

Generate an executable formal program:

```bash
node bin/formalize.mjs \
  --text "Mira is a physicist. Mira owns a workstation." \
  --strategy heuristic \
  --emit /tmp/formal.mjs

node /tmp/formal.mjs
```

The generated `.mjs` is standalone: executing it prints deterministic CNL.

## LLM formalization / repair

The included client speaks a minimal OpenAI-compatible `/v1/chat/completions` protocol.

```bash
export FORMALIZER_BASE_URL=http://127.0.0.1:8000/v1
export FORMALIZER_MODEL=my-model
# FORMALIZER_API_KEY is optional for a local endpoint

node bin/formalize.mjs --file input.txt --strategy direct --cnl
node bin/formalize.mjs --file input.txt --strategy proto --cnl
node bin/formalize.mjs --file input.txt --strategy repair --cnl
```

`proto` receives the original NL plus conservative ProtoIR. `repair` additionally receives the heuristic draft. It is explicitly told that NL is authoritative and that the draft is only fallible evidence.

## Evaluation

Two complementary families of metrics are supported.

1. **Executable behavioral tests**: fixed queries have expected `TRUE/FALSE/UNKNOWN` results. These are the strongest non-circular tests in the current harness.
2. **LLM semantic judge**: compares original NL against CNL generated from the formal program. It scores coverage and faithfulness separately, plus scope/coreference/temporal-modality.

Run the preserved held-out pilot benchmark:

```bash
node bin/eval.mjs \
  --dataset benchmarks/pilot-heldout.json \
  --strategy heuristic
```

Compare strategies:

```bash
node bin/compare.mjs \
  --dataset benchmarks/pilot-heldout.json \
  --strategies heuristic,direct,proto,repair \
  --out comparison.json
```

To add an LLM judge, configure a preferably different model:

```bash
export JUDGE_BASE_URL=http://127.0.0.1:8000/v1
export JUDGE_MODEL=independent-judge-model

node bin/compare.mjs \
  --dataset benchmarks/pilot-heldout.json \
  --strategies heuristic,direct,proto,repair \
  --judge --judge-runs 3
```

## Why NL -> Formal IR -> CNL -> Judge?

Direct structural exact match is too strict: two programs can be semantically equivalent while using different predicate names or reification choices. Conversely, a fluent CNL can hide an incorrect program. The harness therefore combines:

- structural precision/recall against optional gold IR;
- executable query behavior;
- CNL round-trip semantic fidelity judged in both directions;
- repair reuse (how much of the draft survives a repair).

The LLM judge is **not a proof of correctness**. It is an additional measurement channel. For serious experiments, freeze behavioral tests before repair, keep the judge blind to strategy identity, and preferably use a judge model independent of the formalizer.

## Drop-in custom strategies

A custom `.mjs` strategy can be evaluated without editing the library:

```bash
node bin/eval.mjs \
  --dataset benchmarks/pilot-heldout.json \
  --strategy-file examples/custom-strategy.mjs
```

The module may default-export a strategy object/class or export `createStrategy(args)`.

## Directory layout

```text
src/
  protoir.mjs              conservative surface extraction
  ir.mjs                   Formal IR constructors/validation
  cnl.mjs                  deterministic Formal IR -> CNL
  reasoner.mjs             tiny Datalog-like executor
  compiler.mjs             Formal IR -> standalone executable .mjs
  evaluator.mjs            behavioral/structural/reuse metrics
  judge.mjs                NL <-> CNL judge protocol
  llm/openai-compatible.mjs
  strategies/
    heuristic.mjs
    direct-llm.mjs
    proto-llm.mjs
    repair-llm.mjs
bin/
  formalize.mjs
  eval.mjs
  compare.mjs
  corruption-eval.mjs
  judge.mjs
benchmarks/
experiments/
tests/
docs/
```

See `docs/ARCHITECTURE.md`, `docs/IR.md`, `docs/EVALUATION.md`, `docs/ADDING_STRATEGY.md`, `docs/EXPERIMENT_PLAN.md`, `docs/INTEGRATION.md`, `docs/SECURITY.md`, and `docs/LIMITATIONS.md`.
