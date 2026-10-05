// Scope-aware first-order reading of EVL facts (v2).
//
// The native reading (english.mjs nativeFolFromFacts, kept for parity) conjoins
// every event at the top level. That asserts embedded content as a fact
// ("Bob believes that Ada left" asserted ∃e2 leave(e2)), turns the antecedent of
// a conditional into a fact, and leaves event ids free inside link atoms.
// This reading nests instead:
//   - an event used as a role argument (content, purpose, cause, nominalised
//     subject) is a proposition argument  role(e1,⟦φ⟧)  and is not asserted;
//   - link(E1, if, E2) is (φ2 → φ1); unless is (¬φ2 → φ1); and/but are ∧;
//     any other connective is CONN(φ1, φ2), with both formulas closed;
//   - a speech act is TYPE(λwh.(φ)) over its content only;
//   - relative-clause events (restrict/2) are part of the restrictor;
//   - each entity is quantified at the lowest proposition that contains all of
//     its occurrences, so no variable is left free;
//   - neg + modal: scope(neg(E), modal) gives ¬MODAL[...]; otherwise "must not",
//     "should not", "might not", "would not" read as MODAL[¬...] and the other
//     modals keep the native wide negation.
import { KB } from "./kb.mjs";
import { UNIVERSAL_Q, adj } from "./english.mjs";
import { isCompound } from "./terms.mjs";

const NARROW_NEG_MODALS = ["must", "should", "might", "would"];
const CONDITIONAL = ["if", "unless"];

