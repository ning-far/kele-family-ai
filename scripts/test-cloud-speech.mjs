import {writeFile} from 'node:fs/promises';
const base=process.argv[2];if(!/^https:\/\/[A-Za-z0-9.-]+\/(?:kele-english-api\/?|v1\/functions\/kele-english-api)$/.test(base??''))throw new Error('HTTPS function URL required');
const origin='https://ning-and-far-d4gnalnk55f9133e8-1251364700.tcloudbaseapp.com';
const call=(path,body)=>fetch(base.replace(/\/$/,'')+path,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});
const result={base,checkedAt:new Date().toISOString()};
const config=await fetch(base.replace(/\/$/,'')+'/config',{headers:{origin},signal:AbortSignal.timeout(40000)});result.configStatus=config.status;result.config=await config.json();
const translate=await call('/baidu/translate',{q:'apple',from:'en',to:'zh'});result.translationStatus=translate.status;result.translation=await translate.json();
const tts=await call('/baidu/tts',{tex:'apple',aue:6,per:0});result.ttsStatus=tts.status;result.ttsType=tts.headers.get('content-type');const wave=Buffer.from(await tts.arrayBuffer());result.ttsBytes=wave.length;
if(tts.ok&&wave.toString('ascii',0,4)==='RIFF'){
 let pcm,rate=16000;for(let i=12;i+8<=wave.length;){const id=wave.toString('ascii',i,i+4),size=wave.readUInt32LE(i+4);if(id==='fmt ')rate=wave.readUInt32LE(i+12);if(id==='data'){pcm=wave.subarray(i+8,i+8+size);break;}i+=8+size+(size%2);}
 if(pcm){const asr=await call('/baidu/asr',{audioBase64:pcm.toString('base64'),rate,dev_pid:1737});result.asrStatus=asr.status;result.asr=await asr.json();}
}
result.pass=result.configStatus===200&&result.config.baiduConfigured===true&&result.translationStatus===200&&result.ttsStatus===200&&result.asrStatus===200&&typeof result.asr?.text==='string'&&result.asr.text.trim().length>0;
await writeFile('docs/reviews/云端语音链路实测-20261004.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
