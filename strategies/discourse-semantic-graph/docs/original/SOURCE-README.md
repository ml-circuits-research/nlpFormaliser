# NL2CNL Judge Strategy v1

A self-contained research strategy for **fast natural-language → controlled-natural-language formalization** with **symbolic first pass + batched LLM semantic validation**.

The package is intentionally narrow. It does **not** contain RDF, Prolog, Z3, ontology tooling, vector search, or a reasoning engine. Its only job is:

```text
Natural Language
      ↓
cheap symbolic formalizer
      ↓
canonical readable CNL candidate
      ↓
symbolic audit / ambiguity flags
      ↓
optional batched LLM semantic judge
      ↓
accepted / rejected / uncertain candidate
```

This is meant to be compared experimentally with other NL formalization strategies.

## Why validate with an LLM?

The CNL is deliberately readable English-like structure, so a capable LLM can compare it directly with the original text. The judge is instructed to check semantic equivalence rather than stylistic similarity: omissions, inventions, scope, reference, speech act, modality, time, causality, and semantic roles.

An LLM verdict is **not a proof of equivalence**. It is a cheap semantic test that complements symbolic checks. The important empirical metric is the rate of **silent errors**: wrong formalizations that neither the symbolic layer nor the judge notices.

## Requirements

- Node.js 20+
- no runtime npm dependencies
- optional: any LLM accessible through an OpenAI-compatible chat-completions endpoint, or your own callback

## Library use

```js
import {
  formalizeConversation,
  buildJudgeBatches,
  judgeBatches,
  combineValidation,
  makeOpenAICompatibleCaller,
} from './index.mjs';

const conversation = formalizeConversation([
  { id: 't1', speaker: 'user', text: 'Not every reviewer must accept a paper.' },
  { id: 't2', speaker: 'user', text: 'Does that mean some reviewer is not required to accept one?' }
]);

const batches = buildJudgeBatches(conversation, {
  policy: 'all' // all | risky | sampled
});

const callLLM = makeOpenAICompatibleCaller({
  endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
  model: 'your-model'
});

const reviews = await judgeBatches(batches, { callLLM });
const final = combineValidation(conversation, reviews, {
  requireJudgeForAcceptance: true
});
```

You can replace the HTTP caller with any function:

```js
const reviews = await judgeBatches(batches, {
  callLLM: async ({system, user}) => myOwnModel(system, user)
});
```

## Core API

### Formalization

- `formalizeText(text, options)`
- `formalizeConversation(turns, options)`
- `renderTurn(turn)` / `renderNode(node)`
- `detectSymbolicRisks(...)`
- `auditTurn(turn)` / `auditConversation(conversation)`

### Semantic judge

- `selectTurnsForJudge(conversation, options)`
- `buildJudgeBatches(conversation, options)`
- `judgeSystemPrompt(options)`
- `judgeUserPayload(batch, options)`
- `judgeBatch(batch, {callLLM})`
- `judgeBatches(batches, {callLLM})`
- `validateJudgeResponse(batch, response)`
- `combineValidation(conversation, reviews, options)`
- `makeOpenAICompatibleCaller(options)`

## Judge policies

`policy: "all"`
: Judge every formalization. Best for experiments measuring actual semantic accuracy.

`policy: "risky"`
: Judge only candidates with symbolic audit failures or ambiguity warnings. Cheapest, but cannot estimate silent-error rate well.

`policy: "sampled"`
: Judge all risky candidates plus a deterministic sample of apparently safe candidates. Recommended for deployment-style experiments.

Multiple candidates are packed into one request up to `maxItems` / `maxChars`, so a batch can validate many turns in one LLM call.

## Acceptance logic

A turn is not accepted merely because the symbolic parser emitted CNL.

Typical strict experimental mode:

```text
symbolic AST valid
AND symbolic semantic audit passes
AND LLM verdict = equivalent
AND LLM confidence >= threshold
```

If source/context genuinely leaves multiple readings, the judge should return `uncertain`, not guess.

## CLI

```bash
node cli.mjs formalize "Not every reviewer must accept a paper."
node cli.mjs conversation examples/connected-chat.json
node cli.mjs judge-request examples/connected-chat.json --policy all
```

Live OpenAI-compatible judge:

```bash
export NLCNL_ENDPOINT=http://127.0.0.1:8000/v1/chat/completions
export NLCNL_MODEL=my-model
export NLCNL_API_KEY=optional
node cli.mjs judge-live examples/connected-chat.json --policy sampled
```

## What the symbolic formalizer currently covers

It has explicit representations for common conversational acts and common logical/semantic constructions, including:

- assertions, questions, requests, instructions, goals, preferences, corrections, confirmations;
- events and semantic roles;
- universal/existential/no-style quantification in common forms;
- negation;
- must/may/should/can and several negative modal forms;
- if/then/else, unless, when;
- before/after;
- because;
- conjunction/disjunction;
- several relative-clause patterns;
- common pronoun/coreference cases;
- `whether`, `only`;
- simple search/list/compare/summarize directives;
- deadlines, location, source/destination, instrument in common forms.

It is **not** a complete semantic parser. Difficult nested scope, complex ellipsis, arbitrary anaphora, subtle tense/aspect, counterfactuals, pragmatics, presupposition, numerical constraints, and many long/irregular sentences can fail or be marked unresolved.

## Experimental recommendation

When comparing this strategy with alternatives, use a held-out dataset and record at least:

1. exact/adequate formalization rate;
2. LLM-judged equivalence rate;
3. LLM intervention rate;
4. symbolic unresolved rate;
5. **silent error rate**;
6. tokens/cost/latency per source turn;
7. batch size and calls per 100 turns.

Do not tune the symbolic rules on the same held-out set used for the final score.

## Files

- `src/formalizer.mjs` — symbolic NL → CNL engine
- `src/judge.mjs` — batch semantic judge and provider-independent LLM adapter
- `src/index.mjs` — public exports
- `index.mjs` — package entry point
- `cli.mjs` — thin CLI wrapper
- `docs/ARCHITECTURE.md` — end-to-end procedure
- `docs/JUDGE_PROTOCOL.md` — semantic equivalence protocol
- `docs/CNL.md` — current canonical representation
- `docs/EVALUATION.md` — how to compare this strategy fairly
- `examples/connected-chat.json` — linked conversational examples
- `examples/run.mjs` — offline example
- `test/` — regression tests

MIT license for this prototype code.
