import {HeuristicStrategy} from './src/strategies/heuristic.mjs';
import {DirectLLMStrategy} from './src/strategies/direct-llm.mjs';
import {ProtoLLMStrategy} from './src/strategies/proto-llm.mjs';
import {RepairLLMStrategy} from './src/strategies/repair-llm.mjs';
import {validateIR} from './src/ir.mjs';
import {renderCNL} from './src/cnl.mjs';
import {compileFormalModule} from './src/compiler.mjs';
import {behaviorMetrics,structuralMetrics,reuseMetrics} from './src/evaluator.mjs';
import {reasoningCoverage,metadataAudit,labSymbols} from './coverage.mjs';

export {renderCNL as cnl,validateIR as checkLogic};
export function labStrategy(kind) {
  return {
    name:`lab-${kind}`,usesLLM:kind!=='heuristic',deterministicCNL:true,repair:kind==='repair',
    async formalize(text,{llm,options={},proto}={}) {
      if(kind==='repair'&&!options.allowRepair)throw new Error('Repair must be explicitly enabled; first-pass evaluations never repair');
      const client={complete:({system,user})=>llm(system,user)};
      const impl=kind==='heuristic'?new HeuristicStrategy():kind==='proto'?new ProtoLLMStrategy({client}):kind==='repair'?new RepairLLMStrategy({client}):new DirectLLMStrategy({client});
      const r=await impl.formalize(text,proto?{proto}:{});
      return {formalization:r.ir,proto:r.proto,artifacts:r.artifacts,metadataAudit:metadataAudit(r.ir),
        ...(kind==='repair'?{reuse:reuseMetrics(r.artifacts.draft,r.ir)}:{})};
    },
    check:validateIR,toCNL:renderCNL,symbols:labSymbols,
    toReasoning(ir) {
      return {format:'formal-ir-module/0.2',ir,code:compileFormalModule(ir),coverage:reasoningCoverage(ir),
        semantics:'Standalone module renders the complete IR. The bundled Horn reasoner executes only its supported subset; retained contexts and ambiguity are not flattened into facts.'};
    },
    evaluateReference(ir,sample) {
      const coverage=reasoningCoverage(ir);
      const validation=validateIR(ir);
      if(!validation.ok)return {coverage,behavior:{status:'unsupported',reason:validation.errors.join('; '),tests:sample.tests??[]},structural:null};
      return {coverage,behavior:coverage.complete?behaviorMetrics(ir,sample.tests??[]):{status:'unsupported',reason:'Behavioral engine cannot interpret every represented section',tests:sample.tests??[]},structural:sample.gold_ir?structuralMetrics(ir,sample.gold_ir):null};
    },
  };
}
