// Deterministic interpretations of EVL facts: English realisation and first-order logic.
// (JS port of nlpformaliser/evl.py — kept line-by-line equivalent; see test/parity.test.mjs)
import { KB, Ev } from "./kb.mjs";
import { comparative, inflect, numberWords, superlative } from "./morph.mjs";
import { Compound, isCompound, termToString } from "./terms.mjs";

export const CMP_WORDS = { more_than: "more than", less_than: "less than", at_least: "at least", at_most: "at most",
  exactly: "exactly", fewer_than: "fewer than" };
const CAPITALISED_UNITS = { celsius: "Celsius", fahrenheit: "Fahrenheit", kelvin: "Kelvin" };
export const PERSON_NOUNS = new Set(`man woman person people child boy girl student teacher doctor friend brother sister
mother father parent son daughter king queen worker player farmer customer manager scientist author
writer driver baby lawyer nurse engineer president officer soldier guest neighbor neighbour child
employee user programmer researcher professor politician citizen tenant landlord thief visitor passenger
patient pianist adult kid boss colleague`.split(/\s+/));
const ROLE_PREP = { recipient: "to", beneficiary: "for", instrument: "with", location: "in", source: "from",
  destination: "to", path: "through", topic: "about", companion: "with", time: "at", standard: "than", extent: "", duration: "for" };
export const SUBJ_ORDER = ["agent", "experiencer", "theme", "patient", "stimulus"];
const OBJ_ORDER = ["patient", "theme", "stimulus"];
const PRON = { i: ["I", "me", "my"], you: ["you", "you", "your"], he: ["he", "him", "his"], she: ["she", "her", "her"],
  it: ["it", "it", "its"], we: ["we", "us", "our"], they: ["they", "them", "their"] };
const PLURAL_Q = ["all", "many", "few", "several", "most", "these", "those", "both"];
export const UNIVERSAL_Q = ["every", "all", "each", "any"];
const ADVERB_WH = ["where", "when", "why", "how"];
const ACT_VERB = { ask: "ask", request: "ask", command: "order", suggest: "suggest", offer: "offer", promise: "promise",
  warn: "warn", thank: "thank", apologize: "apologize", permit: "allow" };

const isInt = Number.isInteger;
const isNum = (x) => typeof x === "number";
const isCmp = (q) => q instanceof Compound && q.f in CMP_WORDS;
const rkey = (r) => (typeof r === "string" ? r : termToString(r));
export const words = (lemma) => String(lemma).replaceAll("_", " ");
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Render a number or numeric comparison → [text, plural] */
export function amount(q, useWords = true) {
  if (isCmp(q)) { const [txt] = amount(q.args[0], useWords); return [`${CMP_WORDS[q.f]} ${txt}`, true]; }
  if (isNum(q)) {
    const txt = useWords && Number.isInteger(q) && q < 100 ? numberWords(q) : String(q);
    return [txt, q !== 1];
  }
  return [String(q), true];
}

export function adj(a) {
  if (isCompound(a, "very", 1)) return "very " + adj(a.args[0]);
  if (isCmp(a)) return amount(a)[0];
  if (a instanceof Compound) return [a.f, ...a.args].map(adj).join(" ");
  if (Array.isArray(a)) return a.map(adj).join(",");
  if (isNum(a)) return String(a);
  return words(a);
}

export class English {
  constructor(kb) {
    this.kb = kb;
    this.mentioned = new Set(); this.rendered = new Set(); this.depth = 0;
    this.detOverride = new Map(); this.negSuppressed = new Set();
    this.cfAntecedent = new Set(kb.links.filter(([, c, b]) => (c === "if" || c === "unless") && kb.isEv(b) && kb.evs.get(b).cf).map(([, , b]) => b));
    this.applyScope();
  }

  // ---- scope
  // A determiner can only carry the negation ("no X", "not every X") when the
  // entity is realised with a determiner. Names, pronouns, groups, amounts and wh
  // items keep the negation on the verb (otherwise it would be dropped).
  determinerNP(x) {
    const e = this.kb.ents.get(x);
    return Boolean(e) && !e.name && !e.pron && !(e.members && e.members.length) && !e.measure && !e.wh &&
      !this.kb.ents.get(x).rels.some(([r]) => r === "poss");
  }

