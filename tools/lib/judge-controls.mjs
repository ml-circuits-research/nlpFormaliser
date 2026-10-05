import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {toCNL} from '../../strategies/compact-scope-logic/src/cnl.mjs';
import {fromWire,toWire} from '../../strategies/compact-scope-logic/src/wire.mjs';
import {ROOT} from './strategies.mjs';
import {loadSet} from './evalset.mjs';

export const CONTROL_DOCUMENT=join(ROOT,'docs','evaluation','controls','judge-control-document.json');

/** Dedicated control document: outside every corpus, partition and selection. */
export function loadControlDocument(file=CONTROL_DOCUMENT) {
  const doc=JSON.parse(readFileSync(file,'utf8'));
  if(doc.schema!=='judge-control-document/1'||!Array.isArray(doc.units)||!doc.units.length)throw new Error('Invalid judge control document');
  return {...doc,text:doc.units.map(u=>u.text).join(' ')};
}

// ---- Deterministic corruptions of a scoped-logic formula -------------------
// Each returns a new formula, or null when the operator is absent. They act on
// the first applicable node, so every corruption changes exactly one unit.
const isFormula=x=>Array.isArray(x);
function rewriteFirst(f,rule) {
  const direct=rule(f);
  if(direct)return direct;
  if(!isFormula(f))return null;
  for(let i=1;i<f.length;i++) {
    const child=rewriteFirst(f[i],rule);
    if(child)return [...f.slice(0,i),child,...f.slice(i+1)];
  }
  return null;
}
export const CORRUPTIONS={
  'argument-swap':{mechanism:'Swap agent and recipient constants of a three-place relation',
    rule:f=>isFormula(f)&&f[0]==='$'&&f.length>=5&&typeof f[2]==='string'&&typeof f.at(-1)==='string'?['$',f[1],f.at(-1),...f.slice(3,-1),f[2]]:null},
  'negation-scope-move':{mechanism:'Move negation from an attitude into its complement ("not want to X" -> "want not to X")',
    rule:f=>isFormula(f)&&f[0]==='N'&&isFormula(f[1])&&f[1][0]==='$'&&isFormula(f[1].at(-1))?[...f[1].slice(0,-1),['N',f[1].at(-1)]]:null},
  'quantifier-drop':{mechanism:'Drop universal force: every R is B -> some R is B',
    rule:f=>isFormula(f)&&f[0]==='U'&&isFormula(f[2])&&f[2][0]==='I'?['E',f[1],['A',f[2][1],f[2][2]]]:null},
  'request-as-assertion':{mechanism:'Replace a request with an assertion that the requested action happens',
    rule:f=>isFormula(f)&&f[0]==='$'&&f[1]==='request'&&isFormula(f.at(-1))?f.at(-1):null},
  'attribution-as-fact':{mechanism:'Remove belief attribution and assert its complement as fact',
    rule:f=>isFormula(f)&&f[0]==='$'&&['believe','believes','think','thinks'].includes(f[1])&&isFormula(f.at(-1))?f.at(-1):null},
};
export function corruptFormula(formula,name) {
  const c=CORRUPTIONS[name];if(!c)throw new Error(`Unknown corruption ${name}`);
  return rewriteFirst(formula,c.rule);
}
const renderUnits=formulas=>toCNL(fromWire(`[${formulas.map(f=>toWire(f)).join(',')}]`));

/** Long native-CNL controls of both polarities, with per-unit expectations. */
export function nativeCNLControls(doc=loadControlDocument()) {
  const formulas=doc.units.map(u=>fromWire(u.wire));
  const units=doc.units.map(({id,text})=>({id,text}));
  const allTrue=Object.fromEntries(units.map(u=>[u.id,true]));
  const out=[{id:'long-cnl-gold',original:doc.text,cnl:renderUnits(formulas),expected:true,units,unitExpected:allTrue,
    family:'long-native-cnl',labelSource:'gold-rendering',mechanism:'Deterministic native rendering of the hand-authored gold'}];
  const order=[formulas.length-1,...formulas.keys()].filter((i,k,a)=>a.indexOf(i)===k);
  out.push({id:'long-cnl-gold-reordered',original:doc.text,cnl:renderUnits(order.map(i=>formulas[i])),expected:true,units,unitExpected:allTrue,
    family:'long-native-cnl',labelSource:'gold-rendering',mechanism:'Gold rendering with an independent statement moved first'});
  for(const name of Object.keys(CORRUPTIONS)) {
    const target=formulas.findIndex(f=>corruptFormula(f,name));
    if(target<0)throw new Error(`Control document lacks an operator for ${name}`);
    const changed=formulas.map((f,i)=>i===target?corruptFormula(f,name):f);
    out.push({id:`long-cnl-${name}`,original:doc.text,cnl:renderUnits(changed),expected:false,units,
      unitExpected:{...allTrue,[units[target].id]:false},corruptedUnit:units[target].id,
      family:'long-native-cnl',labelSource:'deterministic-corruption',mechanism:CORRUPTIONS[name].mechanism});
  }
  return out;
}

