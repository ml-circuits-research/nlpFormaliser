# Integration into another project

The library has no external dependencies. The simplest integration is to copy this directory into the target repository and import from `src/index.mjs`.

```js
import {
  buildProtoIR,
  HeuristicStrategy,
  renderCNL,
  compileFormalModule,
  evaluateDataset
} from "./nl-formalizer-lab/src/index.mjs";
```

A production project will probably keep the evaluator/benchmarks separate from its application runtime. The useful runtime subset is:

```text
src/ir.mjs
src/protoir.mjs
src/cnl.mjs
src/compiler.mjs
src/reasoner.mjs                 # only if executable Horn-style reasoning is wanted
src/strategies/<selected>.mjs
src/llm/openai-compatible.mjs    # only for LLM strategies
```

For research, keep the whole package so all strategies are evaluated under the same harness.

## Recommended boundary with SOP Lang or another backend

Do not replace the evaluation layer. Add a compiler:

```text
Formal IR -> SOP Lang
```

and optionally an inverse renderer:

```text
SOP Lang -> Formal IR / CNL
```

Then compare the SOP-backed strategy using the same behavioral tests and NL/CNL judge. This makes representation changes measurable instead of anecdotal.

## Custom strategy file

A strategy can live in the host project and be loaded by path:

```bash
node nl-formalizer-lab/bin/eval.mjs \
  --dataset nl-formalizer-lab/benchmarks/pilot-heldout.json \
  --strategy-file ./my-formalizer-strategy.mjs
```

The strategy file may default-export a strategy instance/class or export `createStrategy(args)`.
