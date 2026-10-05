// Answer an EVL question by executing it as a conjunctive query over an EVL fact base.
// JS port of nlpformaliser/kb.pl + qa.py: a small backtracking solver (generators) with the same rules:
// taxonomy (kind/2 + generic "Xs are Ys"), generic inheritance with most-specific-class exceptions,
// universal rules restricted by relative clauses (incl. numeric thresholds), modus ponens, and
// non-asserted contexts (beliefs, conditionals, counterfactuals, questions).
import { KB } from "./kb.mjs";
import { English, UNIVERSAL_Q, adj, cap } from "./english.mjs";
import { numberWords } from "./morph.mjs";
import { Compound, isCompound, termToString } from "./terms.mjs";

const GENERIC_Q = ["bare", "all", "every", "each", "most", "many", "any", "few", "no"];
const EQCLASS = [["agent", "experiencer"], ["theme", "patient", "stimulus"], ["location", "pp(in)", "pp(at)", "pp(on)"],
  ["destination", "pp(to)"], ["duration", "extent", "pp(for)"], ["recipient", "pp(to)"]];
const OK_STATUS = ["asserted", "derived", "generic"];
const key = (t) => (typeof t === "string" ? t : termToString(t));
const eqT = (a, b) => a === b || (a != null && b != null && typeof a === "object" && key(a) === key(b));

// ------------------------------------------------------------------ fact base + rules
class Reasoner {
  constructor(facts) {
    this.facts = facts.filter((f) => f instanceof Compound);
    this.idx = new Map();
    for (const f of this.facts) {
      const k = `${f.f}/${f.args.length}`;
      if (!this.idx.has(k)) this.idx.set(k, []);
      this.idx.get(k).push(f.args);
    }
    this.memo = new Map();
  }
  all(f, n) { return this.idx.get(`${f}/${n}`) || []; }
  has(f, n, pred) { return this.all(f, n).some(pred); }
  m(k, fn) { if (!this.memo.has(k)) this.memo.set(k, fn()); return this.memo.get(k); }

  quantOf(x) { return this.all("quant", 2).filter((a) => a[0] === x).map((a) => a[1]); }
  insts(x) { return this.all("inst", 2).filter((a) => a[0] === x).map((a) => a[1]); }
  isNeg(e) { return this.has("neg", 1, (a) => a[0] === e); }
  roles(e) { return this.all("role", 3).filter((a) => a[0] === e); }

  /** generic_ent(X, Q): quantifier of a generic/universal entity, or null */
  genericEnt(x) {
    return this.m(`gen:${x}`, () => {
      const q = this.quantOf(x).find((q) => GENERIC_Q.includes(q));
      if (q !== undefined) return q;
      if (!this.quantOf(x).length && this.has("plural", 1, (a) => a[0] === x) &&
          this.all("role", 3).some(([e, , a]) => a === x && this.has("generic", 1, (g) => g[0] === e))) return "bare";
      return null;
    });
  }
  genericEntities() { return [...new Set(this.all("role", 3).map((a) => a[2]).concat(this.all("quant", 2).map((a) => a[0])))].filter((x) => typeof x === "string" && this.genericEnt(x) != null); }