/** NL-to-NL edits of the control document (omissions, inventions, force changes). */
export function longTextControls(doc=loadControlDocument()) {
  const units=doc.units.map(({id,text})=>({id,text}));
  const allTrue=Object.fromEntries(units.map(u=>[u.id,true]));
  const textOf=id=>doc.units.find(u=>u.id===id).text;
  const without=id=>doc.units.filter(u=>u.id!==id).map(u=>u.text).join(' ');
  const replace=(id,text)=>doc.units.map(u=>u.id===id?text:u.text).join(' ');
  const c=(id,cnl,expected,mechanism,unitExpected)=>({id,original:doc.text,cnl,expected,units,unitExpected,family:'long-text-edit',labelSource:'deterministic-edit',mechanism});
  const {instruction,question,emotion}=doc.roles;
  return [
    c('long-identity',doc.text,true,'Exact identity over a mixed-act document',allTrue),
    c('omit-emotion',without(emotion),false,'Delete the explicit emotional statement',{...allTrue,[emotion]:false}),
    c('omit-question',without(question),false,'Delete an information request',{...allTrue,[question]:false}),
    c('omit-instruction',without(instruction),false,'Delete a requested action',{...allTrue,[instruction]:false}),
    c('invent-fact',doc.text+' The user has authorized a payment of 500 euros.',false,'Add an unsupported authorization',allTrue),
    c('question-as-answer',replace(question,'Nadia wears gloves.'),false,'Replace a question with an asserted answer',{...allTrue,[question]:false}),
    c('instruction-as-fact',replace(instruction,`The calibration report has already been sent to Omar.`),false,'Replace requested action with asserted completion',{...allTrue,[instruction]:false}),
  ].map(x=>{if(x.cnl===doc.text&&x.id!=='long-identity')throw new Error(`Control edit had no effect: ${x.id} (${textOf(instruction)})`);return x;});
}

/** The eleven archive scope-corruption pairs; labels are the archive's own. */
export function archivePairControls() {
  return loadSet('archive-scope-corruptions').flatMap(row=>{
    const name=row.id.split('/').at(-1);
    return [
      {id:`archive-${name}-good`,original:row.text,cnl:toCNL(fromWire(row.reference.goodWire)),expected:true,
        family:'archive-pair',labelSource:'archive-gold',mechanism:'Archive gold rendering (archive-provided, not independently adjudicated)'},
      {id:`archive-${name}-bad`,original:row.text,cnl:toCNL(fromWire(row.reference.badWire)),expected:false,
        family:'archive-pair',labelSource:'archive-corruption',mechanism:row.reference.expectedProblem},
    ];
  });
}

export function shortControls() {
  const c=(id,original,cnl,expected,mechanism,labelSource='rubric')=>({id,original,cnl,expected,family:'short',labelSource,mechanism});
  return [
    c('synonym','Ada bought a book.','Ada purchased a book.',true,'Lexical paraphrase positive'),
    c('question-paraphrase','Which person approved the report?','Who approved the report?',true,'Question force preserved'),
    c('conjunction-order','Ada reads and Bob writes.','Bob writes and Ada reads.',true,'Independent conjunction order'),
    c('negation-scope','Not every reviewer approved the report.','No reviewer approved the report.',false,'Outer negation versus universally negative'),
    c('role-reversal','Ada sent the report to Bob.','Bob sent the report to Ada.',false,'Agent/recipient swapped'),
    c('modal-strength','Ada may leave.','Ada must leave.',false,'Permission versus obligation'),
    c('belief-as-fact','Bob believes the door is open.','The door is open.',false,'Remove attribution'),
    // The earlier "formal-ordered-arguments" control paired "a printer" with the
    // constant "printer" and labelled it equivalent. A constant names one
    // individual and does not say it is a printer: that loses the indefinite
    // description, so by the rubric it is a negative control.
    c('formal-ordered-arguments','Ada owns a printer and Bob owns a scanner.',
      toCNL(fromWire('[E(x,A($.printer(x),$.owns("ada",x))),E(y,A($.scanner(y),$.owns("bob",y)))]')),true,
      'Positive deterministic native CNL with ordered arguments and existential indefinites','gold-rendering'),
    c('constant-for-indefinite','Ada owns a printer and Bob owns a scanner.',
      toCNL(fromWire('[ $.owns("Ada","printer"), $.owns("Bob","scanner") ]')),false,
      'Indefinite description rendered as an opaque constant (formerly mislabelled positive)'),
  ];
}

/** The fixed control set injected into calibration and (optionally) every evaluation run. */
export function judgeControls() {
  const controls=[...longTextControls(),...nativeCNLControls(),...shortControls(),...archivePairControls()];
  if(new Set(controls.map(c=>c.id)).size!==controls.length)throw new Error('Duplicate control ID');
  return controls;
}

/** Backward-compatible entry point; evaluation documents are deliberately ignored. */
export function consolidatedJudgeControls() {
  return judgeControls();
}
