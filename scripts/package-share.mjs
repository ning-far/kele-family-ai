// Build an explicit, credential-free source snapshot. Do not copy the project root.
import {cp,mkdir,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const platform=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=resolve(platform,'..');
const version='v0.1.0-preview.1';
const excluded=new Set(['node_modules','.git','.temp','.cache','.pnpm-store','.swc','dist','models','recordings','backups','.analysis','.venv','__pycache__','legacy']);
function allowed(name){return !excluded.has(name)&&!(/\.(log|pem|key|pfx|p12|zip|tsbuildinfo|bin|exe|dll)$/i.test(name))&&(!name.startsWith('.env')||name==='.env.example');}
async function copyTree(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})){
  if(!allowed(entry.name)||entry.isSymbolicLink())continue;
  if(entry.isDirectory())await copyTree(join(from,entry.name),join(to,entry.name));
  else if(entry.isFile())await cp(join(from,entry.name),join(to,entry.name));
 }
}
for(const name of ['EnglishLearning','drumRhythmGame']){
 const source=join(project,name),target=join(platform,'originals',name);
 for(const dir of name==='EnglishLearning'?['src','tests','assets','scripts']:['src','tests','public','scripts','timing']){
  if(await stat(join(source,dir)).then(s=>s.isDirectory()).catch(()=>false))await copyTree(join(source,dir),join(target,dir));
 }
 const rootFiles=name==='EnglishLearning'?['index.html','package.json','pnpm-lock.yaml','.env.example','server.mjs']:['index.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vite.config.ts','THIRD_PARTY_NOTICES.md'];
 for(const file of rootFiles)if(await stat(join(source,file)).catch(()=>false))await cp(join(source,file),join(target,file));
}
const target=join(platform,'.temp/share',`kele-family-ai-${version}`);
await mkdir(target,{recursive:true});
for(const dir of ['apps','packages','scripts','tests','originals','docs','.github'])await copyTree(join(platform,dir),join(target,dir));
// Generated legacy output is excluded; it is rebuilt from originals in this package.
// Filter it during traversal rather than deleting broad folders.
for(const file of ['README.md','CHANGELOG.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','tsconfig.tests.json','.gitignore','.npmrc','.node-version','.env.example'])await cp(join(platform,file),join(target,file));
const files=[];const findings=[];
async function inspect(root){for(const entry of await readdir(root,{withFileTypes:true})){
 if(entry.name==='SOURCE-MANIFEST.json'||!allowed(entry.name)||entry.isSymbolicLink())continue;
 const path=join(root,entry.name),name=relative(target,path).replaceAll('\\','/');
 if(entry.isDirectory()){await inspect(path);continue;}
 const body=await readFile(path);
 if(/\.(mjs|js|ts|tsx|json|yaml|yml|md|example|ps1)$/.test(entry.name)){
  const text=body.toString('utf8');
  if(/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push(name);
 }
 if(body.length>=100*1024*1024)throw new Error('GitHub oversized file: '+name);
 files.push({path:name,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
}}
await inspect(target);
if(findings.length)throw new Error('Potential secret material; paths only: '+findings.join(', '));
await writeFile(join(target,'SOURCE-MANIFEST.json'),JSON.stringify({version,experience:'layout-20261009-r10',files,totalBytes:files.reduce((s,f)=>s+f.bytes,0),secretScan:'passed narrow secret markers; excluded credential paths'},null,2));
console.log(JSON.stringify({version,target,files:files.length,totalBytes:files.reduce((s,f)=>s+f.bytes,0),secretFindings:findings.length}));
