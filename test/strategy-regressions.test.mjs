// Regression tests for the strategy fixes (review items H1-H4, M1-M8, Low).
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCNL} from '../strategies/lab-shared/src/cnl.mjs';
import {compileFormalModule} from '../strategies/lab-shared/src/compiler.mjs';
import {closure,queryStatus} from '../strategies/lab-shared/src/reasoner.mjs';
import {validateIR} from '../strategies/lab-shared/src/ir.mjs';
import {slug} from '../strategies/lab-shared/src/util.mjs';
import {buildProtoIR} from '../strategies/lab-shared/src/protoir.mjs';
import {HeuristicStrategy} from '../strategies/lab-shared/src/strategies/heuristic.mjs';
import {SemanticRepairer} from '../strategies/lab-shared/src/repairer.mjs';
import {labSymbols} from '../strategies/lab-shared/coverage.mjs';
import {fromWire,toWire} from '../strategies/compact-scope-logic/src/wire.mjs';
import {toCNL as microCNL} from '../strategies/compact-scope-logic/src/cnl.mjs';
import {createPipeline} from '../strategies/compact-scope-logic/src/pipeline.mjs';
import {microSymbols} from '../strategies/compact-scope-logic/src/symbols.mjs';
import {splitSentences,formalizeText,renderTurn} from '../strategies/discourse-semantic-graph/src/formalizer.mjs';
import speech,{SYSTEM as SPEECH_SYSTEM} from '../strategies/speech-act-normalization/index.mjs';

