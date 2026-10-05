# EVL — Event Logic in Prolog (formalisation DSL)

A text is formalised as a set of **ground Prolog facts** (one per line, ending in `.`).
Identifiers are lowercase atoms: entities `x1, x2, ...`, events/states `e1, e2, ...`.
Lexical concepts are **single English lemmas** (lowercase, `snake_case` allowed for
multiword lemmas such as `ice_cream`, `take_off`) — never phrases or sentences.
Proper names go in quotes: `name(x1, 'Mary')`.

The fixed (interpreted) vocabulary — ~20 structural primitives. Anything else is ignored
by the interpreter, so everything that matters MUST be expressed with these.

## Entities
| fact | meaning |
|---|---|
| `inst(X, Concept)` | X is a Concept (common-noun lemma): `inst(x1, dog)` |
| `name(X, 'Name')` | X is called Name |
| `pron(X, P)` | X is referred to by a pronoun, P ∈ `i, you, he, she, it, we, they` |
| `prop(X, Adj)` | X has property Adj: `prop(x1, red)`; `prop(x1, very(tall))` |
| `quant(X, Q)` | determiner/quantifier of X. Q ∈ `a, the, every, all, some, no, most, many, few, several, any, this, that, these, those, both, each, bare` or an integer (`quant(x2, 3)`). `bare` = no determiner (mass nouns, generic plurals). Default: `a` on first mention, `the` afterwards |
| `plural(X)` | X denotes several individuals |
| `rel(X, R, Y)` | X stands in relation R to Y. R ∈ `of, poss` (Y's X) or a preposition (`in, on, at, near, with, from, for, about, ...`): `rel(x1, poss, x2)` = x2's x1 |
| `restrict(X, E)` | relative clause: X is restricted by event E ("the man **who bought a car**") |

## Events and states (neo-Davidsonian)
| fact | meaning |
|---|---|
| `event(E, Verb)` | E is an event/state of type Verb (verb lemma). Use `be` for copular states, `exist` for "there is" |
| `role(E, Role, A)` | A participates in E with Role (see below). A is an entity, an event (for `content`, `purpose`, `cause`), or an atom (for `manner`, `time`, `attribute`) |
| `tense(E, T)` | T ∈ `past, present, future` (default `present`) |
| `aspect(E, A)` | A ∈ `progressive, perfect, perfect_progressive` |
| `modal(E, M)` | M ∈ `can, could, must, may, might, should, would` |
| `neg(E)` | E does not happen / is not the case |
| `voice(E, passive)` | realise E in passive voice (agent optional) |
| `link(E1, Conn, E2)` | discourse relation: "E1 Conn E2". Conn ∈ `and, but, because, if, when, before, after, while, although, so, unless, until` |

### Roles
`agent` (doer), `experiencer` (one who feels/perceives/knows), `patient` (affected thing),
`theme` (moved/located/described thing; subject of intransitive non-agentive verbs and of `be`),
`stimulus` (what is felt/perceived), `recipient`, `beneficiary`, `instrument`, `location`,
`source`, `destination`, `path`, `time`, `manner`, `purpose`, `cause`, `topic`, `companion`,
`content` (the proposition said/believed/known — an event id), `attribute` (predicate of `be`:
adjective atom, entity, or `more(Adj)`, `most(Adj)`, `less(Adj)`, `as(Adj)`), `standard`
(the compared-to entity in comparatives), `extent`.
Any preposition can be used directly as a role via `pp(Prep)`: `role(e1, pp(about), x3)`.

## Optional meta / classification facts (not verbalised)
`kind(Concept, SuperConcept)` — e.g. `kind(buy, transfer)`, `kind(dog, animal)`.
These categorise the "dynamic" lexical predicates and may be used by reasoning.

## Example
"Mary didn't give the old book to her brother because he already had it."
```prolog
name(x1, 'Mary').
inst(x2, book). prop(x2, old). quant(x2, the).
inst(x3, brother). rel(x3, poss, x1).
event(e1, give). tense(e1, past). neg(e1).
role(e1, agent, x1). role(e1, theme, x2). role(e1, recipient, x3).
event(e2, have). tense(e2, past). role(e2, agent, x3). role(e2, theme, x2). role(e2, manner, already).
link(e1, because, e2).
kind(give, transfer).
```
