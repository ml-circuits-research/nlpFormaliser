import {atom, atomOptions, makeIR, normalizeIR, rule} from "../ir.mjs";
import {buildProtoIR} from "../protoir.mjs";
import {slug} from "../util.mjs";

// Deliberately small deterministic draft grammar. It asserts a fact only for a
// declarative clause it fully understands. Questions, conditionals outside the
// explicit rule patterns, modal/attitude clauses and clauses whose object is not
// a short noun phrase are recorded as unsupported notes (in `ambiguities`, by
// source offsets) instead of being asserted as facts or copied into names.

const VERBS = new Map(Object.entries({
  owns: "owns", own: "owns", owned: "owns",
  holds: "holding", holding: "holding", held: "holding",
  authored: "authored", author: "authored",
  reviewed: "reviewed", review: "reviewed",
  deleted: "deleted", delete: "deleted",
  entered: "entered", enter: "entered",
  approved: "approved", approve: "approved",
  contains: "contains", contain: "contains",
  requires: "requires", require: "requires",
  detects: "detects", detect: "detects",
  submitted: "submitted", submit: "submitted",
  sent: "sent", send: "sent",
  promised: "promised", promise: "promised",
  belongs: "belongs_to"
}));

const PRONOUN = /^(she|he|they)$/i;
const QUESTION = /\?/;
const CONDITIONAL = /\b(?:if|unless|when|whenever|provided|assuming)\b/i;
const MODAL = /\b(?:must|may|might|can|could|should|would|shall|will|cannot|can't|won't|mustn't|shouldn't|needs?\s+to|has\s+to|have\s+to|allowed|permitted|required|forbidden|prohibited|obliged)\b/i;
const ATTITUDE = /\b(?:believes?|believed|thinks?|thought|knows?|knew|says?|said|claims?|claimed|hopes?|hoped|wants?|wanted|doubts?|doubted|promised?|promises|told|tells?|reported|aware)\b/i;
const TEMPORAL_ADVERB = /\s+(?:yesterday|today|tomorrow|now|currently|recently|again|already|later|earlier|soon)$/i;
const OBJECT_STOP = /\s+(?:in|on|at|to|from|with|without|for|after|before|during|until|since|by|only|because|while|which|who|that|then)\b|,/i;
const DETERMINER = /^(?:the|a|an|this|that|these|those|his|her|its|their)\s+/i;
const MAX_OBJECT_WORDS = 3;

// An unresolvable pronoun yields null: the clause is then reported, not asserted
// about an entity literally named "he".
function resolvePerson(raw, state) {
  if (!raw) return raw;
  if (!PRONOUN.test(raw)) return raw;
  return state.lastPerson ?? null;
}

function entity(raw) { return slug(raw); }
function pred(raw) { return VERBS.get(String(raw).toLowerCase()) ?? slug(raw); }

function addFact(ir, p, args, options = {}) {
  ir.facts.push(atom(p, ...args, atomOptions(options)));
}

function note(state, kind) {
  const span = state.span ?? null;
  const key = `${kind}:${span?.join("-")}`;
  if (state.noted.has(key)) return;
  state.noted.add(key);
  state.notes.push({id: `u${state.notes.length + 1}`, kind, ...(span ? {span} : {})});
}

// A short object noun phrase. Trailing temporal adverbs and prepositional or
// relative material are not represented; they are reported, never copied into
// the entity name. A non-restrictive ", which is a/an X" adds X(object).
function anchorObject(raw, ir, state) {
  let s = raw.trim();
  let extra = null;
  const rel = s.match(/^(.+?),\s*which\s+is\s+(?:a|an)\s+([A-Za-z][A-Za-z0-9_-]*)$/i);
  if (rel) { s = rel[1]; extra = rel[2]; }
  const notes = [];
  if (TEMPORAL_ADVERB.test(s)) { s = s.replace(TEMPORAL_ADVERB, ""); notes.push("unrepresented_time"); }
  const stop = s.match(OBJECT_STOP);
  if (stop) { s = s.slice(0, stop.index); notes.push("unrepresented_modifier"); }
  s = s.replace(DETERMINER, "").trim();
  const words = s.split(/\s+/).filter(Boolean);
  // A determiner inside the remainder signals a second object (ditransitive) or a clause.
  if (!words.length || words.length > MAX_OBJECT_WORDS || words.some((w) => /^(?:the|a|an|that|is|was|are|were)$/i.test(w))) return null;
  for (const kind of notes) note(state, kind);
  return {object: s, extra};
}

