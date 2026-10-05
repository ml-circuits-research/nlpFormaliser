# Discourse Semantic Graph

Public ID: `discourse-semantic-graph`. Legacy compatibility ID: `symbolic`.

The source proposes a symbolic transducer plus selective batched validation, not merely isolated sentence parsing. Its state tracks recent entities/propositions across turns. The AST includes speech acts, events/roles, quantifiers, negation/modality, conditions/alternatives, temporal/causal relations, attitudes, queries, directives/selectors, goals/preferences, corrections and unresolved nodes.

Restored outputs include complete turns, speakers/addressees, discourse state, ambiguity alternatives/questions, confidence, symbolic audits, helper batches and load estimates. The native CNL is regenerated from the AST and diagnostics; cached CNL is not used as authoritative meaning. The 30-turn source conversation remains one evaluation unit and a parity test reproduces its state and rendering.

Review policies `all`, `risky`, and `sampled` are preserved. Source-aware review batches include conversational context and symbolic audit failures. The archive's validator checks protocol, batch/turn IDs, coverage, confidence and detailed error fields. `judge-task.mjs` supplies this native review through Ploinky Workers. The independent common judge is a separate measurement, not a replacement for the strategy's own audit architecture.

Unresolved nodes must remain visible, not disappear or cause the complete candidate to be discarded. They block claims of completed reasoning. A downstream reasoning compiler is explicitly outside the archive's implementation; the adapter preserves the complete graph and marks that backend gap. Extending it requires binder/reference integrity and operator semantics; labels such as `x2 you flagged` cannot substitute for a flag relation.

The helper replacement protocol is preserved in the source API but is not activated in first-pass runs. Prior false-positive judge findings remain useful failure hypotheses, not a verdict against a pipeline that had been partially omitted.

Recovered [architecture](original/ARCHITECTURE.md), [CNL node families](original/CNL.md), [native judge protocol](original/JUDGE_PROTOCOL.md), and [evaluation](original/EVALUATION.md).

## Review changes

The sentence splitter keeps abbreviations, times and decimals (".tmp", "9 a.m.", "3.5", "Dr.") inside one sentence, and the tokenizer keeps decimals and file extensions. Contracted negation and auxiliaries (haven't, don't, can't, won't, isn't) are expanded before parsing, so they produce NOT/modal nodes. Unparsed text is rendered as `UNRESOLVED_FRAGMENT#k`, never verbatim; the fragment stays in the AST. Ambiguities are listed as `NOTED AMBIGUITY #k` with id, severity, kind and a span or options only when they are at most 3 words; helper questions and messages are not rendered into the judged CNL. The 30-turn AST and state are unchanged from the archive. Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`).

## Symbolic parser v2

Goal: more sentences represented as structure, purely symbolically (no model calls). Progress is measured offline with `node tools/symbolic-progress.mjs`: per sentence it counts unparsed fragments, unresolved references, clauses collapsed into a role string, symbols over 3 words and source echo. A sentence is *clean* when it has none of them. Rules are tuned on the development partition; `source-heldout` is reported but not used for tuning.

- **Lexicon** (`src/lexicon.mjs`): compromise's rule-and-lexicon tagger (already a dependency of Event Role Logic) recognizes verbs outside the archive's ~150-word list, gives verb roots ("broke" → break, "licensed" → license) and bare-verb imperatives ("Book me a seat"). Closed-class words are never verbs. Rebuilt clauses that lost their context ("deployment start") use a frame test ("they start it"). The archive list is consulted first.
- **Clause connectives**: `;`, but, although, while, so, which is why, then, since, as soon as / once, whenever, trailing unless / provided / as long as. Both sides must be clauses. Contrast connectives stay visible (`AND BUT:`).
- **Complements**: reported speech and attitudes with and without "that" ("Tom thinks the server crashed"), tell/promise/warn + recipient, adjective + that ("I am worried that…"), embedded whether-questions ("check whether…"). "X does not think S" is NOT over the attitude. Agent and recipient are interned before the content, so pronouns in the content can refer to them.
- **Noun phrases over 3 words**: a relative clause (full or reduced) becomes a restriction on the head entity, placed next to the event that mentions it; lists become `AND(...)` / `OR(...)` groups; a prepositional tail becomes a relation (`e1:"summary" OF e2:"article"`). A pronoun recipient is split from its object ("book me a window seat"). ONLY keeps its focus restriction inside its scope (`WHERE:`).
- **Turn markers**: sentence-initial discourse markers ("Therefore", "Well, basically") are kept as `DISCOURSE …` instead of being parsed as a subject. Quoted material is a mention without a representation and stays unresolved.
- **Because of NP** is `BECAUSE OF e1:"storm"`, not a clause.
- **Amounts and possessives**: "at least three of the five reviewers", "fewer than ten units", "not all of the guests", "neither Alex nor Priya" carry an explicit operator (`AMOUNT(AT_LEAST three OF …)`); "the customer's consent" is consent OF customer. Long prepositional values are parsed as noun phrases.
- **Shared subjects**: "Node7 is a server and is overloaded", "Tom corrected the report but did not resubmit it": a conjunct that starts with a verb reuses the left subject.
- **Questions**: when/where/why/how and "what N did …" questions parse their clause; several questions in one sentence ("Which X…, and which Y?", "…, and why?") become an AND of queries.
- **Social acts**: greetings, thanks, apologies and congratulations are events between speaker and addressee with their topic; a following clause is a proposition. Contractions 'd and 's after pronouns are expanded.

The 30-turn archive dialogue changes in 12 turns, all recorded in `test/fixtures/discourse-divergences.json`. Most are corrections (embedded clause content, relative clauses, NOT scope). The other 18 turns equal the archive, ids aside.