  applyScope() {
    this.negOverModal = new Set();
    for (const [a, b] of this.kb.scopes) if (isCompound(a, "neg", 1) && b === "modal") this.negOverModal.add(a.args[0]);
    for (const [a, b] of this.kb.scopes) {
      if (isCompound(a, "neg", 1) && this.kb.isEnt(b) && !this.determinerNP(b)) continue;
      if (isCompound(b, "neg", 1) && this.kb.isEnt(a) && !this.determinerNP(a)) continue;
      if (isCompound(a, "neg", 1) && this.kb.isEnt(b)) {
        const q = this.kb.ents.get(b).quant;
        if (UNIVERSAL_Q.includes(q)) { this.detOverride.set(b, q === "all" ? "not all" : "not every"); this.negSuppressed.add(a.args[0]); }
        else if (["a", "some", "any"].includes(q) || q == null || isInt(q)) { this.detOverride.set(b, "no"); this.negSuppressed.add(a.args[0]); }
        else if (q === "many" || q === "most") { this.detOverride.set(b, `not ${q}`); this.negSuppressed.add(a.args[0]); }
      } else if (isCompound(b, "neg", 1) && this.kb.isEnt(a)) {
        if (UNIVERSAL_Q.includes(this.kb.ents.get(a).quant)) { this.detOverride.set(a, "no"); this.negSuppressed.add(b.args[0]); }
      }
    }
  }

  wideIndefinite(e) {
    const args = new Set(this.kb.evs.get(e).roles.map(([, a]) => a).filter((a) => typeof a === "string"));
    for (const [a, b] of this.kb.scopes) {
      if (typeof a === "string" && typeof b === "string" && args.has(a) && args.has(b)) {
        const qa = this.kb.ents.get(a)?.quant, qb = this.kb.ents.get(b)?.quant;
        if ((["a", "some", "one"].includes(qa) || qa == null || isInt(qa)) && UNIVERSAL_Q.includes(qb)) return a;
      }
    }
    return null;
  }

  // ---- entities
  isPlural(x) {
    const e = this.kb.isEnt(x) ? this.kb.ents.get(x) : null;
    if (!e) return false;
    if (e.members && e.members.length) return true;
    if (e.measure) return amount(e.measure[0])[1];
    if (e.wh === "how_many") return true;
    if (e.pron) return e.pron === "we" || e.pron === "they";
    const q = e.quant;
    return e.plural || (isInt(q) && q !== 1) || PLURAL_Q.includes(q) || isCmp(q);
  }
  person(x) {
    const e = this.kb.isEnt(x) ? this.kb.ents.get(x) : null;
    if (e && e.pron) return { i: 1, we: 1, you: 2 }[e.pron] ?? 3;
    return 3;
  }
  isHuman(x) {
    const e = this.kb.isEnt(x) ? this.kb.ents.get(x) : null;
    if (e && e.members && e.members.length) return e.members.some((m) => this.isHuman(m));
    return Boolean(e && (e.name || ["i", "you", "he", "she", "we"].includes(e.pron) || e.inst.some((i) => PERSON_NOUNS.has(i))));
  }
  whWord(x) {
    const e = this.kb.ents.get(x), w = e.wh, noun = e.inst.length ? e.inst[0] : null;
    if (w === "which" && noun) return "which " + (this.isPlural(x) ? inflect(noun, "NNS") : words(noun));
    if (w === "how_many") return "how many " + (noun ? inflect(noun, "NNS") : "");
    if (w === "how_much") return "how much " + (noun ? words(noun) : "");
    if (w === "who" || w === "what") return (w === "who" || this.isHuman(x)) && w !== "what" ? "who" : "what";
    return String(w).replaceAll("_", " ");
  }

  np(x, kase = "subj", gap = null) {
    if (gap !== null && x === gap) return "";
    if (Array.isArray(x) || x instanceof Compound) return adj(x);
    if (this.kb.isEv(x)) { this.rendered.add(x); return this.clause(x, gap, "gerund"); }
    if (!this.kb.isEnt(x)) return adj(x);
    const e = this.kb.ents.get(x);
    this.depth++;
    if (this.depth > 8) { this.depth--; return "it"; }
    try {
      const focus = e.focus.map(words).join(" ");
      const s = this.npCore(x, e, kase, gap);
      return `${focus} ${s}`.trim();
    } finally { this.depth--; }
  }

