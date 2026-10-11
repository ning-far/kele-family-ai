import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {execFile} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {IncomingMessage,ServerResponse} from 'node:http';
const modelsRoot=fileURLToPath(new URL('../../../EnglishLearning/models/',import.meta.url));
// Rebuild original resources before starting Vite; newly added public files require a restart
// because legacy resource watching is disabled to avoid partial-copy reloads.
let deviceQuery:Promise<string>|undefined;
let deviceCache:{at:number;body:string}|undefined;
// Local model files are mounted read-only, rather than copied into the public build.
function originalResources(req:IncomingMessage,res:ServerResponse,next:()=>void){
 const pathname=(req.url??'').split('?')[0];
 if(pathname==='/local/device-status'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??'')){res.statusCode=403;res.end(JSON.stringify({error:'local-computer-only'}));return;}
  if(process.platform!=='win32'){res.end(JSON.stringify({available:false}));return;}
  if(deviceCache&&Date.now()-deviceCache.at<5000){res.end(deviceCache.body);return;}
  const script=fileURLToPath(new URL('../../scripts/windows-device-status.ps1',import.meta.url));
  if(!deviceQuery)deviceQuery=new Promise<string>(resolveQuery=>{
  execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{timeout:30000,windowsHide:true},(error,stdout)=>{
   if(error){resolveQuery(JSON.stringify({available:false,error:'system-query-failed'}));return;}
   try{const parsed=JSON.parse(stdout.trim());resolveQuery(JSON.stringify({available:parsed.available===true,name:'EasyInput Board',paired:parsed.paired===true,connected:parsed.connected===true,easyInputRunning:parsed.easyInputRunning===true}));}catch{resolveQuery(JSON.stringify({available:false,error:'system-query-failed'}));}
  });}).then(body=>{deviceCache={at:Date.now(),body};deviceQuery=undefined;return body});
  void deviceQuery.then(body=>res.end(body));return;
 }
 if(pathname==='/legacy/english/api/config'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({baiduConfigured:false}));return;
 }
 if(pathname.startsWith('/legacy/english/api/')){
  res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'cloud-provider-not-configured'}));return;
 }
 if(!pathname.startsWith('/legacy/english/models/')){next();return;}
 const relative=pathname.slice('/legacy/english/models/'.length);
 if(req.method!=='GET'||!/^whisper-(base|tiny|small\.en)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(json|onnx|bin)$/.test(relative)){res.statusCode=404;res.end();return;}
 void(async()=>{
  try{
   const root=await realpath(modelsRoot),path=await realpath(resolve(root,relative));
   if(!path.startsWith(root+sep))throw new Error('outside-model-root');
   const info=await stat(path);if(!info.isFile())throw new Error('not-file');
   res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'application/octet-stream');res.setHeader('Content-Length',info.size);
   const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{res.statusCode=404;res.end();}
 })();
}
const apiTarget=process.env.KELE_API_PROXY_TARGET??'http://127.0.0.1:8787';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(apiTarget))throw new Error('LOCAL_API_PROXY_REQUIRED');
export default defineConfig({plugins:[react(),{name:'original-learning-local-resources',configureServer(server){server.middlewares.use(originalResources);},configurePreviewServer(server){server.middlewares.use(originalResources);}}],server:{port:5173,strictPort:true,watch:{ignored:['**/public/legacy/**']},proxy:{'/api':apiTarget,'/healthz':apiTarget}}});
