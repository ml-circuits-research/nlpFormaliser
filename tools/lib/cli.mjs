import {existsSync,readFileSync} from 'node:fs';
export const readArg=x=>(x===undefined||x==='-'?readFileSync(0,'utf8'):existsSync(x)?readFileSync(x,'utf8'):x).trim();
export function positive(value,name) {
  const n=Number(value);if(!Number.isSafeInteger(n)||n<1) throw new Error(`${name} must be a positive integer`);return n;
}
