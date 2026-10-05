import {isVariable, slug, stableStringify} from "./util.mjs";

export const IR_VERSION = "0.2";

export function atom(pred, ...rest) {
  let options = {};
  if (rest.length && rest.at(-1) && typeof rest.at(-1) === "object" && !Array.isArray(rest.at(-1)) && rest.at(-1).__atomOptions) {
    options = rest.pop();
  }
  return {
    pred: slug(pred),
    args: rest.map(normalizeTerm),
    neg: Boolean(options.neg),
    ...(options.context ? {context: options.context} : {}),
    ...(options.source ? {source: options.source} : {})
  };
}

export function atomOptions(options = {}) {
  return {...options, __atomOptions: true};
}

export function rule(head, body = [], meta = {}) {
  return {
    head: normalizeAtom(head),
    body: body.map(normalizeAtom),
    ...(Object.keys(meta).length ? {meta} : {})
  };
}

export function makeIR(input = {}) {
  return normalizeIR({
    version: input.version ?? IR_VERSION,
    facts: input.facts ?? [],
    rules: input.rules ?? [],
    contexts: input.contexts ?? [],
    queries: input.queries ?? [],
    externals: input.externals ?? [],
    ambiguities: input.ambiguities ?? [],
    symbols: input.symbols ?? {entities: {}, predicates: {}},
    meta: input.meta ?? {}
  });
}

export function normalizeTerm(x) {
  if (typeof x !== "string") return x;
  if (isVariable(x)) return `?${slug(x.slice(1))}`;
  return slug(x);
}

export function normalizeAtom(a) {
  if (!a || typeof a !== "object") throw new TypeError("Atom must be an object");
  if (!a.pred) throw new TypeError("Atom.pred is required");
  return {
    pred: slug(a.pred),
    args: (a.args ?? []).map(normalizeTerm),
    neg: Boolean(a.neg),
    ...(a.context ? {context: String(a.context)} : {}),
    ...(a.source ? {source: a.source} : {})
  };
}

function normalizeRule(r) {
  if (!r?.head) throw new TypeError("Rule.head is required");
  return {
    head: normalizeAtom(r.head),
    body: (r.body ?? []).map(normalizeAtom),
    ...(r.meta ? {meta: r.meta} : {})
  };
}

export function normalizeIR(ir = {}) {
  return {
    version: String(ir.version ?? IR_VERSION),
    facts: dedupeAtoms((ir.facts ?? []).map(normalizeAtom)),
    rules: dedupeRules((ir.rules ?? []).map(normalizeRule)),
    contexts: structuredClone(ir.contexts ?? []),
    queries: structuredClone(ir.queries ?? []),
    externals: structuredClone(ir.externals ?? []),
    ambiguities: structuredClone(ir.ambiguities ?? []),
    symbols: structuredClone(ir.symbols ?? {entities: {}, predicates: {}}),
    meta: structuredClone(ir.meta ?? {})
  };
}

export function atomKey(a) {
  const n = normalizeAtom(a);
  return `${n.neg ? "!" : ""}${n.pred}(${n.args.map((x) => stableStringify(x)).join(",")})${n.context ? `@${n.context}` : ""}`;
}

export function ruleKey(r) {
  const n = normalizeIR({rules: [r]}).rules[0];
  return `${atomKey(n.head)}<-${n.body.map(atomKey).sort().join("&")}`;
}

export function dedupeAtoms(atoms) {
  const seen = new Set();
  const out = [];
  for (const a of atoms) {
    const k = atomKey(a);
    if (!seen.has(k)) { seen.add(k); out.push(a); }
  }
  return out;
}

export function dedupeRules(rules) {
  const seen = new Set();
  const out = [];
  for (const r of rules) {
    const k = `${atomKey(r.head)}<-${r.body.map(atomKey).sort().join("&")}`;
    if (!seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}

export function validateIR(ir) {
  const errors = [];
  let n;
  try { n = normalizeIR(ir); } catch (e) { return {ok: false, errors: [e.message]}; }
  for (const [i, f] of n.facts.entries()) {
    if (!f.pred) errors.push(`facts[${i}] has empty predicate`);
    if (!Array.isArray(f.args)) errors.push(`facts[${i}].args is not an array`);
  }
  for (const [i, r] of n.rules.entries()) {
    const bodyVars = new Set(r.body.flatMap((a) => a.args.filter(isVariable)));
    for (const v of r.head.args.filter(isVariable)) {
      if (!bodyVars.has(v)) errors.push(`rules[${i}] head variable ${v} is not bound in the body`);
    }
  }
  return {ok: errors.length === 0, errors, ir: n};
}

export function irSize(ir) {
  const n = normalizeIR(ir);
  return n.facts.length + n.rules.length + n.contexts.length + n.queries.length + n.externals.length + n.ambiguities.length;
}
