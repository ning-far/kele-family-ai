import { DeviceInputSchema, type DeviceInput } from '@kele/schemas';
export interface DeviceTransport {
  readonly kind:DeviceInput['transport'];
  connect():Promise<void>;
  disconnect():Promise<void>;
  subscribe(listener:(event:DeviceInput)=>void):()=>void;
}
export type SupportedTransport = DeviceInput['transport'];
export type DeviceCapability = 'buttons'|'leds'|'audio'|'telemetry';
export type DeviceDescriptor = { deviceId:string; name:string; transport:SupportedTransport; capabilities:DeviceCapability[] };
export type PlatformAction = 'voice-input-toggle'|'assistant-record-toggle'|'mode-rhythm'|'mode-learning'|'mode-idiom';
export const defaultKeyActions:Record<DeviceInput['key'],PlatformAction|undefined> = { S1:'voice-input-toggle', S2:'assistant-record-toggle', S3:'mode-rhythm', S4:'mode-learning', S5:'mode-idiom', S6:undefined };
export function actionForKey(key:DeviceInput['key']):PlatformAction|undefined{return defaultKeyActions[key];}
export class UnavailableTransport implements DeviceTransport {
  readonly kind:SupportedTransport;
  private readonly reason:string;
  constructor(kind:SupportedTransport, reason='NOT_IMPLEMENTED'){this.kind=kind;this.reason=reason;}
  async connect(){throw new Error(this.reason);}
  async disconnect(){}
  subscribe(_listener:(event:DeviceInput)=>void){return ()=>{};}
}
export class SimulatorTransport implements DeviceTransport {
  readonly kind='simulator' as const;
  private connected=false;
  private seq=0;
  private bootId='';
  private listeners=new Set<(event:DeviceInput)=>void>();
  async connect(){if(this.connected)return;this.connected=true;this.seq=0;this.bootId=crypto.randomUUID();}
  async disconnect(){this.connected=false;}
  subscribe(listener:(event:DeviceInput)=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  press(key:DeviceInput['key']){
    if(!this.connected)throw new Error('DEVICE_DISCONNECTED');
    const seq=++this.seq;
    const event=DeviceInputSchema.parse({schemaVersion:'1.0',deviceId:'local-simulator',bootId:this.bootId,
      seq,eventId:this.bootId+':'+seq,key,edge:'toggle',transport:this.kind,capturedAt:new Date().toISOString()});
    this.listeners.forEach(listener=>listener(event));return event;
  }
}