  npCore(x, e, kase, gap) {
    if (e.wh) return ADVERB_WH.includes(e.wh) ? "" : this.whWord(x);
    if (e.members && e.members.length) {
      const parts = e.members.map((m) => this.np(m, kase, gap)).filter(Boolean);
      this.mentioned.add(x);
      return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts.at(-1);
    }
    if (e.measure) {
      const [n, unit] = e.measure;
      const [txt, pl] = amount(n, false);
      const uparts = String(unit).split("_");
      if (pl) uparts[0] = inflect(uparts[0], "NNS");
      let s = `${txt} ${uparts.map((w) => CAPITALISED_UNITS[w] ?? w).join(" ")}`;
      // an amount OF something: "30 days' written notice"
      if (e.inst.length) s = [s + (s.endsWith("s") ? "'" : "'s"), ...e.props.map(adj), words(e.inst[0])].join(" ");
      if (e.rate) s += ` per ${words(e.rate)}`;
      for (const [r, y] of e.rels) s += ` ${words(r)} ${this.np(y, "obj")}`;
      this.mentioned.add(x);
      return s;
    }
    const first = !this.mentioned.has(x);
    if (e.pron && (!(e.inst.length || e.name) || !first)) { this.mentioned.add(x); return PRON[e.pron][kase === "subj" ? 0 : 1]; }
    this.mentioned.add(x);
    const plural = this.isPlural(x);
    const poss = e.rels.filter(([r]) => r === "poss").map(([, y]) => y);
    const pps = e.rels.filter(([r]) => r !== "poss");
    const mods = e.props.map(adj);
    let head, det;
    if (e.name) { head = e.name; det = ""; }
    else {
      const noun = e.inst.length ? e.inst[0] : "thing";
      head = plural ? inflect(noun, "NNS") : words(noun);
      const q = e.quant;
      if (this.detOverride.has(x) && first) {
        det = this.detOverride.get(x);
        if (det === "no" && !plural && e.quant === "all") head = inflect(noun, "NNS");
      } else if (poss.length) {
        const y = poss[0];
        const ye = this.kb.isEnt(y) ? this.kb.ents.get(y) : null;
        if (ye && ye.pron) det = PRON[ye.pron][2];
        else { const owner = this.np(y, "obj"); det = owner + (owner.endsWith("s") && this.isPlural(y) ? "'" : "'s"); }
      } else if (q == null) det = first ? (plural ? "" : "a") : "the";
      else if (isNum(q) || isCmp(q)) det = first ? amount(q)[0] : "the";
      else if (q === "bare") det = "";
      else if (["a", "some", "any"].includes(q) && !first) det = "the";
      else if (q === "a") det = plural ? "" : "a";
      else if (q === "no" && !first) det = "the";
      else det = first || ["this", "that", "these", "those"].includes(q) ? (typeof q === "string" ? q : termToString(q)) : "the";
    }
    const ws = [det, ...mods, head].filter(Boolean);
    if (ws.length > 1 && ws[0] === "a" && "aeiou".includes(ws[1][0].toLowerCase())) ws[0] = "an";
    let s = ws.join(" ");
    for (const extra of e.inst.slice(1)) s += `, ${"aeiou".includes(String(extra)[0]) ? "an" : "a"} ${words(extra)},`;
    for (const [r, y] of pps) s += ` ${words(r)} ${this.np(y, "obj")}`;
    for (const ev of e.restrict) {
      if (this.rendered.has(ev)) continue;
      this.rendered.add(ev);
      s += ` ${this.isHuman(x) ? "who" : "that"} ${this.clause(ev, x)}`;
    }
    return s;
  }

