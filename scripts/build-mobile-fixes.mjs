import {spawnSync} from 'node:child_process';
import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const project=resolve(import.meta.dirname,'../..'),platform=join(project,'kele-platform');
for(const [script,cwd,args] of [[join(platform,'scripts/prepare-original-games.mjs'),project,[]],[join(platform,'apps/web/node_modules/vite/bin/vite.js'),join(platform,'apps/web'),['build']],[join(platform,'scripts/prepare-cloud-preview.mjs'),project,[]]]){const result=spawnSync(process.execPath,[script,...args],{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
const from=join(platform,'.temp/cloud-preview-20261004'),to=join(platform,'.temp/mobile-fixes-20261004');await mkdir(to,{recursive:true});
for(const name of ['assets','play','home','devices','modes','family','me','legacy/english/src','legacy/drum/charts']){await mkdir(resolve(to,name,'..'),{recursive:true});await cp(join(from,name),join(to,name),{recursive:true});}
for(const name of ['legacy/english/index.html','legacy/english/mobile.css','legacy/english/short-screen.css','legacy/english/viewport-layout.css','legacy/english/wireless.js','legacy/drum/index.html','legacy/drum/viewport-layout.css','legacy/drum/touch.js','legacy/drum/wireless.js']){await mkdir(resolve(to,name,'..'),{recursive:true});await cp(join(from,name),join(to,name));}
await mkdir(join(to,'legacy/drum/assets'),{recursive:true});for(const entry of await readdir(join(from,'legacy/drum/assets'))){if(/\.(js|css)$/.test(entry))await cp(join(from,'legacy/drum/assets',entry),join(to,'legacy/drum/assets',entry));}
const html=await readFile(join(to,'play/index.html'),'utf8');if(!html.includes('/assets/'))throw new Error('Entry bundle missing');
// Publish the two user-provided recordings, not private click-review audio.
await mkdir(join(to,'legacy/drum/audio'),{recursive:true});
for(const id of ['red-star','white-rabbit'])await cp(join(from,'legacy/drum/audio',id+'.mp3'),join(to,'legacy/drum/audio',id+'.mp3'));
await writeFile(join(platform,'.temp/mobile-release-info.json'),JSON.stringify({directory:to,checkedAt:new Date().toISOString(),preserved:['index.html','companion','cloud-admin','__auth']},null,2));
console.log('Mobile fixes package prepared: '+to);
