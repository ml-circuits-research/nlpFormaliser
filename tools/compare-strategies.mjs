#!/usr/bin/env node
import {readFileSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {compareStrategies} from './lib/complementarity.mjs';

const {values} = parseArgs({options: {experiment: {type: 'string', multiple: true}, out: {type: 'string'}}});
if (!values.experiment?.length || !values.out) throw new Error('Use --experiment DIR (repeatable) --out NEW_DIR');
const inputs = values.experiment.map(resolvePath => {
  const dir = resolve(resolvePath);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  if (!existsSync(join(dir, 'summary.json'))) throw new Error(`Unfinished experiment: ${dir}`);
  const raw = readFileSync(join(dir, 'items.jsonl'), 'utf8');
  return {dir, manifest, sha256: createHash('sha256').update(raw).digest('hex'), rows: raw.trim().split('\n').filter(Boolean).map(JSON.parse)};
});
const signature = m => JSON.stringify([m.stage, m.repairs, m.options?.['judge-tier'], m.options?.['judge-mode'], m.options?.['cnl-view']??'native', m.sourceHashes?.['tools/lib/judge.mjs']]);
if (inputs.some(i => signature(i.manifest) !== signature(inputs[0].manifest))) throw new Error('Mixed stage/repair/judge protocols require separate comparisons');
const report = compareStrategies(inputs.flatMap(i => i.rows));
report.inputs = inputs.map(({dir, manifest, sha256}) => ({dir, id: manifest.id, stage: manifest.stage, itemsSha256: sha256}));
const out = resolve(values.out);
if (existsSync(out)) throw new Error('Output exists; comparisons are immutable');
mkdirSync(out, {recursive: true});
writeFileSync(join(out, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
const pct = x => x === null ? 'unmeasured' : `${(100*x).toFixed(1)}%`;
writeFileSync(join(out, 'report.md'), '# Matched strategy complementarity\n\nDiagnostic based on judge labels; not a validated ensemble.\n\n' +
  '| Left | Right | Shared / labeled | Left only | Right only | Both wrong | Oracle gain |\n|---|---|---:|---:|---:|---:|---:|\n' +
  report.pairs.map(p => `| ${p.left} | ${p.right} | ${p.shared} / ${p.labeled} | ${p.leftOnly} | ${p.rightOnly} | ${p.bothWrong} | ${pct(p.oracleGainOverBestSingle)} |`).join('\n') +
  '\n\n' + report.limitations.map(s => `- ${s}`).join('\n') + '\n');
console.log(JSON.stringify({out, cases: report.cases, pairs: report.pairs.length}));
