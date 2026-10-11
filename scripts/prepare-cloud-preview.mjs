import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {RELEASE_VERSION} from '../apps/web/src/release.ts';
const platform=resolve(dirname(fileURLToPath(import.meta.url)),'..'),project=resolve(platform,'..');
const release=join(platform,'.temp/cloud-preview-20261004');
await mkdir(release,{recursive:true});
await cp(join(platform,'apps/web/dist'),release,{recursive:true});
const index=await readFile(join(release,'index.html'),'utf8');
const api='https://ning-and-far-d4gnalnk55f9133e8-1251364700.ap-shanghai.app.tcloudbase.com/kele-english-api';
async function connectEnglish(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await connectEnglish(path);else if(entry.name.endsWith('.js')){let text=await readFile(path,'utf8');text=text.replaceAll('/legacy/english/api/',api+'/');if(entry.name==='engineConfig.js')text=text.replace('return "local-base"; // 旧值','return "baidu"; // 云端首次使用默认百度识别；保留本地选项。旧值');if(entry.name==='main.js')text='try { localStorage.setItem("el_engine_migrated_local_v2","1"); } catch {}\n'+text;await writeFile(path,text);}}}
await connectEnglish(join(release,'legacy/english/src'));
// Unbundled modules need a versioned dependency graph to bypass cached old audio code.
const clientVersion=RELEASE_VERSION;
async function versionClient(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await versionClient(path);else if(/\.(js|html)$/.test(entry.name)){let text=await readFile(path,'utf8');text=text.replace(/(["'])([^"'\s]+\.js)\1/g,(all,quote,url)=>url.startsWith('.')||url.startsWith('/legacy/')?`${quote}${url}?v=${clientVersion}${quote}`:all);await writeFile(path,text);}}}
await versionClient(join(release,'legacy/english'));
await versionClient(join(release,'legacy/drum'));
// Tell cloud users why speech goes to a server; avoid claiming browser ASR is pronunciation grading.
for(const entry of await readdir(join(release,'assets'))){if(entry.endsWith('.js')){const path=join(release,'assets',entry);let text=await readFile(path,'utf8');text=text.replaceAll('云翻译尚未接入，保留原有离线词典回退。','云端语音与翻译已接入；识别文字匹配不能代替专业声学发音评分。');await writeFile(path,text);}}
// Real directory indexes make direct links work without relying on account-side SPA rewrites.
for(const route of ['play','home','devices','modes','modes/rhythm-game','modes/primary-english','family','me']){await mkdir(join(release,route),{recursive:true});await writeFile(join(release,route,'index.html'),index);}
await writeFile(join(release,'play/connection.json'),JSON.stringify({ok:true}));
// The target already hosts a separate companion prototype. Do not replace its root homepage.
await rm(join(release,'index.html'));
for(const id of ['whisper-tiny','whisper-base','whisper-small.en']){
 const from=join(project,'EnglishLearning/models',id),to=join(release,'legacy/english/models',id);
 async function copyModels(source,target){await mkdir(target,{recursive:true});for(const entry of await readdir(source,{withFileTypes:true})){if(entry.isDirectory())await copyModels(join(source,entry.name),join(target,entry.name));else if(entry.isFile()&&/\.(json|onnx|bin|txt|md)$/.test(entry.name))await cp(join(source,entry.name),join(target,entry.name));}}
 await copyModels(from,to);
}
await mkdir(join(release,'legacy/english/api/config'),{recursive:true});
await writeFile(join(release,'legacy/english/api/config/index.html'),JSON.stringify({baiduConfigured:false}));
// Static deployments cannot read the user's Windows Bluetooth session.
await mkdir(join(release,'local/device-status'),{recursive:true});
await writeFile(join(release,'local/device-status/index.html'),JSON.stringify({available:false,error:'local-computer-only'}));
const manifest=[];
async function inventory(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await inventory(path);else if(entry.isFile()){const name=relative(release,path).replaceAll('\\','/');if(/(?:^|\/)(?:\.env|backups?|recordings?)(?:[./]|$)|\.(pem|key|pfx|p12)$/i.test(name))throw new Error('Forbidden publication file: '+name);const body=await readFile(path);manifest.push({path:name,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});}}}
await inventory(release);
const result={environment:'ning-and-far-d4gnalnk55f9133e8',region:'ap-shanghai',entry:'/play/',files:manifest,totalBytes:manifest.reduce((sum,file)=>sum+file.bytes,0),limitations:['Family cloud API is not deployed','Cloud translation provider is not configured','Browser speech runtime currently loads from jsdelivr','Actual iPhone performance and BLE gameplay require device acceptance']};
await writeFile(join(platform,'.temp/cloud-preview-20261004-manifest.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({release,files:manifest.length,totalBytes:result.totalBytes,largestFile:manifest.reduce((a,b)=>b.bytes>a.bytes?b:a),entry:result.entry}));
