import { fromWire, toWire } from './src/wire.mjs';
import { toCNL } from './src/cnl.mjs';
import { FORMALIZE_SYSTEM } from './src/prompts.mjs';
import { isVar, isDocument } from './src/ir.mjs';
export const SYSTEM=FORMALIZE_SYSTEM;

export function toLogic(wire) {
  const ir = fromWire(wire), names = new Map();
  function term(x) {
    if (isVar(x)) { if (!names.has(x)) names.set(x, `X${names.size}`); return {var: names.get(x)}; }
    if (!Array.isArray(x)) return {constant: x};
    const [op, ...args] = x;
    if (op === '$') return {predicate: args[0], args: args.slice(1).map(term)};
    return {op: ({A:'and',O:'or',N:'not',I:'implies',U:'forall',E:'exists',Q:'ask',W:'which'})[op], args: args.map(term)};
  }
  return {format: 'fol-ast/1', statements: (isDocument(ir) ? ir : [ir]).map(term)};
}

export default {
  name: 'microir', deterministicCNL: true, usesLLM: true,
  async formalize(text, {llm}) {
    // Keep wire text: variables in the internal IR are Symbols and cannot be JSON serialized.
    const wire = await llm(SYSTEM, text);
    return {formalization: toWire(fromWire(wire)),rawWire:wire,compactCNL:toCNL(fromWire(wire),{compact:true})};
  },
  check(wire) { try { fromWire(wire); return {ok:true, errors:[]}; } catch(e) { return {ok:false, errors:[e.message]}; } },
  toCNL: wire => toCNL(fromWire(wire)),
  toReasoning: toLogic,
};
