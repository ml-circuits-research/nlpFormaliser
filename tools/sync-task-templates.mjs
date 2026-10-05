#!/usr/bin/env node
// Regenerate (or with --check, verify) the static task templates from the
// strategy prompt constants. No model is called.
import {syncTaskTemplates} from './lib/task-templates.mjs';

const check=process.argv.includes('--check');
const stale=await syncTaskTemplates({write:!check});
if(check&&stale.length){console.error(`Stale task templates:\n${stale.join('\n')}`);process.exit(1);}
console.log(stale.length?`${check?'Stale':'Updated'}: ${stale.join(', ')}`:'All task templates are current.');
