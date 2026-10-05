# nlpFormaliser — formalizare NL → logică → NL, verificată prin dus-întors

Întrebarea: putem transforma text în predicate (în stil Prolog) cu un set mic de primitive, apoi
**executa** formalizarea înapoi în limbaj natural și declara formalizarea corectă dacă un LLM judecă
textul inițial și cel reconstruit ca echivalente? Iar dacă nu sunt echivalente, poate un LLM mic
(Haiku) să **repare formalizarea** până când devin?

```
text ──LLM──▶ cod formal ──checker simbolic──▶ (erori? → LLM repară)
                  │
             interpretare (deterministă)
                  ▼
           text reconstruit ──judecător(text, reconstruit)──▶ echivalent? STOP : LLM repară (max 4 runde)
```

## Ce am comparat (doar tehnologii mature, folosite efectiv)

| back-end | formalism | cine formalizează | cine „execută” înapoi în NL |
|---|---|---|---|
| `evl_prolog` | **EVL**: fapte Prolog neo-davidsoniene, ~20 de primitive structurale (`event`, `role`, `inst`, `quant`, `neg`, `modal`, `tense`, `link`, `restrict`…) + predicate lexicale deschise (lemme), plus meta-predicate de clasificare (`kind/2`) | Haiku | **SWI-Prolog** validează (checker scris în Prolog), apoi un **verbalizator determinist** cu reguli + morfologie lemminflect |
| `amr` | **AMR** (Abstract Meaning Representation, cadre PropBank) | Haiku | **amrlib** (generator T5 antrenat pe AMR 3.0) |
| `gf_rgl` | **Grammatical Framework**, Resource Grammar Library (arbori de sintaxă abstractă) | Haiku | **GF 3.12** (type-check + linearizare deterministă) |
| `evl_prolog_llm_realizer` | EVL | Haiku | **Haiku** (condiție de control: verbalizator LLM în loc de unul determinist) |
| `erg` *(implementat, nerulat)* | **MRS** din English Resource Grammar (DELPH-IN) | parserul ACE | generatorul ACE |

ERG/ACE e cea mai „muncită” tehnologie simbolică bidirecțională, dar binarul ACE se descarcă doar de pe
sweaglesw.org, domeniu blocat de politica de rețea a sandbox-ului. Codul (`nlpformaliser/erg_backend.py`)
e gata și se activează cu `scripts/setup.sh` acolo unde domeniul e accesibil. Parserul AMR antrenat
(BART) n-a putut fi folosit din același motiv: tokenizer-ul lui vine de pe HuggingFace. De aceea AMR-ul
e scris de Haiku, iar generatorul T5 rulează local, cu vocabularul T5 luat de pe Google Storage.

Set de date: `data/sentences.jsonl`, 40 de texte în engleză, construite de mână pe fenomene semantice
(cuantificatori, negație, modalitate, timp/aspect, relative, atitudini, condiționale, comparative,
anaforă de tip donkey, texte cu mai multe propoziții, stil juridic/științific).

## Rezultate (40 de texte, max 4 runde de reparare)

Evaluarea finală o face un **judecător independent (Sonnet 5.5)**, cu alt prompt decât judecătorul din
buclă (Haiku), ca bucla să nu-și poată „optimiza” propria metrică. Etichete:
`equivalent` = aceleași condiții de adevăr, `minor` = o nuanță pierdută sau adăugată,
`major` = fapt, participant, negație, cuantificator, timp sau relație greșit ori lipsă.

| back-end | validă din prima | validă la final | judecătorul Haiku acceptă | Sonnet: prima formalizare (eq/minor/major) | Sonnet: după buclă (eq/minor/major) |
|---|---|---|---|---|---|
| **evl_prolog** (determinist) | 39 | 40 | 40 | 20 / 13 / 7 | **29 / 10 / 1** |
| amr | 40 | 40 | 24 | 10 / 10 / 20 | 13 / 16 / 11 |
| gf_rgl | 11 | 31 | 22 | 15 / 14 / 11 | 16 / 12 / 12 |
| evl_prolog_llm_realizer (control) | 38 | 40 | 40 | 27 / 8 / 5 | 32 / 8 / 0 ⚠️ |

**Testul de mutații.** Schimbăm deliberat semantica formalizărilor EVL acceptate (negăm evenimentul
principal, inversăm agentul cu pacientul, schimbăm cuantificatorul sau timpul, ștergem un fapt),
le reexecutăm și verificăm dacă judecătorul Haiku observă diferența: **155/159 de mutații detectate**
(negație 40/40, inversare de roluri 23/23, cuantificator 33/34, timp verbal 35/36, fapt șters 24/26).
Un judecător mic e deci suficient de sensibil la schimbări grosiere de sens.

