import {atom, atomOptions, makeIR, normalizeIR, rule} from "../ir.mjs";
import {buildProtoIR} from "../protoir.mjs";
import {slug} from "../util.mjs";

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

function resolvePerson(raw, state) {
  if (!raw) return raw;
  return PRONOUN.test(raw) && state.lastPerson ? state.lastPerson : raw;
}

function entity(raw) { return slug(raw); }
function pred(raw) { return VERBS.get(String(raw).toLowerCase()) ?? slug(raw); }

function addFact(ir, p, args, options = {}) {
  ir.facts.push(atom(p, ...args, atomOptions(options)));
}

function inferSimpleClause(clause, ir, state) {
  const c = clause.trim().replace(/[.!?]+$/, "");
  let m;

  // "Mira, a physicist, owns the lab workstation"
  m = c.match(/^([A-Z][A-Za-z0-9_-]*),\s+(?:an?\s+)([A-Za-z_-]+),\s+(.+)$/);
  if (m) {
    const [, name, typ, rest] = m;
    state.lastPerson = entity(name);
    addFact(ir, typ, [name]);
    inferSimpleClause(`${name} ${rest}`, ir, state);
    return;
  }

  // X is a TYPE / X is an ADJECTIVE.
  m = c.match(/^(?:the\s+)?([A-Za-z][A-Za-z0-9_-]*)\s+is\s+(?:a|an)\s+([A-Za-z][A-Za-z0-9_-]*)$/i);
  if (m) {
    const [, x, typ] = m;
    if (/^[A-Z]/.test(x)) state.lastPerson = entity(x);
    addFact(ir, typ, [x]);
    return;
  }
  m = c.match(/^(?:the\s+)?([A-Za-z][A-Za-z0-9_-]*)\s+is\s+(red|clean|contaminated|overloaded|empty|active|inactive)$/i);
  if (m) { addFact(ir, m[2], [m[1]]); return; }

  // Spatial relation.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+is\s+(west|east|north|south)\s+of\s+(?:the\s+)?([A-Za-z0-9_-]+)$/i);
  if (m) { addFact(ir, `${m[2]}_of`, [m[1], m[3]]); return; }

  // Mounted on.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+is\s+mounted\s+on\s+(?:the\s+)?(.+)$/i);
  if (m) { addFact(ir, "mounted_on", [m[1], m[2]]); return; }

  // Passive "the report was approved by Ana".
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+was\s+([A-Za-z]+ed)\s+by\s+([A-Z][A-Za-z0-9_-]*)$/i);
  if (m) { addFact(ir, pred(m[2]), [m[3], m[1]]); return; }

  // Explicit negated transitive.
  m = c.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+did\s+not\s+([A-Za-z_-]+)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i);
  if (m) { addFact(ir, pred(m[2]), [resolvePerson(m[1], state), m[3]], {neg: true}); return; }

  // belongs to is multiword.
  m = c.match(/^(?:the\s+)?([A-Za-z0-9_-]+)\s+belongs\s+to\s+([A-Za-z0-9_-]+)$/i);
  if (m) { addFact(ir, "belongs_to", [m[1], m[2]]); return; }

  // Generic transitive for a deliberately small verb inventory.
  m = c.match(/^([A-Za-z][A-Za-z0-9_-]*)\s+([A-Za-z_-]+)\s+(?:the\s+|a\s+|an\s+)?(.+)$/i);
  if (m && VERBS.has(m[2].toLowerCase())) {
    const subject = resolvePerson(m[1], state);
    if (/^[A-Z]/.test(m[1])) state.lastPerson = entity(m[1]);
    addFact(ir, pred(m[2]), [subject, m[3]]);
  }
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

function parseEveryRule(text, ir) {
  // Every researcher who owns a GPU can run a local model.
  const m = text.match(/^Every\s+([A-Za-z_-]+)\s+who\s+([A-Za-z_-]+)\s+(?:a|an|the)\s+([A-Za-z_-]+)\s+can\s+([A-Za-z_-]+)(?:\s+(?:a|an|the))?\s+(.+?)[.!?]?$/i);
  if (!m) return false;
  const [, subjectType, rel, objectType, action, object] = m;
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
  const leftIR = makeIR();
  const rightIR = makeIR();
  const state = {};
  inferSimpleClause(m[1], leftIR, state);
  inferSimpleClause(m[2], rightIR, state);
  if (leftIR.facts.length === 1 && rightIR.facts.length === 1) {
    // Replace constants that appear as generic noun labels with one shared variable only in the trivial unary case.
    ir.rules.push(rule(rightIR.facts[0], leftIR.facts));
    return true;
  }
  return false;
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
    const state = {lastPerson: null};
    for (const sentence of splitSentences(text)) {
      if (parseEveryRule(sentence, ir) || parseNoMayRule(sentence, ir) || parseIfThen(sentence, ir)) continue;
      // Split coordination conservatively. Each half is still traceable in ProtoIR.
      const pieces = sentence.replace(/[.!?]+$/, "").split(/\s+(?:and|but)\s+/i);
      for (const piece of pieces) inferSimpleClause(piece, ir, state);
    }
    enrichSymbols(ir);
    const normalized = normalizeIR(ir);
    normalized.meta.protoSummary = {mentions: proto.mentions.length, markers: proto.markers.length, clauses: proto.clauses.length};
    return {ir: normalized, proto, artifacts: {draft: normalized}};
  }
}
