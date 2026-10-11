import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberSettingsClient} from '../apps/web/src/member-settings-client.ts';
import {createMemberContext} from '../apps/web/src/member-context.ts';
const settings={defaultMode:'rhythm-game',sound:true,fontSize:'标准' as const};
const profile={id:'child',familyId:'family',displayName:'孩子',ageBand:'child' as const};
test('common mode updates preserve other server preferences and conflict never applies optimistic settings',async()=>{
 const context=createMemberContext();context.setSession('user',[profile]);context.select('child');let writes=0;
 const send:typeof fetch=async(_url,init)=>{
  if(init?.method==='GET')return Response.json({data:{profileId:'child',version:3,settings:{...settings,fontSize:'大字',sound:false}}});
  const body=JSON.parse(String(init?.body));assert.equal(body.expectedVersion,3+writes);assert.equal(body.settings.sound,false);assert.equal(body.settings.fontSize,'大字');writes++;
  return writes===1?Response.json({data:{profileId:'child',version:4,settings:body.settings}}):new Response('',{status:409});
 };
 const client=createMemberSettingsClient(context,send);await client.load();await client.update({defaultMode:'primary-english'});
 assert.equal(client.getSnapshot().snapshot?.version,4);
 await assert.rejects(client.update({defaultMode:'idiom-chain'}),/SETTINGS_VERSION_CONFLICT/);
 assert.equal(client.getSnapshot().status,'conflict');assert.equal(client.getSnapshot().snapshot?.settings.defaultMode,'primary-english');
 assert.throws(()=>client.adopt({profileId:'child',version:3,settings}),/STALE_SETTINGS_RESPONSE/);
});
test('member change clears cached settings and rejects a late reply',async()=>{
 const context=createMemberContext();context.setSession('user',[profile,{...profile,id:'senior',ageBand:'senior'}]);context.select('child');
 const send:typeof fetch=async()=>{context.select('senior');return Response.json({data:{profileId:'child',version:1,settings}});};
 const client=createMemberSettingsClient(context,send);await assert.rejects(client.load(),/MEMBER_CHANGED/);assert.equal(client.getSnapshot().snapshot,null);
});
