import {createHash} from 'node:crypto';
import {resolveStrategy} from './registry.mjs';

// Only completed, explicit semantic judgments are labels. Valid syntax,
// eligibility, missing judgments and infrastructure failures are not labels.
export function semanticLabel(row) {
  return row.verdict?.status === 'judged' && typeof row.verdict.equivalent === 'boolean'
    ? row.verdict.equivalent : null;
}

export function wilson(successes, total) {
  if (!total) return null;
  const z = 1.959963984540054, p = successes / total, z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const radius = z * Math.sqrt(p * (1 - p) / total + z2 / (4 * total * total)) / (1 + z2 / total);
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

function identity(row) {
  return createHash('sha256').update(JSON.stringify([
    row.sourceText ?? row.text, row.context ?? null, row.turns ?? null,
  ])).digest('hex');
}

export function compareStrategies(rows) {
  const cases = new Map(), strategies = new Set();
  for (const row of rows) {
    if (!row.id || !row.strategy || typeof (row.sourceText ?? row.text) !== 'string') {
      throw new Error('Comparison requires case ID, strategy and source text');
    }
    strategies.add(row.strategy);
    if (!cases.has(row.id)) cases.set(row.id, {identity: identity(row), rows: new Map()});
    const item = cases.get(row.id);
    if (item.identity !== identity(row)) throw new Error(`Different source/context for case ${row.id}`);
    if (item.rows.has(row.strategy)) throw new Error(`Duplicate strategy/case: ${row.strategy}/${row.id}`);
    item.rows.set(row.strategy, row);
  }
  const names = [...strategies].sort();
  function pair(left, right, category = null) {
    const counts = {shared: 0, labeled: 0, unknown: 0, bothCorrect: 0, leftOnly: 0, rightOnly: 0, bothWrong: 0};
    const disagreements = [];
    for (const [id, item] of cases) {
      const a = item.rows.get(left), b = item.rows.get(right);
      if (!a || !b || (category !== null && (a.category??'uncategorised') !== category)) continue;
      if ((a.category??'uncategorised') !== (b.category??'uncategorised')) throw new Error(`Category mismatch for ${id}`);
      counts.shared++;
      const x = semanticLabel(a), y = semanticLabel(b);
      if (x === null || y === null) {counts.unknown++; continue;}
      counts.labeled++;
      counts[x ? (y ? 'bothCorrect' : 'leftOnly') : (y ? 'rightOnly' : 'bothWrong')]++;
      if (x !== y) disagreements.push({id, category: a.category, judgedBetter: x ? left : right});
    }
    const n = counts.labeled;
    const bestSingle = Math.max(counts.bothCorrect + counts.leftOnly, counts.bothCorrect + counts.rightOnly);
    const oracle = counts.bothCorrect + counts.leftOnly + counts.rightOnly;
    return {left, right, ...counts, leftAccuracy: n ? (counts.bothCorrect + counts.leftOnly) / n : null,
      rightAccuracy: n ? (counts.bothCorrect + counts.rightOnly) / n : null,
      oracleAccuracy: n ? oracle / n : null,
      oracleGainOverBestSingle: n ? (oracle - bestSingle) / n : null,
      disagreementRate: n ? (counts.leftOnly + counts.rightOnly) / n : null,
      disagreements};
  }
  const pairs = [];
  for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
    const categories = [...new Set(rows.filter(r => r.strategy === names[a]).map(r => r.category ?? 'uncategorised'))].sort();
    pairs.push({...pair(names[a], names[b]), byCategory: Object.fromEntries(categories.map(c => [c, pair(names[a], names[b], c)]))});
  }
  const competence = Object.fromEntries(names.map(name => {
    const selected = rows.filter(r => r.strategy === name);
    const groups = [...new Set(selected.map(r => r.category ?? 'uncategorised'))].sort();
    return [name, Object.fromEntries(groups.map(category => {
      const group = selected.filter(r => (r.category ?? 'uncategorised') === category);
      const labeled = group.filter(r => semanticLabel(r) !== null);
      const passed = labeled.filter(r => semanticLabel(r)).length;
      return [category, {cases: group.length, labeled: labeled.length, unknown: group.length - labeled.length,
        passed, accuracy: labeled.length ? passed / labeled.length : null, wilson95: wilson(passed, labeled.length)}];
    }))];
  }));
  const duplicateInputs = new Map();
  for (const row of rows) {
    if(!row.ok||!row.cnl)continue;
    const view=row.judgmentView??'native';
    const cnl=view==='common'?row.commonCNL?.cnl:row.cnl;
    if(!cnl)continue;
    const key=createHash('sha256').update(JSON.stringify([identity(row),cnl])).digest('hex');
    if(!duplicateInputs.has(key))duplicateInputs.set(key,[]);
    duplicateInputs.get(key).push({id:row.id,strategy:row.strategy,label:semanticLabel(row)});
  }
  const identicalJudgeInputs=[...duplicateInputs].filter(([,group])=>group.length>1).map(([hash,group])=>({
    hash,rows:group,contradictoryLabels:new Set(group.map(r=>r.label).filter(x=>x!==null)).size>1,
  }));
  return {schema: 'strategy-complementarity/1', cases: cases.size, strategies: names, pairs, competence,
    families:Object.fromEntries(names.map(name=>[name,resolveStrategy(name)?.family??'unknown'])),identicalJudgeInputs,
    limitations: [
      'Labels are model judgments, not independently established semantic truth.',
      'Oracle selects using the evaluation label: it is an optimistic diagnostic, not a deployable selector.',
      'Unknown/unpaired outcomes are reported, not converted into semantic failures or successes.',
      'Intervals assume independent cases; corpus duplicates and correlated judgments weaken that assumption.',
      'Do not learn routing rules on heldout data or treat related strategies as independent votes.',
    ]};
}