  copulaPairs(negative) {
    const out = [];
    for (const [e, v] of this.all("event", 2)) {
      if (v !== "be") continue;
      for (const [, r, x] of this.roles(e)) {
        if (r !== "theme") continue;
        const q = this.genericEnt(x);
        if (q == null) continue;
        if (!negative && (this.isNeg(e) || q === "no" || this.has("restrict", 2, (a) => a[0] === x))) continue;
        if (negative && !(this.isNeg(e) || this.quantOf(x).includes("no"))) continue;
        for (const c1 of this.insts(x))
          for (const [, r2, y] of this.roles(e))
            if (r2 === "attribute" && typeof y === "string") for (const c2 of this.insts(y)) out.push([c1, c2]);
      }
    }
    return out;
  }
  genIsa() { return this.m("genIsa", () => this.copulaPairs(false)); }
  genNotIsa() { return this.m("genNotIsa", () => this.copulaPairs(true)); }
  directSub(c) { return [...this.all("kind", 2).filter((a) => a[0] === c).map((a) => a[1]), ...this.genIsa().filter(([a]) => a === c).map(([, b]) => b)]; }
  /** BFS distances from class c to all its superclasses */
  supers(c) {
    return this.m(`sup:${key(c)}`, () => {
      const dist = new Map(); let frontier = [c], d = 0;
      while (frontier.length && d < 50) {
        d++;
        const next = [];
        for (const x of frontier) for (const s of this.directSub(x)) if (!dist.has(key(s))) { dist.set(key(s), d); next.push(s); }
        frontier = next;
      }
      return dist;
    });
  }
  sub(c, s) { return this.supers(c).has(key(s)); }
  isa(x, c) {
    if (this.insts(x).some((i) => eqT(i, c))) return true;
    if (this.insts(x).some((i) => this.sub(i, c))) return true;
    return this.has("measure", 3, (a) => a[0] === x && eqT(a[2], c));
  }
  notIsa(x, c) {
    const classes = this.insts(x).flatMap((c0) => [c0, ...[...this.supers(c0).keys()]]);
    return this.genNotIsa().some(([c1, c2]) => classes.some((k) => key(k) === key(c1)) && eqT(c2, c));
  }
  dist(x, c) {
    if (this.insts(x).some((i) => eqT(i, c))) return 0;
    let best = null;
    for (const c0 of this.insts(x)) { const d = this.supers(c0).get(key(c)); if (d != null && d <= 6 && (best == null || d < best)) best = d; }
    return best;
  }
  entities() { return [...new Set(["inst", "name", "pron", "measure", "group"].flatMap((p) => this.all(p, p === "measure" ? 3 : 2).map((a) => a[0])))]; }

  evType(e, v) { return this.has("event", 2, (a) => a[0] === e && (eqT(a[1], v) || this.sub(a[1], v))); }
  roleEq(r1, r2) { const a = key(r1), b = key(r2); return a === b || EQCLASS.some((c) => c.includes(a) && c.includes(b)); }

  embedded(e) {
    return this.has("role", 3, (a) => a[1] === "content" && a[2] === e) ||
      this.has("link", 3, (a) => (a[2] === e || a[0] === e) && (a[1] === "if" || a[1] === "unless")) ||
      this.has("counterfactual", 1, (a) => a[0] === e) || this.has("act", 3, (a) => a[2] === e) ||
      this.has("restrict", 2, (a) => a[1] === e && this.genericEnt(a[0]) != null);
  }
  asserted(e) { return this.has("event", 2, (a) => a[0] === e) && !this.embedded(e); }
  similar(a, b) {
    if (eqT(a, b)) return true;
    const nameOf = (x) => this.all("name", 2).filter((r) => r[0] === x).map((r) => r[1]);
    if (nameOf(a).some((n) => nameOf(b).includes(n))) return true;
    const pr = (x) => this.all("pron", 2).filter((r) => r[0] === x).map((r) => r[1]);
    if (pr(a).some((p) => pr(b).includes(p))) return true;
    if (this.insts(a).some((c) => this.isa(b, c))) return true;
    for (const [x, na, u] of this.all("measure", 3)) if (x === a)
      for (const [y, nb, u2] of this.all("measure", 3)) if (y === b && eqT(u, u2) && amountOk(nb, na)) return true;
    return false;
  }
  matchEvent(p, e) {
    const pv = this.all("event", 2).find((a) => a[0] === p)?.[1];
    if (pv === undefined || !this.evType(e, pv)) return false;
    if (this.isNeg(p) !== this.isNeg(e)) return false;
    return this.roles(p).filter(([, r]) => r !== "time" && r !== "manner")
      .every(([, r, a]) => this.roles(e).some(([, r2, b]) => this.roleEq(r2, r) && this.similar(a, b)));
  }
  derived(e1) {
    return this.all("link", 3).some(([a, c, e2]) => a === e1 && c === "if" &&
      this.all("event", 2).some(([e3]) => e3 !== e2 && this.asserted(e3) && this.matchEvent(e2, e3)));
  }
  sameRefs(a2) {  // all A with same_ref(A2, A)
    const g = this.all("group", 2).find((x) => x[0] === a2);
    return [a2, ...(g && Array.isArray(g[1]) ? g[1] : [])];
  }
  satisfiesRestrictions(a, g) {
    return this.all("restrict", 2).filter((r) => r[0] === g).every(([, p]) => {
      const v = this.all("event", 2).find((x) => x[0] === p)?.[1];
      if (v === undefined) return false;
      return this.all("event", 2).some(([e]) => e !== p && this.evType(e, v) && this.asserted(e) && this.isNeg(p) === this.isNeg(e) &&
        this.roles(p).filter(([, r]) => r !== "time" && r !== "manner").every(([, r, b]) =>
          b === g ? this.roles(e).some(([, r2, a2]) => this.roleEq(r2, r) && this.sameRefs(a2).includes(a))
                  : this.roles(e).some(([, r2, b2]) => this.roleEq(r2, r) && this.similar(b, b2))));
    });
  }
  status(e) {
    if (this.asserted(e)) return "asserted";
    if (this.derived(e)) return "derived";
    if (this.has("generic", 1, (a) => a[0] === e)) return "generic";
    return "embedded";
  }
  attrs(x) {
    const out = this.all("prop", 2).filter((a) => a[0] === x).map((a) => a[1]);
    for (const [e, v] of this.all("event", 2)) if (v === "be" && !this.isNeg(e) && this.roles(e).some(([, r, t]) => r === "theme" && t === x))
      for (const [, r, a] of this.roles(e)) if (r === "attribute") out.push(a);
    return out;
  }
  causes(e) {
    return [...this.roles(e).filter(([, r]) => r === "cause" || r === "purpose").map(([, , w]) => w),
      ...this.all("link", 3).filter(([a, c]) => a === e && c === "because").map(([, , w]) => w),
      ...this.all("link", 3).filter(([, c, b]) => c === "so" && b === e).map(([w]) => w)];
  }
}

