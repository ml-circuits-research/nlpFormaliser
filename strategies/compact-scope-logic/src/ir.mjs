// MicroIR: compact semantic IR with dynamic semantic predicates.
// Fixed operators carry logic/scope; $.name(...) carries open vocabulary.

const VAR = Symbol('microir.var');
let nextVarId = 0;

function makeVar(id = nextVarId++) {
  return Object.freeze({ [VAR]: true, id });
}

export function isVar(x) {
  return !!(x && typeof x === 'object' && x[VAR] === true);
}

// Every property access creates a predicate-constructor dynamically.
// $.buy(a,b) => ['$', 'buy', a, b]
export const $ = new Proxy(Object.create(null), {
  get(_target, name) {
    if (name === 'then' || name === 'toJSON' || name === 'inspect') return undefined;
    if (typeof name !== 'string') return undefined;
    return (...args) => Object.freeze(['$', name, ...args]);
  }
});

// Fixed structural operators. Keep this set deliberately small.
export const A = (...xs) => Object.freeze(['A', ...xs]); // and
export const O = (...xs) => Object.freeze(['O', ...xs]); // or
export const N = x => Object.freeze(['N', x]);            // not
export const I = (a, b) => Object.freeze(['I', a, b]);    // implies
export const Q = x => Object.freeze(['Q', x]);            // yes/no question

export function U(fn) { // forall
  const x = makeVar();
  return Object.freeze(['U', x, fn(x)]);
}

export function E(fn) { // exists
  const x = makeVar();
  return Object.freeze(['E', x, fn(x)]);
}

export function W(fn) { // wh-question
  const x = makeVar();
  return Object.freeze(['W', x, fn(x)]);
}

export const and = A;
export const or = O;
export const not = N;
export const implies = I;
export const forall = U;
export const exists = E;
export const ask = Q;
export const wh = W;

export function isPredicate(x) {
  return Array.isArray(x) && x[0] === '$' && typeof x[1] === 'string';
}

export function isNode(x) {
  return Array.isArray(x) && ['$', 'A', 'O', 'N', 'I', 'U', 'E', 'Q', 'W'].includes(x[0]);
}

export function isDocument(x) {
  return Array.isArray(x) && !isNode(x);
}

export function validate(ir) {
  const errors = [];
  const root = isDocument(ir) ? ir : [ir];
  if (!root.length) errors.push('Empty document');
  // Question force (Q/W) is allowed only as a whole document item or directly as
  // a predicate argument (an embedded question). Nested under A/O/N/I/U/E/Q/W it
  // would be rendered as a "Statement" and silently lose its force.
  function formula(x, path, questionAllowed = true) {
    if (!isNode(x)) { errors.push(`${path}: expected a logical formula`); return; }
    if ((x[0] === 'Q' || x[0] === 'W') && !questionAllowed) errors.push(`${path}: question operator ${x[0]} must be a top-level document item or a predicate argument`);
    if (['A','O','N','I','Q'].includes(x[0])) x.slice(1).forEach((y,i)=>formula(y,`${path}[${i}]`,false));
    else if (['U','E','W'].includes(x[0])) formula(x[2],`${path}.body`,false);
    else if (x[0] === '$') x.slice(2).forEach((y,i)=>{ if (isNode(y)) formula(y,`${path}.${x[1]}[${i}]`,true); });
  }
  root.forEach((x,i)=>formula(x,`$[${i}]`));

  function walk(x, bound, path) {
    if (isVar(x)) {
      if (!bound.has(x)) errors.push(`${path}: free variable`);
      return;
    }
    if (x === null || ['string', 'number', 'boolean'].includes(typeof x)) return;
    if (!Array.isArray(x)) {
      errors.push(`${path}: unsupported value`);
      return;
    }
    const op = x[0];
    if (op === '$') {
      if (typeof x[1] !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(x[1])) {
        errors.push(`${path}: invalid predicate name`);
      }
      for (let i = 2; i < x.length; i++) walk(x[i], bound, `${path}.${x[1]}[${i - 2}]`);
      return;
    }
    if (op === 'A' || op === 'O') {
      if (x.length < 3) errors.push(`${path}: ${op} requires >=2 operands`);
      for (let i = 1; i < x.length; i++) walk(x[i], bound, `${path}.${op}[${i - 1}]`);
      return;
    }
    if (op === 'N' || op === 'Q') {
      if (x.length !== 2) errors.push(`${path}: ${op} arity`);
      if (x.length > 1) walk(x[1], bound, `${path}.${op}`);
      return;
    }
    if (op === 'I') {
      if (x.length !== 3) errors.push(`${path}: I arity`);
      if (x.length > 1) walk(x[1], bound, `${path}.I.left`);
      if (x.length > 2) walk(x[2], bound, `${path}.I.right`);
      return;
    }
    if (op === 'U' || op === 'E' || op === 'W') {
      if (x.length !== 3 || !isVar(x[1])) {
        errors.push(`${path}: invalid binder ${op}`);
        return;
      }
      const next = new Set(bound);
      next.add(x[1]);
      walk(x[2], next, `${path}.${op}`);
      return;
    }
    errors.push(`${path}: unknown operator ${String(op)}`);
  }

  root.forEach((x, i) => walk(x, new Set(), `$[${i}]`));
  return { ok: errors.length === 0, errors };
}

export function normalize(ir) {
  function n(x) {
    if (!Array.isArray(x) || isVar(x)) return x;
    const op = x[0];
    if (op === '$') return Object.freeze(['$', x[1], ...x.slice(2).map(n)]);
    if (op === 'A' || op === 'O') {
      const ys = x.slice(1).map(n).flatMap(y => Array.isArray(y) && y[0] === op ? y.slice(1) : [y]);
      if (ys.length === 1) return ys[0];
      return Object.freeze([op, ...ys]);
    }
    return Object.freeze([op, ...x.slice(1).map(n)]);
  }
  return isDocument(ir) ? Object.freeze(ir.map(n)) : n(ir);
}

export function stats(ir) {
  const predicates = new Map();
  let nodes = 0, vars = 0;
  function walk(x) {
    if (isVar(x)) { vars++; return; }
    if (!Array.isArray(x)) return;
    if (x[0] === '$') predicates.set(x[1], (predicates.get(x[1]) || 0) + 1);
    if (isNode(x)) nodes++;
    const start = x[0] === '$' ? 2 : 1;
    for (let i = start; i < x.length; i++) walk(x[i]);
  }
  (isDocument(ir) ? ir : [ir]).forEach(walk);
  return { nodes, vars, predicates: Object.fromEntries([...predicates].sort()) };
}

export const _internal = { VAR };
