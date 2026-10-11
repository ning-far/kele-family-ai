import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler} from './server.mjs';
const origin='https://ning-and-far-d4gnalnk55f9133e8-1251364700.tcloudbaseapp.com';

test('managed gateway owns ACAO without duplicate values; origin restriction stays enforced',async t=>{
 const prior=process.env.CLOUDBASE_GATEWAY_CORS;process.env.CLOUDBASE_GATEWAY_CORS='1';
 t.after(()=>{if(prior===undefined)delete process.env.CLOUDBASE_GATEWAY_CORS;else process.env.CLOUDBASE_GATEWAY_CORS=prior;});
 const provider={handleConfig:(_req,res)=>res.writeHead(200,{'Content-Type':'application/json'}).end('{}')};
 const server=createServer(createHandler(provider));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base=`http://127.0.0.1:${server.address().port}/config`;
 const good=await fetch(base,{headers:{origin}});assert.equal(good.status,200);assert.equal(good.headers.get('access-control-allow-origin'),null);
 assert.equal((await fetch(base,{headers:{origin:'https://unrelated.example'}})).status,403);
});
test('cloud speech HTTP contract: CORS, validation, binary output and rate limit',async t=>{
 let calls=0;const provider={handleConfig:(_req,res)=>res.writeHead(200,{'Content-Type':'application/json'}).end('{"baiduConfigured":true}'),handleBaiduAsr:(_req,res)=>{calls++;res.writeHead(200,{'Content-Type':'application/json'}).end('{"text":"apple"}');},handleBaiduTts:(_req,res)=>res.writeHead(200,{'Content-Type':'audio/mp3'}).end(Buffer.from([73,68,51,1]))};
 const server=createServer(createHandler(provider));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base=`http://127.0.0.1:${server.address().port}/kele-english-api`;
 const request=(path,body,other={})=>fetch(base+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...other},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/config')).status,200);
 assert.equal((await request('/baidu/asr',{}, {origin:'https://unrelated.example'})).status,403);
 assert.equal((await request('/baidu/asr',{audioBase64:'invalid!'})).status,400);
 assert.equal((await request('/baidu/asr',{audioBase64:Buffer.alloc(640002).toString('base64')})).status,400);
 assert.equal((await request('/baidu/asr',{audioBase64:Buffer.alloc(320).toString('base64'),dev_pid:9999})).status,400);
 assert.equal(calls,0);
 const good=await request('/baidu/asr',{audioBase64:Buffer.alloc(320).toString('base64'),dev_pid:1737});assert.deepEqual(await good.json(),{text:'apple'});assert.equal(good.headers.get('access-control-allow-origin'),origin);assert.equal(calls,1);
 const sound=await request('/baidu/tts',{tex:'apple'});assert.equal(sound.headers.get('content-type'),'audio/mp3');assert.deepEqual([...new Uint8Array(await sound.arrayBuffer())],[73,68,51,1]);
 for(let i=0;i<40;i++)await request('/baidu/tts',{tex:'apple'});
 assert.equal((await request('/baidu/tts',{tex:'apple'})).status,429);
});
