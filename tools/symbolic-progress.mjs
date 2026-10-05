#!/usr/bin/env node
// Offline progress report for a deterministic strategy (default: Discourse Semantic Graph). No model calls.
// Per sentence (turn) it counts the defects that block a purely symbolic representation: unparsed fragments, unresolved references,
// clauses collapsed into a role string (structural residue), symbols longer than 3 words and source echo (4+ consecutive source words in
// one symbol). A turn is "clean" when it has none of them. Partitions are reported separately; tune on development only.
//   node tools/symbolic-progress.mjs [--set consolidated] [--strategy discourse-semantic-graph] [--examples 5] [--json out.json]
import {parseArgs} from 'node:util';
import {writeFileSync} from 'node:fs';
import {loadSet} from './lib/evalset.mjs';
import {loadStrategy,formalizeToCNL} from './lib/strategies.mjs';
import {auditFormalization,sourceEcho} from './lib/audit.mjs';
import {symbolViolations} from './lib/symbols.mjs';
const {values:o}=parseArgs({options:{set:{type:'string',default:'consolidated'},strategy:{type:'string',default:'discourse-semantic-graph'},
  examples:{type:'string',default:'0'},json:{type:'string'},class:{type:'string'}}});
const strategy=await loadStrategy(o.strategy);
const CLASSES=['raw','unresolvedRef','residue','longSymbol','echo'];
const blank=()=>({docs:0,turns:0,clean:0,...Object.fromEntries(CLASSES.map(c=>[c,0])),turnsWith:Object.fromEntries(CLASSES.map(c=>[c,0])),symbols:0,eligibleDocs:0});
const report={},examples=Object.fromEntries(CLASSES.map(c=>[c,[]]));
const walk=(x,fn)=>{if(!x||typeof x!=='object')return;fn(x);for(const v of Object.values(x))if(v&&typeof v==='object')walk(v,fn);};
for(const item of loadSet(o.set)) {
  const r=await formalizeToCNL(strategy,item.text,{turns:item.turns,options:{rounds:0}});
  r.sourceText=item.text;
  const audit=auditFormalization(strategy,r);
  const part=item.provenance?.partition??'unknown';
  for(const key of [part,'all']) {
    const t=report[key]??=blank();
    t.docs++;t.eligibleDocs+=audit.eligible?1:0;
  }
  const turns=r.formalization?.turns??[];
  const symbols=strategy.symbols?strategy.symbols(r.formalization):[];
  const byTurn=new Map();
  for(const s of symbols){const i=Number(s.path.match(/^turns\[(\d+)\]/)?.[1]);if(!byTurn.has(i))byTurn.set(i,[]);byTurn.get(i).push(s);}
  turns.forEach((turn,i)=>{
    const syms=byTurn.get(i)??[];
    const counts={raw:0,unresolvedRef:0,residue:0,longSymbol:symbolViolations(syms).length,echo:sourceEcho(turn.source,syms).hits.length};
    walk(turn.content,n=>{if(n.type==='raw')counts.raw++;if(n.kind==='unresolved_ref')counts.unresolvedRef++;});
    counts.residue=(turn.ambiguities??[]).filter(a=>a.kind==='structural_residue').length;
    for(const key of [part,'all']) {
      const t=report[key];t.turns++;t.symbols+=syms.length;
      for(const c of CLASSES){t[c]+=counts[c];if(counts[c])t.turnsWith[c]++;}
      if(CLASSES.every(c=>!counts[c]))t.clean++;
    }
    if(part!=='development')return;
    for(const c of CLASSES)if(counts[c]&&examples[c].length<Number(o.examples))
      examples[c].push({case:item.id.split('/').slice(-2).join('/'),source:turn.source,
        detail:c==='longSymbol'?symbolViolations(syms).map(v=>v.name):c==='echo'?sourceEcho(turn.source,syms).hits.map(s=>s.name):c==='residue'?turn.ambiguities.filter(a=>a.kind==='structural_residue').map(a=>a.span):undefined});
  });
}
for(const t of Object.values(report))t.cleanRate=Number((t.clean/t.turns).toFixed(4));
const out={strategy:o.strategy,set:o.set,report,...(Number(o.examples)?{examples:o.class?{[o.class]:examples[o.class]}:examples}:{})};
if(o.json)writeFileSync(o.json,JSON.stringify(out,null,2)+'\n');
for(const [part,t] of Object.entries(report))
  console.log(`${part.padEnd(15)} docs ${t.docs}  turns ${t.turns}  clean ${t.clean} (${(100*t.cleanRate).toFixed(1)}%)  `+
    CLASSES.map(c=>`${c} ${t[c]}/${t.turnsWith[c]}t`).join('  ')+`  symbols ${t.symbols}  eligible docs ${t.eligibleDocs}`);
if(Number(o.examples))for(const [c,list] of Object.entries(out.examples)){console.log(`\n== ${c}`);for(const e of list)console.log(`- [${e.case}] ${e.source}${e.detail?`\n    ${JSON.stringify(e.detail)}`:''}`);}
