// EVL signature + integrity checker (JS port of nlpformaliser/evl.pl).
import { Compound, isCompound, isGround, parseProgram, termToString } from "./terms.mjs";
import { MAX_SYMBOL_WORDS, symbolWords } from "../../../tools/lib/symbols.mjs";

export const SIG = {
  inst: 2, name: 2, pron: 2, prop: 2, quant: 2, plural: 1, rel: 3, restrict: 2,
  event: 2, role: 3, tense: 2, aspect: 2, modal: 2, neg: 1, voice: 2, link: 3, kind: 2,
  group: 2, measure: 3, rate: 2, focus: 2, generic: 1, freq: 2, counterfactual: 1, scope: 2,
  act: 3, speaker: 2, addressee: 2, wh: 2,
};
export const ROLES = ["agent", "experiencer", "patient", "theme", "stimulus", "recipient", "beneficiary",
  "instrument", "location", "source", "destination", "path", "time", "manner", "purpose",
  "cause", "topic", "companion", "content", "attribute", "standard", "extent", "duration"];
export const PRONOUNS = ["i", "you", "he", "she", "it", "we", "they"];
export const TENSES = ["past", "present", "future"];
export const ASPECTS = ["progressive", "perfect", "perfect_progressive"];
// "need" (with neg: "need not") expresses absence of necessity.
export const MODALS = ["can", "could", "must", "may", "might", "should", "would", "need"];
export const CONNS = ["and", "but", "because", "if", "when", "before", "after", "while", "although", "so", "unless", "until",
  "since", "as_soon_as", "instead_of"];
export const QUANTS = ["a", "the", "every", "all", "some", "no", "most", "many", "few", "several", "any", "this", "that",
  "these", "those", "both", "each", "bare"];
export const NUM_CMPS = ["more_than", "less_than", "at_least", "at_most", "exactly"];
export const ACT_TYPES = ["ask", "request", "command", "suggest", "offer", "promise", "warn", "thank", "apologize", "permit"];
export const WH_WORDS = ["who", "what", "which", "where", "when", "why", "how", "how_many", "how_much"];
export const FREQS = ["always", "usually", "often", "sometimes", "rarely", "never", "typically", "generally"];
export const FOCUS = ["only", "even", "also", "just"];

const q = termToString;
const isInt = (x) => Number.isInteger(x);

export const idLike = (a) => typeof a === "string" && /^[xegaq]\d+$/.test(a);

