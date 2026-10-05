import {normalizeIR} from "./ir.mjs";
import {symbolWords} from "../../../tools/lib/symbols.mjs";

// The judged CNL is derived from the formal structure only. Model-written
// metadata may shape wording only in two narrow ways: an entity/predicate label
// that restyles its own symbol (at most 3 words, same words), and a predicate
// template made of all argument slots plus at most 3 other words. Longer labels/templates fall back to the structural rendering.
// Context, ambiguity and external glosses are explanatory notes: they stay in the
// IR but are never rendered, so a free-text gloss cannot supply meaning that the
// program does not contain. Contextual atoms are rendered inside their context.
//
// renderIRCNL is self-contained (it only uses symbolWords) so that the standalone
// compiled module embeds exactly the same renderer.
export function renderIRCNL(ir, {includeSections = false} = {}) {
  const MAX_WORDS = 3;
  const isVar = (x) => typeof x === "string" && x.startsWith("?");
  const humanize = (x) => String(x ?? "").replace(/^\?/, "").replace(/_/g, " ");
  const short = (s, proper = false) => typeof s === "string" && s.trim() !== "" && symbolWords(s, {proper}).length <= MAX_WORDS;
  const scalar = (x) => x === null || ["string", "number", "boolean"].includes(typeof x);
  // A label may only restyle its own symbol (case, spaces, underscores): "Ada"
  // for ada is used, "everything is true" for ada is not.
  const letters = (v) => String(v).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "");
  const sameWords = (label, symbol) => letters(label) === letters(symbol);
  const term = (x) => {
    if (isVar(x)) return x;
    if (!scalar(x)) return JSON.stringify(x);
    const label = ir.symbols?.entities?.[x]?.label;
    return short(label, true) && sameWords(label, x) ? label : humanize(x);
  };
  const phrase = (p) => {
    const label = ir.symbols?.predicates?.[p]?.label;
    return short(label) && sameWords(label, p) ? label : humanize(p);
  };
  const validTemplate = (t, arity) => {
    if (typeof t !== "string") return false;
    const slots = [...t.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
    for (let i = 0; i < arity; i += 1) if (!slots.includes(i)) return false;
    if (slots.some((i) => i >= arity)) return false;
    return symbolWords(t.replace(/\{\d+\}/g, " "), {proper: true}).length <= MAX_WORDS;
  };
  const contextHead = (id) => {
    const c = (ir.contexts ?? []).find((x) => x && x.id === id) ?? {};
    const kind = short(c.kind) ? humanize(c.kind) : "context";
    const holder = scalar(c.holder) && c.holder != null && short(String(c.holder), true) ? ` of ${term(c.holder)}` : "";
    return `Within context ${short(String(id)) ? id : "(unnamed)"} (${kind}${holder})`;
  };
  const atom = (a, terminal = true) => {
    const template = ir.symbols?.predicates?.[a.pred]?.cnl;
    let core;
    if (validTemplate(template, a.args.length)) core = template.replace(/\{(\d+)\}/g, (_, i) => term(a.args[Number(i)]));
    else if (a.args.length === 0) core = phrase(a.pred);
    else if (a.args.length === 1) core = `${term(a.args[0])} is ${phrase(a.pred)}`;
    else if (a.args.length === 2) core = `${term(a.args[0])} ${phrase(a.pred)} ${term(a.args[1])}`;
    else core = `${phrase(a.pred)}(${a.args.map(term).join(", ")})`;
    if (a.neg) core = `NOT (${core})`;
    if (a.context !== undefined) core = `${contextHead(a.context)}: ${core}`;
    return terminal ? `${core}.` : core;
  };
  const lines = [];
  const section = (name) => { if (includeSections) lines.push(`# ${name}`); };
  if ((ir.facts ?? []).length) {
    section("Facts");
    for (const f of ir.facts) lines.push(atom(f));
  }
  if ((ir.rules ?? []).length) {
    section("Rules");
    for (const r of ir.rules) {
      const vars = [...new Set([r.head, ...(r.body ?? [])].flatMap((a) => a.args.filter(isVar)))];
      const prefix = vars.length ? `For all ${vars.join(", ")}, ` : "";
      const body = (r.body ?? []).length ? r.body.map((a) => atom(a, false)).join(" AND ") : "TRUE";
      lines.push(`${prefix}IF ${body} THEN ${atom(r.head, false)}.`);
    }
  }
  if ((ir.contexts ?? []).length) {
    section("Contexts");
    for (const c of ir.contexts) {
      const id = c && short(String(c.id ?? "")) ? c.id : "_";
      const kind = c && short(c.kind) ? humanize(c.kind) : "context";
      const holder = c && scalar(c.holder) && c.holder != null && short(String(c.holder), true) ? ` HOLDER ${term(c.holder)}` : "";
      const parent = c && typeof c.parent === "string" && short(c.parent) ? ` WITHIN ${c.parent}` : "";
      lines.push(`CONTEXT ${id} [${kind}]${holder}${parent}.`);
    }
  }
  if ((ir.ambiguities ?? []).length) {
    section("Ambiguities");
    ir.ambiguities.forEach((a, k) => {
      const options = Array.isArray(a?.options) ? a.options : [];
      const shown = options.length && options.every((o) => scalar(o) && o !== null && short(String(o), true))
        ? `: options ${options.map((o) => term(o)).join(" | ")}`
        : options.length ? `: ${options.length} alternatives (not rendered)` : "";
      const tags = [a && typeof a.id === "string" && short(a.id) ? a.id : null, a && typeof a.kind === "string" && short(a.kind) ? humanize(a.kind) : null].filter(Boolean);
      const id = tags.length ? ` (${tags.join(", ")})` : "";
      lines.push(`NOTED AMBIGUITY #${k + 1}${id}${shown}.`);
    });
  }
  if ((ir.queries ?? []).length) {
    section("Queries");
    for (const q of ir.queries) {
      const vars = (Array.isArray(q?.vars) ? q.vars : []).join(", ") || "truth value";
      const where = (Array.isArray(q?.where) ? q.where : []).map((a) => atom(a, false)).join(" AND ");
      lines.push(`QUESTION: find ${vars}${where ? ` such that ${where}` : ""}.`);
    }
  }
  if ((ir.externals ?? []).length) {
    section("External predicates");
    for (const e of ir.externals) {
      const roles = (Array.isArray(e?.roles) ? e.roles : []).map((r) => short(String(r)) ? r : "(long role)");
      lines.push(`EXTERNAL ${short(String(e?.predicate ?? "")) ? e.predicate : "(long name)"}(${roles.join(", ")}).`);
    }
  }
  return lines.join("\n");
}

export function renderCNL(input, options = {}) {
  return renderIRCNL(normalizeIR(input), options);
}
