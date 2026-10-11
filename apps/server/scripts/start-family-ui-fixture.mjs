import {createInvitationReader} from '../src/invitation-reader.ts';
import {createInvitationRevoker,createInvitationWriter} from '../src/invitation-repository.ts';
import {createPermissionReader} from '../src/permission-repository.ts';
import {createLearningExporter} from '../src/export-repository.ts';
// Disposable local acceptance fixture. It never uses a production account.
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createApp} from '../src/app.ts';
import {createFamilyWriter} from '../src/family-repository.ts';
import {createMemberWriter} from '../src/member-repository.ts';
import {createProfileReader} from '../src/profile-repository.ts';
import {createProgressReader} from '../src/progress-repository.ts';
import {createAttemptWriter} from '../src/attempt-repository.ts';
import {createRecognitionSubmitter} from '../src/english-assessment.ts';
import {createSettingsRepository} from '../src/settings-repository.ts';
import {createSessionRepository} from '../src/session-repository.ts';
import {createBrowserIdentityVerifier,sessionCookie} from '../src/browser-session.ts';
const url=new URL(process.env.MIGRATION_DATABASE_URL??'');
if(url.hostname!=='127.0.0.1'||url.port!=='55432')throw new Error('LOCAL_DISPOSABLE_DATABASE_REQUIRED');
const owner=new pg.Client({connectionString:url.href});await owner.connect();
const userId=randomUUID(),invitationRecipient=process.env.KELE_FIXTURE_INVITATIONS==='true'?randomUUID():null,role='kele_ui_'+randomUUID().replaceAll('-','');
await owner.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
await owner.query(`GRANT USAGE ON SCHEMA kele TO ${role}`);
await owner.query(`GRANT SELECT,INSERT ON kele.learning_invitations TO ${role}`);
await owner.query(`GRANT UPDATE(revoked_at) ON kele.learning_invitations TO ${role}`);
await owner.query(`GRANT SELECT,INSERT ON kele.families,kele.family_memberships,kele.member_profiles,kele.profile_grants,kele.activity_attempts,kele.reward_ledger,kele.profile_creation_operations,kele.family_creation_operations,kele.login_sessions,kele.login_proofs TO ${role}`);
await owner.query(`GRANT SELECT,INSERT,UPDATE ON kele.learning_progress,kele.member_settings TO ${role}`);
await owner.query(`GRANT UPDATE ON kele.family_memberships,kele.member_profiles,kele.profile_grants TO ${role}`);
await owner.query(`GRANT UPDATE(revoked_at) ON kele.login_sessions TO ${role}`);
await owner.query(`GRANT EXECUTE ON FUNCTION kele.has_profile_permission(uuid,uuid,text) TO ${role}`);
await owner.query(`GRANT EXECUTE ON FUNCTION kele.effective_profile_permissions(uuid,uuid) TO ${role}`);
await owner.query(`GRANT EXECUTE ON FUNCTION kele.invitation_access_is_effective(uuid) TO ${role}`);
await owner.query(`GRANT SELECT ON kele.invitation_access_sources TO ${role}`);
await owner.query('INSERT INTO kele.users(id) VALUES($1)',[userId]);
const connections=new pg.Pool({connectionString:url.href,max:4});
const pool={connect:async()=>{const connection=await connections.connect();await connection.query(`SET ROLE ${role}`);return connection;}};
const family=await createFamilyWriter(pool)(userId,'验收家庭');
const memberWriter=createMemberWriter(pool);
const child=await memberWriter(userId,family.familyId,randomUUID(),{displayName:'验收小朋友',ageBand:'child'});
await memberWriter(userId,family.familyId,randomUUID(),{displayName:'验收长辈',ageBand:'senior'});
await createAttemptWriter(pool)(userId,{familyId:family.familyId,memberId:child.profile.id,operationId:randomUUID(),activityId:'english-recognize',contentVersion:'1',inputHash:'fixture-correct-answer',contentId:'apple',skill:'recognize'});
if(process.env.KELE_FIXTURE_READ_ONLY==='true')await owner.query("DELETE FROM kele.profile_grants WHERE profile_id=$1 AND user_id=$2 AND permission IN ('settings.write','progress.write')",[child.profile.id,userId]);
if(invitationRecipient){
 await owner.query('INSERT INTO kele.users(id) VALUES($1)',[invitationRecipient]);
 await createInvitationWriter(pool)(userId,family.familyId,randomUUID(),child.profile.id,invitationRecipient);
}
const settings=createSettingsRepository(pool);
const sessions=createSessionRepository(pool),origin='http://localhost:5174';
const app=createApp({listInvitations:createInvitationReader(pool),revokeInvitation:createInvitationRevoker(pool),readPermissions:createPermissionReader(pool),exportLearning:createLearningExporter(pool),readSettings:settings.read,writeSettings:settings.write,verifyIdentity:createBrowserIdentityVerifier(async()=>null,sessions,origin),listAuthorizedProfiles:createProfileReader(pool),createFamily:createFamilyWriter(pool),createMember:memberWriter,readProgress:createProgressReader(pool),submitRecognition:createRecognitionSubmitter(createProfileReader(pool),createAttemptWriter(pool)),browserAuth:{sessions,verifyProof:async()=>null,origin,secure:false}});
const server=createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/api/_acceptance/login'){
  res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');
  res.end('<h1>家庭页面独立验收</h1><p>本页只使用本机自动生成的测试账号，不代表真实供应商登录。</p><form method="post" action="/api/_acceptance/enter"><button>使用验收账号</button></form>');return;
 }
 if(req.method==='POST'&&req.url==='/api/_acceptance/enter'){
  if(req.headers.origin!==origin){res.statusCode=403;res.end();return;}
  const session=await sessions.exchange(userId,'disposable-fixture:'+randomUUID());
  res.setHeader('set-cookie',sessionCookie(session.token,false));res.setHeader('location','/family');res.statusCode=303;res.end();return;
 }
 app.emit('request',req,res);
});
await new Promise(resolve=>server.listen(8790,'127.0.0.1',resolve));
console.log('Disposable family fixture ready on 127.0.0.1:8790; type stop to clean up.');
let stopping=false;
async function stop(){
 if(stopping)return;stopping=true;
 await new Promise(resolve=>server.close(resolve));await connections.end();
 await owner.query('DELETE FROM kele.login_sessions WHERE user_id=$1',[userId]);
 await owner.query('DELETE FROM kele.login_proofs WHERE user_id=$1',[userId]);
 await owner.query('DELETE FROM kele.profile_creation_operations WHERE user_id=$1',[userId]);
 for(const table of ['reward_ledger','learning_progress','activity_attempts'])await owner.query(`DELETE FROM kele.${table} WHERE family_id=$1`,[family.familyId]);
 await owner.query('DELETE FROM kele.profile_grants WHERE family_id=$1',[family.familyId]);
 await owner.query('DELETE FROM kele.member_settings WHERE family_id=$1',[family.familyId]);
 await owner.query('DELETE FROM kele.member_profiles WHERE family_id=$1',[family.familyId]);
 await owner.query('DELETE FROM kele.family_memberships WHERE family_id=$1',[family.familyId]);
 await owner.query('DELETE FROM kele.families WHERE id=$1',[family.familyId]);
 await owner.query('DELETE FROM kele.family_creation_operations WHERE user_id=$1',[userId]);
 await owner.query('DELETE FROM kele.users WHERE id=$1',[userId]);
 if(invitationRecipient)await owner.query('DELETE FROM kele.users WHERE id=$1',[invitationRecipient]);
 await owner.query(`DROP OWNED BY ${role}`);await owner.query(`DROP ROLE ${role}`);await owner.end();
 console.log('Disposable fixture data and role removed.');process.exit(0);
}
process.stdin.setEncoding('utf8');process.stdin.on('data',value=>{if(value.trim()==='stop')void stop();});
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
