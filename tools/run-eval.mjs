#!/usr/bin/env node
import {appendFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {ROOT,loadStrategy,listStrategies,formalizeToCNL} from './lib/strategies.mjs';
import {loadSet,sourceForModel} from './lib/evalset.mjs';
import {taskLLM,digest} from './lib/pworker.mjs';
import {makeJudge} from './lib/judge.mjs';
import {positive} from './lib/cli.mjs';
import {auditFormalization} from './lib/audit.mjs';
import {resolveStrategy} from './lib/registry.mjs';
import {summarizeRows,breakdown} from './lib/metrics.mjs';
import {projectCommonCNL} from './lib/common-cnl.mjs';
import {writeResultMirror} from './lib/result-mirrors.mjs';
import {resumeAction} from './lib/resume-eval.mjs';

const {values:o}=parseArgs({options:{strategy:{type:'string',multiple:true},set:{type:'string',default:'consolidated'},
  tier:{type:'string',default:'small'},'judge-tier':{type:'string',default:'good'},
  model:{type:'string'},'judge-model':{type:'string'},
  'judge-mode':{type:'string',default:'bidirectional'},'batch-size':{type:'string',default:'5'},
  'cnl-view':{type:'string',default:'native'},
  selection:{type:'string'},mirrors:{type:'boolean',default:false},
  'max-tokens':{type:'string',default:'8000'},'judge-max-tokens':{type:'string',default:'6000'},'timeout-ms':{type:'string',default:'180000'},limit:{type:'string'},stage:{type:'string',default:'calibration'},
  concurrency:{type:'string',default:'5'},
  id:{type:'string'},offline:{type:'boolean'},cache:{type:'string',default:'use'},
  'rejudge':{type:'string'},'resume-from':{type:'string'},help:{type:'boolean'}}});
if(o.help){console.log('eval --strategy NAME (repeatable, or all) --stage calibration|development|heldout|full [--limit N] [--tier small] [--judge-tier good] [--judge-mode direct|bidirectional] [--batch-size 5] [--offline] [--rejudge items.jsonl] [--id NAME]');process.exit(0);}
if(!['calibration','development','heldout','full','source'].includes(o.stage)) throw new Error('Unknown experiment stage');
if(!['direct','bidirectional'].includes(o['judge-mode'])) throw new Error('Unknown judge mode');
if(!['native','common'].includes(o['cnl-view'])) throw new Error('Unknown CNL view');
if(!['use','off','record','strict'].includes(o.cache)) throw new Error('Unknown cache mode');
const batchSize=positive(o['batch-size'],'batch-size'),maxTokens=positive(o['max-tokens'],'max-tokens');
const concurrency=positive(o.concurrency,'concurrency');
const judgeMaxTokens=positive(o['judge-max-tokens'],'judge-max-tokens'),timeoutMs=positive(o['timeout-ms'],'timeout-ms');
const names=!o.strategy||o.strategy.includes('all')?listStrategies():o.strategy;
const id=o.id??`${new Date().toISOString().replace(/[:.]/g,'-')}-${o.stage}`;
if(!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Experiment ID must be a simple directory name');
const out=join(ROOT,'docs','experiments',id);
if(existsSync(out)) throw new Error('Experiment already exists; use a new ID to preserve evidence');
const calibrationCats=['negation-scope','conditionals-rules','questions-wh','discourse-coreference','modality-obligation'];
let cases=loadSet(o.set);
const structuredSet=cases.some(x=>x.schema==='nlp-eval/2');
if(o.stage==='source'&&!structuredSet)throw new Error('Source partition mode requires an imported structured corpus');
if(structuredSet&&['development','heldout'].includes(o.stage))cases=cases.filter(x=>x.provenance?.partition===(o.stage==='heldout'?'source-heldout':'development'));
if(cases.some(x=>x.kind==='judge-pair'))throw new Error('This corpus contains paired judge controls; use its good/bad representations, not the formalizer evaluator');
const calibrationIds=calibrationCats.map(c=>cases.find(x=>x.category===c)?.id).filter(Boolean);
if(o.stage==='calibration') cases=structuredSet?cases.slice(0,5):cases.filter(x=>calibrationIds.includes(x.id));
else if(o.stage!=='full'&&!structuredSet) cases=cases.filter(x=>!calibrationIds.includes(x.id) && ((parseInt(digest(x.id).slice(0,8),16)%5===0)===(o.stage==='heldout')));
if(o.stage!=='calibration')cases.sort((a,b)=>digest(a.id).localeCompare(digest(b.id)));
if(o.limit)cases=cases.slice(0,positive(o.limit,'limit'));
if(o.selection) {
  const selection=JSON.parse(readFileSync(resolve(o.selection),'utf8'));
  if(selection.set!==o.set||!Array.isArray(selection.ids)||new Set(selection.ids).size!==selection.ids.length)throw new Error('Invalid evaluation selection');
  const all=new Map(loadSet(o.set).map(row=>[row.id,row]));
  cases=selection.ids.map(id=>{if(!all.has(id))throw new Error(`Missing selected case ${id}`);return all.get(id);});
  if(cases.some(r=>r.kind==='judge-pair'))throw new Error('Cannot formalize paired judge controls');
}
const prior=o.rejudge?readFileSync(resolve(o.rejudge),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r=>({...r,originalStrategy:r.strategy,strategy:resolveStrategy(r.strategy)?.id??r.strategy})).filter(r=>!o.strategy||o.strategy.includes('all')||o.strategy.some(n=>(resolveStrategy(n)?.id??n)===r.strategy)):null;
if(prior) cases=prior.map(r=>({id:r.id,text:r.text,category:r.category})).filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);
if(!cases.length) throw new Error('No cases selected');
const strategies=await Promise.all((prior?[...new Set(prior.map(r=>r.strategy))]:names).map(loadStrategy));
if(strategies.some(s=>s.repair))throw new Error('Repair strategies are preserved but excluded from the first-pass evaluator');
function sourceHashes(dir) {
  const hashes={};
  function visit(d){for(const e of readdirSync(d,{withFileTypes:true})){if(['.git','node_modules','docs','draftStrategies','eval'].includes(e.name))continue;const p=join(d,e.name);if(e.isDirectory())visit(p);else if(/\.(mjs|json|md)$/.test(p))hashes[relative(ROOT,p)]=digest(readFileSync(p,'utf8'));}}
  visit(dir);return hashes;
}
const source={...sourceHashes(ROOT),...sourceHashes(join(ROOT,'..','Ploinky-Worker','lib'))};
const resumed=new Map();let resumeEvidence=null;
if(o['resume-from']){
  if(prior||o.offline)throw new Error('Resume cannot be combined with rejudge or offline');
  const dir=resolve(o['resume-from']),old=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  for(const key of ['model','judge-model','judge-mode','cnl-view','max-tokens','judge-max-tokens'])if(old.options[key]!==o[key])throw new Error(`Resume protocol mismatch: ${key}`);
  if(JSON.stringify(old.cases.map(c=>c.id).sort())!==JSON.stringify(cases.map(c=>c.id).sort()))throw new Error('Resume case selection changed');
  for(const [file,hash] of Object.entries(old.sourceHashes))if((file.startsWith('strategies/')||file.startsWith('tasks/')||file==='tools/lib/judge.mjs')&&source[file]!==hash)throw new Error(`Resume semantic source changed: ${file}`);
  const raw=readFileSync(join(dir,'items.jsonl'),'utf8');
  for(const row of raw.trim().split('\n').filter(Boolean).map(JSON.parse)){
    const key=`${row.strategy}/${row.id}`;if(resumed.has(key))throw new Error('Duplicate resume row');resumed.set(key,row);
  }
  resumeEvidence={directory:dir,itemsSha256:digest(raw),completedRows:resumed.size,policy:'Reuse all semantic/syntax outcomes; retry only infrastructure or judge errors; generate unfinished cases.'};
}
const manifest={id,started:new Date().toISOString(),stage:o.stage,options:o,repairs:0,cases,strategies:strategies.map(s=>s.name),sourceHashes:source,node:process.version,argv:process.argv.slice(2),rejudgeOf:o.rejudge??null};
if(resumeEvidence)manifest.resume=resumeEvidence;
mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');
save('manifest.json',manifest);
const calls=[],results=[],mirrors=[];
const onCall=role=>call=>{const rec={role,...call};calls.push(rec);appendFileSync(join(out,'calls.jsonl'),JSON.stringify(rec)+'\n');};
const onTask=role=>event=>appendFileSync(join(out,'tasks.jsonl'),JSON.stringify({role,...event})+'\n');
const judgeBridge=taskLLM({file:join(ROOT,'tasks',`judge-${o['judge-mode']}.mjs`),tier:o['judge-tier'],model:o['judge-model'],batchSize,maxTokens:judgeMaxTokens,timeoutMs,cache:o.cache,offline:o.offline,onCall:onCall('judge'),onTask:onTask('judge')});
if(!o.offline) {
  try{manifest.proxy=await judgeBridge.client.health();manifest.catalog=await judgeBridge.client.providerModels('openference');save('manifest.json',manifest);}
  catch(e){save('blocked.json',{reason:e.message});throw e;}
}
const judge=makeJudge(judgeBridge.llm,o['judge-mode']);
for(const strategy of strategies) {
  const bridge=taskLLM({file:strategy.taskFile,tier:o.tier,model:o.model,batchSize,maxTokens,timeoutMs,cache:o.cache,offline:o.offline,onCall:onCall(strategy.name),onTask:onTask(strategy.name)});
  const inputs=prior?prior.filter(r=>r.strategy===strategy.name):cases;
  for(let start=0;start<inputs.length;start+=concurrency) {
    const rows=await Promise.all(inputs.slice(start,start+concurrency).map(async item=>{
      const input=sourceForModel(item);
      const previous=resumed.get(`${strategy.name}/${item.id}`),action=resumeAction(previous,input);
      const r=prior?item:action!=='generate'?previous:await formalizeToCNL(strategy,input,{llm:bridge.llm,turns:item.turns,options:{rounds:0}});
      const audit=auditFormalization(strategy,r);
      let commonCNL=null;
      if(r.formalization!=null) {
        try {commonCNL=projectCommonCNL(strategy.name,r.formalization);}
        catch(e) {commonCNL={error:e.message,wholeDocumentJudgeEligible:false};}
      }
      const judgeCNL=o['cnl-view']==='common'?(commonCNL?.wholeDocumentJudgeEligible?commonCNL.cnl:null):r.cnl;
      const verdict=action==='reuse'?previous.verdict:o.offline?{status:'not_judged',equivalent:null,reason:'Offline experiment'}:
        o['cnl-view']==='common'&&!commonCNL?.wholeDocumentJudgeEligible?{status:'not_judged',equivalent:null,reason:'Common projection incomplete or unavailable'}:
        await judge(input,r.ok?judgeCNL:null);
      // An empty but well-formed IR must still face every behavioral probe.
      // Skipping it because its CNL is empty would inflate measured accuracy.
      const referenceEvaluation=r.formalization!=null&&strategy.evaluateReference?strategy.evaluateReference(r.formalization,{tests:item.reference?.behavior??[],gold_ir:item.reference?.formalIR}):null;
      return {...r,id:item.id,category:item.category,tags:item.tags??[],sourceText:item.sourceText??item.text,context:item.context,turns:item.turns,reference:item.reference,provenance:item.provenance,referenceEvaluation,audit,commonCNL,judgmentView:o['cnl-view'],verdict,...(resumeEvidence?{executionProvenance:{action,previousExperiment:previous?resumeEvidence.directory:null}}:{})};
    }));
    for(const r of rows){results.push(r);appendFileSync(join(out,'items.jsonl'),JSON.stringify(r)+'\n');if(o.mirrors){mirrors.push(writeResultMirror(ROOT,id,r));save('mirror-index.json',mirrors);}console.error(`${strategy.name} ${r.id}: valid=${r.ok} eligible=${r.audit.eligible} judge=${r.verdict.status}/${r.verdict.equivalent}`);}
  }
}
const summary={id,stage:o.stage,repairs:0,finished:new Date().toISOString(),strategies:{},calls:{requests:calls.length,uncached:calls.filter(c=>!c.result.cached).length,inputTokens:calls.reduce((n,c)=>n+(c.result.usage?.in??0),0),outputTokens:calls.reduce((n,c)=>n+(c.result.usage?.out??0),0),knownCredits:calls.reduce((n,c)=>n+(c.result.credits??0),0),unknownCreditRequests:calls.filter(c=>c.result.credits==null&&!c.result.cached).length,knownUsd:calls.reduce((n,c)=>n+(c.result.usd??0),0),unknownUsdRequests:calls.filter(c=>c.result.usd==null&&!c.result.cached).length}};
for(const s of strategies){const rs=results.filter(r=>r.strategy===s.name);summary.strategies[s.name]={...summarizeRows(rs),byCategory:breakdown(rs,'category'),byTag:breakdown(rs,'tags')};}
save('summary.json',summary);
writeFileSync(join(out,'report.md'),`# Experiment ${id}\n\nStage: ${o.stage}. Repairs: 0. Calibration is debugging evidence, not a ranking.\n\n| Strategy | Cases | Valid | Reasoning eligible | Judged | Equivalent | Eligible and equivalent | Judge errors |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`+Object.entries(summary.strategies).map(([n,s])=>`| ${n} | ${['n','valid','reasoningEligible','judged','equivalent','eligibleEquivalent','judgeErrors'].map(k=>s[k]).join(' | ')} |`).join('\n')+`\n\nModel requests: ${calls.length}. Known credits: ${summary.calls.knownCredits}; unknown-credit requests: ${summary.calls.unknownCreditRequests}. Missing prices are not zero cost.\n\nPer-category, overlapping-tag and semantic/control behavioral metrics are in summary.json. Empty behavioral annotations have accuracy=null, never an automatic pass.\n\nSee manifest.json for source hashes, case texts, task settings and model catalog; items.jsonl for formalizations, CNL, exports and verdicts; calls.jsonl and tasks.jsonl for execution evidence.\n`);
console.log(JSON.stringify(summary,null,2));
