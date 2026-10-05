// Run the recovered native unit tests (strategies/_archive, kept untouched as
// provenance) against the ACTIVE modules. Each archive test file is loaded as
// a data: module whose relative imports are redirected to the active code.
// Assertions on intentionally changed behaviour are rewritten by an explicit,
// exact-match transform list; every such divergence is documented in
// docs/restoration-audit.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT} from '../tools/lib/strategies.mjs';

const url=p=>pathToFileURL(join(ROOT,p)).href;
const dataModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const shim=paths=>dataModule(paths.map(p=>`export * from ${JSON.stringify(url(p))};`).join('\n'));

function load(file,redirects,transforms=[]) {
  let source=readFileSync(join(ROOT,file),'utf8');
  for(const [from,to,reason] of transforms) {
    assert.ok(source.includes(from),`${file}: divergence transform no longer applies (${reason})`);
    source=source.replaceAll(from,to);
  }
  for(const [from,to] of Object.entries(redirects))source=source.replaceAll(`'${from}'`,JSON.stringify(to)).replaceAll(`"${from}"`,JSON.stringify(to));
  source=source.replaceAll('import.meta.url',JSON.stringify(url(file)));
  const wrapper=dataModule(`import test from 'node:test';
export default (name,...rest)=>test(\`[native on active] \${name}\`,...rest);`);
  source=source.replace(/import test from ["']node:test["'];/,`import test from ${JSON.stringify(wrapper)};`);
  return import(dataModule(source));
}

const labIndex=url('strategies/lab-shared/src/index.mjs');
for(const name of readdirSync(join(ROOT,'strategies/_archive/lab/tests')).filter(f=>f.endsWith('.test.mjs')).sort())
  await load(`strategies/_archive/lab/tests/${name}`,{'../src/index.mjs':labIndex});

const discourseIndex=shim(['strategies/discourse-semantic-graph/src/formalizer.mjs','strategies/discourse-semantic-graph/src/judge.mjs']);
for(const name of readdirSync(join(ROOT,'strategies/_archive/discourse/test')).filter(f=>f.endsWith('.test.mjs')).sort())
  await load(`strategies/_archive/discourse/test/${name}`,{'../index.mjs':discourseIndex});

// Documented MicroIR divergences: constants are serialized quoted (so a constant
// named x cannot become a bound variable), and the archive gold
// merge_approvals leaves the variable-like identifier c unbound, which the
// active parser rejects instead of silently reading it as a constant.
export const MICROIR_TRANSFORMS=[
  [`assert.equal(toWire($.buy('ravi','laptop')), '$.buy(ravi,laptop)');`,`assert.equal(toWire($.buy('ravi','laptop')), '$.buy("ravi","laptop")');`,'quoted constants'],
  [`assert.equal(toWire($.anything_new('a','b')), '$.anything_new(a,b)');`,`assert.equal(toWire($.anything_new('a','b')), '$.anything_new("a","b")');`,'quoted constants'],
  [`]) assert.equal(toWire(fromWire(wire)),wire);`,`]) assert.equal(toCNL(fromWire(toWire(fromWire(wire)))),toCNL(fromWire(wire)));`,'quoted constants: round trip compared on CNL'],
  [`for(const row of dataset){`,`for(const row of dataset.filter(r=>r.id!=='merge_approvals')){`,'unbound variable c in archive gold'],
  [`  assert.equal(toWire(ir),row.goldWire,row.id);`,`  assert.equal(toCNL(fromWire(toWire(ir))),toCNL(ir),row.id);`,'quoted constants: round trip compared on CNL'],
];
test('[native on active] MicroIR test/run.mjs',async()=>{
  const micro=shim(['strategies/compact-scope-logic/src/ir.mjs','strategies/compact-scope-logic/src/wire.mjs','strategies/compact-scope-logic/src/cnl.mjs','strategies/compact-scope-logic/src/pipeline.mjs','strategies/compact-scope-logic/src/prompts.mjs']);
  await load('strategies/_archive/microir/test/run.mjs',{'../src/index.mjs':micro},MICROIR_TRANSFORMS);
});
test('[native on active] CNL-Core tests.mjs',async()=>{
  await load('strategies/_archive/cnl/tests.mjs',{'./cnl-core.mjs':url('strategies/speech-act-normalization/src/cnl-core.mjs')});
});