  // ---- verb group
  chain(ev, form, cfRole) {
    let { tense, aspect, modal } = ev;
    if (ev.cf) {
      if (cfRole === "antecedent") {
        if (tense === "past") aspect = aspect == null ? "perfect" : aspect;
        tense = "past";
        modal = modal === "would" ? null : modal;
      } else {
        modal = modal || "would";
        if (tense === "past") aspect = aspect == null ? "perfect" : aspect;
      }
    }
    const chain = [];
    if (modal) chain.push([modal, "modal"]);
    else if (tense === "future" && form === "finite") chain.push(["will", "modal"]);
    if (aspect === "perfect" || aspect === "perfect_progressive") chain.push(["have", "perf"]);
    if (aspect === "progressive" || aspect === "perfect_progressive") chain.push(["be", "prog"]);
    if (ev.passive) chain.push(["be", "pass"]);
    chain.push([ev.verb, "main"]);
    return [chain, tense];
  }

  verbGroup(ev, subj, form = "finite", question = false, cfRole = null, eid = null) {
    // scope(neg(E), modal): absence of necessity is realised as "need not".
    if (eid !== null && this.negOverModal?.has(eid) && ["must", "should"].includes(ev.modal)) ev = new Ev(ev.verb, {...ev, modal: "need", roles: ev.roles});
    const [chain, tense] = this.chain(ev, form, cfRole);
    const subjunctiveWere = ev.cf && cfRole === "antecedent" && ev.tense !== "past" && chain[0][0] === "be";
    let out = [], prev = null;
    chain.forEach(([lem, kind], i) => {
      let w;
      if (kind === "modal") w = lem;
      else if (form === "gerund" && i === 0) w = inflect(lem, "VBG");
      else if (prev === "modal" || (i === 0 && (form === "inf" || form === "imp"))) w = lem !== "be" ? words(lem) : "be";
      else if (prev === "perf" || prev === "pass") w = inflect(lem, "VBN");
      else if (prev === "prog") w = inflect(lem, "VBG");
      else if (subjunctiveWere && i === 0) w = "were";
      else w = this.finite(lem, tense, subj);
      out.push(w); prev = kind;
    });
    const neg = ev.neg && !this.negSuppressed.has(eid);
    const adverbs = ev.focus.map(words);
    if (ev.freq) adverbs.push(ev.freq);
    const simple = chain.length === 1 && chain[0][0] !== "be";
    if (form === "finite" && (question || neg) && simple) out = [this.finite("do", tense, subj), words(ev.verb)];
    if (form === "imp" && neg) out = ["do", "not", ...out];
    else if (neg) {
      if (form === "inf" || form === "gerund") out = ["not", ...out];
      else out.splice(1, 0, "not");
    }
    if (adverbs.length) {
      let pos = (simple && !(question || neg)) || ["inf", "imp", "gerund"].includes(form) ? 0 : 1;
      if (neg && pos === 1) pos = 2;
      out.splice(pos, 0, ...adverbs);
    }
    return out;
  }

  finite(lem, tense, subj) {
    const has = subj != null && subj !== "";
    const pl = has ? this.isPlural(subj) : false;
    const per = has ? this.person(subj) : 3;
    if (lem === "be") {
      if (tense === "past") return pl || per === 2 ? "were" : "was";
      return per === 1 && !pl ? "am" : pl || per === 2 ? "are" : "is";
    }
    if (tense === "past") return inflect(lem, "VBD");
    if (per === 3 && !pl) return inflect(lem, "VBZ");
    return words(lem);
  }

  // ---- clauses
  arg(a, kase = "obj", gap = null) {
    if (Array.isArray(a) || a instanceof Compound) return adj(a);
    if (this.kb.isEv(a)) { this.rendered.add(a); return this.clause(a, gap, "gerund"); }
    return this.np(a, kase, gap);
  }

