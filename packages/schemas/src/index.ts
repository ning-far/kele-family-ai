import { z } from 'zod';
export const ModeIdSchema = z.enum(['rhythm-game','primary-english','idiom-chain','voice-input-bridge','companion-chat','creator-studio']);
export type ModeId = z.infer<typeof ModeIdSchema>;
export const ModeManifestSchema = z.object({
  id: ModeIdSchema, version: z.string().regex(/^\d+\.\d+\.\d+$/), title: z.string().min(1),
  description: z.string().min(1), category: z.enum(['play','learn','companion','create']),
  audiences: z.array(z.enum(['child','senior','adult'])).min(1),
  entry: z.object({web:z.string().startsWith('/'),miniprogram:z.string().startsWith('/')}).strict(),
  device:z.object({optional:z.boolean(),capabilities:z.array(z.string())}).strict(),
  permissions:z.array(z.string()), settingsSchema:z.record(z.string(),z.unknown()),
  telemetryEvents:z.array(z.string())
}).strict();
export type ModeManifest = z.infer<typeof ModeManifestSchema>;
export const AgentStateSchema=z.enum(['idle','waking','listening','transcribing','understanding','needs_input','planning','awaiting_confirmation','executing','paused','completed','failed','error','cancelled','expired']);
export type AgentState=z.infer<typeof AgentStateSchema>;
export const CreateRunSchema=z.object({
  schemaVersion:z.literal('1.0'),memberId:z.uuid(),hostSessionId:z.uuid().optional(),priorRunId:z.uuid().optional(),
  input:z.discriminatedUnion('type',[
    z.object({type:z.literal('text'),text:z.string().trim().min(1).max(2000)}).strict(),
    z.object({type:z.literal('audio'),uploadId:z.uuid()}).strict()
  ])
}).strict();
export const DeviceInputSchema=z.object({
  schemaVersion:z.literal('1.0'),deviceId:z.string().min(1).max(128),bootId:z.string().min(1).max(128),
  seq:z.number().int().nonnegative(),eventId:z.string().min(1).max(128),
  key:z.enum(['S1','S2','S3','S4','S5','S6']),edge:z.enum(['down','up','toggle']),
  transport:z.enum(['usb-serial','web-bluetooth','wechat-ble','simulator']),capturedAt:z.iso.datetime()
}).strict();
export type DeviceInput=z.infer<typeof DeviceInputSchema>;
export const OpenModeInputSchema=z.object({modeId:ModeIdSchema}).strict();

