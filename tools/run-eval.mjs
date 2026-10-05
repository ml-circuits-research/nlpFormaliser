#!/usr/bin/env node
import {appendFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {ROOT,loadStrategy,listStrategies,formalizeToCNL} from './lib/strategies.mjs';
import {loadSet,sourceForModel,modelInputFor} from './lib/evalset.mjs';
import {taskLLM,digest} from './lib/pworker.mjs';
import {makeJudge} from './lib/judge.mjs';
import {makeUnitJudge} from './lib/unit-judge.mjs';
import {sourceUnits} from './lib/units.mjs';
import {positive} from './lib/cli.mjs';
import {auditFormalization} from './lib/audit.mjs';
import {resolveStrategy} from './lib/registry.mjs';
import {summarizeRows,breakdown} from './lib/metrics.mjs';
import {projectCommonCNL} from './lib/common-cnl.mjs';
import {writeResultMirror} from './lib/result-mirrors.mjs';
import {resumeAction,checkResumeProtocol} from './lib/resume-eval.mjs';
import {selectStage,calibrationIds,STAGES} from './lib/selection.mjs';
import {judgeIndependence,servedOverlap} from './lib/model-identity.mjs';
import {judgeControls} from './lib/judge-controls.mjs';
import {controlMetrics,controlGate} from './lib/control-gate.mjs';
import {unitReport} from './lib/unit-stats.mjs';
import {temporalAddedContent} from './lib/temporal.mjs';

const {values:o}=parseArgs({options:{strategy:{type:'string',multiple:true},set:{type:'string',default:'consolidated'},
  tier:{type:'string',default:'small'},'judge-tier':{type:'string',default:'good'},
  model:{type:'string'},'judge-model':{type:'string'},'allow-self-judge':{type:'boolean',default:false},
  'judge-mode':{type:'string',default:'bidirectional'},'batch-size':{type:'string',default:'5'},
  // Judge prompts never mix documents by default: batching puts several cases in one prompt.
  'judge-batch-size':{type:'string',default:'1'},
  'unit-judge':{type:'string',default:'on'},
  controls:{type:'boolean',default:false},'control-gate':{type:'string',default:'flag'},
  'control-min-sensitivity':{type:'string',default:'0.8'},'control-min-specificity':{type:'string',default:'0.8'},
  'cnl-view':{type:'string',default:'native'},
  selection:{type:'string'},mirrors:{type:'boolean',default:false},
  'max-tokens':{type:'string',default:'8000'},'judge-max-tokens':{type:'string',default:'6000'},'timeout-ms':{type:'string',default:'180000'},limit:{type:'string'},stage:{type:'string',default:'calibration'},
  concurrency:{type:'string',default:'5'},
  id:{type:'string'},offline:{type:'boolean'},cache:{type:'string',default:'use'},
  'rejudge':{type:'string'},'resume-from':{type:'string'},help:{type:'boolean'}}});
if(o.help){console.log(`eval --strategy NAME (repeatable, or all) --stage calibration|development|heldout|full|source [--selection FILE] [--limit N]
  [--tier small] [--judge-tier good] [--model up/model] [--judge-model up/model] [--allow-self-judge]
  [--judge-mode direct|bidirectional] [--batch-size 5] [--judge-batch-size 1] [--unit-judge on|off]
  [--controls] [--control-gate flag|abort] [--offline] [--rejudge items.jsonl] [--resume-from DIR] [--mirrors] [--id NAME]`);process.exit(0);}
if(!STAGES.includes(o.stage)) throw new Error('Unknown experiment stage');
if(!['direct','bidirectional'].includes(o['judge-mode'])) throw new Error('Unknown judge mode');
if(!['native','common'].includes(o['cnl-view'])) throw new Error('Unknown CNL view');
if(!['use','off','record','strict'].includes(o.cache)) throw new Error('Unknown cache mode');
if(!['on','off'].includes(o['unit-judge'])) throw new Error('--unit-judge must be on or off');
if(!['flag','abort'].includes(o['control-gate'])) throw new Error('--control-gate must be flag or abort');
const batchSize=positive(o['batch-size'],'batch-size'),maxTokens=positive(o['max-tokens'],'max-tokens');
const judgeBatchSize=positive(o['judge-batch-size'],'judge-batch-size');
const concurrency=positive(o.concurrency,'concurrency');
const judgeMaxTokens=positive(o['judge-max-tokens'],'judge-max-tokens'),timeoutMs=positive(o['timeout-ms'],'timeout-ms');
const threshold=(k)=>{const x=Number(o[k]);if(!(x>=0&&x<=1))throw new Error(`${k} must be within [0,1]`);return x;};
const gateOptions={minSensitivity:threshold('control-min-sensitivity'),minSpecificity:threshold('control-min-specificity')};
const unitJudging=o['unit-judge']==='on';

// ---- Case selection ---------------------------------------------------------
// Stage labels describe how cases were chosen: an explicit selection or a
// rejudge is not a development/heldout partition, whatever --stage says.
const stageLabel=o.rejudge?'rejudge':o.selection?'selection':o.stage;
const allCases=loadSet(o.set);
const calibration=calibrationIds(allCases.filter(x=>x.kind!=='judge-pair'));
let cases,warnings=[];
if(o.selection) {
  const selection=JSON.parse(readFileSync(resolve(o.selection),'utf8'));
  if(selection.set!==o.set||!Array.isArray(selection.ids)||new Set(selection.ids).size!==selection.ids.length)throw new Error('Invalid evaluation selection');
  const all=new Map(allCases.map(row=>[row.id,row]));
  cases=selection.ids.map(id=>{if(!all.has(id))throw new Error(`Missing selected case ${id}`);return all.get(id);});
  if(cases.some(r=>r.kind==='judge-pair'))throw new Error('Cannot formalize paired judge controls');
} else cases=selectStage(allCases,o.stage).cases;
if(o.limit)cases=cases.slice(0,positive(o.limit,'limit'));
const calibrationOverlap=o.selection?cases.map(c=>c.id).filter(id=>calibration.includes(id)):[];
if(calibrationOverlap.length)warnings.push(`Selection contains ${calibrationOverlap.length} calibration (debugging) case(s): ${calibrationOverlap.join(', ')}. It is development evidence, not a clean ranking.`);
const prior=o.rejudge?readFileSync(resolve(o.rejudge),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r=>({...r,originalStrategy:r.strategy,strategy:resolveStrategy(r.strategy)?.id??r.strategy})).filter(r=>!o.strategy||o.strategy.includes('all')||o.strategy.some(n=>(resolveStrategy(n)?.id??n)===r.strategy)):null;
if(prior) cases=prior.map(r=>({id:r.id,text:r.sourceText??r.text,category:r.category})).filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);
if(!cases.length) throw new Error('No cases selected');

