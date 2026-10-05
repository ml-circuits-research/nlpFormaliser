#!/usr/bin/env node
// Re-record the intentional divergences between the archive code (provenance,
// strategies/_archive) and the active strategies. Run deliberately after a
// reviewed behaviour change: `node test/fixtures/record-divergences.mjs`.
// The parity tests compare unchanged cases against the archive and changed
// cases against these recorded fixtures. Document each divergence class in
// docs/restoration-audit.md.
import {writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {loadSet} from '../../tools/lib/evalset.mjs';
import {loadStrategy} from '../../tools/lib/strategies.mjs';
import {HeuristicStrategy as OriginalHeuristic} from '../../strategies/_archive/lab/src/strategies/heuristic.mjs';
import {renderCNL as originalCNL} from '../../strategies/_archive/lab/src/cnl.mjs';
import {formalizeConversation,renderTurn} from '../../strategies/_archive/discourse/src/formalizer.mjs';

const here=new URL('./',import.meta.url);

export async function labDivergences() {
  const adapted=await loadStrategy('deterministic-rule-draft');
  const out={};
  for(const sample of [...loadSet('archive-lab-development'),...loadSet('archive-lab-heldout')]) {
    const expected=await new OriginalHeuristic().formalize(sample.text);
    const actual=await adapted.formalize(sample.text);
    const cnl=adapted.toCNL(actual.formalization);
    const differs=[];
    if(!isDeepStrictEqual(actual.formalization,expected.ir))differs.push('ir');
    if(!isDeepStrictEqual(actual.proto,expected.proto))differs.push('proto');
    if(cnl!==originalCNL(expected.ir))differs.push('cnl');
    if(differs.length)out[sample.id]={differs,ir:actual.formalization,cnl};
  }
  return out;
}

export async function discourseDivergences() {
  const [sample]=loadSet('archive-discourse-dialogue');
  const strategy=await loadStrategy('discourse-semantic-graph');
  const r=await strategy.formalize(sample.text,{turns:sample.turns});
  const expected=formalizeConversation(sample.turns);
  const turns={};
  r.formalization.turns.forEach((t,i)=>{
    const e=expected.turns[i];
    const {cnl:_a,...ta}=t,{cnl:_b,...tb}=e;
    if(!isDeepStrictEqual(ta,tb))turns[t.id]={content:t.content,ambiguities:t.ambiguities,confidence:t.confidence};
  });
  return {changedTurns:turns,stateEqual:isDeepStrictEqual(r.formalization.state,expected.state),cnl:strategy.toCNL(r.formalization),
    archiveCnlEqual:strategy.toCNL(r.formalization)===expected.turns.map(renderTurn).join('\n\n')};
}

if(import.meta.url===`file://${process.argv[1]}`) {
  const lab=await labDivergences();
  writeFileSync(new URL('lab-divergences.json',here),JSON.stringify({note:'Recorded active outputs for archive lab cases whose deterministic draft intentionally diverges from strategies/_archive (see docs/restoration-audit.md).',cases:lab},null,1)+'\n');
  const discourse=await discourseDivergences();
  writeFileSync(new URL('discourse-divergences.json',here),JSON.stringify({note:'Recorded active outputs for the 30-turn archive dialogue where the discourse parser intentionally diverges (see docs/restoration-audit.md).',...discourse},null,1)+'\n');
  console.log(`lab: ${Object.keys(lab).length} divergent cases; discourse: ${Object.keys(discourse.changedTurns).length} changed turns`);
}
