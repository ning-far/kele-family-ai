import {readdir,readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const platform=resolve(dirname(fileURLToPath(import.meta.url)),'..'),project=resolve(platform,'..');
const build=join(platform,'apps/web/dist'),reportDir=join(project,'docs/reviews');
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function files(root){const out=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())out.push(...await files(path));else if(entry.isFile())out.push(path);}return out;}
const missing=[],different=[],inventory=[];
const forbidden=[];
for(const path of await files(build)){if(/(?:^|[\\/])(?:\.env(?:\..*)?|backups?|recordings?)(?:[\\/]|$)|\.(pem|key|pfx|p12)$/i.test(path))forbidden.push(relative(build,path));}
async function compare(source,target,kind){for(const path of await files(source)){const rel=relative(source,path),dest=join(target,rel),info=await stat(path);const item={kind,path:rel.replaceAll('\\','/'),bytes:info.size};try{item.sha256=await hash(path);item.matches=item.sha256===await hash(dest);if(!item.matches)different.push(`${kind}/${item.path}`);}catch{item.matches=false;missing.push(`${kind}/${item.path}`);}inventory.push(item);}}
await compare(join(project,'EnglishLearning/assets'),join(build,'legacy/english/assets'),'english-artwork');
await compare(join(project,'drumRhythmGame/public'),join(build,'legacy/drum'),'drum-public');
const source=await readFile(join(project,'drumRhythmGame/src/core/songs.ts'),'utf8');
const songs=[];
for(const match of source.matchAll(/id:\s*"([^"]+)"[\s\S]*?chartPath:\s*"([^"]+)"[\s\S]*?hasAudio:\s*(true|false)/g)){
 const [,id,chartPath,audio]=match;const chart=JSON.parse(await readFile(join(build,'legacy/drum',chartPath),'utf8'));
 const audioFile=chart.meta?.audioFile;
 if(audio==='true'&&!audioFile)missing.push(`song/${id}/audioFile`);
 if(audioFile){try{await stat(join(build,'legacy/drum',audioFile));}catch{missing.push(`song/${id}/${audioFile}`);}}
 songs.push({id,chartPath,audioFile:audioFile??null,synthetic:audio==='false'});
}
// Validate all relative JS module imports; HTML imports are explicitly checked too.
const englishRoot=join(build,'legacy/english');
for(const path of await files(join(englishRoot,'src'))){if(!path.endsWith('.js'))continue;const text=await readFile(path,'utf8');for(const match of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){try{await stat(resolve(dirname(path),match[1]));}catch{missing.push(`english-import/${relative(englishRoot,path)}:${match[1]}`);}}}
const icons=await readFile(join(englishRoot,'src/content/icons.js'),'utf8');
const artworkRendering={inlineSvg:icons.includes('<svg'),wordImage:true,externalImagesIncluded:inventory.filter(item=>item.kind==='english-artwork').length};
const modelFiles=await files(join(project,'EnglishLearning/models'));
const models={};for(const path of modelFiles){const id=relative(join(project,'EnglishLearning/models'),path).split(/[\\/]/)[0];const size=(await stat(path)).size;models[id]=(models[id]??0)+size;}
const blocked=['English models are mounted by local Vite middleware, not present in static dist','English API provider is not configured','Windows device status endpoint is local-only','Unregistered MP3s have no registered playable chart; not counted as playable songs'];
const http=[];
if(process.argv.includes('--http'))for(const item of inventory){
 const prefix=item.kind==='english-artwork'?'/legacy/english/assets/':'/legacy/drum/';
 const url='http://127.0.0.1:5175'+prefix+item.path.split('/').map(encodeURIComponent).join('/');
 try{const response=await fetch(url,{signal:AbortSignal.timeout(10000)});const body=Buffer.from(await response.arrayBuffer());http.push({path:prefix+item.path,status:response.status,matches:response.ok&&createHash('sha256').update(body).digest('hex')===item.sha256});}
 catch{http.push({path:prefix+item.path,status:0,matches:false});}
}
const result={checkedAt:new Date().toISOString(),pass:missing.length===0&&different.length===0&&forbidden.length===0&&http.every(item=>item.matches),songs,artworkRendering,modelBytes:models,missing,different,forbidden,http,blocked,inventory};
await mkdir(reportDir,{recursive:true});await writeFile(join(reportDir,'原项目资源清单-20261004.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,songs,artworkRendering,modelBytes:models,missing,different,forbidden,httpChecked:http.length,httpFailed:http.filter(item=>!item.matches),files:inventory.length,bytes:inventory.reduce((sum,item)=>sum+item.bytes,0)},null,2));
if(!result.pass)process.exitCode=1;
