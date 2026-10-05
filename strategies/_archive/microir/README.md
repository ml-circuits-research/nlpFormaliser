# microir-formalizer-mjs

Experimental `.mjs` library for **automatic semantic formalization of natural language**.

Target loop:

```text
Natural Language
      |
      v
  LLM formalizer
      |
      v
 compact MicroIR
      |
      v   deterministic
      CNL
      |
      v
   LLM judge  <---- compares only NL vs CNL
      |
  good? ---- yes ---> accept best IR
      |
      no
      v
  LLM repair -> IR -> CNL -> judge
```

The important separation is deliberate:

- the LLM proposes a formal representation;
- the library parses/validates it without `eval`;
- **CNL generation is deterministic**;
- the library keeps a readable CNL and a shorter compact CNL for the judge;
- the semantic judge sees the original NL and generated CNL, not hidden reasoning;
- repair is optional and bounded;
- the best-scoring candidate is retained even if a repair makes things worse.

## 1. Tiny IR

There is only one open-vocabulary predicate constructor: `$`.

```mjs
$.buy(ravi,laptop)
$.believe(alice,$.leave(bob))
$.time($.plan(ravi,$.buy(ravi,laptop)),next_month)
```

`buy`, `believe`, `time`, `plan`, etc. are **not predefined JS functions**. `$` is a `Proxy`; every `$.name(...)` dynamically returns the same predicate node shape.

Fixed operators are only those needed for logical structure:

```text
A(...)     and
O(...)     or
N(x)       not
I(a,b)     implication
U(x,e)     forall     (wire syntax)
E(x,e)     exists
Q(e)       yes/no question
W(x,e)     wh-question
[...]      ordered discourse
```

Example:

```text
Every researcher writes a paper. Does Alice write a paper?
```

```mjs
[
  U(x,I($.researcher(x),E(y,A($.paper(y),$.write(x,y))))),
  Q(E(y,A($.paper(y),$.write(alice,y))))
]
```

## 2. Why dynamic predicates?

They keep the formal language tiny while allowing an unlimited semantic vocabulary. The library does not need a hard-coded function for `buy`, `temperature`, `medical_device`, or a new domain term.

Underscores are allowed for lexical compounds (`credit_card`, `new_york`). They should **not** hide structure merely to save characters. Prefer:

```mjs
$.time($.plan(ravi,$.buy(ravi,laptop)),next_month)
```

over an opaque `$.plan_time(...)` when `time` may later matter independently.

## 3. Deterministic CNL

```mjs
import { fromWire, toCNL } from './src/index.mjs';

const ir = fromWire('N($.promise(alice,$.attend(alice,meeting)))');
console.log(toCNL(ir));
```

The renderer intentionally avoids guessing whether an arbitrary predicate is a noun, verb or adjective. It emits explicit controlled language such as:

```text
it is not the case that (the predicate “promise” holds for “alice”, in that order,
the proposition that the predicate “attend” holds for “alice”, in that order, “meeting”)
```

This is less elegant than free English but has a crucial property: rendering is deterministic and does not silently invent lexical semantics.

## 4. Pipeline API

```mjs
import {
  createOpenAICompatibleAdapter,
  createPipeline
} from './src/index.mjs';

const formalizer = createOpenAICompatibleAdapter({
  baseURL: 'http://localhost:8000/v1',
  model: 'your-formalizer-model'
});

const judge = createOpenAICompatibleAdapter({
  baseURL: 'http://localhost:8001/v1',
  model: 'your-judge-model'
});

const f = createPipeline({
  formalizer,
  judge,
  maxRepairs: 1,
  threshold: 0.985
});

const result = await f.run(
  'Ravi plans to buy a laptop next month. Has he bought it?'
);

console.log(result.best.wire);
console.log(result.best.cnl);
console.log(result.best.audit);
```

The judge uses a compact deterministic CNL by default to reduce prompt size; `result.best.cnl` remains the readable rendering and `result.best.judgeCNL` is the compact judge rendering.

Normal cost when the first result is accepted: **2 LLM calls** (formalizer + judge). One repair makes it **4 calls**. `maxRepairs` bounds cost explicitly.

## 5. CLI

```bash
node bin/microir.mjs render --wire 'Q($.owns(alice,car))'
node bin/microir.mjs validate --wire 'Q($.owns(alice,car))'
```

For an OpenAI-compatible local/API server:

```bash
export FORMALIZER_BASE_URL=http://localhost:8000/v1
export FORMALIZER_MODEL=my-formalizer
export JUDGE_BASE_URL=http://localhost:8001/v1
export JUDGE_MODEL=my-judge

node bin/microir.mjs pipeline --file input.txt --repairs 1 --threshold .985
```

The judge defaults to the formalizer endpoint/model if `JUDGE_*` is absent, but an independent judge is preferable for evaluation.

## 6. Tests and evals

```bash
npm test
npm run eval:static
npm run eval:compactness
```

LLM-dependent evaluations:

```bash
npm run eval:judge
npm run eval:formalizer
```

The repository contains:

- 30 realistic multi-sentence NL cases mixing statements and questions;
- gold reference IR for structural testing;
- 11 deliberately corrupted formalizations for evaluating the judge;
- static parser/serializer/CNL tests;
- pairwise judge evaluation (`good IR` should score above `corrupted IR`);
- end-to-end formalizer evaluation with bounded repair.

See `docs/` for the design and evaluation protocol.
