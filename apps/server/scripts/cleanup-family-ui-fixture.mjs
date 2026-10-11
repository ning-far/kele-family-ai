import pg from 'pg';
import assert from 'node:assert/strict';
const url=new URL(process.env.MIGRATION_DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55432');
const client=new pg.Client({connectionString:url.href});await client.connect();
try{
 const roles=await client.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'kele_ui_%'");
 assert.equal(roles.rows.length,1,'Expected exactly one disposable UI fixture role');
 const role=roles.rows[0].rolname;assert.match(role,/^kele_ui_[0-9a-f]{32}$/);
 const targets=await client.query("SELECT DISTINCT f.id,f.created_by FROM kele.families f JOIN kele.member_profiles p ON p.family_id=f.id WHERE f.name='验收家庭' AND p.display_name='验收小朋友' AND p.age_band='child'");
 assert.equal(targets.rows.length,1,'Ambiguous disposable fixture; refusing cleanup');
 const {id,userId}= {id:targets.rows[0].id,userId:targets.rows[0].created_by};
 await client.query('BEGIN');
 for(const table of ['login_sessions','login_proofs','profile_creation_operations'])await client.query(`DELETE FROM kele.${table} WHERE user_id=$1`,[userId]);
 for(const table of ['reward_ledger','learning_progress','activity_attempts','profile_grants','member_profiles','family_memberships'])await client.query(`DELETE FROM kele.${table} WHERE family_id=$1`,[id]);
 await client.query('DELETE FROM kele.families WHERE id=$1',[id]);
 await client.query('DELETE FROM kele.users WHERE id=$1',[userId]);
 await client.query(`DROP OWNED BY ${role}`);await client.query(`DROP ROLE ${role}`);
 await client.query('COMMIT');console.log('Disposable UI fixture records and role removed; no other family affected.');
}catch(error){await client.query('ROLLBACK');throw error;}
finally{await client.end();}
