import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resultDisposition,writeResultMirror} from '../tools/lib/result-mirrors.mjs';

test('result mirrors contain only actual CNL, and success requires both semantic and reasoning checks',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nlp-mirrors-'));
  try{
    const row={id:'consolidated/base/01',strategy:'example',ok:true,cnl:'Every person is ready.',audit:{eligible:true},verdict:{status:'judged',equivalent:true}};
    const saved=writeResultMirror(root,'experiment',row);
    assert.equal(saved.bucket,'success');
    assert.equal(fs.readFileSync(path.join(root,saved.path),'utf8'),row.cnl+'\n');
    assert.throws(()=>writeResultMirror(root,'experiment',row),/already exists/);
    assert.equal(resultDisposition({...row,audit:{eligible:false}}),'unsupported_or_opaque');
    assert.equal(resultDisposition({...row,verdict:{status:'judge_error'}}),'judge_error');
    assert.equal(resultDisposition({...row,verdict:{status:'judged',equivalent:false}}),'not_equivalent');
    const failed=writeResultMirror(root,'experiment',{...row,id:'consolidated/base/02',ok:false,cnl:null});
    assert.equal(failed.bucket,'fail');assert.equal(failed.hasCNL,false);
    assert.equal(fs.readFileSync(path.join(root,failed.path),'utf8'),'');
    const other=writeResultMirror(root,'experiment',{...row,strategy:'other-strategy',cnl:'Different CNL.',verdict:{status:'judged',equivalent:false}});
    const sameCase=writeResultMirror(root,'experiment',{...row,id:'consolidated/base/02',strategy:'other-strategy',cnl:'Another failure.',ok:false});
    const otherRun=writeResultMirror(root,'other-experiment',{...row,id:'consolidated/base/02',ok:false,cnl:'New run CNL.'});
    assert.notEqual(sameCase.path,failed.path);assert.notEqual(otherRun.path,failed.path);
    assert.equal(fs.readFileSync(path.join(root,other.path),'utf8'),'Different CNL.\n');
    assert.equal(fs.readFileSync(path.join(root,failed.path),'utf8'),'');
    assert.equal(fs.readFileSync(path.join(root,saved.path),'utf8'),row.cnl+'\n');
    assert.throws(()=>writeResultMirror(root,'experiment',{...row,id:'../escape'}),/Invalid/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