**Verificare încrucișată pentru condiția de control** (`experiments/crosscheck.py`). Am luat formalizările
acceptate cu verbalizatorul LLM și le-am executat cu interpretorul determinist:
32/8/0 devine **24/12/4**. Verbalizatorul LLM a *ascuns* erori reale din cod, de exemplu:
- „Unless you hurry, you will miss the train”: codul avea relația inversată
  (*„You hurry unless you will miss the train”*), dar LLM-ul a citit-o „corect”;
- „Alice and Bob met…”: Bob lipsea complet din cod, iar LLM-ul l-a pus la loc din context.

### Ce înseamnă

1. **Abordarea cea mai promițătoare este EVL: LLM → DSL Prolog → interpretor determinist → judecător → reparare.**
   Bucla chiar funcționează: rezultatele de după buclă trec de la 20/13/7 la 29/10/1. Exemple reparate:
   - „If it rains tomorrow…”: în prima versiune antecedentul și consecventul erau inversate; după reparare, corect.
   - „Not every child likes chocolate”: prima versiune dădea „Every child does not…”, versiunea reparată „Some child does not…”.
   - „more than forty”: în prima versiune lipsea „than”.

   Singurul `major` rămas este un *generic* („Increasing the temperature speeds up most reactions”,
   redat ca eveniment cauzal concret): DSL-ul nu are încă primitive pentru generici.
2. **Verbalizatorul trebuie să fie determinist.** Cu un LLM la întoarcere, verificarea dus-întors
   devine îngăduitoare: LLM-ul completează ce lipsește (vezi verificarea încrucișată).
   Execuția simbolică e cea care face testul „onest”.
