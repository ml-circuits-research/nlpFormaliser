# nlpformaliser (JS)

Librărie `.mjs` (Node ≥ 18) pentru **formalizare NL → formalism → execuție → CNL**, verificată de un judecător
LLM, plus un **benchmark** care compară orice metode de formalizare pe același protocol.
Nu are nevoie de Python, Prolog sau server. Singura dependență obligatorie e
[compromise](https://github.com/spencermountain/compromise), pentru morfologia engleză.

```bash
cd js && npm install          # compromise (+ opțional @anthropic-ai/sdk)
npm test                      # paritate cu implementarea de referință (324 de formalizări, 53 de întrebări)
node example.mjs              # pașii deterministici, fără LLM
```

## Modelul de validare

```
NL ──formalize──▶ formalizare ──check──▶ validă?
                       │
                   realize  (execuție deterministă, fără LLM)
                       ▼
                      CNL ──judge(NL, CNL)──▶ spune același lucru?   (LLM)
```

Se judecă **doar** dacă CNL-ul emis prin execuția formalizării spune același lucru ca textul inițial.
Nu se evaluează cum ar putea fi transformată formalizarea în cod; acela e alt subiect.
Opțional, dacă metoda are `refine`, formalizarea e reparată cu feedback-ul judecătorului (bucla).
Scorul final îl dă un **al doilea judecător** (alt model, alt prompt), ca metoda să nu se poată
„optimiza” pe judecătorul din buclă.

## API

```js
import { Formaliser, check, verbalize, fol, ask } from "./index.mjs";

// EVL, pași deterministici (fără LLM)
check(code)                      // { ok, facts, errors, warnings }
verbalize(code)                  // EVL → CNL (engleză)
fol(code)                        // EVL → logică de ordinul I
ask(contextCode, questionCode)   // execută o întrebare EVL pe fapte EVL → { answer, mode, support }

// EVL, pași cu LLM
const f = new Formaliser();                        // implicit Haiku: SDK dacă există ANTHROPIC_API_KEY, altfel `claude -p`
const f2 = new Formaliser({ llm: async (system, prompt) => "..." });   // orice LLM
await f.formalize(text)                            // → cod EVL
await f.judge(original, cnl)                       // → { equivalent, differences }
await f.refine(text, code, { errors, realization, differences })
await f.roundtrip(text, { rounds: 4, onStep })     // bucla completă → { converged, code, realization, trace }
f.prompts()                                        // prompturile + specificația DSL
```

Furnizori LLM: `anthropicLLM({ model })`, `claudeCliLLM({ model })`, `defaultLLM()`, `cachedLLM(llm, dir)`.
Un LLM e doar `async (system, prompt) => text`.

## Benchmark: comparare cu alte metode de formalizare

O **metodă** e un obiect simplu:

```js
{
  name: "my-method",
  formalize: async (text) => "...",                 // NL → formalizare (string, orice format)
  realize: async (formalization) => "...",          // EXECUȚIA formalizării → CNL
  check: async (formalization) => ({ ok, errors }), // opțional: validare
  refine: async (text, formalization, { errors, realization, differences }) => "...",   // opțional: reparare
  deterministicRealizer: true,                      // realize() nu folosește LLM (recomandat pentru un test onest)
}
```

Metode incluse:
- `evlMethod({ llm })`: metoda acestei librării (EVL + interpretor determinist);
- `llmRealizerMethod(base, { llm })`: condiție de control, cu aceeași formalizare, dar un LLM scrie CNL-ul
  (arată cât „repară” un LLM pe ascuns);
- `commandMethod({ name, formalize, realize, check?, refine? })`: **orice unealtă externă, în orice limbaj**.
  Fiecare comandă citește din stdin și scrie în stdout (`refine` primește JSON
  `{text, formalization, feedback}`, `check` întoarce JSON `{ok, errors}`).
  Exemplu: `../adapters/amr_adapter.py` (AMR scris de LLM + generatorul amrlib).

```js
import { benchmark, evlMethod, commandMethod, loadDataset, defaultLLM, anthropicLLM } from "./index.mjs";

const llm = defaultLLM({ model: "claude-haiku-4-5" });
const { markdown } = await benchmark({
  methods: [evlMethod({ llm }), commandMethod({ name: "amr", formalize: "python3 adapters/amr_adapter.py formalize",
            realize: "python3 adapters/amr_adapter.py realize", refine: "python3 adapters/amr_adapter.py refine" })],
  items: await loadDataset("data/roundtrip_all.jsonl"),     // JSONL: {"id", "text", "cat"?}
  loopLLM: llm,                                             // judecătorul din buclă
  evalLLM: defaultLLM({ model: "claude-sonnet-5-5" }),      // judecătorul final, independent
  rounds: 4, concurrency: 4, out: "results/bench",          // reluabil; scrie <method>.jsonl + summary.md/json
});
```

Sau din CLI, cu un fișier de configurare care exportă metodele (exemplu: `examples/compare-evl-amr.mjs`):

```bash
node js/bin/nlpf.mjs bench --dataset data/roundtrip_all.jsonl --config js/examples/compare-evl-amr.mjs \
     --rounds 4 --out results/bench --cache .llm_cache_js
node js/bin/nlpf.mjs bench --dataset data/sentences.jsonl --method evl --method evl+llm --limit 10
```

Raportul dă **procente din cazurile de test** (cu numărul de cazuri separat): formalizare validă din prima,
echivalent din prima, echivalent după buclă, echivalent sau minor, greșeli majore, numărul mediu de runde.

## CLI

```bash
nlpf check fapte.pl | verbalize fapte.pl | fol fapte.pl          # deterministice
nlpf formalize "TEXT" | judge "ORIGINAL" "CNL" | refine "TEXT" --code f.pl --difference "..."
nlpf roundtrip "TEXT" --rounds 4 [--trace]
nlpf ask --context ctx.pl --question-code q.pl                    # execuția întrebărilor (subiect separat)
nlpf answer --context-text "TEXT" --question "TEXT"
nlpf bench --dataset FILE.jsonl [--method evl] [--config methods.mjs] [--out DIR]
nlpf prompts
```

## Structură

```
index.mjs            exporturi publice
src/terms.mjs        parser pentru fapte Prolog (EVL)
src/check.mjs        verificatorul EVL (semnătură + integritate)
src/kb.mjs           modelul faptelor
src/english.mjs      interpretorul determinist EVL → CNL și EVL → FOL
src/morph.mjs        morfologie (compromise)
src/qa.mjs           execuția întrebărilor (rezolvitor cu backtracking)
src/formaliser.mjs   pașii LLM + bucla
src/methods.mjs      interfața „metodă” + evlMethod, llmRealizerMethod, commandMethod
src/bench.mjs        benchmark-ul (judecător de buclă + judecător de evaluare)
src/llm.mjs          furnizori LLM
spec/evl-spec.md     specificația DSL (și prompt)
spec/prompts.json    prompturile, aceleași ca în implementarea de referință
bin/nlpf.mjs         CLI
test/                teste de paritate
```
