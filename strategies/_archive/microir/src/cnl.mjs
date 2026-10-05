import { isVar, isDocument } from './ir.mjs';

// Deterministic Controlled Natural Language (CNL) renderer.
// It intentionally does not guess parts of speech or semantic roles.
// Open-vocabulary predicates are named explicitly, preserving argument order.

export function toCNL(ir, { compact = false } = {}) {
  const vars = new Map();
  let vi = 0;
  const names = ['x','y','z','u','v','w'];
  const fresh = () => vi < names.length ? names[vi++] : `v${vi++}`;

  const nameOfVar = v => {
    if (!vars.has(v)) vars.set(v, fresh());
    return vars.get(v);
  };

  function atom(x) {
    if (isVar(x)) return nameOfVar(x);
    if (x === null) return 'null';
    if (typeof x === 'string') return `“${x.replaceAll('_', ' ')}”`;
    if (typeof x === 'number' || typeof x === 'boolean') return String(x);
    if (Array.isArray(x)) return compact ? `(${clause(x)})` : `the proposition that ${clause(x)}`;
    return String(x);
  }

  function pred(x) {
    const name = x[1].replaceAll('_', ' ');
    const args = x.slice(2).map(atom);
    if (compact) return args.length ? `“${name}”(${args.join(', ')})` : `“${name}”`;
    if (args.length === 0) return `the predicate “${name}” holds`;
    if (args.length === 1) return `the predicate “${name}” holds for ${args[0]}`;
    return `the predicate “${name}” holds with ordered arguments [${args.join('; ')}]`;
  }

  function clause(x) {
    if (!Array.isArray(x)) return atom(x);
    const op = x[0];
    if (op === '$') return pred(x);
    if (op === 'A') return x.slice(1).map(clause).map(s => `(${s})`).join(' and ');
    if (op === 'O') return x.slice(1).map(clause).map(s => `(${s})`).join(' or ');
    if (op === 'N') return `it is not the case that (${clause(x[1])})`;
    if (op === 'I') return `if (${clause(x[1])}), then (${clause(x[2])})`;
    if (op === 'U') {
      const v = nameOfVar(x[1]);
      return `for every ${v}, (${clause(x[2])})`;
    }
    if (op === 'E') {
      const v = nameOfVar(x[1]);
      return `there exists a ${v} such that (${clause(x[2])})`;
    }
    if (op === 'Q') return `is it the case that (${clause(x[1])})?`;
    if (op === 'W') {
      const v = nameOfVar(x[1]);
      return `which ${v} satisfies that (${clause(x[2])})?`;
    }
    throw new TypeError(`Unknown IR operator: ${String(op)}`);
  }

  if (isDocument(ir)) {
    return ir.map((x, i) => {
      const q = Array.isArray(x) && (x[0] === 'Q' || x[0] === 'W');
      return `${q ? 'Question' : 'Statement'} ${i + 1}: ${clause(x)}`;
    }).join('\n');
  }
  return clause(ir);
}