  /** mode: decl | question | embedded_q | imp | inf | gerund */
  clause(e, gap = null, mode = "decl", cfRole = null) {
    const ev = this.kb.evs.get(e);
    this.rendered.add(e);
    const form = { decl: "finite", question: "finite", embedded_q: "finite", imp: "imp", inf: "inf", gerund: "gerund" }[mode];
    if (cfRole == null && this.cfAntecedent.has(e)) cfRole = "antecedent";
    const rd = new Map();
    for (const [r, a] of ev.roles) { const k = rkey(r); if (!rd.has(k)) rd.set(k, []); rd.get(k).push(a); }
    const used = new Set();
    const get = (r) => rd.get(r) || [];
    const take = (r) => { const v = rd.get(r); if (v && v.length) { used.add(r); return v[0]; } return null; };
    const nonEmpty = (r) => get(r).length > 0;

    let subj = null, subjS, vg, postFirst;
    if (ev.verb === "exist") {
      const th = take("theme") ?? take("agent") ?? take("patient");
      const bev = new Ev("be", { tense: ev.tense, aspect: ev.aspect, modal: ev.modal, neg: ev.neg && !this.negSuppressed.has(e),
        freq: ev.freq, cf: ev.cf, focus: ev.focus });
      vg = this.verbGroup(bev, th, form, mode === "question", cfRole);
      subjS = "there"; subj = th;
      postFirst = th != null ? [this.arg(th, "subj", gap)] : ["something"];
    } else {
      const order = ev.passive ? ["patient", "theme", "recipient", "stimulus", "agent"] : SUBJ_ORDER;
      if (mode === "gerund") { for (const r of ["agent", "experiencer"]) if (nonEmpty(r)) { subj = take(r); break; } }
      else if (mode !== "inf" && mode !== "imp") { for (const r of order) if (nonEmpty(r)) { subj = take(r); break; } }
      else if (mode === "imp") {
        for (const r of order) if (nonEmpty(r)) {
          const cand = get(r)[0];
          const ce = typeof cand === "string" && this.kb.isEnt(cand) ? this.kb.ents.get(cand) : null;
          if (ce && ce.pron === "you") subj = take(r);
          break;
        }
      }
      const invert = mode === "question" && !(gap !== null && subj === gap);
      vg = this.verbGroup(ev, subj, form, invert, cfRole, e);
      if (mode === "inf" || mode === "imp" || (mode === "gerund" && subj == null)) subjS = "";
      else if (subj != null && subj === gap) subjS = "";
      else subjS = subj != null ? this.arg(subj, "subj", gap) : mode === "gerund" ? "" : "something";
      postFirst = [];
    }
    if (mode === "inf") vg = vg.length && vg[0] === "not" ? ["not", "to", ...vg.slice(1)] : ["to", ...vg];
    let post = [...postFirst];
    if (ev.verb === "be") {
      for (const a of get("attribute")) post.push(this.attribute(a, rd, gap));
      used.add("attribute"); used.add("standard");
    } else if (ev.verb !== "exist") {
      const objs = OBJ_ORDER.filter((r) => nonEmpty(r) && !used.has(r));
      if (nonEmpty("recipient") && !used.has("recipient") && !objs.length) post.push(this.arg(take("recipient"), "obj", gap));
      for (const r of objs) { for (const a of get(r)) post.push(this.arg(a, "obj", gap)); used.add(r); }
      if (ev.passive && nonEmpty("agent") && !used.has("agent")) {
        const ag = take("agent");
        post.push(ag !== gap ? "by " + this.arg(ag, "obj", gap) : "by");
      }
      for (const a of get("attribute")) post.push(this.attribute(a, rd, gap));
      used.add("attribute");
    }
    for (const [r, a] of ev.roles) {
      if (used.has(rkey(r)) || r === "attribute") continue;
      post.push(this.adjunct(r, a, subj, gap));
    }
    post = post.filter(Boolean);

    let whp = null;
    if (gap !== null && this.kb.isEnt(gap) && this.kb.ents.get(gap).wh && (mode === "question" || mode === "embedded_q")) whp = this.whWord(gap);
    let ws;
    if (mode === "question") {
      if (whp !== null && subj === gap) ws = [whp, ...vg, ...post];
      else if (whp !== null) ws = [whp, vg[0], subjS, ...vg.slice(1), ...post];
      else ws = [vg[0], subjS, ...vg.slice(1), ...post];
    } else if (mode === "embedded_q") {
      ws = whp !== null ? [whp, ...(subj === gap ? [] : [subjS]), ...vg, ...post] : ["whether", subjS, ...vg, ...post];
    } else ws = [subjS, ...vg, ...post];
    return ws.filter(Boolean).join(" ");
  }

  attribute(a, rd, gap = null) {
    const std = (rd.get("standard") || [null])[0];
    const than = std != null ? ` than ${this.arg(std)}` : "";
    if (a instanceof Compound && ["more", "less", "as", "most"].includes(a.f) && a.args.length === 1) {
      const ad = adj(a.args[0]);
      if (a.f === "more") return comparative(ad) + than;
      if (a.f === "less") return "less " + ad + than;
      if (a.f === "as") return `as ${ad}` + (std != null ? ` as ${this.arg(std)}` : "");
      return "the " + superlative(ad);
    }
    if (this.kb.isEnt(a)) return this.np(a, "obj", gap);
    return adj(a) + than;
  }

