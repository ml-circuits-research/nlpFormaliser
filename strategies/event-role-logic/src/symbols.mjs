// Lexical symbols of EVL code (concepts, relations, units, prepositions, atom
// values and proper names). Structural ids (x1, e2, ...) and the fixed
// vocabulary of the checker are not symbols.
import { check, idLike } from "./check.mjs";
import { Compound } from "./terms.mjs";

export function evlSymbols(code) {
  const out = [];
  const add = (path, x, kind = "symbol") => {
    if (typeof x === "string" && x !== "" && !idLike(x)) out.push({path, name: x, kind});
    else if (x instanceof Compound) { add(`${path}.${x.f}`, x.f, kind); x.args.forEach((a, i) => add(`${path}.${x.f}[${i}]`, a, kind)); }
  };
  check(code).facts.forEach((t, i) => {
    if (!(t instanceof Compound)) return;
    const [a0, a1, a2] = t.args, p = `facts[${i}].${t.f}`;
    if (["inst", "event", "prop"].includes(t.f)) add(p, a1);
    else if (t.f === "name") add(p, a1, "proper");
    else if (t.f === "kind") { add(p, a0); add(p, a1); }
    else if (t.f === "rel") add(p, a1);
    else if (t.f === "measure" || t.f === "rate") add(p, t.f === "measure" ? a2 : a1);
    else if (t.f === "role") {
      if (a1 instanceof Compound) add(p, a1.args[0]);
      if (typeof a2 === "string" || a2 instanceof Compound) add(p, a2);
    }
  });
  return out;
}
