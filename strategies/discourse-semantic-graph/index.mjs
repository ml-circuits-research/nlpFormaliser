import {formalizeText,formalizeConversation,renderTurn,auditConversation,buildBatchHelperRequests,summarizeHelperLoad,validateAst} from './src/formalizer.mjs';
import {buildJudgeBatches,judgeBatches,combineValidation} from './src/judge.mjs';

export function refreshCNL(conversation) {
  return {...conversation,turns:conversation.turns.map(t=>({...t,cnl:renderTurn(t),...(t.final_content?{final_cnl:renderTurn({...t,content:t.final_content})}:{})}))};
}
export default {
  name:'discourse-semantic-graph',usesLLM:false,deterministicCNL:true,
  async formalize(text,{turns,options={}}={}) {
    const formalization=turns?formalizeConversation(turns):{turns:formalizeText(text),state:null};
    const helperRequests=buildBatchHelperRequests(formalization,options.helper??{});
    return {formalization,audit:auditConversation(formalization),helperRequests,helperLoad:summarizeHelperLoad(formalization),
      reviewBatches:buildJudgeBatches(formalization,{policy:options.reviewPolicy??'all',...options.review})};
  },
  check(conversation) {
    const errors=conversation.turns.flatMap(t=>validateAst(t.content));
    return {ok:errors.length===0,errors};
  },
  toCNL: conversation=>refreshCNL(conversation).turns.map(t=>t.final_cnl??t.cnl).join('\n\n'),
  toReasoning(conversation) {
    return {format:'discourse-ast/1',ast:conversation,coverage:{complete:false,unhandled:[{reason:'The source archive explicitly defers the downstream reasoning compiler. Full AST, uncertainty and discourse state are retained.'}]}};
  },
};
export async function reviewConversation(conversation,{llm,policy='all',...options}) {
  const fresh=refreshCNL(conversation);
  const batches=buildJudgeBatches(fresh,{policy,...options});
  const responses=await judgeBatches(batches,{callLLM:({system,user})=>llm(system,user)});
  return {batches,responses,validated:combineValidation(fresh,responses,{requireJudgeForAcceptance:true})};
}
export * from './src/formalizer.mjs';