  adjunct(r, a, subj, gap) {
    if (gap !== null && a === gap) {
      const g = this.kb.isEnt(gap) ? this.kb.ents.get(gap) : null;
      if (g && ADVERB_WH.includes(g.wh)) return "";
      if (isCompound(r, "pp", 1)) return words(r.args[0]);
      return ROLE_PREP[r] ?? "";
    }
    if (isCompound(r, "pp", 1)) return `${words(r.args[0])} ${this.arg(a, "obj", gap)}`;
    if (r === "content") {
      if (this.kb.isEv(a)) {
        this.rendered.add(a);
        const w = this.kb.whIn(a);
        if (w !== null) return this.clause(a, w, "embedded_q");
        return "that " + this.clause(a, gap);
      }
      return this.arg(a, "obj", gap);
    }
    if (r === "purpose") {
      if (this.kb.isEv(a)) {
        const sub = this.kb.evs.get(a);
        const ag = sub.roles.filter(([rr]) => SUBJ_ORDER.includes(rr)).map(([, x]) => x);
        this.rendered.add(a);
        if (ag.length && ag[0] === subj) return "in order " + this.inf(a, subj);
        return "so that " + this.clause(a);
      }
      return "for " + this.arg(a, "obj", gap);
    }
    if (r === "cause") {
      if (this.kb.isEv(a)) { this.rendered.add(a); return "because " + this.clause(a, gap); }
      return "because of " + this.arg(a, "obj", gap);
    }
    if (r === "manner" || ((r === "time" || r === "location") && !this.kb.isEnt(a))) return adj(a);
    const prep = typeof r === "string" ? ROLE_PREP[r] ?? "" : "";
    return `${prep} ${this.arg(a, "obj", gap)}`.trim();
  }

  inf(e, drop = null, mode = "inf") {
    const ev = this.kb.evs.get(e);
    this.rendered.add(e);
    const roles = ev.roles.filter(([r, a]) => a !== drop || !SUBJ_ORDER.includes(r));
    const sub = new Ev(ev.verb, { roles, tense: ev.tense, aspect: ev.aspect, modal: null, neg: ev.neg, passive: ev.passive, focus: ev.focus, freq: ev.freq });
    const tmp = `__inf__${this.depth}`;
    this.kb.evs.set(tmp, sub);
    try { this.depth++; return this.clause(tmp, null, mode); }
    finally { this.depth--; this.kb.evs.delete(tmp); }
  }

  // ---- discourse
  sentence(e) {
    const wide = this.wideIndefinite(e);
    let s;
    if (wide !== null && !this.mentioned.has(wide)) {
      const th = this.kb.ents.get(wide), pl = this.isPlural(wide);
      this.mentioned.add(wide);
      const q = th.quant;
      const det = isNum(q) ? amount(q)[0] : pl ? "some" : "a";
      const noun = th.inst.length ? th.inst[0] : "thing";
      const head = pl ? inflect(noun, "NNS") : words(noun);
      const mods = th.props.map(adj).join(" ");
      let npx = [det, mods, head].filter(Boolean).join(" ");
      if (npx.startsWith("a ") && "aeiou".includes(npx.slice(2, 3))) npx = "an " + npx.slice(2);
      s = `there ${pl ? "are" : "is"} ${npx} ${this.isHuman(wide) ? "who" : "that"} ${this.clause(e, wide)}`;
    } else s = this.clause(e);
    for (const [a, c, b] of this.kb.links) {
      if (a === e && this.kb.isEv(b) && !this.rendered.has(b)) {
        if (c === "so") s += `, so ${this.sentence(b)}`;
        else if (c === "instead_of") {
          const ms = this.kb.evs.get(e).roles.find(([r]) => r === "agent" || r === "experiencer")?.[1] ?? null;
          s += ` instead of ${this.inf(b, ms, "gerund")}`;
        } else s += ` ${words(c)} ${this.sentence(b)}`;
      }
    }
    return s;
  }

