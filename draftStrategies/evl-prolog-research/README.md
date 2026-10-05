# nlpFormaliser

**Formalizare NL → formalism → execuție → CNL, validată de un LLM.** Un LLM mic (Haiku) transformă
textul într-o formalizare. Formalizarea e **executată** determinist și produce un text CNL, iar un
judecător LLM decide dacă CNL-ul spune același lucru ca originalul. Dacă nu, LLM-ul repară formalizarea
și ciclul se repetă.

```
NL ──formalize──▶ formalizare ──check──▶ validă?
                       │
                   realize (execuție deterministă)
                       ▼
                      CNL ──judge(NL, CNL)──▶ același sens?  nu → refine → ...
```

Se judecă **doar echivalența de sens a CNL-ului**, nu capacitatea de a transforma formalizarea în cod.

## Ce conține

| | |
|---|---|
| [`js/`](js/README.md) | **Librăria `.mjs`**, fără Python, Prolog sau server. Conține DSL-ul EVL (fapte Prolog neo-davidsoniene cu ~25 de primitive structurale), verificatorul, interpretorul determinist EVL → CNL (și → FOL), bucla cu LLM injectabil, CLI-ul `nlpf` și un **benchmark** care compară orice metode de formalizare pe același protocol |
| [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md) | Documentația experimentelor: protocol, seturi de date, rezultate, limitări, reproducere |
| `nlpformaliser/` | Implementarea de referință (Python + SWI-Prolog) cu care s-au rulat experimentele 1–2; librăria JS e verificată identică pe 324 de formalizări |
| `adapters/` | Metode externe pentru benchmark (exemplu: AMR prin amrlib) |
| `data/`, `results/` | Seturile de test și rezultatele brute (fiecare rundă: formalizare, erori, CNL, verdict) |

## Start rapid

```bash
cd js && npm install
node bin/nlpf.mjs verbalize "name(x1,'Mary'). inst(x2,car). event(e1,buy). tense(e1,past). role(e1,agent,x1). role(e1,theme,x2)."
# → Mary bought a car.
node bin/nlpf.mjs roundtrip "Not every child likes chocolate."        # bucla completă (LLM)
node bin/nlpf.mjs bench --dataset ../data/sentences.jsonl --method evl --limit 10
```

```js
import { Formaliser, verbalize, benchmark, evlMethod, commandMethod } from "./js/index.mjs";
```

## Rezultate pe scurt

Detalii în [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md). Procentele sunt din cazurile de test; etichetele
vin de la un judecător independent (Sonnet).

- **Experimentul 1, 40 de texte.** EVL ajunge la 73% echivalent, 98% echivalent sau minor și 3% major după buclă.
  - AMR: 33% / 73% / 28%. GF: 40% / 70% / 30%.
  - Cu un verbalizator LLM în loc de unul determinist, scorul pare mai bun (80% / 100% / 0%), dar e fals:
    aceleași formalizări executate determinist dau 60% / 90% / 10%.
- **Experimentul 2, 96 de texte, EVL v2:**
  - întrebări și acte de vorbire: 92% echivalent, 100% fără greșeli majore;
  - intenția recunoscută corect în 88% din cazuri;
  - fenomene noi (generici, scope, grupuri, măsuri, focus, frecvență, contrafactuale): 67% / 90%.
- **Judecătorul mic e sensibil:** detectează 97% din schimbările deliberate de sens.
