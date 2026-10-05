import {isVar, isDocument} from './ir.mjs';
import {fromWire} from './wire.mjs';
import {constantKind, symbolViolations} from '../../../tools/lib/symbols.mjs';

// Predicate names and string constants of a MicroIR formula or wire string.
export function microSymbols(input) {
  const ir = typeof input === 'string' ? fromWire(input) : input;
  const out = [];
  function walk(x, path) {
    if (isVar(x) || x == null) return;
    if (typeof x === 'string') { out.push({path, name: x, kind: constantKind(x)}); return; }
    if (!Array.isArray(x)) return;
    if (x[0] === '$') {
      out.push({path: `${path}.$${x[1]}`, name: x[1], kind: 'symbol'});
      x.slice(2).forEach((y, i) => walk(y, `${path}.${x[1]}[${i}]`));
      return;
    }
    if (['U', 'E', 'W'].includes(x[0])) { walk(x[2], `${path}.${x[0]}`); return; }
    x.slice(1).forEach((y, i) => walk(y, `${path}.${x[0]}[${i}]`));
  }
  (isDocument(ir) ? ir : [ir]).forEach((x, i) => walk(x, `$[${i}]`));
  return out;
}

export const microSymbolViolations = input => symbolViolations(microSymbols(input));
