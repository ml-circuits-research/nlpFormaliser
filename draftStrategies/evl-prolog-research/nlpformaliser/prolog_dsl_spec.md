# EVL v2 — Event Logic in Prolog (formalisation DSL)

A text is formalised as a set of **ground Prolog facts** (one per line, ending in `.`).
Identifiers are lowercase atoms: entities `x1, x2, ...`, events/states `e1, e2, ...`,
groups `g1, ...`, speech acts `a1, ...`, queried placeholders `q1, ...`.
Lexical concepts are **single English lemmas** (lowercase, `snake_case` allowed for at most 3 parts,
e.g. `ice_cream`, `take_off`) — never phrases or sentences.
Proper names go in quotes: `name(x1, 'Mary')`. Numbers are Prolog numbers (`40`, `2.5`).

Only the predicates below are interpreted; anything else is ignored, so everything that matters
MUST be expressed with them.

## Entities
| fact | meaning |
|---|---|
| `inst(X, Concept)` | X is a Concept (common-noun lemma): `inst(x1, dog)` |
| `name(X, 'Name')` | X is called Name |
| `pron(X, P)` | X is referred to by a pronoun, P ∈ `i, you, he, she, it, we, they` |
| `prop(X, Adj)` | X has property Adj: `prop(x1, red)`; `prop(x1, very(tall))` |
| `quant(X, Q)` | determiner/quantifier of X. Q ∈ `a, the, every, all, some, no, most, many, few, several, any, this, that, these, those, both, each, bare` (no determiner: mass nouns, generic plurals), an integer (`quant(x2, 3)`), or a numeric comparison `more_than(N), less_than(N), at_least(N), at_most(N), exactly(N)` |
| `plural(X)` | X denotes several individuals |
| `rel(X, R, Y)` | X stands in relation R to Y. R ∈ `of, poss` (Y's X) or a preposition (`in, on, at, near, with, from, for, about, ...`) |
| `restrict(X, E)` | relative clause: X is restricted by event E ("the man **who bought a car**") |
| `group(G, [X1, X2, ...])` | G is the plural entity "X1 and X2 and ..." (joint participants: "Alice and Bob met") |
| `measure(X, N, Unit)` | X is an amount: N units (`measure(x3, 100, degree_celsius)`, `measure(x4, more_than(40), hour)`); declares X |
| `rate(X, Unit)` | the amount X is per Unit: "40 hours **per week**" = `measure(x4, 40, hour). rate(x4, week).` |
| `focus(T, P)` | focus particle on entity or event T, P ∈ `only, even, also, just` ("**only** Sarah") |

## Events and states (neo-Davidsonian)
| fact | meaning |
|---|---|
| `event(E, Verb)` | E is an event/state of type Verb (verb lemma). `be` = copula, `exist` = "there is" |
| `role(E, Role, A)` | A participates in E with Role. A is an entity, an event (for `content`, `purpose`, `cause`, or a nominalised event as subject/object: "**increasing the temperature** speeds up reactions" → `role(e2, agent, e1)`), or an atom (for `manner`, `time`, `attribute`) |
| `tense(E, T)` | T ∈ `past, present, future` (default `present`) |
| `aspect(E, A)` | A ∈ `progressive, perfect, perfect_progressive` |
| `modal(E, M)` | M ∈ `can, could, must, may, might, should, would` |
| `neg(E)` | E does not happen / is not the case |
| `voice(E, passive)` | realise E in passive voice |
| `link(E1, Conn, E2)` | "E1 Conn E2". Conn ∈ `and, but, because, if, when, before, after, while, although, so, unless, until, since, as_soon_as, instead_of` |
| `generic(E)` | E is a general law / habit / definition, not a particular occurrence ("Whales are mammals", "Heat speeds up reactions") |
| `freq(E, F)` | adverb of quantification, F ∈ `always, usually, often, sometimes, rarely, never, typically, generally` |
| `counterfactual(E)` | E is contrary to fact ("if it **had rained**, the match **would have been** postponed": mark both events) |
| `scope(A, B)` | A takes scope over B. A, B are entity ids (their quantifiers) or `neg(E)`. Use it whenever the reading is not the surface order: "Not every child likes chocolate" → `scope(neg(e1), x1)`; "There is one book that every student read" → `scope(x2, x1)` |

### Roles
`agent`, `experiencer`, `patient`, `theme`, `stimulus`, `recipient`, `beneficiary`, `instrument`,
`location`, `source`, `destination`, `path`, `time`, `manner`, `purpose`, `cause`, `topic`, `companion`,
`content` (proposition said/believed/known/asked — an event id), `attribute` (predicate of `be`:
adjective atom, entity, or `more(Adj)`, `most(Adj)`, `less(Adj)`, `as(Adj)`), `standard`
(compared-to entity), `extent`, `duration`. Any preposition can be a role via `pp(Prep)`.

## Speech acts, questions, requests (what the text *does*)
Plain statements need no act. Anything else is wrapped in a speech act:
| fact | meaning |
|---|---|
| `act(A, Type, C)` | utterance A of Type with content event C. Type ∈ `ask, request, command, suggest, offer, promise, warn, thank, apologize, permit` |
| `speaker(A, X)`, `addressee(A, Y)` | who utters A / to whom (default: I / you); `tense(A, past)` for reported acts |
| `wh(Q, W)` | Q is the queried item, W ∈ `who, what, which, where, when, why, how, how_many, how_much`. Q is an entity (`wh(x1, who)`) or a placeholder for an adverbial (`role(e1, location, q1). wh(q1, where).`). A question without `wh` is a yes/no question |

Indirect speech acts are formalised by their intent: "Can you pass the salt?" is
`act(a1, request, e1)`, not a question about ability. "Do you know where the station is?" is
`act(a1, ask, e1)` with `wh(q1, where)`. Embedded questions ("Sarah knew **where** the key was hidden")
use `wh` inside the `content` event, without any act.

## Optional meta / classification facts (not verbalised, used by reasoning)
`kind(Concept, SuperConcept)` — e.g. `kind(penguin, bird)`, `kind(buy, acquire)`.

## Examples
"Mary didn't give the old book to her brother because he already had it."
```prolog
name(x1, 'Mary').
inst(x2, book). prop(x2, old). quant(x2, the).
inst(x3, brother). rel(x3, poss, x1).
event(e1, give). tense(e1, past). neg(e1).
role(e1, agent, x1). role(e1, theme, x2). role(e1, recipient, x3).
event(e2, have). tense(e2, past). role(e2, agent, x3). role(e2, theme, x2). role(e2, manner, already).
link(e1, because, e2).
```
"Not every bird can fly." → `inst(x1, bird). quant(x1, every). event(e1, fly). role(e1, agent, x1). modal(e1, can). neg(e1). scope(neg(e1), x1). generic(e1).`

"Where did Alice and Bob meet?" →
`name(x1,'Alice'). name(x2,'Bob'). group(g1,[x1,x2]). event(e1, meet). tense(e1, past). role(e1, agent, g1). role(e1, location, q1). wh(q1, where). act(a1, ask, e1).`

"Could you close the window, please?" → `inst(x1, window). quant(x1, the). event(e1, close). role(e1, agent, x2). pron(x2, you). role(e1, patient, x1). act(a1, request, e1).`