function amountOk(n, t) {
  if (typeof n !== "number") return false;
  if (typeof t === "number") return n === t;
  if (!(t instanceof Compound)) return false;
  const v = t.args[0];
  return { more_than: n > v, less_than: n < v, at_least: n >= v, at_most: n <= v, exactly: n === v }[t.f] ?? false;
}

// ------------------------------------------------------------------ query solver
class V { constructor(name) { this.name = name; } toString() { return this.name; } }
const isV = (t) => t instanceof V;
const val = (t, b) => (isV(t) ? b.get(t.name) : t);
function bind(t, value, b) {
  if (!isV(t)) return eqT(t, value) ? b : null;
  const cur = b.get(t.name);
  if (cur !== undefined) return eqT(cur, value) ? b : null;
  const nb = new Map(b); nb.set(t.name, value); return nb;
}

function* goal(R, g, b) {
  const [op, ...a] = g;
  switch (op) {
    case "name": for (const [x, n] of R.all("name", 2)) if (n === a[1]) { const nb = bind(a[0], x, b); if (nb) yield nb; } break;
    case "isa": {
      const x = val(a[0], b);
      if (x !== undefined) { if (R.isa(x, a[1])) yield b; }
      else for (const e of R.entities()) if (R.isa(e, a[1])) yield bind(a[0], e, b);
      break;
    }
    case "not_isa": { const x = val(a[0], b); if (x !== undefined && R.notIsa(x, a[1])) yield b; break; }
    case "attr": {
      const x = val(a[0], b);
      for (const e of x !== undefined ? [x] : R.entities()) if (R.attrs(e).some((t) => eqT(t, a[1]))) { const nb = bind(a[0], e, b); if (nb) yield nb; }
      break;
    }
    case "rel": for (const [x, r, y] of R.all("rel", 3)) { let nb = bind(a[0], x, b); nb = nb && eqT(r, val(a[1], b) ?? r) ? bind(a[1], r, nb) : null; nb = nb && bind(a[2], y, nb); if (nb) yield nb; } break;
    case "generic_ent": {
      const x = val(a[0], b);
      if (x !== undefined) { if (R.genericEnt(x) != null) yield b; }
      else for (const e of R.genericEntities()) yield bind(a[0], e, b);
      break;
    }
    case "measure": for (const [x, n, u] of R.all("measure", 3)) if (eqT(u, a[1]) && amountOk(n, a[2])) { const nb = bind(a[0], x, b); if (nb) yield nb; } break;
    case "ev_type": {
      const e = val(a[0], b);
      if (e !== undefined) { if (R.evType(e, a[1])) yield b; }
      else for (const [ev] of R.all("event", 2)) if (R.evType(ev, a[1])) yield bind(a[0], ev, b);
      break;
    }
    case "fills": {
      const [E, role, A, M] = a;
      const e0 = val(E, b);
      for (const [e, r2, a2] of R.all("role", 3)) {
        if (e0 !== undefined && e !== e0) continue;
        if (!R.roleEq(r2, role)) continue;
        let nb = bind(E, e, b);
        if (!nb) continue;
        const av = val(A, nb);
        for (const cand of R.sameRefs(a2)) {
          if (av !== undefined && !eqT(av, cand)) continue;
          const nb2 = bind(A, cand, nb);
          const nb3 = nb2 && bind(M, "direct", nb2);
          if (nb3) yield nb3;
        }
        // generic inheritance (A must be known)
        if (av === undefined || eqT(av, a2)) continue;
        const q = R.genericEnt(a2);
        if (q == null || R.has("scope", 2, (s) => isCompound(s[0], "neg", 1) && s[0].args[0] === e && s[1] === a2)) continue;
        if (R.has("group", 2, (g2) => g2[0] === a2)) continue;
        for (const c of R.insts(a2)) {
          if (!R.isa(av, c) || !R.satisfiesRestrictions(av, a2)) continue;
          const d = R.dist(av, c);
          if (d == null) continue;
          const nb4 = bind(M, new Compound("gen", [c, q, d]), nb);
          if (nb4) yield nb4;
        }
      }
      break;
    }
    case "cause_of": { const e = val(a[0], b); if (e === undefined) break; for (const w of R.causes(e)) { const nb = bind(a[1], w, b); if (nb) yield nb; } break; }
    default: throw new Error(`unknown goal ${op}`);
  }
}

