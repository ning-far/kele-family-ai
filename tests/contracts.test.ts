import test from 'node:test';
import assert from 'node:assert/strict';
import {CreateRunSchema,OpenModeInputSchema,DeviceInputSchema,ModeManifestSchema} from '../packages/schemas/src/index.ts';
import {modes,findMode} from '../packages/mode-registry/src/index.ts';
import {transition} from '../packages/kele-agent/src/index.ts';
import {SimulatorTransport} from '../packages/device-protocol/src/index.ts';
test('registry has unique, schema-valid modes and unknown IDs do not resolve',()=>{
 assert.equal(new Set(modes.map(m=>m.id)).size,6);modes.forEach(m=>assert.ok(ModeManifestSchema.safeParse(m).success));
 assert.equal(findMode('../../admin'),undefined);assert.equal(OpenModeInputSchema.safeParse({modeId:'delete.all'}).success,false);
});
const base={schemaVersion:'1.0',memberId:'a1111111-1111-4111-8111-111111111111',input:{type:'text',text:'打开架子鼓'}};
test('run boundary accepts valid input but rejects identity injection, empty speech and arbitrary audio URLs',()=>{
 assert.ok(CreateRunSchema.safeParse(base).success);
 for(const bad of [{...base,actorUserId:'admin'},{...base,input:{type:'text',text:'  '}},{...base,input:{type:'audio',uploadId:'https://internal/admin'}},{...base,schemaVersion:'9.0'}])assert.equal(CreateRunSchema.safeParse(bad).success,false);
});
test('illegal transitions and terminal runs cannot execute',()=>{
 assert.equal(transition('planning','awaiting_confirmation'),'awaiting_confirmation');
 assert.throws(()=>transition('understanding','completed'),/INVALID_TRANSITION/);
 for(const end of ['completed','failed','error','cancelled','expired'] as const)assert.throws(()=>transition(end,'executing'),/RUN_TERMINAL/);
});
test('simulator disconnect blocks input; reconnection has new boot identity; unsubscribe works',async()=>{
 const sim=new SimulatorTransport();assert.throws(()=>sim.press('S1'),/DISCONNECTED/);
 await sim.connect();let count=0;const off=sim.subscribe(()=>count++);const first=sim.press('S1');
 off();sim.press('S2');assert.equal(count,1);await sim.disconnect();assert.throws(()=>sim.press('S2'));
 await sim.connect();const second=sim.press('S2');assert.notEqual(second.bootId,first.bootId);assert.equal(second.seq,1);
 assert.ok(DeviceInputSchema.safeParse(second).success);assert.equal(DeviceInputSchema.safeParse({...second,key:'ADMIN',seq:-1}).success,false);
});