  renderAct(aid) {
    const act = this.kb.acts.get(aid), c = act.content;
    if (!this.kb.isEv(c)) return { thank: "Thank you.", apologize: "I apologize.", greet: "Hello." }[act.type] ?? "";
    this.rendered.add(c);
    const sp = act.speaker, ad = act.addressee;
    const spe = sp != null && this.kb.isEnt(sp) ? this.kb.ents.get(sp) : null;
    const ade = ad != null && this.kb.isEnt(ad) ? this.kb.ents.get(ad) : null;
    const reported = (sp != null && !(spe && spe.pron === "i")) || (ad != null && !(ade && ade.pron === "you")) || act.tense != null;
    const ev = this.kb.evs.get(c);
    const ag = ev.roles.find(([r]) => r === "agent" || r === "experiencer")?.[1] ?? null;
    const age = typeof ag === "string" && this.kb.isEnt(ag) ? this.kb.ents.get(ag) : null;
    const dd = (s) => s.replaceAll("  ", " ");
    if (reported) {
      const spk = sp != null ? this.np(sp, "subj") : "someone";
      const verb = this.finite(ACT_VERB[act.type], act.tense || "present", sp);
      const adr = ad != null ? this.np(ad, "obj") : "";
      if (act.type === "ask") return cap(dd(`${spk} ${verb} ${adr} ${this.clause(c, this.kb.whIn(c), "embedded_q")}`)) + ".";
      if (["request", "command", "permit"].includes(act.type)) {
        const inf = this.inf(c, ag === ad || (age && age.pron === "you") ? ag : null);
        return cap(dd(`${spk} ${verb} ${adr} ${inf}`)) + ".";
      }
      if (act.type === "thank" || act.type === "apologize") {
        const to = act.type === "apologize" && adr ? `to ${adr} ` : adr ? `${adr} ` : "";
        return cap(`${spk} ${verb} ${to}for ${this.clause(c, null, "gerund")}`) + ".";
      }
      if (act.type === "offer") return cap(`${spk} ${verb} ${this.inf(c, ag)}`) + ".";
      return cap(`${spk} ${verb} ${act.type === "warn" && adr ? adr + " " : ""}that ${this.clause(c)}`) + ".";
    }
    if (act.type === "ask") return cap(this.clause(c, this.kb.whIn(c), "question")) + "?";
    if (act.type === "request" || act.type === "command") {
      const pl = act.type === "request" ? "please " : "";
      if (age && age.pron === "i") return cap(pl + "let me " + this.inf(c, ag, "imp")) + ".";
      if (age && age.pron === "we") return cap(pl + "let's " + this.inf(c, ag, "imp")) + ".";
      return cap(pl + this.clause(c, null, "imp")) + (act.type === "request" ? "." : "!");
    }
    if (act.type === "suggest") {
      if (age && age.pron === "we") return cap("let's " + this.inf(c, ag, "imp")) + ".";
      return cap("I suggest that " + this.clause(c)) + ".";
    }
    if (act.type === "offer") return cap("I offer " + this.inf(c, ag)) + ".";
    if (act.type === "promise") return cap("I promise that " + this.clause(c)) + ".";
    if (act.type === "warn") return cap("I warn you that " + this.clause(c)) + ".";
    if (act.type === "thank") return cap("thank you for " + this.inf(c, age && age.pron === "you" ? ag : null, "gerund")) + ".";
    if (act.type === "apologize") return cap("I apologize for " + this.inf(c, age && age.pron === "i" ? ag : null, "gerund")) + ".";
    if (act.type === "permit") return cap("you may " + this.inf(c, ag, "imp")) + ".";
    return cap(this.clause(c)) + ".";
  }

  render() {
    const dependent = new Set();
    for (const ev of this.kb.evs.values()) for (const [, a] of ev.roles) if (this.kb.isEv(a)) dependent.add(a);
    for (const ent of this.kb.ents.values()) for (const r of ent.restrict) dependent.add(r);
    for (const [, , b] of this.kb.links) dependent.add(b);
    const actContents = new Set([...this.kb.acts.values()].map((a) => a.content));
    const order = [...this.kb.order.filter((x) => this.kb.acts.has(x) || !dependent.has(x)),
      ...this.kb.order.filter((x) => this.kb.evs.has(x) && dependent.has(x))];
    const out = [];
    for (const x of order) {
      if (this.kb.acts.has(x)) { const s = this.renderAct(x); if (s) out.push(s); continue; }
      if (this.rendered.has(x) || actContents.has(x)) continue;
      out.push(cap(this.sentence(x)) + ".");
    }
    return out.join(" ");
  }
}

