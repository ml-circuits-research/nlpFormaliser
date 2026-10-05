# Experimente: formalizare NL → formalism → execuție → CNL, judecată de un LLM

Toate procentele de mai jos sunt **din numărul de cazuri de test**, iar numărul de cazuri e dat separat
pentru fiecare tabel. Datele brute (fiecare rundă: formalizare, erori, CNL, verdict) sunt în `results/`.

## 1. Protocolul de validare

```
NL ──LLM: formalize──▶ formalizare ──check (simbolic)──▶ validă?  nu → LLM: refine (cu erorile)
                            │
                   realize = EXECUȚIE (deterministă, fără LLM)
                            ▼
                           CNL ──judecător LLM (NL, CNL)──▶ același sens?  nu → LLM: refine (cu diferențele)
```

- **Formalizarea e corectă dacă CNL-ul obținut prin execuția ei spune același lucru ca textul inițial.**
  Nu evaluăm capacitatea de a transforma formalizarea în cod: execuția e dată, deterministă.
- **Bucla** (max. 4 runde de reparare): un LLM mic (Claude Haiku 4.5) formalizează, repară și judecă.
- **Evaluarea finală** o face un judecător independent (Claude Sonnet 5.5), cu alt prompt și trei etichete:
  - `echivalent`: aceleași condiții de adevăr;
  - `minor`: o nuanță pierdută sau adăugată;
  - `major`: lipsește, e greșit sau e adăugat un fapt, un participant, o negație, un cuantificator, un număr,
    o modalitate, un timp verbal, o relație sau tipul actului de vorbire.

  Astfel, metoda nu se poate optimiza pe judecătorul de evaluare.
- **Testul de mutații** verifică judecătorul din buclă: schimbăm deliberat sensul formalizărilor
  acceptate, reexecutăm și verificăm dacă judecătorul observă diferența.
- **Controlul „verbalizator LLM”** folosește aceeași formalizare, dar un LLM scrie CNL-ul în locul
  interpretorului. Măsoară cât de îngăduitor devine testul când execuția nu e deterministă.

## 2. Seturi de date (construite de mână, în engleză)

| fișier | cazuri de test | conținut |
|---|---|---|
| `data/sentences.jsonl` | 40 | cuantificatori, negație, modalitate, timp/aspect, relative, atitudini, condiționale, cauzale, comparative, donkey, texte cu mai multe propoziții, stil juridic și științific |
| `data/v2_statements.jsonl` | 30 | generici (6), domeniul cuantificatorilor (5), grupuri (4), măsuri și comparații numerice (5), focus/instead (4), adverbe de frecvență (3), contrafactuale (3) |
| `data/v2_acts.jsonl` | 26 | întrebări da/nu, wh pe subiect/obiect/adverbiale, întrebări și cereri indirecte, comenzi, sugestie, ofertă, promisiune, avertisment, mulțumire, vorbire raportată; fiecare cu tipul de act de referință |
| `data/roundtrip_all.jsonl` | 96 | cele trei seturi de mai sus, împreună |
| `data/qa.jsonl` | 35 întrebări pe 10 texte | pentru experimentul separat de execuție a întrebărilor (secțiunea 6) |

## 3. Experimentul 1: patru metode pe 40 de texte (`results/*.jsonl`, `experiments/run.py`)

Formalizatorul e Haiku în toate cazurile. Execuția diferă:

| metodă | formalism | execuție → CNL |
|---|---|---|
| EVL | fapte Prolog neo-davidsoniene, ~20 de primitive structurale | verbalizator determinist (validat în SWI-Prolog) |
| AMR | Abstract Meaning Representation (PropBank) | generatorul amrlib T5 (neural) |
| GF | arbori Grammatical Framework RGL | linearizare GF (deterministă) |
| EVL + verbalizator LLM | EVL | Haiku (control) |

**Cazuri de test: 40.**