// ---- Output location: refuse reuse before anything is spent ---------------
const id=o.id??`${new Date().toISOString().replace(/[:.]/g,'-')}-${stageLabel}`;
if(!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Experiment ID must be a simple directory name');
const experiments=join(ROOT,'docs','experiments'),out=join(experiments,id);
if(existsSync(out)) throw new Error('Experiment already exists; use a new ID to preserve evidence');
if(o.mirrors)for(const bucket of ['success','fail'])if(existsSync(join(ROOT,'eval',bucket,id)))throw new Error(`Mirror leftovers exist at eval/${bucket}/${id}; remove them or use a new ID before spending model calls`);

const names=!o.strategy||o.strategy.includes('all')?listStrategies():o.strategy;
const strategies=await Promise.all((prior?[...new Set(prior.map(r=>r.strategy))]:names).map(loadStrategy));
if(strategies.some(s=>s.repair))throw new Error('Repair strategies are preserved but excluded from the first-pass evaluator');
const controlOnly=new Set(strategies.filter(s=>s.controlOnly||resolveStrategy(s.name)?.controlOnly).map(s=>s.name));

// ---- Formalizer/judge independence -----------------------------------------
let formalizerOptions={model:o.model??null,tier:o.tier};
if(prior){
  const priorManifest=join(dirname(resolve(o.rejudge)),'manifest.json');
  if(existsSync(priorManifest)){const m=JSON.parse(readFileSync(priorManifest,'utf8'));formalizerOptions={model:m.options?.model??null,tier:m.options?.tier??null};}
  else {formalizerOptions={model:null,tier:null};warnings.push('Rejudge source has no manifest: formalizer model unknown, self-judging cannot be excluded.');}
}
const independence=judgeIndependence({formalizerModel:formalizerOptions.model,formalizerTier:formalizerOptions.tier,
  judgeModel:o['judge-model']??null,judgeTier:o['judge-tier'],usesFormalizer:strategies.some(s=>s.usesLLM!==false)});
if(!o.offline&&independence.selfJudge&&!o['allow-self-judge'])
  throw new Error(`Judge equals formalizer (${independence.judge.kind} ${independence.judge.id}). Use a different judge, or pass --allow-self-judge for development-only evidence.`);
warnings.push(...independence.warnings);
if(independence.selfJudge)warnings.push('Self-judged run (--allow-self-judge): development evidence only, never a ranking.');
if(!o.offline&&!o.controls&&['development','heldout'].includes(stageLabel))warnings.push('Ranked stage without injected judge controls (--controls): judge sensitivity/specificity unmeasured for this run.');

// ---- Source hashes (this project and Ploinky-Worker) -----------------------
function sourceHashes(dir) {
  const hashes={};
  function visit(d){for(const e of readdirSync(d,{withFileTypes:true})){if(['.git','.claude','node_modules','docs','draftStrategies','eval'].includes(e.name))continue;const p=join(d,e.name);if(e.isDirectory())visit(p);else if(/\.(mjs|json|md)$/.test(p))hashes[relative(ROOT,p)]=digest(readFileSync(p,'utf8'));}}
  if(existsSync(dir))visit(dir);return hashes;
}
const source={...sourceHashes(ROOT),...sourceHashes(join(ROOT,'..','Ploinky-Worker','lib'))};
const resumed=new Map();let resumeEvidence=null;
if(o['resume-from']){
  if(prior)throw new Error('Resume cannot be combined with rejudge');
  const dir=resolve(o['resume-from']),old=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
  const check=checkResumeProtocol(old,o,cases.map(c=>c.id),source);
  for(const w of check.warnings){warnings.push(w);console.error(`WARNING: ${w}`);}
  const raw=readFileSync(join(dir,'items.jsonl'),'utf8');
  for(const row of raw.trim().split('\n').filter(Boolean).map(JSON.parse)){
    const key=`${row.strategy}/${row.id}`;if(resumed.has(key))throw new Error('Duplicate resume row');resumed.set(key,row);
  }
  resumeEvidence={directory:dir,itemsSha256:digest(raw),completedRows:resumed.size,pworkerDifferences:check.pworkerDifferences,
    policy:'Reuse semantic/syntax outcomes; retry budget, infrastructure and judge errors; generate unfinished cases.'};
}

// ---- Create the run directory atomically (EEXIST on a race) ----------------
mkdirSync(experiments,{recursive:true});
mkdirSync(out);
const manifest={id,started:new Date().toISOString(),stage:stageLabel,requestedStage:o.stage,options:o,repairs:0,
  cases,calibrationIds:calibration,calibrationOverlap,strategies:strategies.map(s=>s.name),controlOnly:[...controlOnly],
  formalizer:{...formalizerOptions,usesModel:strategies.some(s=>s.usesLLM!==false)},judge:{model:o['judge-model']??null,tier:o['judge-tier'],mode:o['judge-mode'],batchSize:judgeBatchSize,unitJudge:unitJudging},
  independence,warnings,sourceHashes:source,node:process.version,argv:process.argv.slice(2),rejudgeOf:o.rejudge??null};
if(resumeEvidence)manifest.resume=resumeEvidence;
const save=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');
save('manifest.json',manifest);
const calls=[],results=[],mirrors=[];
const onCall=role=>call=>{const rec={role,...call};calls.push(rec);appendFileSync(join(out,'calls.jsonl'),JSON.stringify(rec)+'\n');};
const onTask=role=>event=>appendFileSync(join(out,'tasks.jsonl'),JSON.stringify({role,...event})+'\n');
const judgeLLM=(role,file)=>taskLLM({file,tier:o['judge-tier'],model:o['judge-model'],batchSize:judgeBatchSize,maxTokens:judgeMaxTokens,timeoutMs,cache:o.cache,offline:o.offline,onCall:onCall(role),onTask:onTask(role)});
const judgeTask=join(ROOT,'tasks',`judge-${o['judge-mode']}.mjs`),unitTask=join(ROOT,'tasks','judge-units.mjs');
const judgeBridge=judgeLLM('judge',judgeTask);
if(!o.offline) {
  try{manifest.proxy=await judgeBridge.client.health();manifest.catalog=await judgeBridge.client.providerModels('openference');save('manifest.json',manifest);}
  catch(e){save('blocked.json',{reason:e.message});throw e;}
}
const judge=makeJudge(judgeBridge.llm,o['judge-mode']);
const unitJudge=makeUnitJudge(judgeLLM('unit-judge',unitTask).llm);

// ---- Injected judge controls (before formalization spending) ---------------
let controls=null;
if(o.controls) {
  const set=judgeControls();
  if(o.offline) controls={status:'not_run',reason:'Offline experiment',n:set.length};
  else {
    const cj=makeJudge(judgeLLM('control-judge',judgeTask).llm,o['judge-mode']);
    const cu=makeUnitJudge(judgeLLM('control-judge',unitTask).llm);
    const rows=[];
    for(let i=0;i<set.length;i+=concurrency) rows.push(...await Promise.all(set.slice(i,i+concurrency).map(async c=>({...c,
      verdict:await cj(c.original,c.cnl),...(unitJudging&&c.units?{unitVerdict:await cu(c.original,c.units,c.cnl)}:{})}))));
    for(const r of rows)appendFileSync(join(out,'controls.jsonl'),JSON.stringify(r)+'\n');
    const metrics=controlMetrics(rows);
    controls={status:'judged',controlsSha256:digest(set),...metrics,gate:controlGate(metrics,gateOptions)};
    save('controls-summary.json',controls);
    console.error(`controls: sensitivity ${metrics.sensitivity.correct}/${metrics.sensitivity.n}, specificity ${metrics.specificity.correct}/${metrics.specificity.n}, gate ${controls.gate.passed?'passed':'FAILED'}`);
    if(!controls.gate.passed&&o['control-gate']==='abort'){save('blocked.json',{reason:'Judge controls failed',gate:controls.gate});throw new Error(`Judge controls failed: ${controls.gate.reasons.join('; ')}`);}
  }
}

// ---- Formalize (or reuse) and judge ---------------------------------------
for(const strategy of strategies) {
  const bridge=taskLLM({file:strategy.taskFile,tier:o.tier,model:o.model,batchSize,maxTokens,timeoutMs,cache:o.cache,offline:o.offline,onCall:onCall(strategy.name),onTask:onTask(strategy.name)});
  const inputs=prior?prior.filter(r=>r.strategy===strategy.name):cases;
  for(let start=0;start<inputs.length;start+=concurrency) {
    const rows=await Promise.all(inputs.slice(start,start+concurrency).map(async item=>{
      // Saved rows carry the exact model input; never encode it a second time.
      const input=prior?modelInputFor(item,{stored:true}):sourceForModel(item);
      const previous=resumed.get(`${strategy.name}/${item.id}`),action=prior?'rejudge':resumeAction(previous,input);
      const r=prior?item:action!=='generate'?previous:await formalizeToCNL(strategy,input,{llm:bridge.llm,turns:item.turns,options:{rounds:0}});
      const audit=auditFormalization(strategy,r);
      let commonCNL=null;
      if(r.formalization!=null) {
        try {commonCNL=projectCommonCNL(strategy.name,r.formalization);}
        catch(e) {commonCNL={error:e.message,wholeDocumentJudgeEligible:false};}
      }
      const commonBlocked=o['cnl-view']==='common'&&!commonCNL?.wholeDocumentJudgeEligible;
      const judgeCNL=o['cnl-view']==='common'?(commonCNL?.wholeDocumentJudgeEligible?commonCNL.cnl:null):r.cnl;
      const verdict=action==='reuse'?previous.verdict:o.offline?{status:'not_judged',equivalent:null,reason:'Offline experiment'}:
        commonBlocked?{status:'not_judged',equivalent:null,reason:'Common projection incomplete or unavailable'}:
        await judge(input,r.ok?judgeCNL:null);
      const units=sourceUnits(prior?{...item,text:item.sourceText??item.text}:item);
      const unitVerdict=!unitJudging?{status:'not_judged',reason:'Unit judge disabled',units:[]}:
        action==='reuse'&&previous?.unitVerdict?.status==='judged'?previous.unitVerdict:
        o.offline?{status:'not_judged',reason:'Offline experiment',units:[]}:
        commonBlocked?{status:'not_judged',reason:'Common projection incomplete or unavailable',units:[]}:
        await unitJudge(input,units,r.ok?judgeCNL:null);
      // An empty but well-formed IR must still face every behavioral probe.
      // Skipping it because its CNL is empty would inflate measured accuracy.
      const referenceEvaluation=r.formalization!=null&&strategy.evaluateReference?strategy.evaluateReference(r.formalization,{tests:item.reference?.behavior??[],gold_ir:item.reference?.formalIR}):null;
      const row={...r,modelInput:input,id:item.id,category:item.category,tags:item.tags??[],sourceText:item.sourceText??item.text,context:item.context,turns:item.turns,reference:item.reference,provenance:item.provenance,referenceEvaluation,audit,commonCNL,judgmentView:o['cnl-view'],verdict,units,unitVerdict,...(resumeEvidence?{executionProvenance:{action,previousExperiment:previous?resumeEvidence.directory:null}}:{})};
      row.addedContent=temporalAddedContent(row);
      return row;
    }));
    for(const r of rows){results.push(r);appendFileSync(join(out,'items.jsonl'),JSON.stringify(r)+'\n');if(o.mirrors){mirrors.push(writeResultMirror(ROOT,id,r));save('mirror-index.json',mirrors);}console.error(`${strategy.name} ${r.id}: valid=${r.ok} eligible=${r.audit.eligible} judge=${r.verdict.status}/${r.verdict.outcome??r.verdict.equivalent} units=${r.unitVerdict.status}`);}
  }
}

// ---- Summary -----------------------------------------------------------------
const summary={id,stage:stageLabel,requestedStage:o.stage,repairs:0,finished:new Date().toISOString(),strategies:{},calls:{requests:calls.length,uncached:calls.filter(c=>!c.result.cached).length,inputTokens:calls.reduce((n,c)=>n+(c.result.usage?.in??0),0),outputTokens:calls.reduce((n,c)=>n+(c.result.usage?.out??0),0),knownCredits:calls.reduce((n,c)=>n+(c.result.credits??0),0),unknownCreditRequests:calls.filter(c=>c.result.credits==null&&!c.result.cached).length,knownUsd:calls.reduce((n,c)=>n+(c.result.usd??0),0),unknownUsdRequests:calls.filter(c=>c.result.usd==null&&!c.result.cached).length,byRole:Object.fromEntries([...new Set(calls.map(c=>c.role))].map(role=>[role,calls.filter(c=>c.role===role).length]))}};
for(const s of strategies){const rs=results.filter(r=>r.strategy===s.name);summary.strategies[s.name]={controlOnly:controlOnly.has(s.name),probeRunner:typeof s.evaluateReference==='function',...summarizeRows(rs),byCategory:breakdown(rs,'category'),byTag:breakdown(rs,'tags')};}
summary.ranking={included:strategies.map(s=>s.name).filter(n=>!controlOnly.has(n)),excludedControls:[...controlOnly],
  note:'Control-only strategies are reported but never ranked or used in oracle/complementarity.'};
summary.units=unitJudging&&!o.offline?unitReport(results,{controlOnly}):null;
summary.probeCoverage=Object.fromEntries(strategies.map(s=>{const b=summary.strategies[s.name].behavioral;
  return [s.name,{probeRunner:typeof s.evaluateReference==='function',casesWithProbes:b.casesWithProbes,annotated:b.annotated,tested:b.tested,coverage:b.coverage}];}));
summary.controls=controls;
summary.independence={...independence,served:servedOverlap(calls)};
if(summary.independence.served.overlap.length)warnings.push(`Judge and formalizer were served by the same model: ${summary.independence.served.overlap.join(', ')}`);
const flags=[];
if(controls?.gate&&!controls.gate.passed)flags.push(`JUDGE CONTROLS FAILED: ${controls.gate.reasons.join('; ')}`);
if(independence.selfJudge||summary.independence.served.overlap.length)flags.push('SELF-JUDGED');
summary.flags=flags;summary.warnings=warnings;
summary.rankingEligible=['development','heldout'].includes(stageLabel)&&!o.offline&&!flags.length&&controls?.gate?.passed===true;
save('summary.json',summary);
const pct=x=>x==null?'—':`${(100*x).toFixed(1)}%`,ci=x=>x?`[${pct(x[0])}, ${pct(x[1])}]`:'n/a';
const docTable=`| Strategy | Cases | Valid | Formalization failures | Budget/infra failures | Reasoning eligible | Judged | Equivalent | Not equivalent | Uncertain | Equivalent with notes | Judge errors | Unanchored dates |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n`+
  Object.entries(summary.strategies).map(([n,s])=>`| ${n}${s.controlOnly?' (control)':''} | ${s.n} | ${s.valid} | ${s.formalizationFailures} | ${s.budgetFailures+s.infrastructureFailures} | ${s.reasoningEligible} | ${s.judged} | ${s.equivalent} | ${s.notEquivalent} | ${s.uncertain} | ${s.equivalentWithNotes} | ${s.judgeErrors} | ${s.unanchoredDateRows} |`).join('\n');
const unitTable=summary.units?`\n\n## Unit-level preservation (primary endpoint)\n\nPrimary: micro mean of preserved units among valid, reasoning-eligible, unit-judged outputs. Eligibility is reported separately; intention-to-treat scores invalid or ineligible outputs as 0. 95% intervals: clustered bootstrap over documents.\n\n| Strategy | Eligible docs / cases | Eligible: micro (95% CI) | Eligible: macro | Intention-to-treat: micro (95% CI) | Unit judge errors |\n|---|---:|---:|---:|---:|---:|\n`+
  Object.entries(summary.units.strategies).map(([n,s])=>`| ${n}${s.controlOnly?' (control, not ranked)':''} | ${s.eligibility.eligible} / ${s.cases} | ${pct(s.eligible.microMean)} ${ci(s.eligible.microCI95)} | ${pct(s.eligible.macroMean)} | ${pct(s['intention-to-treat'].microMean)} ${ci(s['intention-to-treat'].microCI95)} | ${s.unitJudgeErrors} |`).join('\n')+
  (summary.units.pairs.length?`\n\nPaired comparisons (intention-to-treat, shared units): see summary.json \`units.pairs\` for differences, paired bootstrap intervals and sign tests.`:''):'';
const controlText=controls?.status==='judged'?`\n\n## Injected judge controls\n\nSensitivity (negative controls rejected): ${controls.sensitivity.correct}/${controls.sensitivity.n}. Specificity (positive controls accepted): ${controls.specificity.correct}/${controls.specificity.n}. Unit-level: sensitivity ${controls.unitLevel.tp}/${controls.unitLevel.tp+controls.unitLevel.fn}, specificity ${controls.unitLevel.tn}/${controls.unitLevel.tn+controls.unitLevel.fp}. Gate: **${controls.gate.passed?'passed':'FAILED'}**${controls.gate.reasons.length?` (${controls.gate.reasons.join('; ')})`:''}.`:controls?`\n\nJudge controls: ${controls.reason}.`:'\n\nJudge controls were not injected; judge sensitivity/specificity is unmeasured in this run.';
writeFileSync(join(out,'report.md'),`# Experiment ${id}\n\nStage: ${stageLabel}${stageLabel!==o.stage?` (requested --stage ${o.stage} ignored by ${stageLabel})`:''}. Repairs: 0. Ranking-eligible: ${summary.rankingEligible?'yes':'no'}. Calibration is debugging evidence, not a ranking.\n${flags.map(f=>`\n> **${f}**`).join('')}${warnings.length?`\n\nWarnings:\n${warnings.map(w=>`- ${w}`).join('\n')}`:''}\n\n## Whole-document outcomes (secondary)\n\nValidity, reasoning eligibility and equivalence are separate criteria. Budget/infrastructure failures are not semantic failures.\n\n${docTable}${unitTable}${controlText}\n\nModel requests: ${calls.length}. Known credits: ${summary.calls.knownCredits}; unknown-credit requests: ${summary.calls.unknownCreditRequests}. Missing prices are not zero cost.\n\nPer-category, overlapping-tag and semantic/control behavioral metrics and probe coverage are in summary.json. Empty behavioral annotations have accuracy=null, never an automatic pass.\n\nSee manifest.json for source hashes, case texts, task settings and model catalog; items.jsonl for formalizations, CNL, exports and verdicts; calls.jsonl and tasks.jsonl for execution evidence.\n`);
console.log(JSON.stringify({id,stage:stageLabel,flags,warnings,strategies:Object.fromEntries(Object.entries(summary.strategies).map(([n,s])=>[n,{n:s.n,valid:s.valid,eligible:s.reasoningEligible,equivalent:s.equivalent}]))},null,2));