/** facts → English (deterministic) */
export function englishFromFacts(facts) { return new English(new KB(facts)).render(); }

/** Native facts → FOL reading, kept unchanged for parity with the Python reference.
 * The active strategy uses the nested reading in fol.mjs. */
export function nativeFolFromFacts(facts) {
  const kb = new KB(facts);
  const arg = (a) => (typeof a === "string" ? a : adj(a).replaceAll(" ", "_"));
  const evAtoms = (e, negate = true) => {
    const ev = kb.evs.get(e);
    const atoms = [`${ev.verb}(${e})`, ...ev.roles.map(([r, a]) => `${typeof r === "string" ? r : r.args[0]}(${e},${arg(a)})`)];
    if (ev.tense !== "present") atoms.push(`${ev.tense}(${e})`);
    let body = atoms.join(" ∧ ");
    if (ev.modal) body = `${String(ev.modal).toUpperCase()}[${body}]`;
    body = `${ev.generic ? "GEN" : "∃"}${e}(${body})`;
    if (ev.freq) body = `${String(ev.freq).toUpperCase()}(${body})`;
    if (ev.cf) body = `CF(${body})`;
    return ev.neg && negate ? `¬${body}` : body;
  };
  const entAtoms = (x) => {
    const e = kb.ents.get(x);
    const at = [...e.inst.map((c) => `${c}(${x})`), ...e.props.map((p) => `${adj(p).replaceAll(" ", "_")}(${x})`)];
    if (e.name) at.push(`${x}=${e.name}`);
    if (e.members && e.members.length) at.push(`${x}=${e.members.join("⊕")}`);
    if (e.measure) at.push(`amount(${x},${arg(e.measure[0])},${e.measure[1]})`);
    for (const [r, y] of e.rels) at.push(`${r}(${x},${y})`);
    return at.length ? at : [`thing(${x})`];
  };
  const univ = [...kb.ents.entries()].filter(([, e]) => UNIVERSAL_Q.includes(e.quant)).map(([x]) => x);
  const whs = [...kb.ents.entries()].filter(([, e]) => e.wh).map(([x]) => x);
  const negWide = new Map();
  for (const [a, b] of kb.scopes) if (isCompound(a, "neg", 1)) negWide.set(a.args[0], b);
  const order = [...univ];
  for (const [a, b] of kb.scopes) {
    if (typeof a === "string" && typeof b === "string" && order.includes(a) && order.includes(b)) {
      order.splice(order.indexOf(a), 1);
      order.splice(order.indexOf(b), 0, a);
    }
  }
  const exist = [...kb.ents.keys()].filter((x) => !univ.includes(x) && !whs.includes(x));
  const wideExist = kb.scopes.filter(([a, b]) => typeof a === "string" && exist.includes(a) && typeof b === "string" && univ.includes(b)).map(([a]) => a);
  const events = [...kb.evs.keys()].map((e) => evAtoms(e, !negWide.has(e)));
  const links = kb.links.map(([a, c, b]) => `${c}(${a},${b})`);
  const inner = exist.filter((x) => !wideExist.includes(x));
  let scope = [...inner.flatMap(entAtoms), ...events, ...links].join(" ∧ ");
  if (inner.length) scope = `∃${inner.join(",")}(${scope})`;
  for (const x of [...order].reverse()) scope = `∀${x}(${entAtoms(x).join(" ∧ ")} → ${scope})`;
  for (const _ of negWide.keys()) scope = `¬(${scope})`;
  for (const x of wideExist) scope = `∃${x}(${entAtoms(x).join(" ∧ ")} ∧ ${scope})`;
  for (const x of whs) scope = `λ${x}.(${scope})`;
  for (const act of kb.acts.values()) scope = `${String(act.type).toUpperCase()}(${scope})`;
  return scope;
}
