import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
const SITE='https://ning-and-far-d4gnalnk55f9133e8-1251364700.tcloudbaseapp.com';
const buckets=new Map();
export function createHandler(provider){return async(req,res)=>{
 const origin=req.headers.origin;
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 const reject=(status,error)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({error}));};
 if(origin&&origin!==SITE){reject(403,'origin-not-allowed');return;}
 // CloudBase gateway already supplies ACAO. A second value is rejected by
 // browsers even though command-line API calls return 200 successfully.
 if(origin){if(process.env.CLOUDBASE_GATEWAY_CORS!=='1')res.setHeader('Access-Control-Allow-Origin',SITE);res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const path=(req.url??'/').split('?')[0].replace(/^\/kele-english-api/,'').replace(/\/$/,'');
 if(req.method==='GET'&&(path==='/config'||path==='/api/config')){await provider.handleConfig(req,res);return;}
 if(req.method==='GET'&&path==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,service:'kele-english-api'}));return;}
 const route=path.replace(/^\/api/,'');
 const handlers={'/baidu/asr':provider.handleBaiduAsr,'/baidu/tts':provider.handleBaiduTts,'/baidu/translate':provider.handleBaiduTranslate,'/baidu/speech-translate':provider.handleBaiduSpeechTranslate};
 if(req.method!=='POST'||!handlers[route]){reject(404,'not-found');return;}
 const minute=Math.floor(Date.now()/60000),ip=String(req.headers['x-forwarded-for']??req.socket.remoteAddress??'unknown').split(',')[0];
 const previous=buckets.get(ip),count=previous?.minute===minute?previous.count+1:1;
 if(buckets.size>1000)buckets.clear();buckets.set(ip,{minute,count});
 if(count>40){res.setHeader('Retry-After','60');reject(429,'try-again-later');return;}
 let body;try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1024*1024){reject(413,'recording-too-long');return;}chunks.push(chunk);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reject(400,'bad-json');return;}
 if(route==='/baidu/asr'||route==='/baidu/speech-translate'){
  if(typeof body.audioBase64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.audioBase64)||body.audioBase64.length%4!==0){reject(400,'invalid-audio');return;}
  const audio=Buffer.from(body.audioBase64,'base64');if(audio.length<320||audio.length>640000){reject(400,'recording-must-be-under-20-seconds');return;}
  body.rate=16000;if(route==='/baidu/asr'&&![1537,1737].includes(Number(body.dev_pid??1737))){reject(400,'unsupported-language');return;}
 }
 if(route==='/baidu/tts'&&(typeof body.tex!=='string'||!body.tex.trim()||body.tex.length>300)){reject(400,'invalid-text');return;}
 if(route==='/baidu/translate'&&(typeof body.q!=='string'||!body.q.trim()||body.q.length>300)){reject(400,'invalid-text');return;}
 try{await handlers[route](Readable.from([Buffer.from(JSON.stringify(body))]),res);}catch{if(!res.headersSent)reject(502,'speech-service-unavailable');else res.end();}
};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const provider=await import('./provider.mjs');createServer(createHandler(provider)).listen(Number(process.env.PORT??9000),'0.0.0.0');}
