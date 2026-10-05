## Round trip (Sonnet judge, % of test cases)

| set | test cases | equivalent – first formalisation | equivalent – after loop | equivalent or minor – after loop | major – after loop | Haiku loop judge accepted |
|---|---|---|---|---|---|---|
| old 40 (EVL v1, earlier run) | 40 | – | 70% | 98% | 2% | 100% |
| old 40 (EVL v2) | 40 | 50% | 72% | 95% | 5% | 95% |
| new phenomena | 30 | 43% | 67% | 90% | 10% | 87% |
| questions & speech acts | 26 | 73% | 92% | 100% | 0% | 96% |

### Per category (after loop, % equivalent / % equivalent-or-minor)

| set | category | test cases | equivalent | equivalent or minor |
|---|---|---|---|---|
| new_phenomena | generic | 6 | 83% | 100% |
| new_phenomena | scope | 5 | 60% | 100% |
| new_phenomena | measure | 5 | 80% | 80% |
| new_phenomena | group | 4 | 25% | 75% |
| new_phenomena | focus | 4 | 50% | 100% |
| new_phenomena | frequency | 3 | 67% | 67% |
| new_phenomena | counterfactual | 3 | 100% | 100% |
| speech_acts | yes-no | 4 | 100% | 100% |
| speech_acts | wh-subject | 2 | 100% | 100% |
| speech_acts | wh-object | 2 | 100% | 100% |
| speech_acts | indirect-question | 2 | 100% | 100% |
| speech_acts | indirect-request | 3 | 67% | 100% |
| speech_acts | wh-adverbial | 4 | 100% | 100% |
| speech_acts | command | 2 | 100% | 100% |
| speech_acts | promise | 1 | 100% | 100% |
| speech_acts | reported | 2 | 100% | 100% |
| speech_acts | warning | 1 | 100% | 100% |
| speech_acts | offer | 1 | 0% | 100% |
| speech_acts | thanks | 1 | 100% | 100% |
| speech_acts | suggestion | 1 | 100% | 100% |

**Intent (speech-act type) recognised correctly:** 88% of 26 test cases.

**Judge mutation test** (196 mutated formalisations): detected 97% — drop_fact 94% of 18, negation 100% of 50, quantifier 92% of 37, role_swap 97% of 29, speech_act 96% of 24, tense 100% of 38

## Question answering by executing the question in Prolog

Test cases: 35 questions over 10 short texts.

| method | correct |
|---|---|
| EVL formalisation + Prolog execution | 86% (30/35) |
| Haiku reading the text directly (baseline) | 97% (34/35) |

| question type | test cases | EVL + Prolog | Haiku baseline |
|---|---|---|---|
| attitude | 1 | 100% | 100% |
| attitude-content | 1 | 100% | 100% |
| count | 1 | 100% | 100% |
| default | 1 | 100% | 100% |
| default-exception | 1 | 100% | 100% |
| generic-inheritance | 1 | 0% | 100% |
| generic-lookup | 1 | 100% | 100% |
| group-member | 1 | 100% | 100% |
| lookup | 8 | 100% | 100% |
| lookup-group | 2 | 100% | 100% |
| measure | 1 | 100% | 100% |
| modus-ponens | 1 | 100% | 100% |
| negation | 2 | 100% | 100% |
| open-world | 2 | 100% | 50% |
| passive-agent | 1 | 100% | 100% |
| rule | 1 | 0% | 100% |
| rule-numeric | 1 | 0% | 100% |
| scope | 2 | 100% | 100% |
| taxonomy | 2 | 50% | 100% |
| taxonomy-negation | 1 | 0% | 100% |
| universal | 1 | 100% | 100% |
| why | 2 | 100% | 100% |