test('H1: Lab judged CNL is structure-derived; glosses and long templates/labels are not rendered',async()=>{
  const ir={facts:[{pred:'owns',args:['ada','gpu']}],rules:[],
    contexts:[{id:'b1',kind:'belief',holder:'bob',gloss:'Bob believes everything the source says'}],
    ambiguities:[{id:'a1',gloss:'the whole original sentence is preserved here',options:['ada','bob']}],
    externals:[{predicate:'sha256',roles:['input','digest'],gloss:'computes a digest of the original text'}],
    symbols:{entities:{ada:{label:'the person who owns everything'}},predicates:{owns:{cnl:'{0} owns {1} and the original meaning is preserved',label:'owns'}}}};
  const cnl=renderCNL(ir);
  for(const leak of ['everything the source','original sentence','digest of the original','person who owns','meaning is preserved'])assert.ok(!cnl.includes(leak),leak);
  assert.match(cnl,/^ada owns gpu\./m);
  assert.match(cnl,/CONTEXT b1 \[belief\] HOLDER bob\./);
  assert.match(cnl,/NOTED AMBIGUITY #1 \(a1\): options ada \| bob\./);
  assert.match(cnl,/EXTERNAL sha256\(input, digest\)\./);
  const mod=await import('data:text/javascript;base64,'+Buffer.from(compileFormalModule(ir)).toString('base64'));
  assert.equal(mod.toCNL(),cnl);
  assert.ok(labSymbols(ir).some(s=>s.kind==='template'&&s.path==='symbols.predicates.owns.cnl'));
});

test('M1: contextual atoms render inside their context and never feed global rules',()=>{
  const ir={facts:[{pred:'person',args:['ada'],context:'c1'},{pred:'person',args:['bob']}],contexts:[{id:'c1',kind:'belief',holder:'eve'}],
    rules:[{head:{pred:'mortal',args:['?x']},body:[{pred:'person',args:['?x']}]}]};
  assert.match(renderCNL(ir),/^Within context c1 \(belief of eve\): ada is person\.$/m);
  const derived=closure(ir).filter(a=>a.pred==='mortal').map(a=>a.args[0]);
  assert.deepEqual(derived,['bob']);
  assert.equal(queryStatus(ir,{pred:'mortal',args:['ada']}),'UNKNOWN');
  const scoped={...ir,rules:[{head:{pred:'mortal',args:['?x'],context:'c1'},body:[{pred:'person',args:['?x'],context:'c1'}]}]};
  assert.ok(closure(scoped).some(a=>a.pred==='mortal'&&a.args[0]==='ada'&&a.context==='c1'));
});

test('M2: contradictions are reported as INCONSISTENT, per context',()=>{
  const ir={facts:[{pred:'open',args:['door']},{pred:'open',args:['door'],neg:true},{pred:'red',args:['door'],context:'c1'}],contexts:[{id:'c1'}],rules:[]};
  assert.equal(queryStatus(ir,{pred:'red',args:['door']}),'INCONSISTENT');
  assert.equal(queryStatus(ir,{pred:'red',args:['door'],context:'c1'}),'TRUE');
  const derived={facts:[{pred:'bird',args:['tweety']},{pred:'flies',args:['tweety'],neg:true}],rules:[{head:{pred:'flies',args:['?x']},body:[{pred:'bird',args:['?x']}]}]};
  assert.equal(queryStatus(derived,{pred:'flies',args:['tweety']}),'INCONSISTENT');
});

test('H4: the deterministic draft refuses questions, conditionals, modals and attitudes and keeps coordination',async()=>{
  const draft=async text=>(await new HeuristicStrategy().formalize(text)).ir;
  for(const text of ['Does Ana own the lab?','Ana owns the lab if Bob agrees.','Ana may own the lab.','Ana believes Bob owns the lab.']) {
    const ir=await draft(text);
    assert.equal(ir.facts.length,0,text);assert.ok(ir.ambiguities.length,text);
    assert.ok(ir.ambiguities.every(a=>/^(?:unsupported|unrepresented|unresolved)_/.test(a.kind)&&Array.isArray(a.span)),text);
  }
  const both=await draft('Ana and Bob own the lab.');
  assert.deepEqual(both.facts.map(f=>f.args),[['ana','lab'],['bob','lab']]);
  const timed=await draft('Ana deleted the file yesterday.');
  assert.deepEqual(timed.facts.map(f=>[f.pred,...f.args]),[['deleted','ana','file']]);
  assert.ok(timed.ambiguities.some(a=>a.kind==='unrepresented_time'));
  const neg=await draft('Bob did not approve the report. He owns the lab.');
  assert.deepEqual(neg.facts.map(f=>[f.pred,f.neg,...f.args]),[['approved',true,'bob','report'],['owns',false,'bob','lab']]);
  const pron=await draft('He owns the lab.');
  assert.equal(pron.facts.length,0);
  const clause=await draft('Alice promised Bob that she would submit the draft.');
  assert.ok(clause.facts.every(f=>f.args.every(a=>a.split('_').length<=3)));
});

test('M5 and Low: ProtoIR negation contractions and per-sentence questions; slugs keep non-Latin names',()=>{
  const p=buildProtoIR("Is Ana here? She can't come. Bob cannot stay, and Eve isn't sure.");
  const neg=p.markers.filter(m=>m.kind==='negation').map(m=>m.value);
  assert.deepEqual(neg,["can't",'cannot',"isn't"]);
  assert.deepEqual(p.markers.filter(m=>m.kind==='question').map(m=>m.sentenceId),['s0']);
  assert.equal(slug('Δημήτρης'),'δημητρης');assert.equal(slug('Łukasz'),'łukasz');
  assert.equal(slug('keepImportantEmails'),'keep_important_emails');
});

test('Low: Lab validateIR checks queries, context references and arity consistency',()=>{
  assert.match(validateIR({facts:[],queries:[{vars:['?y'],where:[{pred:'owns',args:['?x','gpu']}]}]}).errors.join(),/\?y does not occur/);
  assert.match(validateIR({facts:[],queries:[{pred:'owns'}]}).errors.join(),/where must be/);
  assert.match(validateIR({facts:[{pred:'open',args:['door'],context:'c9'}]}).errors.join(),/undeclared context c9/);
  assert.match(validateIR({facts:[{pred:'owns',args:['a','b']},{pred:'owns',args:['a']}]}).errors.join(),/owns\/1/);
  assert.equal(validateIR({facts:[{pred:'open',args:['door'],context:'c1'}],contexts:[{id:'c1',kind:'belief'}],queries:[{vars:['?x'],where:[{pred:'open',args:['?x'],context:'c1'}]}]}).ok,true);
});

test('repair rounds receive deterministic symbol diagnostics',async()=>{
  let prompt='';
  const repairer=new SemanticRepairer({client:{complete:async({user})=>{prompt=user;return '{"facts":[],"rules":[]}';}}});
  await repairer.repair('Keep important emails.',{facts:[{pred:'keep_important_emails_in_inbox',args:['user']}],rules:[]});
  assert.match(prompt,/Symbol violations to fix:\n- symbol longer than 3 words at facts\[0\]\.pred/);
  const calls=[];
  const p=createPipeline({
    formalizer:async()=> '$.keep_important_emails_in_inbox("user")',
    judge:async()=> JSON.stringify({s:1,eq:true,miss:[],add:[],chg:[],amb:[]}),
    repairer:async({user})=>{calls.push(user);return 'E(x,A($.email(x),$.important(x),$.keep_in("user",x,"inbox")))';},maxRepairs:1});
  const r=await p.run('Keep important emails in the inbox.');
  assert.equal(calls.length,1);assert.match(calls[0],/"sym":\["symbol longer than 3 words/);
  assert.equal(r.best.iteration,1);assert.equal(r.accepted,true);
});

test('H3 and Low: MicroIR rejects free variable-like identifiers, nested lists and malformed numbers',()=>{
  assert.throws(()=>fromWire('I($.dog(x),$.barks(x))'),/Unbound variable 'x'.*U\(x/);
  assert.throws(()=>fromWire('$.p(v2)'),/Unbound variable 'v2'/);
  assert.equal(toWire(fromWire('U(x,I($.dog(x),$.barks(x)))')),'U(x,I($.dog(x),$.barks(x)))');
  assert.equal(toWire(fromWire('$.owns(ada,p7)')),'$.owns("ada","p7")');
  assert.throws(()=>fromWire('$.p(["A","x"])'),/top-level document/);
  assert.equal(toWire(fromWire('$.p(1e3)')),'$.p(1000)');
  assert.equal(toWire(fromWire(toWire(fromWire('$.p(1e21)')))),'$.p(1e+21)');
  assert.throws(()=>fromWire('$.p(12abc)'),/Malformed number/);
  assert.throws(()=>fromWire('A(Q($.p("a")),$.q("b"))'),/question operator Q/);
  assert.match(microCNL(fromWire('[$.p("a"),Q($.q("b"))]')),/Question 2: is it the case/);
  assert.match(microCNL(fromWire('$.asks("a",Q($.p("b")))')),/the proposition that is it the case/);
  assert.deepEqual(microSymbols('$.keep_in("user",N($.read("lastImportantEmail")))').map(s=>s.name),['keep_in','user','read','lastImportantEmail']);
});

test('M8: the MicroIR judge parser has strict types',async()=>{
  const run=reply=>createPipeline({formalizer:async()=> '$.p("a")',judge:async()=>reply,maxRepairs:0}).run('x');
  await assert.rejects(run('{"s":1,"eq":"false","miss":[],"add":[],"chg":[],"amb":[]}'),/eq must be a boolean/);
  await assert.rejects(run('{"s":"1","eq":true}'),/score/);
  await assert.rejects(run('{"s":1,"eq":true,"miss":"none"}'),/miss/);
  const ok=await run('{"s":0.5,"eq":false,"miss":["x"],"add":[],"chg":[],"amb":[]}');
  assert.equal(ok.best.audit.equivalent,false);
});

test('M4: discourse splitter, contractions and unresolved fragments',()=>{
  assert.deepEqual(splitSentences('Delete the .tmp files at 9 a.m. tomorrow. The value is 3.5 today. Dr. Smith agreed.'),
    ['Delete the .tmp files at 9 a.m. tomorrow.','The value is 3.5 today.','Dr. Smith agreed.']);
  const turns=formalizeText("Bob doesn't own the server. Ada hasn't approved the report. Ada can't approve it.");
  assert.deepEqual(turns.map(t=>t.content.type),['not','not','modal']);
  assert.equal(turns[2].content.modality,'IMPOSSIBLE');
  const raw=formalizeText('Blorf zibbers quickly beyond the frobnicated wall.');
  const cnl=raw.map(renderTurn).join('\n');
  assert.ok(!/frobnicated/.test(cnl.split('AMBIGUITIES')[0]));
  assert.ok(!/ASK:/.test(cnl));
});

test('Low: speech-act task has no empty INPUT block and states the label rule',()=>{
  assert.ok(!/INPUT:\n\n\n/.test(SPEECH_SYSTEM));
  assert.ok(SPEECH_SYSTEM.trimEnd().endsWith('Return only CNL-Core lines.'));
  assert.deepEqual(speech.symbols('ASSERT: PERSON_1 sent LAST_IMPORTANT_EMAIL_1.').map(s=>s.name),['PERSON_1','LAST_IMPORTANT_EMAIL_1']);
});
