// English morphology on top of compromise (https://github.com/spencermountain/compromise).
import nlp from "compromise";

const T = nlp.methods().two.transform;
const MODEL = nlp.model();

const BE = { VBD: "was", VBN: "been", VBG: "being", VBZ: "is", VBP: "are", VB: "be" };
const vcache = new Map();

function conj(v) {
  if (!vcache.has(v)) {
    let c = {};
    try { c = T.verb.conjugate(v, MODEL) || {}; } catch { c = {}; }
    vcache.set(v, c);
  }
  return vcache.get(v);
}

function regularPast(v) {
  if (v.endsWith("e")) return v + "d";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ied";
  return v + "ed";
}

// verbs whose past tense really equals the lemma (compromise sometimes returns the lemma by mistake, e.g. "brake")
const INVARIANT = new Set("put cut set let hit shut cost hurt split quit bet spread fit read cast burst rid shed thrust upset broadcast bid beat".split(" "));

function verbForm(v, tag) {
  if (tag === "VB" || tag === "VBP") return v;
  const c = { ...conj(v) };
  if (c.PastTense === v && !INVARIANT.has(v)) c.PastTense = regularPast(v);
  if (tag === "VBD") return c.PastTense || regularPast(v);
  if (tag === "VBN") return c.Participle || c.PastTense || regularPast(v);
  if (tag === "VBZ") return c.PresentTense || (/(s|sh|ch|x|z|o)$/.test(v) ? v + "es" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ies" : v + "s");
  if (tag === "VBG") {
    const g = c.Gerund;
    if (g && g.endsWith("ing")) return g;
    if (v.endsWith("ie")) return v.slice(0, -2) + "ying";
    if (v.endsWith("e") && !v.endsWith("ee")) return v.slice(0, -1) + "ing";
    if (v.endsWith("c")) return v + "king";
    return v + "ing";
  }
  return v;
}

function plural(n) {
  let p = "";
  try { p = T.noun.toPlural(n, MODEL); } catch { p = ""; }
  return p || (/(s|sh|ch|x|z)$/.test(n) ? n + "es" : /[^aeiou]y$/.test(n) ? n.slice(0, -1) + "ies" : n + "s");
}

/** Inflect a lemma (snake_case multiword allowed). tag ∈ VB VBD VBN VBG VBZ VBP NNS JJR JJS */
export function inflect(lemma, tag) {
  const parts = String(lemma).split("_");
  const isVerb = tag.startsWith("V");
  const idx = isVerb ? 0 : parts.length - 1;
  const head = parts[idx];
  let out;
  if (head === "be" && isVerb) out = BE[tag];
  else if (isVerb) out = verbForm(head, tag);
  else if (tag === "NNS") out = plural(head);
  else out = head;
  parts[idx] = out;
  return parts.join(" ");
}

// vowel groups, not counting a silent final -e ("large" = 1, "simple" = 1, "happy" = 2)
const syllables = (w) => (w.toLowerCase().replace(/e$/, "").match(/[aeiouy]+/g) || []).length || 1;

export function comparative(adj) {
  if (adj.length <= 6 && (syllables(adj) <= 1 || adj.endsWith("y")) || (adj.endsWith("y") && syllables(adj) <= 2)) {
    try { const r = T.adjective.toComparative(adj, MODEL); if (r && !r.startsWith("more")) return r; } catch { /* fall through */ }
  }
  return "more " + adj;
}

export function superlative(adj) {
  if (adj.length <= 6 && (syllables(adj) <= 1 || adj.endsWith("y")) || (adj.endsWith("y") && syllables(adj) <= 2)) {
    try { const r = T.adjective.toSuperlative(adj, MODEL); if (r && !r.startsWith("most")) return r; } catch { /* fall through */ }
  }
  return "most " + adj;
}

const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

export function numberWords(n) {
  if (typeof n === "number" && !Number.isInteger(n)) return String(n);
  n = Math.trunc(n);
  if (n >= 0 && n < 20) return ONES[n];
  if (n < 100 && n > 0) return TENS[Math.floor(n / 10)] + (n % 10 === 0 ? "" : "-" + ONES[n % 10]);
  return String(n);
}
