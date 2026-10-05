const WORD_RE = /[\p{L}\p{N}_]+(?:[-'][\p{L}\p{N}_]+)*/gu;
const TOKEN_RE = /"[^"\n]*"|'[^'\n]*'|[\p{L}\p{N}_]+(?:[-'][\p{L}\p{N}_]+)*|[^\s]/gu;

const PRONOUNS = new Set("i you he she it we they me him her us them this that these those who whom whose which".split(" "));
const NEG = new Set(["not", "no", "never", "without", "neither", "nor"]);
const QUANT = new Set(["all", "every", "each", "some", "any", "a", "an", "no", "none", "many", "few", "most", "only"]);
const MODAL = new Set(["must", "may", "might", "can", "could", "should", "would", "shall", "possible", "necessary", "required", "prohibited", "allowed"]);
const CONDITIONAL = new Set(["if", "unless", "when", "whenever", "provided", "assuming"]);
const TEMPORAL = new Set(["before", "after", "then", "while", "during", "until", "since", "yesterday", "today", "tomorrow"]);
const COORD = new Set(["and", "or", "but", "either", "neither"]);
const STOP = new Set("the a an is are was were be been being to of in on at for from by with and or but if then that this these those who which whom whose it he she they we i you do does did have has had as than into onto its their his her our your not no every each all some any may might must can could should would shall".split(" "));

function norm(s) { return s.toLowerCase(); }
function classifyToken(text) {
  if (/^['"]/.test(text)) return "quoted";
  if (/^\d+(?:[.,]\d+)?$/.test(text)) return "number";
  if (/^[\p{L}\p{N}_-]+$/u.test(text)) return "word";
  return "punct";
}

export function tokenize(text) {
  const out = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    out.push({id: `t${out.length}`, text: m[0], norm: norm(m[0]), start: m.index, end: m.index + m[0].length, kind: classifyToken(m[0])});
  }
  return out;
}

export function sentenceSpans(text, tokens = tokenize(text)) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/[.!?]/.test(text[i]) && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      const end = i + 1;
      if (text.slice(start, end).trim()) out.push(makeSpan(out.length, start, end, text, tokens));
      start = end;
      while (start < text.length && /\s/.test(text[start])) start += 1;
    }
  }
  if (start < text.length && text.slice(start).trim()) out.push(makeSpan(out.length, start, text.length, text, tokens));
  return out;
}

function makeSpan(i, start, end, text, tokens) {
  return {id: `s${i}`, start, end, text: text.slice(start, end), tokenIds: tokens.filter((t) => t.start >= start && t.end <= end).map((t) => t.id)};
}

export function clauseSpans(text, sentences, tokens) {
  const out = [];
  const boundary = /[,;:]|\b(?:but|because|although|unless|if|when|while|before|after|then)\b/giu;
  for (const s of sentences) {
    let cursor = s.start;
    for (const m of s.text.matchAll(boundary)) {
      const cut = s.start + m.index;
      if (text.slice(cursor, cut).trim()) out.push(makeClause(out.length, cursor, cut, text, tokens, s.id));
      cursor = cut;
    }
    if (text.slice(cursor, s.end).trim()) out.push(makeClause(out.length, cursor, s.end, text, tokens, s.id));
  }
  return out;
}

function makeClause(i, start, end, text, tokens, sentenceId) {
  return {id: `c${i}`, sentenceId, start, end, text: text.slice(start, end).trim(), tokenIds: tokens.filter((t) => t.start >= start && t.end <= end).map((t) => t.id)};
}

function addMarker(out, token, kind, value = token.norm) {
  out.push({id: `m${out.length}`, kind, value, tokenId: token.id, start: token.start, end: token.end});
}

export function extractMarkers(tokens, text) {
  const out = [];
  for (const t of tokens) {
    const w = t.norm;
    if (NEG.has(w)) addMarker(out, t, "negation");
    if (QUANT.has(w)) addMarker(out, t, "quantifier");
    if (MODAL.has(w)) addMarker(out, t, "modality");
    if (CONDITIONAL.has(w)) addMarker(out, t, "conditional");
    if (TEMPORAL.has(w)) addMarker(out, t, "temporal");
    if (COORD.has(w)) addMarker(out, t, "coordination");
    if (["before", "after", "because", "therefore", "so"].includes(w)) addMarker(out, t, "relation_signal");
  }
  if (text.trim().endsWith("?")) out.push({id: `m${out.length}`, kind: "question", value: "question", start: text.lastIndexOf("?"), end: text.lastIndexOf("?") + 1});
  return out;
}

