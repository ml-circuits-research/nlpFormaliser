// Parser for EVL code: ground Prolog facts (atoms, quoted atoms, numbers, compound terms, lists).
//
// Term representation:
//   atom      -> JS string            ('Mary' and mary are both atoms)
//   number    -> JS number
//   compound  -> Compound {f, args}
//   list      -> JS array
//   variable  -> Var {name}           (only so the checker can report non-ground facts)

export class Compound {
  constructor(f, args) { this.f = f; this.args = args; }
  toString() { return termToString(this); }
}
export class Var {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
}

export const isCompound = (t, f, n) => t instanceof Compound && (f === undefined || t.f === f) && (n === undefined || t.args.length === n);
export const isAtom = (t) => typeof t === "string";
export const isNumber = (t) => typeof t === "number";

export function termToString(t) {
  if (typeof t === "number") return String(t);
  if (typeof t === "string") return /^[a-z][A-Za-z0-9_]*$/.test(t) ? t : `'${t.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (Array.isArray(t)) return `[${t.map(termToString).join(", ")}]`;
  if (t instanceof Var) return t.name;
  return `${termToString(t.f)}(${t.args.map(termToString).join(", ")})`;
}

export function isGround(t) {
  if (t instanceof Var) return false;
  if (Array.isArray(t)) return t.every(isGround);
  if (t instanceof Compound) return t.args.every(isGround);
  return true;
}

class SyntaxErr extends Error {
  constructor(msg, line) { super(msg); this.line = line; }
}

/**
 * Parse EVL code. Returns { facts: Term[], errors: string[], rules: Term[] }.
 * Syntax errors are reported per clause (the parser resynchronises at the next '.').
 */
export function parseProgram(code) {
  const facts = [], errors = [], rules = [];
  let i = 0, line = 1;
  const n = code.length;

  const peek = () => code[i];
  const skipWs = () => {
    for (;;) {
      while (i < n && /\s/.test(code[i])) { if (code[i] === "\n") line++; i++; }
      if (code[i] === "%") { while (i < n && code[i] !== "\n") i++; continue; }
      if (code[i] === "/" && code[i + 1] === "*") {
        const j = code.indexOf("*/", i + 2);
        const end = j < 0 ? n : j + 2;
        for (let k = i; k < end; k++) if (code[k] === "\n") line++;
        i = end; continue;
      }
      break;
    }
  };
  const err = (msg) => { throw new SyntaxErr(msg, line); };

  function parseQuoted(q) {
    i++; let s = "";
    while (i < n) {
      const c = code[i];
      if (c === "\\") { const d = code[i + 1]; s += d === "n" ? "\n" : d === "t" ? "\t" : d; i += 2; continue; }
      if (c === q) { if (code[i + 1] === q) { s += q; i += 2; continue; } i++; return s; }
      if (c === "\n") line++;
      s += c; i++;
    }
    err("unterminated quoted atom");
  }

  function parseArgs(close) {
    const args = [];
    skipWs();
    if (peek() === close) { i++; return args; }
    for (;;) {
      args.push(parseTerm());
      skipWs();
      if (peek() === ",") { i++; continue; }
      if (peek() === close) { i++; return args; }
      if (close === "]" && peek() === "|") err("list tails ('|') are not supported in EVL facts");
      err(`operator expected (found '${peek() ?? "end of input"}')`);
    }
  }

  function parsePrimary() {
    skipWs();
    const c = peek();
    if (c === undefined) err("unexpected end of input");
    if (c === "[") { i++; return parseArgs("]"); }
    if (c === "(") { i++; const t = parseTerm(); skipWs(); if (peek() !== ")") err("')' expected"); i++; return t; }
    if (c === "'" || c === '"') {
      const a = parseQuoted(c);
      if (peek() === "(") { i++; return new Compound(a, parseArgs(")")); }
      return a;
    }
    const num = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(code.slice(i));
    if (num && (c !== "-" || /\d/.test(code[i + 1]))) { i += num[0].length; return Number(num[0]); }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(code.slice(i));
    if (id) {
      i += id[0].length;
      if (/^[A-Z_]/.test(id[0])) return new Var(id[0]);
      if (peek() === "(") { i++; return new Compound(id[0], parseArgs(")")); }
      return id[0];
    }
    err(`illegal start of term ('${c}')`);
  }

  // minimal operator support: only the clause neck ':-' and conjunction ',' at top level
  function parseTerm() { return parsePrimary(); }

  while (true) {
    skipWs();
    if (i >= n) break;
    const startLine = line;
    try {
      let directive = false;
      if (code.startsWith(":-", i)) { directive = true; i += 2; }
      const parts = [parseTerm()];
      skipWs();
      let isRule = false;
      while (peek() === "," || code.startsWith(":-", i)) {
        if (peek() === ",") { i++; parts.push(parseTerm()); }
        else { i += 2; isRule = true; parts.push(parseTerm()); }
        skipWs();
      }
      if (peek() !== "." || !(i + 1 >= n || /[\s%]/.test(code[i + 1]))) err(`operator expected (found '${peek() ?? "end of input"}')`);
      i++;
      if (directive) continue;
      if (isRule) { rules.push(parts[0]); continue; }
      facts.push(...parts);
    } catch (e) {
      if (!(e instanceof SyntaxErr)) throw e;
      errors.push(`syntax error: ${e.message} (near line ${startLine})`);
      // resynchronise after the next full stop
      while (i < n && !(code[i] === "." && (i + 1 >= n || /\s/.test(code[i + 1])))) { if (code[i] === "\n") line++; i++; }
      i++;
    }
  }
  return { facts, errors, rules };
}
