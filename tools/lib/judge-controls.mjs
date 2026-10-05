import {toCNL} from '../../strategies/compact-scope-logic/src/cnl.mjs';
import {fromWire} from '../../strategies/compact-scope-logic/src/wire.mjs';

export function consolidatedJudgeControls(cases) {
  const first=cases.find(c=>c.category==='base'), second=cases.find(c=>c.category==='lab-development');
  if(!first||!second)throw new Error('Consolidated calibration requires base and lab examples');
  const [emotion,question,instruction]=first.construction.addedSentences;
  const remove=fragment=>{if(!first.text.includes(fragment))throw new Error('Missing control span');return first.text.replace(fragment,'').trim();};
  const control=(id,original,cnl,expected,mechanism)=>({id,original,cnl,expected,mechanism});
  const pairs=[
    control('long-identity',first.text,first.text,true,'Exact identity over a mixed-act document'),
    control('omit-emotion',first.text,remove(emotion),false,'Delete the explicit emotional statement'),
    control('omit-question',first.text,remove(question),false,'Delete an information request'),
    control('omit-instruction',first.text,remove(instruction),false,'Delete a requested action'),
    control('invent-fact',first.text,first.text+'\n\nThe user has authorized a payment of 500 euros.',false,'Add an unsupported authorization'),
    control('question-as-answer',first.text,first.text.replace(question,'No clarification is needed and every request can be handled immediately.'),false,'Replace a question with an asserted answer'),
    control('instruction-as-fact',first.text,first.text.replace(instruction,'All unresolved questions have already been listed.'),false,'Replace requested action with asserted completion'),
    control('lab-long-identity',second.text,second.text,true,'Exact identity on a different long document'),
    control('synonym','Ada bought a book.','Ada purchased a book.',true,'Lexical paraphrase positive'),
    control('question-paraphrase','Which person approved the report?','Who approved the report?',true,'Question force preserved'),
    control('conjunction-order','Ada reads and Bob writes.','Bob writes and Ada reads.',true,'Independent conjunction order'),
    control('negation-scope','Not every reviewer approved the report.','No reviewer approved the report.',false,'Outer negation versus universally negative'),
    control('role-reversal','Ada sent the report to Bob.','Bob sent the report to Ada.',false,'Agent/recipient swapped'),
    control('modal-strength','Ada may leave.','Ada must leave.',false,'Permission versus obligation'),
    control('belief-as-fact','Bob believes the door is open.','The door is open.',false,'Remove attribution'),
  ];
  pairs.push(control('formal-ordered-arguments','Ada owns a printer and Bob owns a scanner.',
    toCNL(fromWire('[ $.owns("Ada","printer"), $.owns("Bob","scanner") ]')),true,'Positive deterministic native CNL with ordered arguments'));
  return pairs;
}
