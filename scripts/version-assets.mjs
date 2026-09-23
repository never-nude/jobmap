import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Version the copied site's first-party module graph together, so a fresh HTML
// response cannot accidentally import cached code from a previous deployment.
export async function versionAssets(directory,revision){
 if(!/^[a-f0-9]{7,40}$/.test(revision||''))throw Error('Expected a Git commit SHA for asset versioning.');
 const root=resolve(directory),files=await readdir(root),modules=files.filter(name=>/\.m?js$/.test(name));
 const known=new Set(modules);
 for(const name of modules){
  const path=join(root,name),source=await readFile(path,'utf8');
  const versioned=source.replace(/(\bfrom\s*)(['"])(\.\/[\w.-]+\.m?js)(?:\?v=[a-f0-9]+)?\2/g,(match,prefix,quote,url)=>{
   if(!known.has(url.slice(2)))throw Error(`Missing module ${url} imported by ${name}.`);
   return `${prefix}${quote}${url}?v=${revision}${quote}`;
  });
  if(versioned!==source)await writeFile(path,versioned);
 }
 const htmlPath=join(root,'index.html'),html=await readFile(htmlPath,'utf8');
 const assets=new Set();
 const versioned=html.replace(/((?:src|href)=)(['"])([^'"]+)\2/g,(match,prefix,quote,url)=>{
  const path=url.replace(/\?v=[a-f0-9]+$/,'');
  if(!/^(?:\.\/)?[\w./-]+\.(?:m?js|css|svg)$/.test(path)||path.split('/').includes('..'))return match;
  assets.add(path);
  return `${prefix}${quote}${path}?v=${revision}${quote}`;
 });
 for(const asset of assets)await access(join(root,asset));
 await writeFile(htmlPath,versioned);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 await versionAssets(process.argv[2]||'_site',process.argv[3]);
 console.log('Versioned website assets for this deployment.');
}
