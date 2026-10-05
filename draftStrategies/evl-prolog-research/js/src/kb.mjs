// In-memory model of an EVL fact base (entities, events, speech acts, links, scopes).
import { Compound } from "./terms.mjs";

export class Ent {
  constructor() {
    this.inst = []; this.name = null; this.pron = null; this.props = []; this.quant = null; this.plural = false;
    this.rels = []; this.restrict = []; this.members = null; this.measure = null; this.rate = null;
    this.focus = []; this.wh = null;
  }
}

export class Ev {
  constructor(verb, o = {}) {
    this.verb = verb; this.roles = o.roles ?? []; this.tense = o.tense ?? "present"; this.aspect = o.aspect ?? null;
    this.modal = o.modal ?? null; this.neg = o.neg ?? false; this.passive = o.passive ?? false;
    this.generic = o.generic ?? false; this.freq = o.freq ?? null; this.cf = o.cf ?? false; this.focus = o.focus ?? [];
  }
}

export class Act {
  constructor(type, content) { this.type = type; this.content = content; this.speaker = null; this.addressee = null; this.tense = null; }
}

export class KB {
  /** @param {Array} facts parsed terms (Compound) */
  constructor(facts) {
    this.facts = facts;
    this.ents = new Map();
    this.evs = new Map();
    this.acts = new Map();
    this.links = []; this.kinds = []; this.scopes = [];
    this.order = [];
    const ent = (x) => { if (!this.ents.has(x)) this.ents.set(x, new Ent()); return this.ents.get(x); };
    const pending = [];
    for (const f of facts) {
      if (!(f instanceof Compound)) continue;
      const a = f.args;
      if (f.f === "event" && a.length === 2 && !this.evs.has(a[0])) { this.evs.set(a[0], new Ev(a[1])); this.order.push(a[0]); }
      else if (f.f === "act" && a.length === 3 && !this.acts.has(a[0])) { this.acts.set(a[0], new Act(a[1], a[2])); this.order.push(a[0]); }
      else pending.push(f);
    }
    for (const f of pending) {
      const p = f.f, a = f.args;
      if (["speaker", "addressee", "tense"].includes(p) && this.acts.has(a[0])) { this.acts.get(a[0])[p] = a[1]; continue; }
      if (p === "focus" && this.evs.has(a[0])) { this.evs.get(a[0]).focus.push(a[1]); continue; }
      switch (p) {
        case "inst": ent(a[0]).inst.push(a[1]); break;
        case "name": ent(a[0]).name = String(a[1]); break;
        case "pron": ent(a[0]).pron = a[1]; break;
        case "prop": ent(a[0]).props.push(a[1]); break;
        case "quant": ent(a[0]).quant = a[1]; break;
        case "plural": ent(a[0]).plural = true; break;
        case "rel": ent(a[0]).rels.push([a[1], a[2]]); break;
        case "restrict": ent(a[0]).restrict.push(a[1]); break;
        case "group": ent(a[0]).members = Array.isArray(a[1]) ? [...a[1]] : []; break;
        case "measure": ent(a[0]).measure = [a[1], a[2]]; break;
        case "rate": ent(a[0]).rate = a[1]; break;
        case "focus": ent(a[0]).focus.push(a[1]); break;
        case "wh": ent(a[0]).wh = a[1]; break;
        case "link": this.links.push([...a]); break;
        case "kind": this.kinds.push([...a]); break;
        case "scope": this.scopes.push([...a]); break;
        default: {
          if (!a.length || !this.evs.has(a[0])) break;
          const ev = this.evs.get(a[0]);
          if (p === "role") ev.roles.push([a[1], a[2]]);
          else if (p === "tense") ev.tense = a[1];
          else if (p === "aspect") ev.aspect = a[1];
          else if (p === "modal") ev.modal = a[1];
          else if (p === "neg") ev.neg = true;
          else if (p === "voice" && a[1] === "passive") ev.passive = true;
          else if (p === "generic") ev.generic = true;
          else if (p === "freq") ev.freq = a[1];
          else if (p === "counterfactual") ev.cf = true;
        }
      }
    }
  }

  isEnt(x) { return typeof x === "string" && this.ents.has(x); }
  isEv(x) { return typeof x === "string" && this.evs.has(x); }

  /** The wh item directly used in event e (if any). */
  whIn(e) {
    for (const [, a] of this.evs.get(e).roles) {
      if (this.isEnt(a) && this.ents.get(a).wh) return a;
      if (this.isEnt(a) && this.ents.get(a).members)
        for (const m of this.ents.get(a).members) if (this.ents.get(m)?.wh) return m;
    }
    return null;
  }
}