function inferSimpleClause(clause, ir, state) {
  const c = clause.trim().replace(/[.!?,;]+$/, "");
  let m;

  // "Mira, a physicist, owns the lab workstation"
  m = c.match(/^([A-Z][A-Za-z0-9_-]*),\s+(?:an?\s+)([A-Za-z_-]+),\s+(.+)$/);
  if (m) {
    const [, name, typ, rest] = m;
    state.lastPerson = entity(name);
    addFact(ir, typ, [name]);
    inferSimpleClause(`${name} ${rest}`, ir, state);
    return true;
  }

  // X is a TYPE / X is an ADJECTIVE.
  m = c.match(/^(?:the\s+)?([A-Za-z][A-Za-z0-9_-]*)\s+is\s+(?:a|an)\s+([A-Za-z][A-Za-z0-9_-]*)$/i);
  if (m) {
    const [, x, typ] = m;
    if (/^[A-Z]/.test(x)) state.lastPerson = entity(x);
    addFact(ir, typ, [x]);
    return true;
  }
  m = c.match(/^(?:the\s+)?([A-Za-z][A-Za-z0-9_-]*)\s+is\s+(red|clean|contaminated|overloaded|empty|active|inactive)$/i);
  if (m) { addFact(ir, m[2], [m[1]]); return true; }

  // Spatial relation.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+is\s+(west|east|north|south)\s+of\s+(?:the\s+)?([A-Za-z0-9_-]+)$/i);
  if (m) { addFact(ir, `${m[2]}_of`, [m[1], m[3]]); return true; }

  // Mounted on.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+is\s+mounted\s+on\s+(?:the\s+)?(.+)$/i);
  if (m) {
    const o = anchorObject(m[2], ir, state);
    if (!o) return false;
    addFact(ir, "mounted_on", [m[1], o.object]);
    return true;
  }

  // Passive "the report was approved by Ana".
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+was\s+([A-Za-z]+ed)\s+by\s+([A-Z][A-Za-z0-9_-]*)$/i);
  if (m) { addFact(ir, pred(m[2]), [m[3], m[1]]); return true; }

  // Explicit negated transitive.
  m = c.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+did\s+not\s+([A-Za-z_-]+)\s+(.+)$/i);
  if (m) {
    const o = anchorObject(m[3], ir, state);
    if (!o) return false;
    const subject = resolvePerson(m[1], state);
    if (!subject) { note(state, "unresolved_reference"); return true; }
    if (/^[A-Z]/.test(m[1]) && !PRONOUN.test(m[1])) state.lastPerson = entity(m[1]);
    addFact(ir, pred(m[2]), [subject, o.object], {neg: true});
    if (o.extra) addFact(ir, o.extra, [o.object]);
    return true;
  }

  // belongs to is multiword.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+belongs\s+to\s+([A-Za-z0-9_-]+)$/i);
  if (m) { addFact(ir, "belongs_to", [m[1], m[2]]); return true; }

  // Generic transitive for a deliberately small verb inventory.
  m = c.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+([A-Za-z_-]+)\s+(.+)$/i);
  if (m && VERBS.has(m[2].toLowerCase())) {
    const o = anchorObject(m[3], ir, state);
    if (!o) return false;
    const subject = resolvePerson(m[1], state);
    if (!subject) { note(state, "unresolved_reference"); return true; }
    if (/^[A-Z]/.test(m[1]) && !PRONOUN.test(m[1])) state.lastPerson = entity(m[1]);
    addFact(ir, pred(m[2]), [subject, o.object]);
    if (o.extra) addFact(ir, o.extra, [o.object]);
    return true;
  }
  return false;
}

function parseEveryRule(text, ir) {
  // Every researcher who owns a GPU can run a local model.
  const m = text.match(/^Every\s+([A-Za-z_-]+)\s+who\s+([A-Za-z_-]+)\s+(?:a|an|the)\s+([A-Za-z_-]+)\s+can\s+([A-Za-z_-]+)(?:\s+(?:a|an|the))?\s+(.+?)[.!?]?$/i);
  if (!m) return false;
  const [, subjectType, rel, objectType, action, object] = m;
  if (object.trim().split(/\s+/).length > MAX_OBJECT_WORDS - 1) return false;
  const x = "?x", y = "?y";
  ir.rules.push(rule(
    atom(`can_${pred(action)}`, x, entity(object)),
    [atom(subjectType, x), atom(pred(rel), x, y), atom(objectType, y)]
  ));
  return true;
}

function parseNoMayRule(text, ir) {
  // No reviewer may approve a paper they authored.
  const m = text.match(/^No\s+([A-Za-z_-]+)\s+may\s+([A-Za-z_-]+)\s+(?:a|an|the)\s+([A-Za-z_-]+)\s+they\s+([A-Za-z_-]+)[.!?]?$/i);
  if (!m) return false;
  const [, subjectType, action, objectType, relation] = m;
  const x = "?x", y = "?y";
  ir.rules.push(rule(
    atom(`prohibited_${pred(action)}`, x, y),
    [atom(subjectType, x), atom(objectType, y), atom(pred(relation), x, y)]
  ));
  return true;
}

