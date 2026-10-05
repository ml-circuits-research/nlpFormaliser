#!/usr/bin/env node
// Emit a reviewable apply_patch input. Do not modify source examples in place.
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
import {createHash} from 'node:crypto';
import {loadSet} from './lib/evalset.mjs';
import {ROOT} from './lib/strategies.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const sources = ['base','archive-lab-development','archive-lab-heldout','archive-scope-semantics',
  'archive-speech-acts','archive-speech-sample','archive-discourse-dialogue','archive-scope-corruptions'];
const loaded = Object.fromEntries(sources.map(set => [set, loadSet(set).map(row=>({...row,sourceSet:set}))]));
const additions = [
  ['I am frustrated by how many unrelated details I have to keep track of.', 'Which of these requests can be handled now, and which need clarification?', 'List the unresolved questions before taking any action.'],
  ['I am worried that an important restriction will get lost in this discussion.', 'What information is still missing before we can decide what to do?', 'Keep the separate requests separate and do not invent links between them.'],
  ['I feel overwhelmed, although I appreciate the help.', 'Which claims are certain, and which are merely possibilities or reported beliefs?', 'Explain the uncertainties without silently choosing one interpretation.'],
  ['I am relieved that we are finally making progress, but I am still impatient.', 'What should be checked first, and why?', 'Give me a short ordered checklist and leave unrelated tasks independent.'],
  ['I am annoyed about the delay, not about the person helping me.', 'Can you identify any conflicting requirements in these notes?', 'Point out contradictions rather than resolving them without asking me.'],
];
const preamble = 'These notes concern separate situations unless I explicitly connect them.';
const groups=[];
function divide(rows, count) {
  let offset=0;
  return Array.from({length:count},(_,i)=>{
    const size=Math.floor(rows.length/count)+(i<rows.length%count?1:0);
    const chunk=rows.slice(offset,offset+size);offset+=size;return chunk;
  });
}
function addGroups(name,rows,count,partition='development') {
  for(const [i,items] of divide(rows,count).entries()) {
    const extra=additions[groups.length%additions.length];
    const dialogue=items.length===1&&items[0].turns;
    const paragraphs=[...(dialogue?[]:[preamble]),...items.map(r=>r.text),...extra];
    const text=paragraphs.join('\n\n');
    const sentenceCount=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].filter(s=>s.segment.trim()).length;
    if(sentenceCount<10)throw new Error(`Too short: ${name}/${i}`);
    const slug=`${name}/${String(i+1).padStart(2,'0')}-mixed-discussion`;
    const turns=dialogue?[...items[0].turns,...extra.map((text,j)=>({id:`added-${j+1}`,speaker:'user',text}))]:undefined;
    groups.push({schema:'nlp-eval/2',id:`consolidated/${slug}`,kind:turns?'conversation':'formalization',
      text,category:name,tags:[...new Set([...items.flatMap(r=>r.tags??[]),'mixed-speech-acts','question','instruction','emotion'])],
      ...(turns?{turns}:{}),
      provenance:{partition,construction:'Deterministic concatenation of preserved source texts with explicitly recorded additions',
        trust:'Synthetic mixed-topic development material; not a natural conversation or certified gold',textSha256:hash(text)},
      construction:{sentenceCount,addedSentences:extra,preamble:dialogue?null:preamble,
        sources:items.map(r=>({id:r.id,set:r.sourceSet,file:relative(ROOT,r.file),archivedFile:`docs/evaluation/atomic/${relative(ROOT,r.file).slice(5)}`,textSha256:hash(r.text)}))},
      // Atomic answers are retained in the archive, never merged into global
      // gold: concatenation may alter context, reference and consistency.
      reference:{},
    });
  }
}
addGroups('base',loaded.base,14);
addGroups('lab-development',loaded['archive-lab-development'],3);
addGroups('lab-heldout',loaded['archive-lab-heldout'],3,'source-heldout');
addGroups('scope',loaded['archive-scope-semantics'],3);
addGroups('speech-acts',[...loaded['archive-speech-acts'],...loaded['archive-speech-sample']],5);
addGroups('dialogue',loaded['archive-discourse-dialogue'],1);
const selected=[...groups.filter(g=>g.category==='base').filter((_,i)=>[0,3,6,9,13].includes(i)),
  ...groups.filter(g=>g.category==='lab-development').slice(0,2),
  ...['scope','speech-acts','dialogue'].map(c=>groups.find(g=>g.category===c))];
let patch='*** Begin Patch\n';
function add(path,text) {patch+=`*** Add File: ${ROOT}/${path}\n`+text.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';}
for(const group of groups)add(`eval/${group.id}.txt`,group.text+'\n');
add('docs/evaluation/metadata/consolidated.jsonl',groups.map(g=>JSON.stringify(g)).join('\n')+'\n');
add('docs/evaluation/selections/consolidated-first10.json',JSON.stringify({schema:'eval-selection/1',set:'consolidated',ids:selected.map(g=>g.id),
  rationale:'Five base mixtures, two Lab development mixtures, one scoped mixture, one speech-act mixture and the connected dialogue. No Lab heldout examples.'},null,2)+'\n');
add('docs/evaluation/consolidation.json',JSON.stringify({schema:'corpus-consolidation/1',cases:groups.length,
  preservedAtomicRecords:Object.values(loaded).flat().length,formalizationSources:groups.flatMap(g=>g.construction.sources).length,
  excludedJudgePairs:loaded['archive-scope-corruptions'].map(r=>r.id),groups:groups.map(({id,construction,provenance})=>({id,...construction,partition:provenance.partition}))},null,2)+'\n');
for(const row of Object.values(loaded).flat()) {
  const from=relative(ROOT,row.file),to=`docs/evaluation/atomic/${from.slice(5)}`;
  const first=readFileSync(row.file,'utf8').split('\n')[0];
  patch+=`*** Update File: ${ROOT}/${from}\n*** Move to: ${ROOT}/${to}\n@@\n-${first}\n+${first}\n`;
}
patch+='*** End Patch\n';
// Chunk large generated additions so apply_patch can be driven without losing
// data to tool-output limits. All parts must be generated before source moves.
const operations=patch.slice('*** Begin Patch\n'.length,-'*** End Patch\n'.length).split(/(?=\*\*\* (?:Add|Update) File: )/).filter(Boolean);
const parts=[];
for(const operation of operations) {
  if(!operation.startsWith('*** Add File: ')||operation.length<12000){parts.push(`*** Begin Patch\n${operation}*** End Patch\n`);continue;}
  const lines=operation.trimEnd().split('\n'),header=lines.shift();
  let previous=null;
  while(lines.length){let size=0,chunk=[];while(lines.length&&(size<9000||!chunk.length)){const line=lines.shift();chunk.push(line);size+=line.length;}
    const body=previous===null?`${header}\n${chunk.join('\n')}\n`:
      `${header.replace('*** Add File: ','*** Update File: ')}\n@@\n ${previous.slice(1)}\n${chunk.join('\n')}\n*** End of File\n`;
    parts.push(`*** Begin Patch\n${body}*** End Patch\n`);previous=chunk.at(-1);
  }
}
if(process.argv[2]==='--count')process.stdout.write(String(parts.length));
else if(process.argv[2]==='--part')process.stdout.write(parts[Number(process.argv[3])]??'');
else process.stdout.write(patch);
