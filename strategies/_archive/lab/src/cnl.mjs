import {humanize, isVariable} from "./util.mjs";
import {normalizeIR} from "./ir.mjs";

function label(term, ir) {
  if (isVariable(term)) return term;
  const meta = ir.symbols?.entities?.[term];
  return meta?.label ?? humanize(term);
}

function predicatePhrase(pred, ir) {
  return ir.symbols?.predicates?.[pred]?.label ?? humanize(pred);
}

function applyTemplate(template, args, ir) {
  return template.replace(/\{(\d+)\}/g, (_, i) => label(args[Number(i)], ir));
}

export function renderAtomCNL(atom, ir, {terminal = true} = {}) {
  const pmeta = ir.symbols?.predicates?.[atom.pred] ?? {};
  let core;
  if (pmeta.cnl) core = applyTemplate(pmeta.cnl, atom.args, ir);
  else if (atom.args.length === 0) core = `${predicatePhrase(atom.pred, ir)}`;
  else if (atom.args.length === 1) core = `${label(atom.args[0], ir)} is ${predicatePhrase(atom.pred, ir)}`;
  else if (atom.args.length === 2) core = `${label(atom.args[0], ir)} ${predicatePhrase(atom.pred, ir)} ${label(atom.args[1], ir)}`;
  else core = `${predicatePhrase(atom.pred, ir)}(${atom.args.map((x) => label(x, ir)).join(", ")})`;
  if (atom.neg) core = `NOT (${core})`;
  return terminal ? `${core}.` : core;
}

function ruleVariables(r) {
  const vars = new Set();
  for (const a of [r.head, ...r.body]) for (const x of a.args) if (isVariable(x)) vars.add(x);
  return [...vars];
}

export function renderRuleCNL(r, ir) {
  const vars = ruleVariables(r);
  const prefix = vars.length ? `For all ${vars.join(", ")}, ` : "";
  const body = r.body.length ? r.body.map((a) => renderAtomCNL(a, ir, {terminal: false})).join(" AND ") : "TRUE";
  const head = renderAtomCNL(r.head, ir, {terminal: false});
  return `${prefix}IF ${body} THEN ${head}.`;
}

export function renderCNL(input, {includeSections = false} = {}) {
  const ir = normalizeIR(input);
  const lines = [];
  const section = (name) => { if (includeSections) lines.push(`# ${name}`); };

  if (ir.facts.length) {
    section("Facts");
    for (const f of ir.facts) lines.push(renderAtomCNL(f, ir));
  }
  if (ir.rules.length) {
    section("Rules");
    for (const r of ir.rules) lines.push(renderRuleCNL(r, ir));
  }
  if (ir.contexts.length) {
    section("Contexts");
    for (const c of ir.contexts) lines.push(`CONTEXT ${c.id ?? "_"} [${c.kind ?? "context"}]: ${c.gloss ?? JSON.stringify(c)}.`);
  }
  if (ir.ambiguities.length) {
    section("Ambiguities");
    for (const a of ir.ambiguities) lines.push(`AMBIGUOUS: ${a.gloss ?? JSON.stringify(a.options ?? a)}.`);
  }
  if (ir.queries.length) {
    section("Queries");
    for (const q of ir.queries) {
      const vars = q.vars?.join(", ") || "truth value";
      const where = (q.where ?? []).map((a) => renderAtomCNL(a, ir, {terminal: false})).join(" AND ");
      lines.push(`QUESTION: find ${vars}${where ? ` such that ${where}` : ""}.`);
    }
  }
  if (ir.externals.length) {
    section("External predicates");
    for (const e of ir.externals) lines.push(`EXTERNAL ${e.predicate}(${(e.roles ?? []).join(", ")})${e.gloss ? `: ${e.gloss}` : ""}.`);
  }
  return lines.join("\n");
}