function parseIfThen(text, ir) {
  const m = text.match(/^If\s+(.+?),\s*(?:then\s+)?(.+?)[.!?]?$/i);
  if (!m) return false;
  if (MODAL.test(m[1]) || MODAL.test(m[2]) || ATTITUDE.test(m[1]) || ATTITUDE.test(m[2])) return false;
  const leftIR = makeIR();
  const rightIR = makeIR();
  const state = {notes: [], noted: new Set()};
  inferSimpleClause(m[1], leftIR, state);
  inferSimpleClause(m[2], rightIR, state);
  if (leftIR.facts.length === 1 && rightIR.facts.length === 1 && !state.notes.length) {
    ir.rules.push(rule(rightIR.facts[0], leftIR.facts));
    return true;
  }
  return false;
}

// Split coordinated clauses. A piece without its own verb ("Ana" in "Ana and
// Bob own the lab") is a coordinated subject and is distributed over the next
// clause; a piece that starts with a verb reuses the previous subject.
function splitCoordination(sentence) {
  const pieces = sentence.replace(/[.!?]+$/, "").split(/\s*;\s*|,?\s+(?:and|but)\s+|,\s*then\s+/i).map((x) => x.trim()).filter(Boolean);
  const out = [];
  let pendingSubjects = [];
  let lastSubject = null;
  for (const piece of pieces) {
    const words = piece.split(/\s+/);
    const hasVerb = words.slice(1).some((w) => VERBS.has(w.toLowerCase()) || /^(?:is|was|are|were|did|does)$/i.test(w));
    if (words.length <= 2 && !hasVerb && /^(?:the\s+)?[A-Za-z][A-Za-z0-9_-]*$/i.test(piece)) { pendingSubjects.push(piece); continue; }
    if ((VERBS.has(words[0].toLowerCase()) || /^(?:is|was|did)$/i.test(words[0])) && lastSubject) {
      out.push(`${lastSubject} ${piece}`);
      continue;
    }
    // Only a single-token subject directly followed by a verb is reused or replaced.
    const simpleSubject = words.length > 1 && (VERBS.has(words[1].toLowerCase()) || /^(?:is|was|are|were|did|does)$/i.test(words[1]));
    if (pendingSubjects.length && !simpleSubject) { out.push(piece); continue; }
    for (const s of pendingSubjects) out.push(`${s} ${words.slice(1).join(" ")}`);
    pendingSubjects = [];
    lastSubject = simpleSubject ? words[0] : null;
    out.push(piece);
  }
  return {clauses: out, dangling: pendingSubjects.length > 0};
}

function enrichSymbols(ir) {
  const entityIds = new Set(ir.facts.flatMap((f) => f.args).filter((x) => typeof x === "string" && !x.startsWith("?")));
  const preds = new Set([...ir.facts.map((f) => f.pred), ...ir.rules.flatMap((r) => [r.head.pred, ...r.body.map((a) => a.pred)])]);
  for (const e of entityIds) ir.symbols.entities[e] ??= {label: e.replace(/_/g, " ")};
  for (const p of preds) ir.symbols.predicates[p] ??= {label: p.replace(/_/g, " ")};
}

export class HeuristicStrategy {
  constructor({name = "heuristic"} = {}) { this.name = name; }

  async formalize(text, {proto = buildProtoIR(text)} = {}) {
    const ir = makeIR({meta: {strategy: this.name}});
    const state = {lastPerson: null, notes: [], noted: new Set(), span: null};
    for (const sentence of proto.sentences) {
      state.span = [sentence.start, sentence.end];
      const s = sentence.text.trim();
      if (QUESTION.test(s)) { note(state, "unsupported_question"); continue; }
      if (parseEveryRule(s, ir) || parseNoMayRule(s, ir) || parseIfThen(s, ir)) continue;
      if (CONDITIONAL.test(s)) { note(state, "unsupported_conditional"); continue; }
      if (ATTITUDE.test(s)) { note(state, "unsupported_attitude"); continue; }
      if (MODAL.test(s)) { note(state, "unsupported_modality"); continue; }
      const {clauses, dangling} = splitCoordination(s);
      if (dangling) note(state, "unsupported_coordination");
      for (const clause of clauses) if (!inferSimpleClause(clause, ir, state)) note(state, "unsupported_clause");
    }
    // Unsupported material is retained as explicit notes, never as facts.
    ir.ambiguities.push(...state.notes);
    enrichSymbols(ir);
    const normalized = normalizeIR(ir);
    normalized.meta.protoSummary = {mentions: proto.mentions.length, markers: proto.markers.length, clauses: proto.clauses.length};
    return {ir: normalized, proto, artifacts: {draft: normalized}};
  }
}