// Concepts are lemmas of at most 3 words. Words are counted with the shared
// symbol rule (underscores, hyphens, digits and camelCase), so camelCase cannot
// hide a phrase.
function lemmaOk(c) {
  if (isCompound(c, "very", 1)) return lemmaOk(c.args[0]);
  if (typeof c === "number") return true;
  if (typeof c !== "string") return false;
  return symbolWords(c).length <= MAX_SYMBOL_WORDS && !c.includes(" ");
}
// name/2 holds a proper name: at most 3 name tokens, each starting with an
// upper-case letter or digit (lower-case particles such as "van" or "de" are
// allowed between them), and no sentence punctuation. Free text is rejected.
export function properNameOk(n) {
  if (typeof n !== "string") return false;
  const tokens = n.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > MAX_SYMBOL_WORDS) return false;
  if (!tokens.every((t) => /^[\p{L}\p{N}][\p{L}\p{N}'’.&-]*$/u.test(t))) return false;
  return /^[\p{Lu}\p{N}]/u.test(tokens[0]) && /^[\p{Lu}\p{N}]/u.test(tokens.at(-1));
}
function* subLemmas(t) {
  if (typeof t === "string") yield t;
  else if (t instanceof Compound) { yield t.f; for (const a of t.args) yield* subLemmas(a); }
}
function* lexicalArgs(t) {
  if (!(t instanceof Compound)) return;
  const [a0, a1, a2] = t.args;
  if (["inst", "event", "prop"].includes(t.f) && t.args.length === 2) yield a1;
  if (t.f === "kind" && t.args.length === 2) yield a0;
  if (t.f === "role" && t.args.length === 3 && !idLike(a2)) yield* subLemmas(a2);
  if (t.f === "rel" && t.args.length === 3) yield a1;
}
const validQuant = (x) => isInt(x) || QUANTS.includes(x) ||
  (x instanceof Compound && x.args.length === 1 && NUM_CMPS.includes(x.f) && typeof x.args[0] === "number");
const validAmount = (x) => typeof x === "number" ||
  (x instanceof Compound && x.args.length === 1 && NUM_CMPS.includes(x.f) && typeof x.args[0] === "number");
const validRole = (r) => (isCompound(r, "pp", 1) && typeof r.args[0] === "string") || ROLES.includes(r);

/** Parse + validate EVL code → { ok, facts, errors, warnings } */
export function check(code) {
  const { facts: raw, errors: synErrors, rules } = parseProgram(code);
  const errors = [...synErrors], warnings = [], facts = [];
  for (const r of rules) errors.push(`rules are not allowed (only ground facts): ${q(r)}`);
  for (const t of raw) {
    if (!isGround(t)) { errors.push(`fact is not ground (variables not allowed): ${q(t)}`); continue; }
    if (!(t instanceof Compound) || SIG[t.f] !== t.args.length) {
      const [f, n] = t instanceof Compound ? [t.f, t.args.length] : [t, 0];
      warnings.push(`unknown predicate ${f}/${n} ignored: ${q(t)}`);
    }
    facts.push(t);
  }
  const by = (f, n) => facts.filter((t) => t instanceof Compound && t.f === f && t.args.length === n).map((t) => t.args);
  const has = (f, n, pred) => by(f, n).some(pred);
  const entity = (x) => has("inst", 2, (a) => a[0] === x) || has("name", 2, (a) => a[0] === x) || has("pron", 2, (a) => a[0] === x) ||
    has("group", 2, (a) => a[0] === x) || has("measure", 3, (a) => a[0] === x) || has("wh", 2, (a) => a[0] === x);
  const ev = (e) => has("event", 2, (a) => a[0] === e);
  const actId = (a) => has("act", 3, (x) => x[0] === a);
  const scopeArg = (t) => (isCompound(t, "neg", 1) ? ev(t.args[0]) : entity(t) || t === "modal");
  const out = [];
  const add = (m) => { if (!out.includes(m)) out.push(m); };

  for (const [e, r] of by("role", 3)) if (!ev(e)) add(`role/3 on undeclared event ${e} (role ${q(r)})`);
  for (const [, r] of by("role", 3)) if (!validRole(r)) add(`unknown role ${q(r)}`);
  for (const [e, r, a] of by("role", 3)) if (idLike(a) && !entity(a) && !ev(a)) add(`${q(r)} of ${e} is ${a}, which is neither a declared entity nor event`);
  for (const [e, r, a] of by("role", 3)) if (r === "content" && !ev(a) && !entity(a)) add(`content of ${e} must be an event id, got ${q(a)}`);
  for (const p of ["prop", "quant", "plural", "rel", "restrict"])
    for (const t of facts) if (t instanceof Compound && t.f === p && SIG[p] === t.args.length && !entity(t.args[0]))
      add(`${p}/_ on undeclared entity ${q(t.args[0])} (needs inst/name/pron)`);
  for (const [, , y] of by("rel", 3)) if (!entity(y)) add(`rel/3 target ${q(y)} is not a declared entity`);
  for (const [, e] of by("restrict", 2)) if (!ev(e)) add(`restrict/2 refers to undeclared event ${q(e)}`);
  for (const p of ["tense", "aspect", "modal", "neg", "voice", "generic", "freq", "counterfactual"])
    for (const t of facts) if (t instanceof Compound && t.f === p && SIG[p] === t.args.length && !ev(t.args[0]) && !(p === "tense" && actId(t.args[0])))
      add(`${p}/_ on undeclared event ${q(t.args[0])}`);
  for (const [a, , b] of by("link", 3)) for (const e of [a, b]) if (!ev(e)) add(`link/3 refers to undeclared event ${q(e)}`);
  for (const [, c] of by("link", 3)) if (!CONNS.includes(c)) add(`unknown connective ${q(c)}`);
  for (const [e, t] of by("tense", 2)) if (!TENSES.includes(t)) add(`bad tense ${q(t)} for ${e}`);
  for (const [e, t] of by("aspect", 2)) if (!ASPECTS.includes(t)) add(`bad aspect ${q(t)} for ${e}`);
  for (const [e, t] of by("modal", 2)) if (!MODALS.includes(t)) add(`bad modal ${q(t)} for ${e}`);
  for (const [x, p] of by("pron", 2)) if (!PRONOUNS.includes(p)) add(`bad pronoun ${q(p)} for ${x}`);
  for (const [x, v] of by("quant", 2)) if (!validQuant(v)) add(`bad quantifier ${q(v)} for ${x}`);
  for (const [g, l] of by("group", 2)) {
    if (!Array.isArray(l)) add(`group ${g}: second argument must be a list`);
    else for (const x of l) if (!entity(x)) add(`group ${g} member ${q(x)} is not a declared entity`);
  }
  for (const [x, v] of by("measure", 3)) if (!validAmount(v)) add(`measure ${x}: bad amount ${q(v)} (number or more_than(N), ...)`);
  for (const [x] of by("rate", 2)) if (!has("measure", 3, (a) => a[0] === x)) add(`rate/2 on ${x} which has no measure/3`);
  for (const [t, p] of by("focus", 2)) {
    if (!(entity(t) || ev(t))) add(`focus/2 on undeclared ${q(t)}`);
    else if (!FOCUS.includes(p)) add(`bad focus particle ${q(p)}`);
  }
  for (const [e, f] of by("freq", 2)) if (!FREQS.includes(f)) add(`bad frequency ${q(f)} for ${e}`);
  for (const [a, b] of by("scope", 2)) for (const t of [a, b]) if (!scopeArg(t)) add(`scope/2 argument ${q(t)} must be an entity id, neg(Event) or modal`);
  // scope(neg(E), modal): negation outscopes the modal of E ("need not", "is not required to").
  for (const [a, b] of by("scope", 2)) if (b === "modal" && !(isCompound(a, "neg", 1) && has("neg", 1, (x) => x[0] === a.args[0]) && has("modal", 2, (x) => x[0] === a.args[0])))
    add(`scope(${q(a)}, modal) needs neg/1 and modal/2 on the same event`);
  for (const [a] of by("scope", 2)) if (a === "modal") add("modal can only be the second argument of scope/2");
  for (const [x, n] of by("name", 2)) if (!properNameOk(n)) add(`name of ${q(x)} must be a proper name of at most ${MAX_SYMBOL_WORDS} capitalised tokens, got ${q(n)}`);
  for (const [a, t, c] of by("act", 3)) {
    if (!ACT_TYPES.includes(t)) add(`bad act type ${q(t)} for ${a}`);
    else if (!ev(c) && c !== "none") add(`act ${a} content ${q(c)} is not a declared event`);
  }
  for (const p of ["speaker", "addressee"])
    for (const [a, x] of by(p, 2)) {
      if (!actId(a)) add(`${p}/2 on undeclared act ${q(a)}`);
      else if (!entity(x)) add(`${p} of ${a} is not a declared entity: ${q(x)}`);
    }
  for (const [x, w] of by("wh", 2)) if (!WH_WORDS.includes(w)) add(`bad wh word ${q(w)} for ${x}`);
  for (const [x] of by("wh", 2)) {
    const used = has("role", 3, (a) => a[2] === x) ||
      facts.some((t) => t instanceof Compound && t.args.some((a) => Array.isArray(a) && a.includes(x)));
    if (!used) add(`wh item ${x} is not used as an argument of any event`);
  }
  for (const [, , u] of by("measure", 3)) if (!lemmaOk(u)) add(`unit ${q(u)} is not a single lemma`);
  for (const t of facts) for (const c of lexicalArgs(t)) if (!lemmaOk(c))
    add(`${q(c)} is not a single lemma (phrases/sentences are not allowed as concepts)`);
  for (const [e, v1] of by("event", 2)) for (const [e2, v2] of by("event", 2)) if (e === e2 && q(v1) < q(v2)) add(`event ${e} has two types (${q(v1)}, ${q(v2)})`);

  errors.push(...out);
  return { ok: errors.length === 0, facts, errors, warnings };
}
