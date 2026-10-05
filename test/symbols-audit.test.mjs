import test from 'node:test';
import assert from 'node:assert/strict';
import {symbolWords,symbolViolations,MAX_SYMBOL_WORDS} from '../tools/lib/symbols.mjs';
import {auditFormalization,sourceEcho} from '../tools/lib/audit.mjs';
import {strategyTaskTemplates,syncTaskTemplates} from '../tools/lib/task-templates.mjs';
import {loadStrategy} from '../tools/lib/strategies.mjs';

test('symbol words split on underscores, hyphens, spaces, digits and camelCase',()=>{
  assert.equal(MAX_SYMBOL_WORDS,3);
  assert.deepEqual(symbolWords('ignoreLastMessage'),['ignore','Last','Message']);
  assert.equal(symbolWords('keepImportantEmailsInInbox').length,5);
  assert.equal(symbolWords('keep_important_emails_in_inbox').length,5);
  assert.equal(symbolWords('state-of-the-art').length,4);
  assert.equal(symbolWords('HTTPServerError').length,3);
  assert.equal(symbolWords('paper7').length,2);
  assert.equal(symbolWords('"Ada Lovelace"',{proper:true}).length,2);
  assert.equal(symbolWords('McDonald',{proper:true}).length,1);
  const v=symbolViolations([{path:'p',name:'keepImportantEmailsInInbox'},{path:'q',name:'ignoreLastMessage'},{path:'t',name:'{0} is kept in {1} forever and ever',kind:'template'}]);
  assert.deepEqual(v.map(x=>x.path),['p','t']);
});

const lab=await loadStrategy('direct-context-logic');
const row=(formalization,text,extra={})=>({ok:true,text,formalization,cnl:lab.toCNL(formalization),reasoning:lab.toReasoning(formalization),extra:{metadataAudit:{complete:true}},...extra});

test('audit: symbol-length violations make a row ineligible, in their own category',()=>{
  const ir={facts:[{pred:'keepImportantEmailsInInbox',args:['user']}],rules:[]};
  const a=auditFormalization(lab,row(ir,'Keep important emails in the inbox.'));
  assert.equal(a.eligible,false);
  assert.match(a.categories.symbolLength[0],/^symbol longer than 3 words at facts\[0\]\.pred: keep_important_emails_in_inbox/);
  assert.equal(a.eligibility.symbolLength,false);assert.equal(a.eligibility.coverage,true);
  const ok=auditFormalization(lab,row({facts:[{pred:'keep_in',args:['email','inbox']},{pred:'important',args:['email']}],rules:[]},'Keep important emails in the inbox.'));
  assert.deepEqual(ok.issues,[]);assert.equal(ok.eligible,true);
});

test('audit: source echo of four consecutive words is reported with an echo ratio',()=>{
  const text='Ada said that the server crashed after the update.';
  const ir={facts:[{pred:'said',args:['ada','server_crashed_after']}],symbols:{entities:{},predicates:{said:{cnl:'{0} said that the server crashed {1}'}}},rules:[]};
  const a=auditFormalization(lab,row(ir,text));
  assert.ok(a.categories.echo.some(m=>/symbols\.predicates\.said\.cnl/.test(m)));
  assert.ok(a.metrics.echoRatio>0.3);
  assert.equal(sourceEcho(text,[{name:'server_crashed'}]).hits.length,0);
});

test('audit: long explanatory fields are allowed when they are not rendered into the judged CNL',()=>{
  const text='Ada thinks the door is open, or perhaps the window.';
  const ir={facts:[{pred:'open',args:['door'],context:'b1'}],rules:[],contexts:[{id:'b1',kind:'belief',holder:'ada',gloss:'Ada thinks the door is open'}],
    ambiguities:[{id:'a1',options:['door','window'],description:'it is unclear whether the door or perhaps the window is meant'}]};
  const a=auditFormalization(lab,row(ir,text));
  assert.deepEqual(a.categories.symbolLength,[]);assert.deepEqual(a.categories.echo,[]);
  assert.ok(!a.issues.some(i=>/opaque/.test(i)));
  // The same gloss rendered into CNL is flagged.
  const leaked=auditFormalization(lab,row(ir,text,{cnl:'CONTEXT b1: Ada thinks the door is open.'}));
  assert.ok(leaked.categories.echo.some(m=>/explanatory field rendered/.test(m)));
});

test('audit: unresolved fragments, control-only strategies and coverage gaps are separate categories',async()=>{
  const discourse=await loadStrategy('discourse-semantic-graph');
  const r=await discourse.formalize('Blorf the zibber quickly.');
  const a=auditFormalization(discourse,{ok:true,text:'Blorf the zibber quickly.',formalization:r.formalization,cnl:discourse.toCNL(r.formalization),reasoning:discourse.toReasoning(r.formalization),extra:{}});
  assert.ok(a.categories.unresolved.length||a.categories.coverage.length);
  assert.ok(a.categories.coverage.length);
  const control=auditFormalization({controlOnly:true},{ok:true,text:'Ada likes tea.',formalization:'ASSERT: Ada likes tea.'});
  assert.equal(control.eligibility.controlOnly,false);assert.equal(control.eligible,false);
});

test('every strategy task template is current and states the 3-word symbol rule with examples',async()=>{
  assert.deepEqual(await syncTaskTemplates({write:false}),[]);
  for(const {file,template} of await strategyTaskTemplates()) {
    if(/judge-task/.test(file))continue;
    assert.match(template,/at most 3 (?:words|tokens)/,file);
    assert.match(template,/camelCase/,file);
    assert.match(template,/[Dd]ecompose/,file);
    assert.match(template,/Good:|Bad:|OBJECT_1 is fine|keep_important_emails_in_inbox/,file);
  }
});
