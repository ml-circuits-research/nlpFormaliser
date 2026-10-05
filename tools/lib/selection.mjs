import {createHash} from 'node:crypto';

const digest=x=>createHash('sha256').update(x).digest('hex');
export const STAGES=['calibration','development','heldout','full','source'];
const CALIBRATION_CATEGORIES=['negation-scope','conditionals-rules','questions-wh','discourse-coreference','modality-obligation'];

/**
 * Calibration (debugging) cases. Structured corpora use the first five
 * formalization records in source order; legacy flat sets use one case from
 * each of five categories. These IDs are excluded from development and heldout.
 */
export function calibrationIds(cases) {
  const structured=cases.some(x=>x.schema==='nlp-eval/2');
  if(structured)return cases.filter(x=>x.kind!=='judge-pair').slice(0,5).map(x=>x.id);
  return CALIBRATION_CATEGORIES.map(c=>cases.find(x=>x.category===c)?.id).filter(Boolean);
}

/** Deterministic stage selection with calibration cases kept out of ranked partitions. */
export function selectStage(all,stage) {
  if(!STAGES.includes(stage))throw new Error('Unknown experiment stage');
  const structured=all.some(x=>x.schema==='nlp-eval/2');
  if(stage==='source'&&!structured)throw new Error('Source partition mode requires an imported structured corpus');
  if(all.some(x=>x.kind==='judge-pair'))throw new Error('This corpus contains paired judge controls; use its good/bad representations, not the formalizer evaluator');
  const calibration=new Set(calibrationIds(all));
  let cases;
  if(stage==='calibration')cases=all.filter(x=>calibration.has(x.id));
  else if(stage==='development'||stage==='heldout') {
    cases=all.filter(x=>!calibration.has(x.id));
    cases=structured
      ?cases.filter(x=>x.provenance?.partition===(stage==='heldout'?'source-heldout':'development'))
      :cases.filter(x=>(parseInt(digest(x.id).slice(0,8),16)%5===0)===(stage==='heldout'));
  } else cases=[...all];
  if(stage!=='calibration')cases.sort((a,b)=>digest(a.id).localeCompare(digest(b.id)));
  return {cases,calibrationIds:[...calibration],structured};
}