| metodă | validă din prima | echivalent din prima | echivalent după buclă | echivalent sau minor după buclă | major după buclă | judecătorul din buclă acceptă |
|---|---|---|---|---|---|---|
| **EVL** | 98% | 50% | **73%** | **98%** | **3%** | 100% |
| AMR | 100% | 25% | 33% | 73% | 28% | 60% |
| GF | 28% | 38% | 40% | 70% | 30% | 55% |
| EVL + verbalizator LLM (control) | 95% | 68% | 80% | 100% | 0% | 100% |

- **Controlul e înșelător.** Am executat formalizările acceptate în condiția de control cu interpretorul
  determinist (`experiments/crosscheck.py`): **60% echivalent, 90% echivalent sau minor, 10% major**, față de
  80% / 100% / 0% cu verbalizatorul LLM. LLM-ul „repară” pe ascuns: o relație *unless* inversată, un
  participant lipsă (Bob), un argument nedeclarat.
- **Testul de mutații** (159 de mutații): judecătorul Haiku detectează **97%**: negație 100%, roluri inversate
  100%, timp verbal 97%, cuantificator 97%, fapt șters 92%.
- **AMR** nu poate reprezenta timpul verbal, numărul gramatical și definitudinea, iar generatorul neural inventează.
  Bucla nu poate repara ce formalismul nu exprimă.
- **GF** generează excelent când arborele e valid, dar LLM-ul scrie greu API-ul RGL: doar 28% din arbori
  sunt valizi din prima.
- ERG/ACE (DELPH-IN) e implementat (`nlpformaliser/erg_backend.py`), dar n-a putut rula: binarul ACE se
  descarcă doar de pe sweaglesw.org, domeniu blocat de rețeaua sandbox-ului.

## 4. Experimentul 2: EVL v2 (`results/v2/`, `experiments/run_v2.py`)

EVL v2 adaugă:
- acte de vorbire: `act/3` + `wh/2`;
- `generic/1`, `scope/2`, `group/2`;
- `measure/3` + `rate/2`;
- `focus/2`, `freq/2`, `counterfactual/1`.

**Cazuri de test: 96** (40 + 30 + 26), plus 196 de mutații.

| set | cazuri | echivalent din prima | echivalent după buclă | echivalent sau minor după buclă | major după buclă | judecătorul din buclă acceptă |
|---|---|---|---|---|---|---|
| 40 vechi, EVL v1* | 40 | – | 70% | 98% | 2% | 100% |
| 40 vechi, EVL v2 | 40 | 50% | 72% | 95% | 5% | 95% |
| fenomene noi | 30 | 43% | 67% | 90% | 10% | 87% |
| întrebări și acte de vorbire | 26 | 73% | 92% | 100% | 0% | 96% |

\* Rezultatele EVL v1 au fost rejudecate cu promptul de evaluare v2, care ține cont de actele de vorbire;
de aici diferența mică față de secțiunea 3.

Pe categorii, după buclă (echivalent / echivalent sau minor):

| fenomen | cazuri | | | act de vorbire | cazuri | | |
|---|---|---|---|---|---|---|---|
| generici | 6 | 83% | 100% | da/nu | 4 | 100% | 100% |
| scope | 5 | 60% | 100% | wh (subiect, obiect, adverbial) | 8 | 100% | 100% |
| măsuri | 5 | 80% | 80% | întrebări indirecte | 2 | 100% | 100% |
| grupuri | 4 | 25% | 75% | cereri indirecte | 3 | 67% | 100% |
| focus | 4 | 50% | 100% | comenzi | 2 | 100% | 100% |
| frecvență | 3 | 67% | 67% | raportate | 2 | 100% | 100% |
| contrafactuale | 3 | 100% | 100% | celelalte (sugestie, ofertă, promisiune, avertisment, mulțumire) | 5 | 80% | 100% |

- **Intenția („ce se cere”)**, adică tipul actului de vorbire, e recunoscută corect în **88%** din 26 de cazuri.
- **Testul de mutații** (196): judecătorul Haiku detectează **97%** (negație 100%, timp verbal 100%,
  roluri 97%, act de vorbire 96%, fapt șters 94%, cuantificator 92%).
