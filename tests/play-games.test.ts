import test from 'node:test';
import assert from 'node:assert/strict';
import {chart,judgeHit,expiredBeats,idioms,idiomMatches,melody,saveRecord,readRecords} from '../apps/web/src/play-data.ts';
test('rhythm scores only the matching lane and time window, never duplicate or arbitrary taps',()=>{
 const beats=chart();assert.equal(beats.length,melody.length);
 assert.equal(judgeHit(beats,1,2),null);assert.equal(judgeHit(beats,0,1),null);
 assert.equal(judgeHit(beats,0,2)?.points,100);assert.equal(judgeHit(beats,0,2.2)?.points,60);
 beats[0].resolved=true;assert.equal(judgeHit(beats,0,2),null);
 assert.ok(!expiredBeats(beats,2.7).includes(0));assert.ok(expiredBeats(beats,2.9).includes(1));
});
test('curated idiom chain matches its last character and rejects wrong ordered characters',()=>{
 for(let i=1;i<idioms.length;i++){
  assert.equal(idioms[i].text.length,4);assert.equal(idiomMatches(idioms[i-1].text,idioms[i].text,idioms[i].text),true);
  assert.equal(idiomMatches(idioms[i-1].text,[...idioms[i].text].reverse().join(''),idioms[i].text),false);
 }
});
test('local records survive LAN browsers without randomUUID, remain bounded and reject corrupt data',()=>{
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');let value='[]';
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_key:string,text:string)=>{value=text}}});
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
 try{
  saveRecord('english',92);assert.equal(readRecords()[0].score,92);assert.ok(readRecords()[0].id);
  for(let i=0;i<24;i++)saveRecord('rhythm',i);assert.equal(readRecords().length,20);assert.equal(readRecords()[0].score,23);
  value='not-json';assert.deepEqual(readRecords(),[]);
  value='[{"mode":"admin","score":100}]';assert.deepEqual(readRecords(),[]);
 }finally{
  if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
  if(oldCrypto)Object.defineProperty(globalThis,'crypto',oldCrypto);else Reflect.deleteProperty(globalThis,'crypto');
 }
});
