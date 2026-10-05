import {atomKey, normalizeAtom, normalizeIR} from "./ir.mjs";
import {isVariable} from "./util.mjs";

// Facts are partitioned by context: a global (context-free) rule atom matches
// only global facts, and an atom scoped to context c matches only facts in c.
// A belief or hypothetical therefore never feeds a global rule.
function unifyAtom(pattern, fact, env) {
  if (pattern.pred !== fact.pred || Boolean(pattern.neg) !== Boolean(fact.neg) || pattern.args.length !== fact.args.length) return null;
  if ((pattern.context ?? null) !== (fact.context ?? null)) return null;
  const next = {...env};
  for (let i = 0; i < pattern.args.length; i += 1) {
    const p = pattern.args[i];
    const f = fact.args[i];
    if (isVariable(p)) {
      if (Object.hasOwn(next, p) && next[p] !== f) return null;
      next[p] = f;
    } else if (p !== f) return null;
  }
  return next;
}

function substitute(a, env) {
  return {...a, args: a.args.map((x) => isVariable(x) ? (env[x] ?? x) : x)};
}

export function closure(input, {maxRounds = 50} = {}) {
  const ir = normalizeIR(input);
  const facts = new Map(ir.facts.map((f) => [atomKey(f), f]));
  for (let round = 0; round < maxRounds; round += 1) {
    let added = 0;
    const factList = [...facts.values()];
    for (const r of ir.rules) {
      let envs = [{}];
      for (const bodyAtom of r.body) {
        const next = [];
        for (const env of envs) {
          const pattern = substitute(bodyAtom, env);
          for (const fact of factList) {
            const u = unifyAtom(pattern, fact, env);
            if (u) next.push(u);
          }
        }
        envs = next;
        if (!envs.length) break;
      }
      for (const env of envs) {
        const head = substitute(r.head, env);
        if (head.args.some(isVariable)) continue;
        const k = atomKey(head);
        if (!facts.has(k)) { facts.set(k, head); added += 1; }
      }
    }
    if (!added) break;
  }
  return [...facts.values()];
}

/** Pairs p / NOT p derived inside the same context partition. */
export function contradictions(input, facts = closure(input)) {
  const keys = new Set(facts.map(atomKey));
  return facts.filter((f) => !f.neg && keys.has(atomKey({...f, neg: true})));
}

export function queryStatus(input, query) {
  const q = normalizeAtom(query);
  const facts = closure(input);
  // An inconsistent partition entails everything classically; report it instead
  // of returning an arbitrary TRUE/FALSE.
  if (contradictions(input, facts).some((f) => (f.context ?? null) === (q.context ?? null))) return "INCONSISTENT";
  const keys = new Set(facts.map(atomKey));
  if (keys.has(atomKey(q))) return "TRUE";
  if (keys.has(atomKey({...q, neg: !q.neg}))) return "FALSE";
  return "UNKNOWN";
}
