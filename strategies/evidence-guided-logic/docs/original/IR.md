# Formal IR 0.2

## Atom

```json
{"pred":"owns","args":["mira","gpu1"],"neg":false}
```

Variables begin with `?`:

```json
{"pred":"owns","args":["?x","?g"],"neg":false}
```

Explicit negative facts use `neg:true`. Absence of a positive fact does not imply negation; the reasoner is three-valued at query time (`TRUE`, `FALSE`, `UNKNOWN`).

## Rule

```json
{
  "head":{"pred":"can_run","args":["?x","local_model"],"neg":false},
  "body":[
    {"pred":"researcher","args":["?x"],"neg":false},
    {"pred":"owns","args":["?x","?g"],"neg":false},
    {"pred":"gpu","args":["?g"],"neg":false}
  ]
}
```

Every head variable must occur in the body. The bundled reasoner supports positive conjunction plus explicit-negation atoms.

## Full shape

```json
{
  "version":"0.2",
  "facts":[],
  "rules":[],
  "contexts":[],
  "queries":[],
  "externals":[],
  "ambiguities":[],
  "symbols":{"entities":{},"predicates":{}},
  "meta":{}
}
```

### Contexts

Contexts retain scope that should not be incorrectly flattened, for example beliefs, counterfactuals, alternatives, quotations, or nested modality.

```json
{"id":"ctx1","kind":"belief","holder":"alice","gloss":"Alice believes that ..."}
```

The representation is intentionally extensible here; current CNL preserves a textual controlled representation while the tiny reasoner ignores context semantics.

### Ambiguities

If the source genuinely underdetermines an attachment or reference, preserving ambiguity is preferable to inventing certainty:

```json
{
  "gloss":"with the telescope has two plausible attachments",
  "options":["instrument_of_seeing","property_of_man"]
}
```

### Queries

```json
{
  "vars":["?x"],
  "where":[{"pred":"can_run","args":["?x","local_model"],"neg":false}]
}
```

### External predicates / procedures

Procedures can be exposed relationally:

```json
{
  "predicate":"sha256",
  "roles":["input","digest"],
  "inputPositions":[0],
  "outputPositions":[1],
  "implementation":"crypto.sha256"
}
```

This keeps symbolic reasoning and executable tools behind one predicate interface.

### Symbols

Optional metadata controls readability without changing logic:

```json
{
  "entities":{"gpu1":{"label":"GPU-1"}},
  "predicates":{"owns":{"label":"owns","cnl":"{0} owns {1}"}}
}
```

## Relation to the earlier conceptual model

- entity -> constant/term plus optional symbol metadata;
- entity type -> unary predicate;
- relation/fact -> atom;
- constraint/definition/implication -> rule or scoped context;
- query -> free variables + atoms;
- procedure -> external predicate;
- event/state -> ordinary entity reified and connected by role predicates where required;
- negation/modal/scope/ambiguity -> atom flags and/or contexts.
