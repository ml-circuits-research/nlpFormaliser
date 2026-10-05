import { $, A, O, N, I, Q, isVar, isNode, isDocument, _internal, validate } from './ir.mjs';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Safe, compact wire format for LLM I/O. No eval.
// Example: U(x,I($.student(x),E(y,A($.book(y),$.read(x,y)))))

export function toWire(ir) {
  const varNames = new Map();
  let vi = 0;
  const names = ['x','y','z','u','v','w'];
  const fresh = () => vi < names.length ? names[vi++] : `v${vi++}`;

  function atom(x) {
    if (isVar(x)) {
      if (!varNames.has(x)) varNames.set(x, fresh());
      return varNames.get(x);
    }
    // A constant named x must remain distinct from a bound variable named x.
    if (typeof x === 'string') return JSON.stringify(x);
    if (typeof x === 'number' || typeof x === 'boolean' || x === null) return String(x);
    return expr(x);
  }

  function expr(x) {
    if (isVar(x) || !Array.isArray(x)) return atom(x);
    const op = x[0];
    if (op === '$') return `$.${x[1]}(${x.slice(2).map(atom).join(',')})`;
    if (op === 'U' || op === 'E' || op === 'W') {
      if (!varNames.has(x[1])) varNames.set(x[1], fresh());
      return `${op}(${varNames.get(x[1])},${expr(x[2])})`;
    }
    return `${op}(${x.slice(1).map(expr).join(',')})`;
  }

  if (isDocument(ir)) return `[${ir.map(expr).join(',')}]`;
  return expr(ir);
}

class Parser {
  constructor(src) { this.s = src; this.i = 0; }
  ws() { while (/\s/.test(this.s[this.i] || '')) this.i++; }
  peek(c) { this.ws(); return this.s.startsWith(c, this.i); }
  eat(c) {
    this.ws();
    if (!this.s.startsWith(c, this.i)) throw new SyntaxError(`Expected '${c}' at ${this.i}`);
    this.i += c.length;
  }
  ident() {
    this.ws();
    const m = this.s.slice(this.i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) throw new SyntaxError(`Expected identifier at ${this.i}`);
    this.i += m[0].length;
    return m[0];
  }
  string() {
    this.ws();
    const start = this.i;
    if (this.s[this.i] !== '"') throw new SyntaxError(`Expected string at ${this.i}`);
    this.i++;
    let escaped = false;
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (!escaped && c === '"') return JSON.parse(this.s.slice(start, this.i));
      if (!escaped && c === '\\') escaped = true; else escaped = false;
    }
    throw new SyntaxError('Unterminated string');
  }
  number() {
    this.ws();
    const m = this.s.slice(this.i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?/);
    if (!m) throw new SyntaxError(`Expected number at ${this.i}`);
    this.i += m[0].length;
    return Number(m[0]);
  }
  args(env) {
    const out = [];
    this.eat('(');
    if (this.peek(')')) { this.eat(')'); return out; }
    while (true) {
      out.push(this.expr(env));
      if (this.peek(',')) { this.eat(','); continue; }
      this.eat(')');
      return out;
    }
  }
  expr(env = new Map()) {
    this.ws();
    if (this.peek('[')) {
      const out = []; this.eat('[');
      if (this.peek(']')) { this.eat(']'); return out; }
      while (true) {
        out.push(this.expr(env));
        if (this.peek(',')) { this.eat(','); continue; }
        this.eat(']'); return out;
      }
    }
    if (this.peek('$.')) {
      this.eat('$.');
      const name = this.ident();
      return $[name](...this.args(env));
    }
    if (this.peek('"')) return this.string();
    if (/[-0-9]/.test(this.s[this.i] || '')) return this.number();

    const id = this.ident();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;

    if (['U','E','W'].includes(id) && this.peek('(')) {
      this.eat('(');
      const varName = this.ident();
      this.eat(',');
      const variable = Object.freeze({ [_internal.VAR]: true, id: Symbol(varName) });
      const env2 = new Map(env); env2.set(varName, variable);
      const body = this.expr(env2);
      this.eat(')');
      return Object.freeze([id, variable, body]);
    }

    if (['A','O','N','I','Q'].includes(id) && this.peek('(')) {
      const args = this.args(env);
      return ({A,O,N,I,Q})[id](...args);
    }

    if (env.has(id)) return env.get(id);
    return id;
  }
}

export function fromWire(src) {
  src = String(src).trim()
    .replace(/^```(?:\w+)?\s*/,'')
    .replace(/\s*```$/,'')
    .trim();
  const p = new Parser(src);
  const ir = p.expr(new Map());
  p.ws();
  if (p.i !== p.s.length) throw new SyntaxError(`Unexpected trailing input at ${p.i}`);
  const check = validate(ir);
  if (!check.ok) throw new SyntaxError(check.errors.join('; '));
  return ir;
}
