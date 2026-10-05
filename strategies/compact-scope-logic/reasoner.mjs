// Finite extensional interpretation for the first-order fragment of fol-ast/1.
// This is a model checker, not an open-world theorem prover. Modal predicates
// and proposition-valued arguments require a separate theory and are refused.
export function evaluate(formula,{domain,facts=[],negativeFacts=[],closedWorld=false},environment={}) {
  const pos=new Set(facts.map(JSON.stringify)),neg=new Set(negativeFacts.map(JSON.stringify));
  const and=xs=>xs.includes(false)?false:xs.includes(null)?null:true;
  const or=xs=>xs.includes(true)?true:xs.includes(null)?null:false;
  const not=x=>x===null?null:!x;
  function term(x,env){if(Object.hasOwn(x,'constant'))return x.constant;if(x.var&&Object.hasOwn(env,x.var))return env[x.var];throw new Error('Unbound or proposition-valued term');}
  function run(f,env){
    if(f.predicate){const key=JSON.stringify([f.predicate,...f.args.map(a=>term(a,env))]);if(pos.has(key)&&neg.has(key))throw new Error('Inconsistent interpretation');return pos.has(key)?true:neg.has(key)||closedWorld?false:null;}
    const a=f.args;
    switch(f.op){
      case 'not':return not(run(a[0],env));
      case 'and':return and(a.map(x=>run(x,env)));
      case 'or':return or(a.map(x=>run(x,env)));
      case 'implies':return or([not(run(a[0],env)),run(a[1],env)]);
      case 'forall':case 'exists':{
        if(!Array.isArray(domain))throw new Error('A finite domain is required');
        const values=domain.map(x=>run(a[1],{...env,[a[0].var]:x}));return f.op==='forall'?and(values):or(values);
      }
      default:throw new Error(`Unsupported assertion operator: ${f.op}`);
    }
  }
  return run(formula,environment);
}