3. **AMR pierde informație din construcție** (nu are timp verbal, număr gramatical sau definitudine), iar
   generatorul neural inventează (*„Universal children don't like chocolate”*, *„in the past”*).
   Bucla nu poate repara ce formalismul nu poate exprima: doar 24/40 sunt acceptate de Haiku.
4. **GF e excelent ca realizator** (când arborele e valid, textul e aproape identic cu originalul și
   multilingv prin construcție), dar **Haiku scrie greu API-ul RGL**: doar 11/40 valide din prima, iar 9
   texte nu au ajuns niciodată valide (erori de supraîncărcare a `mkVP`/`mkCl`, constante inexistente).
   În plus, arborii GF sunt sintactici, nu semantici: nu poți face inferență pe ei.
5. **Un model mic e suficient pentru tot ciclul**: Haiku a formalizat, a reparat și a judecat,
   iar judecata lui e confirmată de mutații și, în mare parte, de Sonnet.
   Unde diferă (11 cazuri la EVL), Haiku e mai îngăduitor cu nuanțele: definitudine, „when” față de
   „before”, posesivele reformulate.

### Direcții următoare
- Primitive EVL pentru **generici** și **scope** explicit (`forall/exists` pe entități), plus coreferință
  mai fină (`pron` folosit doar la mențiunile ulterioare e deja implementat).
- **EVL → GF**: verbalizatorul EVL poate produce arbori RGL în loc de șiruri, ca să obțină română (RGL
  pentru română e deja compilată în setup) și alte limbi: aceeași formalizare, altă „semantică”.
- ERG/ACE ca a doua cale complet simbolică, pentru comparație (necesită acces la sweaglesw.org).
- Checker-ul a fost întărit după rulare: acum respinge și fraze ascunse în argumentele rolurilor
  (Haiku a „smuggle-uit” `more_than(forty_hours_per_week)` la s35). Asta e singurul cod acceptat
  din rulare care ar fi respins acum.

## Librăria JS (`js/`) — formalizatorul ca unealtă separată

Librărie `.mjs` pură (Node ≥ 18). Singura dependență e [compromise](https://github.com/spencermountain/compromise),
folosită pentru morfologie. Nu are nevoie de Python, Prolog sau server. LLM-ul se injectează: implicit
`@anthropic-ai/sdk` (dependență opțională, cu `ANTHROPIC_API_KEY`) sau `claude -p` dacă nu există cheie.

```js
import { Formaliser, check, verbalize, fol, ask } from "nlpformaliser";   // sau "./js/index.mjs"

// pași deterministici — fără LLM
check(code)                 // { ok, facts, errors, warnings }  (verificatorul EVL)
verbalize(code)             // EVL → engleză
fol(code)                   // EVL → logică de ordinul I
ask(contextCode, questionCode)   // execută întrebarea: { answer, mode, support }

// pași cu LLM + bucla
const f = new Formaliser();                         // sau new Formaliser({ llm: async (system, prompt) => "..." })
await f.formalize(text, { context })                // → cod EVL
await f.judge(original, candidate)                  // → { equivalent, differences }
await f.refine(text, code, { errors, realization, differences })
await f.roundtrip(text, { rounds: 4, onStep })      // toată bucla → { converged, code, realization, trace }
await f.answer(contextText, question)               // formalizează ambele + execută
f.prompts()                                         // prompturile + specificația, dacă vrei bucla cu LLM-ul tău
```

CLI-ul (`js/bin/nlpf.mjs`, sau `nlpf` după `npm i -g ./js`) folosește librăria în proces separat:

```bash
nlpf check fapte.pl            # exit 1 dacă e invalid
nlpf verbalize fapte.pl
nlpf fol fapte.pl
nlpf formalize "Not every child likes chocolate."
nlpf judge "original" "reconstruit"
nlpf refine "text" --code fapte.pl --realization "..." --difference "..."
nlpf roundtrip "Can you pass me the salt?" --rounds 4 --trace
nlpf ask --context ctx.pl --question-code q.pl
nlpf answer --context-text "Most birds can fly, but penguins cannot. Pingu is a penguin." --question "Can Pingu fly?"
nlpf prompts
```

**Paritate.** Portul JS e verificat față de implementarea de referință Python + SWI-Prolog, cu care s-au
făcut experimentele (`cd js && npm test`). Pe toate cele 324 de formalizări produse în experimente
(din fiecare rundă), verificatorul, verbalizarea și citirea FOL dau același rezultat. Excepție fac doar
variantele de ortografie legitime dintre cele două librării de morfologie: *canceled/cancelled*,
*persons/people*. Pe 53 de perechi context-întrebare, răspunsurile sunt identice.
Fixtures: `python experiments/make_js_fixtures.py`.

## Structura repo-ului

```
nlpformaliser/
  prolog_dsl_spec.md   specificația EVL (folosită și ca prompt)
  evl.pl               loader + checker de integritate în SWI-Prolog (semnătură, ID-uri nedeclarate, lemme)
  evl.py               interpretări ale aceluiași cod: english() determinist și fol() (logică de ordinul I)
  backends.py          EVL, EVL+LLM-realizer, AMR (amrlib), GF (RGL)
  erg_backend.py       DELPH-IN ERG/ACE (MRS)
  judge.py             judecătorul din buclă (Haiku) + judecătorul de evaluare (Sonnet)
  loop.py              bucla formalizare → verificare → execuție → judecată → reparare
  mutate.py            mutații semantice pentru testarea judecătorului
  llm.py               acces LLM: Anthropic SDK (dacă există ANTHROPIC_API_KEY) sau `claude -p`, cu cache pe disc
  kb.pl, qa.py         execuția întrebărilor ca interogări Prolog (taxonomie, generici cu excepții, reguli, praguri numerice)
js/                    librăria JS (index.mjs, src/, bin/nlpf.mjs, test/, example.mjs) — produsul
nlpformaliser/         implementarea de referință Python + SWI-Prolog, folosită în experimente
experiments/run.py     rulează experimentul + evaluare + raport (reia de unde a rămas)
experiments/crosscheck.py
data/sentences.jsonl
results/               *.jsonl (urmă completă pe runde: cod, erori, text reconstruit, verdict), eval, mutații, summary
scripts/setup.sh       instalarea dependențelor
```

```bash
bash scripts/setup.sh
python experiments/run.py --backends evl_prolog amr gf_rgl evl_prolog_llm_realizer --rounds 4
python experiments/run.py --report-only
```

Exemplu de cod EVL și cele două interpretări ale lui:

```prolog
inst(x1, farmer). quant(x1, every). restrict(x1, e1).
inst(x2, donkey). pron(x2, it).
event(e1, own).  role(e1, agent, x1). role(e1, theme, x2).
event(e2, feed). role(e2, agent, x1). role(e2, theme, x2).
```
- `english()` → *Every farmer who owns a donkey feeds it.*
- `fol()` → `∀x1(farmer(x1) → ∃x2(donkey(x2) ∧ ∃e1(own(e1) ∧ agent(e1,x1) ∧ theme(e1,x2)) ∧ ∃e2(feed(e2) ∧ …)))`

### Limitări
- 40 de texte construite de mână: rezultatele sunt indicative, nu un benchmark.
- Un singur rulaj pe condiție (fără repetiții sau variație de seed).
- Etichetele Sonnet nu au fost validate de un om.
- Rezultatele au fost produse înainte de două corecturi minore, făcute după rulare: posesivul la plural
  („students' ” în loc de „students's”) și checker-ul întărit.
- Cost: ~760 de apeluri Haiku și ~230 de apeluri Sonnet.