function* solve(R, goals, b = new Map(), i = 0) {
  if (i === goals.length) { yield b; return; }
  for (const nb of goal(R, goals[i], b)) if (nb) yield* solve(R, goals, nb, i + 1);
}

// Prolog standard order of terms (for deterministic, Prolog-identical ordering of solutions)
function rank(t) { return t === undefined || t === null ? 0 : typeof t === "number" ? 1 : typeof t === "string" ? 3 : 4; }
function cmp(a, b) {
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 1) return a - b;
  if (ra === 3) return a < b ? -1 : a > b ? 1 : 0;
  if (ra === 0) return 0;
  const [fa, aa] = Array.isArray(a) ? ["[|]", a] : [a.f, a.args];
  const [fb, ab] = Array.isArray(b) ? ["[|]", b] : [b.f, b.args];
  const la = Array.isArray(a) ? 2 : aa.length, lb = Array.isArray(b) ? 2 : ab.length;
  if (la !== lb) return la - lb;
  if (fa !== fb) return fa < fb ? -1 : 1;
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(aa.length, ab.length); i++) { const c = cmp(aa[i], ab[i]); if (c) return c; }
    return aa.length - ab.length;
  }
  for (let i = 0; i < aa.length; i++) { const c = cmp(aa[i], ab[i]); if (c) return c; }
  return 0;
}

// ------------------------------------------------------------------ compiler: EVL question → goals
class Compiler {
  constructor(ctxFacts, qFacts) {
    this.ctx = new KB(ctxFacts); this.q = new KB(qFacts);
    this.ctxEnts = new Set([...this.ctx.ents.entries()].filter(([, e]) => e.inst.length || e.name || e.pron || (e.members && e.members.length) || e.measure).map(([x]) => x));
    this.names = []; this.main = []; this.late = []; this.modes = []; this.n = 0; this.anon = 0;
  }
  var(i) {
    if (this.q.isEv(i)) return new V(`E_${i}`);
    const e = this.q.ents.get(i);
    if (e && !e.wh && this.ctxEnts.has(i) && !(e.inst.length || e.name)) return i;
    return new V(`X_${i}`);
  }
  term(a) {
    if (typeof a === "string" && (this.q.isEv(a) || this.q.isEnt(a))) return this.var(a);
    return a;
  }
  mode() { this.n++; const m = new V(`M${this.n}`); this.modes.push(m); return m; }
  entityGoals(x) {
    const e = this.q.ents.get(x), v = this.var(x);
    if (!isV(v)) return;
    if (e.name) this.names.push(["name", v, e.name]);
    for (const c of e.inst) this.late.push(["isa", v, c]);
    for (const p of e.props) this.late.push(["attr", v, p]);
    for (const [r, y] of e.rels) this.late.push(["rel", v, r, this.term(y)]);
    if (UNIVERSAL_Q.includes(e.quant)) this.late.push(["generic_ent", v]);
    if (e.measure && typeof e.measure[0] === "number") this.late.push(["measure", v, e.measure[1], e.measure[0]]);
  }
  eventGoals(e) {
    const ev = this.q.evs.get(e), E = this.var(e);
    const out = [["ev_type", E, ev.verb]];
    for (const [r, a] of ev.roles) {
      const ent = this.q.isEnt(a) ? this.q.ents.get(a) : null;
      if (ent && ent.wh === "why") { out.push(["cause_of", E, this.var(a)]); continue; }
      if (ent && ent.members && ent.members.length) { for (const m of ent.members) out.push(["fills", E, r, this.term(m), this.mode()]); continue; }
      if ((r === "time" || r === "manner") && !ent) continue;
      if (ent && ent.pron && !ent.inst.length) { out.push(["fills", E, r, new V(`_${++this.anon}`), this.mode()]); continue; }
      out.push(["fills", E, r, this.term(a), this.mode()]);
    }
    return out;
  }
  compile() {
    const acts = [...this.q.acts.values()].filter((a) => a.type === "ask");
    if (!acts.length) throw new Error("question has no act(_, ask, _)");
    const main = acts[0].content;
    if (!this.q.isEv(main)) throw new Error(`question content ${main} is not an event`);
    let wh = this.q.whIn(main);
    if (wh === null) wh = [...this.q.ents.entries()].find(([, e]) => e.wh)?.[0] ?? null;
    for (const [x, e] of this.q.ents) {
      if (!e.wh) this.entityGoals(x);
      else if (e.inst.length && ["which", "how_many", "what", "who"].includes(e.wh)) for (const c of e.inst) this.late.push(["isa", this.var(x), c]);
    }
    this.main.push(...this.eventGoals(main));
    for (const e of this.q.evs.keys()) if (e !== main) this.late.push(...this.eventGoals(e));
    return { main, wh, goals: [...this.names, ...this.main, ...this.late] };
  }
}