export function extractMentions(text, tokens) {
  const candidates = [];
  const add = (kind, start, end, label, extra = {}) => {
    const key = `${start}:${end}:${kind}`;
    if (!candidates.some((x) => x._key === key)) candidates.push({_key: key, id: `x${candidates.length}`, kind, start, end, text: text.slice(start, end), label, ...extra});
  };

  for (const t of tokens) {
    if (t.kind === "number") add("number", t.start, t.end, t.text);
    if (t.kind === "quoted") add("quoted", t.start, t.end, t.text.slice(1, -1));
    if (PRONOUNS.has(t.norm)) add("pronoun", t.start, t.end, t.text);
    if (/^[A-Z][A-Za-z]*\d+$/.test(t.text) || /^[A-Z]\d+$/.test(t.text)) add("identifier", t.start, t.end, t.text);
  }

  // Individual capitalized tokens are also retained so a sentence-initial marker cannot swallow a name.
  const nonNameInitial = new Set(["if","every","each","all","no","when","unless","after","before","then","the","a","an"]);
  for (const t of tokens) {
    if (t.kind === "word" && /^[A-Z]/.test(t.text) && !nonNameInitial.has(t.norm) && !/^[A-Z]\d+$/.test(t.text)) add("proper", t.start, t.end, t.text);
  }

  // Proper-name sequences, including sentence-initial names; false positives are intentional (high recall).
  const proper = /\b(?:[A-Z][\p{L}'-]+)(?:\s+[A-Z][\p{L}'-]+)*/gu;
  for (const m of text.matchAll(proper)) add("proper", m.index, m.index + m[0].length, m[0]);

  // Definite/indefinite noun-phrase candidates. We preserve the surface rather than claiming a parse.
  const np = /\b(?:the|a|an|this|that|these|those)\s+([\p{L}][\p{L}\p{N}_'-]*(?:\s+[\p{L}][\p{L}\p{N}_'-]*){0,3})/giu;
  for (const m of text.matchAll(np)) {
    const phrase = m[0];
    const words = phrase.split(/\s+/);
    while (words.length > 1 && STOP.has(words.at(-1).toLowerCase())) words.pop();
    const label = words.join(" ");
    add("noun_phrase", m.index, m.index + label.length, label);
  }

  return candidates.map(({_key, ...x}) => x).sort((a, b) => a.start - b.start || a.end - b.end);
}

export function extractPredicateCandidates(tokens) {
  const out = [];
  for (const t of tokens) {
    if (t.kind !== "word") continue;
    if (STOP.has(t.norm) || PRONOUNS.has(t.norm)) continue;
    if (t.norm.length < 2) continue;
    out.push({id: `p${out.length}`, surface: t.text, norm: t.norm, tokenIds: [t.id], start: t.start, end: t.end});
  }
  return out;
}

export function surfaceRelations(text) {
  const out = [];
  const add = (kind, m, fields) => out.push({id: `r${out.length}`, kind, start: m.index, end: m.index + m[0].length, surface: m[0], ...fields});
  for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9_-]*)\s+is\s+(?:a|an)\s+([\p{L}][\p{L}\p{N}_-]*)/gu)) add("copula_type", m, {subject: m[1], complement: m[2]});
  for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9_-]*)\s+(owns|holds|contains|authored|reviewed|deleted|entered|approved)\s+(?:the\s+|a\s+|an\s+)?([A-Za-z0-9_-]+)/giu)) add("surface_binary", m, {subject: m[1], predicate: m[2], object: m[3]});
  for (const m of text.matchAll(/\b([A-Za-z0-9_-]+)\s+is\s+(west|east|north|south)\s+of\s+([A-Za-z0-9_-]+)/giu)) add("spatial", m, {subject: m[1], predicate: `${m[2]}_of`, object: m[3]});
  return out;
}

export function buildProtoIR(text) {
  const source = String(text ?? "");
  const tokens = tokenize(source);
  const sentences = sentenceSpans(source, tokens);
  const clauses = clauseSpans(source, sentences, tokens);
  return {
    version: "0.2",
    source,
    tokens,
    sentences,
    clauses,
    mentions: extractMentions(source, tokens),
    markers: extractMarkers(tokens, source),
    predicateCandidates: extractPredicateCandidates(tokens),
    surfaceRelations: surfaceRelations(source),
    meta: {policy: "high-recall-surface; preserve source; do not force semantic normalization"}
  };
}

export function compactProtoIR(proto) {
  return {
    version: proto.version,
    clauses: proto.clauses.map(({id, text, start, end}) => ({id, text, start, end})),
    mentions: proto.mentions.map(({id, kind, text, start, end}) => ({id, kind, text, start, end})),
    markers: proto.markers,
    predicateCandidates: proto.predicateCandidates.map(({id, surface, norm, start, end}) => ({id, surface, norm, start, end})),
    surfaceRelations: proto.surfaceRelations
  };
}