export function folFromFacts(facts) {
  const kb = new KB(facts);
  const arg = (a) => (typeof a === "string" ? a : adj(a).replaceAll(" ", "_"));
  const negWide = new Map();
  const negOverModal = new Set();
  for (const [a, b] of kb.scopes) if (isCompound(a, "neg", 1)) {
    if (b === "modal") negOverModal.add(a.args[0]);
    else negWide.set(a.args[0], b);
  }
  const isEv = (x) => kb.isEv(x), isEnt = (x) => kb.isEnt(x);

  // ---- dependency structure
  const roleArgEvents = new Set(), linkTargets = new Set(), restrictEvents = new Map(), actContent = new Map();
  for (const [e, ev] of kb.evs) for (const [, a] of ev.roles) if (isEv(a) && a !== e) roleArgEvents.add(a);
  for (const [a, , b] of kb.links) if (isEv(a) && isEv(b) && a !== b) linkTargets.add(b);
  for (const [x, ent] of kb.ents) for (const r of ent.restrict) if (isEv(r)) restrictEvents.set(r, x);
  for (const [id, act] of kb.acts) if (isEv(act.content)) actContent.set(act.content, id);
  const dependent = (e) => roleArgEvents.has(e) || linkTargets.has(e) || restrictEvents.has(e) || actContent.has(e);

  // ---- sites: top, act:A, prop:E (role argument), ante:E (antecedent), rel:E (restrictor)
  const parent = new Map([["top", null]]);
  const occurrences = new Map();          // entity -> Set(site)
  const visited = new Set();
  const note = (x, site) => { if (!occurrences.has(x)) occurrences.set(x, new Set()); occurrences.get(x).add(site); };
  function noteEntity(x, site, seen = new Set()) {
    if (!isEnt(x) || seen.has(x)) return;
    seen.add(x); note(x, site);
    const ent = kb.ents.get(x);
    for (const [, y] of ent.rels) noteEntity(y, site, seen);
    for (const m of ent.members ?? []) noteEntity(m, site, seen);
  }
  function walkEvent(e, site) {
    const key = `${e}@${site}`;
    if (visited.has(key)) return;
    visited.add(key);
    const ev = kb.evs.get(e);
    for (const [, a] of ev.roles) {
      if (isEv(a) && a !== e) { const s = `prop:${a}`; parent.set(s, site); walkEvent(a, s); }
      else noteEntity(a, site);
    }
    for (const [a, c, b] of kb.links) if (a === e && isEv(b) && b !== e) {
      if (CONDITIONAL.includes(c)) { const s = `ante:${b}`; parent.set(s, site); walkEvent(b, s); }
      else walkEvent(b, site);
    }
  }
  const units = [];
  for (const x of kb.order) {
    if (kb.acts.has(x)) {
      const act = kb.acts.get(x), s = `act:${x}`;
      parent.set(s, "top");
      for (const p of [act.speaker, act.addressee]) if (p != null) noteEntity(p, "top");
      if (isEv(act.content)) walkEvent(act.content, s);
      units.push({act: x});
    } else if (isEv(x) && !dependent(x)) { walkEvent(x, "top"); units.push({event: x}); }
  }
  // Restrictor events: their own entities live inside the restrictor when they occur nowhere else.
  for (const [r, owner] of restrictEvents) { parent.set(`rel:${r}`, `owner:${owner}`); walkEvent(r, `rel:${r}`); }
  // Entities declared but never used stay at the top (as in the native reading).
  for (const x of kb.ents.keys()) if (!occurrences.has(x)) note(x, "top");

  const ancestors = (s) => { const out = []; for (let c = s; c != null; c = parent.get(c)) out.push(c); return out; };
  const placement = new Map();
  function place(x, stack = new Set()) {
    if (placement.has(x)) return placement.get(x);
    if (stack.has(x)) return "top";
    stack.add(x);
    // A restrictor site sits wherever its owner entity is placed.
    const resolve = (s) => s.startsWith("owner:") ? place(s.slice(6), stack) : s;
    // An entity's own relative clause does not count as a use of the entity.
    let sites = [...occurrences.get(x)].filter((s) => !(s.startsWith("rel:") && restrictEvents.get(s.slice(4)) === x));
    if (!sites.length) sites = ["top"];
    const relSites = sites.filter((s) => s.startsWith("rel:"));
    if (!(relSites.length === 1 && sites.length === 1)) sites = sites.map((s) => s.startsWith("rel:") ? resolve(parent.get(s)) : s);
    let lca = sites[0];
    for (const s of sites.slice(1)) { const a = new Set(ancestors(s)); lca = ancestors(lca).find((c) => a.has(c)) ?? "top"; }
    placement.set(x, lca);
    stack.delete(x);
    return lca;
  }
  for (const x of kb.ents.keys()) place(x);
  const placedAt = (site) => [...kb.ents.keys()].filter((x) => placement.get(x) === site);

  // ---- formulas
  const entAtoms = (x) => {
    const e = kb.ents.get(x);
    const at = [...e.inst.map((c) => `${c}(${x})`), ...e.props.map((p) => `${adj(p).replaceAll(" ", "_")}(${x})`)];
    if (e.name) at.push(`${x}=${e.name}`);
    if (e.members && e.members.length) at.push(`${x}=${e.members.join("⊕")}`);
    if (e.measure) at.push(`amount(${x},${arg(e.measure[0])},${e.measure[1]})`);
    for (const [r, y] of e.rels) at.push(`${r}(${x},${y})`);
    for (const r of e.restrict) if (isEv(r)) at.push(block(`rel:${r}`, [linked(r, `rel:${r}`)]));
    return at.length ? at : [`thing(${x})`];
  };
  const stack = new Set();
  function event(e, site) {
    const ev = kb.evs.get(e);
    if (stack.has(e)) return `${ev.verb}(${e})`;
    stack.add(e);
    const roleAtom = ([r, a]) => {
      const name = typeof r === "string" ? r : r.args[0];
      if (isEv(a) && a !== e) return `${name}(${e},⟦${block(`prop:${a}`, [linked(a, `prop:${a}`)])}⟧)`;
      return `${name}(${e},${arg(a)})`;
    };
    const atoms = [`${ev.verb}(${e})`, ...ev.roles.map(roleAtom)];
    if (ev.tense !== "present") atoms.push(`${ev.tense}(${e})`);
    let body = atoms.join(" ∧ ");
    const modal = ev.modal ? String(ev.modal).toUpperCase() : null;
    const narrow = ev.neg && modal && !negOverModal.has(e) && NARROW_NEG_MODALS.includes(ev.modal) && !(site === "top" && negWide.has(e));
    if (modal && !narrow) body = `${modal}[${body}]`;
    body = `${ev.generic ? "GEN" : "∃"}${e}(${body})`;
    if (ev.freq) body = `${String(ev.freq).toUpperCase()}(${body})`;
    if (ev.cf) body = `CF(${body})`;
    if (narrow) body = `${modal}[¬${body}]`;
    else if (ev.neg && !(site === "top" && negWide.has(e))) body = `¬${body}`;
    stack.delete(e);
    return body;
  }
  function linked(e, site) {
    let f = event(e, site);
    for (const [a, c, b] of kb.links) if (a === e && isEv(b) && b !== e) {
      if (c === "if") f = `(${block(`ante:${b}`, [linked(b, `ante:${b}`)])} → ${f})`;
      else if (c === "unless") f = `(¬${block(`ante:${b}`, [linked(b, `ante:${b}`)])} → ${f})`;
      else if (c === "and" || c === "but") f = `(${f} ∧ ${linked(b, site)})`;
      else f = `${String(c).toUpperCase()}(${f}, ${linked(b, site)})`;
    }
    return f;
  }
  // The native quantifier layout, applied to the entities placed at one site.
  function block(site, parts) {
    const here = placedAt(site);
    const univ = here.filter((x) => UNIVERSAL_Q.includes(kb.ents.get(x).quant));
    const whs = here.filter((x) => kb.ents.get(x).wh && !univ.includes(x));
    const order = [...univ];
    for (const [a, b] of kb.scopes) if (typeof a === "string" && typeof b === "string" && order.includes(a) && order.includes(b)) {
      order.splice(order.indexOf(a), 1);
      order.splice(order.indexOf(b), 0, a);
    }
    const exist = here.filter((x) => !univ.includes(x) && !whs.includes(x));
    // Donkey anaphora: an indefinite inside a universal's relative clause that is
    // also used in its scope is bound together with that universal (DRT reading).
    const donkeys = new Map(univ.map((u) => [u, []]));
    for (const x of exist) {
      const owner = univ.find((u) => kb.ents.get(u).restrict.some((r) => occurrences.get(x)?.has(`rel:${r}`)));
      if (owner) donkeys.get(owner).push(x);
    }
    const donkeySet = new Set([...donkeys.values()].flat());
    // An entity named inside a universal's restrictor (rel/2) must be bound outside it.
    const inRestrictor = exist.filter((x) => !donkeySet.has(x) && univ.some((u) => kb.ents.get(u).rels.some(([, y]) => y === x) || (kb.ents.get(u).members ?? []).includes(x)));
    const wideExist = [...new Set([...kb.scopes.filter(([a, b]) => typeof a === "string" && exist.includes(a) && typeof b === "string" && univ.includes(b)).map(([a]) => a), ...inRestrictor])];
    const inner = exist.filter((x) => !wideExist.includes(x) && !donkeySet.has(x));
    let scope = [...inner.flatMap(entAtoms), ...parts].join(" ∧ ") || "⊤";
    if (inner.length) scope = `∃${inner.join(",")}(${scope})`;
    for (const x of [...order].reverse()) {
      const bound = [x, ...donkeys.get(x)];
      scope = `∀${bound.join(",")}(${bound.flatMap(entAtoms).join(" ∧ ")} → ${scope})`;
    }
    if (site === "top") for (const e of negWide.keys()) if (units.some((u) => u.event === e)) scope = `¬(${scope})`;
    for (const x of wideExist) scope = `∃${x}(${entAtoms(x).join(" ∧ ")} ∧ ${scope})`;
    for (const x of whs) scope = `λ${x}.(${scope})`;
    return scope;
  }
  const parts = units.map((u) => {
    if (u.event) return linked(u.event, "top");
    const act = kb.acts.get(u.act);
    const inner = isEv(act.content) ? [linked(act.content, `act:${u.act}`)] : [];
    return `${String(act.type).toUpperCase()}(${block(`act:${u.act}`, inner)})`;
  });
  return block("top", parts);
}

/** Variables (x1, e2, q1, g1, a1) occurring outside the scope of a binder. */
export function freeVariables(formula) {
  const free = new Set();
  const bound = [];
  const s = String(formula);
  let depth = 0;
  for (let i = 0; i < s.length;) {
    const rest = s.slice(i);
    const binder = rest.match(/^(?:[∃∀]|GEN)([a-z]\w*(?:,[a-z]\w*)*)\(/u) || rest.match(/^λ([a-z]\w*)\.\(/u);
    if (binder) { depth += 1; bound.push({depth, vars: binder[1].split(",")}); i += binder[0].length; continue; }
    const c = s[i];
    if (c === "(" || c === "[" || c === "⟦") { depth += 1; i += 1; continue; }
    if (c === ")" || c === "]" || c === "⟧") { while (bound.length && bound.at(-1).depth === depth) bound.pop(); depth -= 1; i += 1; continue; }
    const v = rest.match(/^[a-z]\d+(?![\w])/);
    if (v && !/[\w]/.test(s[i - 1] ?? "")) {
      if (!bound.some((b) => b.vars.includes(v[0]))) free.add(v[0]);
      i += v[0].length; continue;
    }
    i += 1;
  }
  return [...free];
}