- **Greșeli majore rămase:**
  - ore și date („six in the evening”);
  - cuantificator plus cardinal pe aceeași entitate („each of the *three* brothers”);
  - „30 days' written notice”, reparat după rulare în verbalizator.

## 5. Experimentul 3: benchmark-ul JS, EVL vs. AMR vs. control (`results/bench/`)

Rulat cu librăria JS (`js/`), pe protocolul din secțiunea 1, cu metode pluggable:

```bash
node js/bin/nlpf.mjs bench --dataset data/roundtrip_all.jsonl --config js/examples/compare-evl-amr.mjs \
     --rounds 4 --out results/bench --cache .llm_cache_js
```

AMR e conectat ca **metodă externă** (`adapters/amr_adapter.py`, prin `commandMethod`), la fel cum se
poate conecta orice alt formalizator.

**Cazuri de test: 96 pentru EVL și pentru control; 24 pentru AMR.** Rularea AMR a fost oprită la 24 din 96
la reorganizarea repo-ului: fiecare apel își reîncărca modelul, deci rularea era foarte lentă. Ultimul rând
compară EVL pe exact aceleași 24 de texte.

| metodă | cazuri | validă din prima | echivalent din prima | echivalent după buclă | echivalent sau minor după buclă | major după buclă |
|---|---|---|---|---|---|---|
| EVL (JS) | 96 | 97% | 56% | 71% | 96% | 4% |
| EVL + verbalizator LLM (control) | 96 | 98% | 73% | 84% | 97% | 3% |
| AMR (amrlib, prin `commandMethod`) | 24 | 100% | 38% | 50% | 83% | 17% |
| EVL pe aceleași 24 de texte ca AMR | 24 | 96% | 50% | 75% | 100% | 0% |

Rezultatele reproduc experimentele 1–2 cu librăria JS. Controlul arată din nou mai bine din cauza
verbalizatorului LLM, nu a formalizării (vezi secțiunea 3).

## 6. Subiect separat: execuția întrebărilor (`results/v2/qa.jsonl`)

Nu face parte din protocolul de validare de mai sus. Aici întrebarea e formalizată (cu contextul formalizat
ca referință) și **executată** ca interogare peste faptele contextului. Regulile acoperă:
- taxonomie;
- generici cu excepții (clasa cea mai specifică câștigă);
- reguli universale restrânse de relative, inclusiv praguri numerice;
- modus ponens;
- credințe care nu sunt luate drept fapte.

**Cazuri de test: 35 de întrebări pe 10 texte.**

| metodă | corect |
|---|---|
| formalizare EVL + execuție | 86% |
| Haiku citind direct textul | 97% |

Toate cele 5 greșeli ale execuției vin din codări diferite ale aceluiași fapt între context și întrebare
(de exemplu „Willy is a whale” codat ca `be` + atribut în loc de `inst/2`), nu din raționament. Pe
întrebările al căror răspuns nu reiese din text, execuția a răspuns corect „nu se știe” 2/2, iar Haiku 1/2.

## 7. Limitări

- Seturi mici, construite de mână; un singur rulaj per condiție, fără repetiții.
- Etichetele judecătorului de evaluare (Sonnet) nu au fost validate de un om.
- Doar engleză.
- Judecătorul din buclă e mai îngăduitor decât cel de evaluare la nuanțe (definitudine, „when” vs. „before”).
- Corecturi făcute după rulări, care nu se reflectă în cifrele de mai sus:
  - posesivul la plural;
  - checker-ul întărit împotriva frazelor ascunse în argumente;
  - redarea „30 days' written notice”.

## 8. Reproducere

```bash
bash scripts/setup.sh                                   # implementarea de referință (Python + SWI-Prolog, AMR, GF)
python experiments/run.py --backends evl_prolog amr gf_rgl evl_prolog_llm_realizer --rounds 4   # experimentul 1
python experiments/crosscheck.py
python experiments/run_v2.py                            # experimentul 2 + execuția întrebărilor
cd js && npm install && npm test                        # librăria JS + paritate cu referința
node js/bin/nlpf.mjs bench ...                          # experimentul 3
```
