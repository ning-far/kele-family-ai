import {parseInvitationQuery,type InvitationQuery,type InvitationPage} from './invitation-reader.ts';
import type {InvitationResult} from './invitation-repository.ts';
import type {AcceptanceResult} from './invitation-acceptance-repository.ts';
import type {PermissionSnapshot} from './permission-repository.ts';
import type {LearningExport} from './export-repository.ts';
import {createServer,type IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';
import {modes} from '@kele/mode-registry';
import {readJsonBody} from './request-body.ts';
import type {DeletionResult} from './deletion-repository.ts';
import type {ProgressSnapshot} from './progress-repository.ts';
import {parseSettingsWrite,type SettingsSnapshot,type SettingsWrite} from './settings-repository.ts';
import {recognitionQuestions,parseRecognitionInput,type RecognitionInput,type RecognitionResult} from './english-assessment.ts';
import {readSessionCookie,sessionCookie,type SessionRepository} from './browser-session.ts';
export type IdentityVerifier = (req:IncomingMessage)=>Promise<{userId:string}|null>;
export type ProfileSummary = {id:string;familyId:string;displayName:string;ageBand:'child'|'adult'|'senior'};
export type ProfileReader = (verifiedUserId:string)=>Promise<ProfileSummary[]>;
export type MemberWriter=(userId:string,familyId:string,operationId:string,input:{displayName:string;ageBand:'child'|'adult'|'senior'})=>Promise<{profile:ProfileSummary;replayed:boolean}>;
export function createApp(options:{acceptInvitation?:(actor:string,id:string)=>Promise<AcceptanceResult>;listInvitations?:(actor:string,input:InvitationQuery)=>Promise<InvitationPage>;revokeInvitation?:(actor:string,id:string)=>Promise<{id:string;status:'revoked'}>;createInvitation?:(actor:string,familyId:string,operationId:string,profileId:string,recipient:string)=>Promise<InvitationResult>;readPermissions?:(userId:string,profileId:string)=>Promise<PermissionSnapshot>;exportLearning?:(userId:string,profileId:string)=>Promise<LearningExport>;checkDatabase?:()=>Promise<void>;readSettings?:(userId:string,profileId:string)=>Promise<SettingsSnapshot>;writeSettings?:(userId:string,profileId:string,input:SettingsWrite)=>Promise<SettingsSnapshot>;verifyIdentity?:IdentityVerifier;listAuthorizedProfiles?:ProfileReader;createFamily?:(userId:string,name:string,operationId?:string)=>Promise<{familyId:string;profileId:string;name:string;replayed?:boolean}>;deleteProfile?:(userId:string,profileId:string,operationId:string)=>Promise<DeletionResult>;readDeletion?:(userId:string,jobId:string)=>Promise<DeletionResult|null>;readProgress?:(userId:string,profileId:string)=>Promise<ProgressSnapshot>;submitRecognition?:(userId:string,profileId:string,operationId:string,input:RecognitionInput)=>Promise<RecognitionResult>;createMember?:MemberWriter;browserAuth?:{sessions:SessionRepository;verifyProof:IdentityVerifier;origin:string;secure:boolean}}={}){
 return createServer(async(req,res)=>{
  const invitationUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const requestId=randomUUID();res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const path=(req.url??'/').split('?')[0];
  if(req.method==='POST'&&['/api/v1/auth/exchange','/api/v1/auth/logout'].includes(path)){
   const auth=options.browserAuth;
   if(!auth){res.statusCode=503;res.end(JSON.stringify({error:{code:'LOGIN_NOT_CONFIGURED',message:'登录服务尚未接入',retryable:false},requestId}));return;}
   if(req.headers.origin!==auth.origin){res.statusCode=403;res.end(JSON.stringify({error:{code:'ORIGIN_REJECTED',message:'请在平台页面进行登录操作',retryable:false},requestId}));return;}
   try{
    if(path.endsWith('/exchange')){
     const input=await readJsonBody(req);
     if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('consent' in input)||input.consent!==true)throw new Error('LOGIN_CONSENT_REQUIRED');
     const actor=await auth.verifyProof(req);
     if(!actor?.userId)throw new Error('UNAUTHENTICATED');
     const header=req.headers.authorization;
     if(!header?.startsWith('Bearer '))throw new Error('UNAUTHENTICATED');
     const session=await auth.sessions.exchange(actor.userId,header.slice(7));
     res.setHeader('Set-Cookie',sessionCookie(session.token,auth.secure));
     res.end(JSON.stringify({data:{userId:actor.userId,expiresAt:session.expiresAt},requestId}));return;
    }
    const token=readSessionCookie(req);
    const actor=token?await auth.sessions.verify(token):null;
    if(actor&&token)await auth.sessions.revoke(actor.userId,token);
    res.setHeader('Set-Cookie',sessionCookie('',auth.secure,0));res.statusCode=204;res.end();return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['LOGIN_CONSENT_REQUIRED','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='UNAUTHENTICATED'?401:code==='LOGIN_PROOF_REPLAYED'?409:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'LOGIN_UNAVAILABLE':code,message:res.statusCode===409?'登录证明已使用，请重新登录':'登录操作未完成，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='GET'&&path==='/healthz'){res.end(JSON.stringify({data:{status:'ok',environment:'local-scaffold',database:options.checkDatabase?'configured':'not-configured',ai:'not-configured'},requestId}));return;}
  if(req.method==='GET'&&path==='/readyz'){
   if(!options.checkDatabase){res.statusCode=503;res.end(JSON.stringify({data:{ready:false,database:'not-configured'},requestId}));return;}
   try{await options.checkDatabase();const ready=Boolean(options.verifyIdentity);res.statusCode=ready?200:503;res.end(JSON.stringify({data:{ready,database:'reachable',identity:ready?'configured':'not-configured'},requestId}));}
   catch{res.statusCode=503;res.end(JSON.stringify({data:{ready:false,database:'unreachable'},requestId}));}return;
  }
  if(req.method==='GET'&&path==='/api/v1/modes'){res.end(JSON.stringify({data:modes,requestId}));return;}
  if(req.method==='GET'&&path==='/api/v1/invitations'){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=parseInvitationQuery(new URL(req.url!,'http://localhost').searchParams);
    if(!options.listInvitations)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.listInvitations(actor.userId,input),requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';res.statusCode=code==='INVALID_INVITATION_QUERY'?400:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'INVITATIONS_UNAVAILABLE':code,message:'邀请列表暂未读取，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const invitationFamily=path.match(/^\/api\/v1\/families\/([0-9a-f-]{36})\/invitations$/i);
  const invitationRevoke=path.match(/^\/api\/v1\/invitations\/([0-9a-f-]{36})\/revoke$/i);
  const invitationAccept=path.match(/^\/api\/v1\/invitations\/([0-9a-f-]{36})\/accept$/i);
  if(req.method==='POST'&&invitationAccept){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('confirmedInvitationId' in input)||input.confirmedInvitationId!==invitationAccept[1]||!invitationUUID.test(invitationAccept[1]))throw new Error('INVALID_INVITATION');
    if(!options.acceptInvitation)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.acceptInvitation(actor.userId,invitationAccept[1]),requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_INVITATION','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:['INVITATION_EXPIRED','INVITATION_REVOKED'].includes(code)?410:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'INVITATION_UNAVAILABLE':code,message:res.statusCode===410?'邀请已失效，请联系邀请人':res.statusCode===403?'当前账号不能接受此邀请':'接受未完成，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='POST'&&invitationRevoke){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('confirmedInvitationId' in input)||input.confirmedInvitationId!==invitationRevoke[1])throw new Error('INVALID_INVITATION');
    if(!invitationUUID.test(invitationRevoke[1]))throw new Error('INVALID_INVITATION');
    if(!options.revokeInvitation)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.revokeInvitation(actor.userId,invitationRevoke[1]),requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    res.statusCode=['INVALID_INVITATION','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code)?400:code==='FORBIDDEN'?403:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'REVOCATION_UNAVAILABLE':code,message:'邀请撤销尚未确认，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='POST'&&invitationFamily){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req),operationId=req.headers['idempotency-key'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==3||!('profileId' in input)||!('recipientUserId' in input)||!('confirmedRecipientUserId' in input)||typeof input.profileId!=='string'||typeof input.recipientUserId!=='string'||input.recipientUserId!==input.confirmedRecipientUserId||typeof operationId!=='string')throw new Error('INVALID_INVITATION');
    if(![invitationFamily[1],input.profileId,input.recipientUserId,operationId].every(value=>invitationUUID.test(value))||input.recipientUserId.toLowerCase()===actor.userId.toLowerCase())throw new Error('INVALID_INVITATION');
    if(!options.createInvitation)throw new Error('DATABASE_UNAVAILABLE');
    const data=await options.createInvitation(actor.userId,invitationFamily[1],operationId,input.profileId,input.recipientUserId);
    res.statusCode=data.replayed?200:201;res.end(JSON.stringify({data,requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_INVITATION','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:code==='IDEMPOTENCY_CONFLICT'?409:['INVITATION_EXPIRED','INVITATION_REVOKED'].includes(code)?410:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'INVITATION_UNAVAILABLE':code,message:res.statusCode===410?'邀请已失效，请重新确认创建':res.statusCode===409?'邀请内容与此前操作不同':'邀请尚未创建，请检查权限和目标后重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const permissionsTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})\/permissions$/i);
  if(req.method==='GET'&&permissionsTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    if(!options.readPermissions)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.readPermissions(actor.userId,permissionsTarget[1]),requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    res.statusCode=code==='INVALID_ID'?400:code==='FORBIDDEN'?403:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'PERMISSIONS_UNAVAILABLE':code,message:res.statusCode===403?'无权使用此成员档案':'权限暂未读取，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const exportTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})\/learning-export$/i);
  if(req.method==='POST'&&exportTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('confirmedProfileId' in input)||input.confirmedProfileId!==exportTarget[1])throw new Error('EXPORT_CONFIRMATION_REQUIRED');
    if(!options.exportLearning)throw new Error('DATABASE_UNAVAILABLE');
    const data=await options.exportLearning(actor.userId,exportTarget[1]);
    res.setHeader('Content-Disposition','attachment; filename="kele-learning-export.json"');
    res.end(JSON.stringify(data));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['EXPORT_CONFIRMATION_REQUIRED','INVALID_ID','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:code==='EXPORT_TOO_LARGE'?413:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'EXPORT_UNAVAILABLE':code,message:res.statusCode===413?'数据较多，需要异步导出，当前功能尚未接入':res.statusCode===403?'无权导出此成员数据':'导出未完成，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const settingsTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})\/settings$/i);
  if((req.method==='GET'||req.method==='PUT')&&settingsTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    let result:SettingsSnapshot;
    if(req.method==='PUT'){
     const input=parseSettingsWrite(await readJsonBody(req));
     if(!options.writeSettings)throw new Error('DATABASE_UNAVAILABLE');
     result=await options.writeSettings(actor.userId,settingsTarget[1],input);
    }else{
     if(!options.readSettings)throw new Error('DATABASE_UNAVAILABLE');
     result=await options.readSettings(actor.userId,settingsTarget[1]);
    }
    res.end(JSON.stringify({data:result,requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_ID','INVALID_SETTINGS','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:code==='SETTINGS_VERSION_CONFLICT'?409:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'SETTINGS_UNAVAILABLE':code,message:res.statusCode===409?'设置已在其他设备更新，请重新加载后再保存':res.statusCode===403?'无权使用此档案设置':'设置暂未保存，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='GET'&&path==='/api/v1/english/recognition'){res.end(JSON.stringify({data:recognitionQuestions(),requestId}));return;}
  const recognitionTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})\/english\/recognition$/i);
  if(req.method==='POST'&&recognitionTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=parseRecognitionInput(await readJsonBody(req)),operationId=req.headers['idempotency-key'];
    if(typeof operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))throw new Error('INVALID_ID');
    if(!options.submitRecognition)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.submitRecognition(actor.userId,recognitionTarget[1],operationId,input),requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_ID','INVALID_ANSWER','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:['IDEMPOTENCY_CONFLICT','CONTENT_VERSION_CONFLICT'].includes(code)?409:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'ASSESSMENT_UNAVAILABLE':code,message:res.statusCode===409?'题目或提交内容已变化，请重新加载':res.statusCode===403?'无权使用此档案':'学习结果未保存，请重试',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const memberFamily=path.match(/^\/api\/v1\/families\/([0-9a-f-]{36})\/members$/i);
  if(req.method==='POST'&&memberFamily){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req),operationId=req.headers['idempotency-key'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['displayName','ageBand'].includes(key))||!('displayName' in input)||typeof input.displayName!=='string'||!input.displayName.trim()||input.displayName.trim().length>80||!('ageBand' in input)||!['child','adult','senior'].includes(String(input.ageBand))||typeof operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))throw new Error('INVALID_PROFILE');
    if(!options.createMember)throw new Error('DATABASE_UNAVAILABLE');
    const result=await options.createMember(actor.userId,memberFamily[1],operationId,{displayName:input.displayName.trim(),ageBand:input.ageBand as 'child'|'adult'|'senior'});
    res.statusCode=result.replayed?200:201;res.end(JSON.stringify({data:result.profile,requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_ID','INVALID_PROFILE','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:code==='IDEMPOTENCY_CONFLICT'?409:code==='PROFILE_DELETED'?410:503;
    res.end(JSON.stringify({error:{code:res.statusCode===503?'PROFILE_UNAVAILABLE':code,message:invalid?'请检查成员名称和年龄组':code==='PROFILE_DELETED'?'原档案已删除，请重新创建':'暂时无法创建成员',retryable:res.statusCode===503},requestId}));return;
   }
  }
  const progressTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})\/progress$/i);
  if(req.method==='GET'&&progressTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    if(!options.readProgress)throw new Error('DATABASE_UNAVAILABLE');
    res.end(JSON.stringify({data:await options.readProgress(actor.userId,progressTarget[1]),requestId}));return;
   }catch(error){const code=error instanceof Error?error.message:'';res.statusCode=code==='FORBIDDEN'?403:code==='INVALID_ID'?400:503;res.end(JSON.stringify({error:{code:res.statusCode===503?'PROGRESS_UNAVAILABLE':code,message:res.statusCode===403?'无权读取此档案进度':'进度暂时不可用',retryable:res.statusCode===503},requestId}));return;}
  }
  const deletionJob=path.match(/^\/api\/v1\/deletion-jobs\/([0-9a-f-]{36})$/i);
  if(req.method==='GET'&&deletionJob){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    if(!options.readDeletion)throw new Error('DATABASE_UNAVAILABLE');
    const result=await options.readDeletion(actor.userId,deletionJob[1]);
    if(!result){res.statusCode=404;res.end(JSON.stringify({error:{code:'NOT_FOUND',message:'任务不存在或无权查看',retryable:false},requestId}));return;}
    res.end(JSON.stringify({data:{...result,message:result.status==='completed'?'在线结构化数据已清理，备份删除状态需按运维流程核实':'档案已隐藏，清理尚未完成'},requestId}));return;
   }catch{res.statusCode=503;res.end(JSON.stringify({error:{code:'DELETION_UNAVAILABLE',message:'删除任务暂时不可用',retryable:true},requestId}));return;}
  }
  const deletionTarget=path.match(/^\/api\/v1\/members\/([0-9a-f-]{36})$/i);
  if(req.method==='DELETE'&&deletionTarget){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req),operationId=req.headers['idempotency-key'];
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!('confirmProfileId' in input)||input.confirmProfileId!==deletionTarget[1]||typeof operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))throw new Error('DELETION_CONFIRMATION_REQUIRED');
    if(!options.deleteProfile)throw new Error('DATABASE_UNAVAILABLE');
    const result=await options.deleteProfile(actor.userId,deletionTarget[1],operationId);
    res.statusCode=202;res.end(JSON.stringify({data:{...result,message:'档案已隐藏，清理任务尚未完成'},requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['DELETION_CONFIRMATION_REQUIRED','INVALID_ID','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='FORBIDDEN'?403:code==='IDEMPOTENCY_CONFLICT'?409:503;
    res.end(JSON.stringify({error:{code:invalid||['FORBIDDEN','IDEMPOTENCY_CONFLICT'].includes(code)?code:'DELETION_UNAVAILABLE',message:invalid?'请明确确认要删除的档案':code==='FORBIDDEN'?'无权删除此档案':'删除任务暂时不可用',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='POST'&&path==='/api/v1/families'){
   try{
    const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
    if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
    const input=await readJsonBody(req);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='name')||!('name' in input)||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80)throw new Error('INVALID_FAMILY_NAME');
    if(!options.createFamily){res.statusCode=503;res.end(JSON.stringify({error:{code:'DATABASE_UNAVAILABLE',message:'家庭数据服务尚未接入',retryable:true},requestId}));return;}
    const operationId=req.headers['idempotency-key'];if(typeof operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId))throw new Error('INVALID_ID');const result=await options.createFamily(actor.userId,input.name.trim(),operationId);res.statusCode=result.replayed?200:201;res.end(JSON.stringify({data:result,requestId}));return;
   }catch(error){
    const code=error instanceof Error?error.message:'';
    const invalid=['INVALID_ID','INVALID_FAMILY_NAME','INVALID_JSON','BODY_TOO_LARGE','UNSUPPORTED_CONTENT_TYPE'].includes(code);
    res.statusCode=invalid?400:code==='IDEMPOTENCY_CONFLICT'?409:code==='FAMILY_UNAVAILABLE_FOR_REPLAY'?410:503;res.end(JSON.stringify({error:{code:res.statusCode===503?'FAMILY_UNAVAILABLE':code,message:invalid?'请检查家庭名称和请求格式':'家庭创建暂时不可用',retryable:res.statusCode===503},requestId}));return;
   }
  }
  if(req.method==='GET'&&path==='/api/v1/session'){
    try {
      const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
      if(!actor || typeof actor.userId!=='string' || !actor.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
      res.end(JSON.stringify({data:{userId:actor.userId},requestId}));return;
    } catch {
      res.statusCode=503;res.end(JSON.stringify({error:{code:'IDENTITY_UNAVAILABLE',message:'登录验证暂时不可用',retryable:true},requestId}));return;
    }
  }
  if(req.method==='GET'&&path==='/api/v1/profiles'){
    try {
      const actor=options.verifyIdentity?await options.verifyIdentity(req):null;
      if(!actor?.userId){res.statusCode=401;res.end(JSON.stringify({error:{code:'UNAUTHENTICATED',message:'请先登录',retryable:false},requestId}));return;}
      if(!options.listAuthorizedProfiles){res.statusCode=503;res.end(JSON.stringify({error:{code:'DATABASE_UNAVAILABLE',message:'家庭数据服务尚未接入',retryable:true},requestId}));return;}
      const profiles=await options.listAuthorizedProfiles(actor.userId);
      res.end(JSON.stringify({data:profiles,userId:actor.userId,requestId}));return;
    } catch {
      res.statusCode=503;res.end(JSON.stringify({error:{code:'PROFILE_UNAVAILABLE',message:'家庭档案暂时不可用',retryable:true},requestId}));return;
    }
  }
  res.statusCode=404;res.end(JSON.stringify({error:{code:'NOT_FOUND',message:'接口尚未提供',retryable:false},requestId}));
 });
}
