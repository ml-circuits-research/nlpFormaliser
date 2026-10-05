// Public research identities are stable; old IDs remain readable for saved runs.
export const REGISTRY=Object.freeze({
  'event-role-logic':{folder:'event-role-logic',title:'Event Role Logic',aliases:['evl'],family:'event-logic'},
  'compact-scope-logic':{folder:'compact-scope-logic',title:'Compact Scope Logic',aliases:['microir'],family:'scoped-logic'},
  'explicit-scope-logic':{folder:'explicit-scope-logic',title:'Explicit Scope Logic',aliases:[],family:'scoped-logic'},
  'deterministic-rule-draft':{folder:'deterministic-rule-draft',title:'Deterministic Rule Draft',aliases:['lab-heuristic'],family:'context-logic'},
  'direct-context-logic':{folder:'direct-context-logic',title:'Direct Context Logic',aliases:['lab-direct'],family:'context-logic'},
  'evidence-guided-logic':{folder:'evidence-guided-logic',title:'Evidence Guided Logic',aliases:['lab-proto'],family:'context-logic'},
  'discourse-semantic-graph':{folder:'discourse-semantic-graph',title:'Discourse Semantic Graph',aliases:['symbolic'],family:'discourse'},
  'speech-act-normalization':{folder:'speech-act-normalization',title:'Speech Act Normalization',aliases:['cnl-core'],family:'normalization',controlOnly:true},
  'draft-guided-repair':{folder:'draft-guided-repair',title:'Draft Guided Repair',aliases:[],family:'context-logic',repair:true},
});
export function resolveStrategy(name) {
  const id=Object.keys(REGISTRY).find(id=>id===name||REGISTRY[id].aliases.includes(name));
  return id?{id,...REGISTRY[id]}:null;
}