const goalString = (gs) => gs.map(([op, ...a]) => `${op}(${a.map((t) => (isV(t) ? t.name : termToString(t))).join(", ")})`).join(", ");

function render(ctxFacts, x, wh = null) {
  const eng = new English(new KB(ctxFacts));
  if (eng.kb.isEv(x)) { const s = eng.clause(x); return wh === "why" ? "because " + s : s; }
  if (eng.kb.isEnt(x)) {
    const ent = eng.kb.ents.get(x);
    if (wh === "how_many") {
      const q = ent.quant;
      if (typeof q === "number") return numberWords(q);
      if (ent.members && ent.members.length) return numberWords(ent.members.length);
      if (ent.measure) return eng.np(x);
      return UNIVERSAL_Q.includes(q) ? "all" : String(q);
    }
    return eng.np(x, "obj");
  }
  return adj(x);
}

// Effective operators of an event: polarity (neg, freq never, a "no" participant),
// modality, tense, other frequency adverbs and "few" participants.
function eventOperators(kb, e) {
  const ev = kb.evs.get(e);
  if (!ev) return {neg: false, modal: null, tense: "present", freq: null, few: false, generic: false};
  const fillers = ev.roles.map(([, a]) => a).filter((a) => kb.isEnt(a)).map((a) => kb.ents.get(a));
  const noFiller = fillers.some((x) => x.quant === "no");
  const neg = Boolean(ev.neg) !== (ev.freq === "never") !== noFiller;
  const explicitTense = kb.facts.some((f) => f instanceof Compound && f.f === "tense" && f.args[0] === e);
  return {neg, modal: ev.modal ?? null, tense: ev.tense ?? "present", explicitTense, freq: ev.freq === "never" || ev.freq === "always" ? null : ev.freq ?? null,
    few: fillers.some((x) => x.quant === "few"), generic: Boolean(ev.generic)};
}

/**
 * Execute a formalised question against formalised context facts.
 * @param {Array} ctxFacts  parsed+checked context facts
 * @param {Array} qFacts    parsed+checked question facts (must contain act(_, ask, E))
 * @returns {{answer:string, mode:string, support:string[], goal:string, n_solutions?:number}}
 */
