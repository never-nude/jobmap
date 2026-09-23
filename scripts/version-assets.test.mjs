import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {versionAssets} from './version-assets.mjs';

test('published HTML and the complete first-party import graph share a revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'jobmap-assets-'));
 try{
  await mkdir(join(dir,'vendor'));
  await Promise.all(Object.entries({
   'index.html':'<link href="style.css"><script src="app.js"></script><script src="vendor/leaflet.js"></script><a href="./">Home</a><a href="https://example.com/icon.svg">External</a>',
   'app.js':"import {jobAge} from './age.mjs';\nimport {energyFocus} from './energy.mjs';",
   'energy.mjs':"import {jobAge} from './age.mjs';",
   'age.mjs':'export const jobAge=()=>null;',
   'style.css':'body{color:white}',
   'vendor/leaflet.js':'// fixed vendor file',
  }).map(([name,text])=>writeFile(join(dir,name),text)));
  await versionAssets(dir,'abcdef1');
  const html=await readFile(join(dir,'index.html'),'utf8');
  assert(html.includes('app.js?v=abcdef1'));
  assert(html.includes('style.css?v=abcdef1'));
  assert(html.includes('vendor/leaflet.js?v=abcdef1'));
  assert(html.includes('href="./"'));
  assert(html.includes('href="https://example.com/icon.svg"'));
  for(const name of ['app.js','energy.mjs'])assert((await readFile(join(dir,name),'utf8')).includes("from './age.mjs?v=abcdef1'"));
  await versionAssets(dir,'123abcd');
  assert(!(await readFile(join(dir,'index.html'),'utf8')).includes('abcdef1'));
  assert(!(await readFile(join(dir,'app.js'),'utf8')).includes('abcdef1'));
  assert((await readFile(join(dir,'app.js'),'utf8')).includes("from './age.mjs?v=123abcd'"));
 }finally{await rm(dir,{recursive:true,force:true});}
});