export function answerFacts(ctxFacts, qFacts) {
  const comp = new Compiler(ctxFacts, qFacts);
  let main, wh, goals;
  try { ({ main, wh, goals } = comp.compile()); } catch (e) { return { answer: "error", detail: [e.message] }; }
  const R = new Reasoner(ctxFacts);
  const qev = comp.q.evs.get(main);
  const out = { goal: goalString(goals) };

  // copular class questions: "Is Willy a mammal?"
  const attrs = qev.roles.filter(([r]) => r === "attribute").map(([, a]) => a);
  const theme = qev.roles.find(([r]) => r === "theme")?.[1];
  if (qev.verb === "be" && wh === null && attrs.length && comp.q.isEnt(attrs[0]) && comp.q.ents.get(attrs[0]).inst.length && theme !== undefined) {
    const cls = comp.q.ents.get(attrs[0]).inst[0], t = comp.var(theme);
    for (const [test, ans] of [["isa", "yes"], ["not_isa", "no"]]) {
      if (!solve(R, [...comp.names, [test, t, cls]]).next().done) return { ...out, answer: ans, mode: "taxonomy" };
    }
    return { ...out, answer: "unknown", mode: "taxonomy" };
  }

  const E = comp.var(main), W = wh ? comp.var(wh) : "none";
  const seen = new Map();
  for (const b of solve(R, goals)) {
    const e = val(E, b);
    const sol = [e, R.status(e), R.isNeg(e) ? "neg" : "pos", isV(W) ? val(W, b) : W, comp.modes.map((m) => val(m, b))];
    seen.set(JSON.stringify(sol.map(key)), sol);
  }
  const sols = [...seen.values()].sort((a, b) => { for (let i = 0; i < 5; i++) { const c = cmp(a[i], b[i]); if (c) return c; } return 0; });
  out.n_solutions = sols.length;
  // Operators must match before a context event can answer: modality, tense,
  // frequency and quantified participants. freq(never) and a "no" participant
  // flip polarity; any other mismatch makes the event unusable (answer unknown).
  const qOps = eventOperators(comp.q, main);
  const good = sols.filter((s) => OK_STATUS.includes(s[1])).flatMap((s) => {
    const c = eventOperators(new KB(R.facts), s[0]);
    if (c.modal !== qOps.modal || c.freq !== qOps.freq || c.few) return [];
    // Tense is compared only when the question states it (tense/2); an omitted
    // tense in a question is treated as unconstrained, not as "present".
    if (qOps.explicitTense && !c.generic && !qOps.generic && s[1] !== "generic" && c.tense !== qOps.tense) return [];
    const neg = c.neg !== qOps.neg;
    return [[s[0], s[1], neg ? "neg" : "pos", s[3], s[4]]];
  });
  const direct = (s) => s[4].every((m) => m === "direct");
  let support = [];
  if (wh === null) {
    const dsols = good.filter(direct);
    if (dsols.length) {
      const pos = dsols.filter((s) => s[2] === "pos");
      Object.assign(out, { answer: pos.length ? "yes" : "no", mode: "direct" });
      support = (pos.length ? pos : dsols).map((s) => s[0]);
    } else {
      const gsols = [];
      for (const s of good) {
        const gm = s[4].filter((m) => isCompound(m, "gen", 3));
        if (gm.length) gsols.push([Math.min(...gm.map((m) => m.args[2])), s, gm]);
      }
      if (gsols.length) {
        const best = Math.min(...gsols.map(([d]) => d));
        const top = gsols.filter(([d]) => d === best);
        const negs = top.filter(([, s, gm]) => s[2] === "neg" || gm.some((m) => m.args[1] === "no")).map(([, s]) => s);
        if (negs.length) { Object.assign(out, { answer: "no", mode: "generic" }); support = negs.map((s) => s[0]); }
        else {
          const weak = top.some(([, , gm]) => gm.some((m) => m.args[1] === "most" || m.args[1] === "many"));
          const few = top.some(([, , gm]) => gm.some((m) => m.args[1] === "few"));
          Object.assign(out, { answer: few ? "probably no" : weak ? "probably yes" : "yes", mode: "generic" });
          support = top.map(([, s]) => s[0]);
        }
      } else Object.assign(out, { answer: "unknown", mode: "none" });
    }
  } else {
    const cands = good.filter((s) => s[2] === "pos" && direct(s));
    const vals = [];
    for (const s of cands) if (s[3] !== undefined && !vals.some((v) => eqT(v, s[3]))) vals.push(s[3]);
    support = cands.map((s) => s[0]);
    if (!vals.length) Object.assign(out, { answer: "unknown", mode: "none" });
    else {
      const w = comp.q.ents.get(wh).wh;
      if (w === "how_many" && vals.length > 1) Object.assign(out, { answer: numberWords(vals.length), mode: "count" });
      else Object.assign(out, { answer: vals.map((v) => render(ctxFacts, v, w)).join(", "), mode: "direct" });
    }
  }
  out.support = [...new Set(support)].slice(0, 3).map((e) => cap(render(ctxFacts, e)));
  return out;
}
