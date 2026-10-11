import {createHash,randomBytes} from 'node:crypto';
import type {DatabasePool} from './profile-repository.ts';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function createSessionRepository(pool:DatabasePool){
 return {
  async exchange(userId:string,verifiedProof:string){
   const token=randomBytes(32).toString('base64url'),hash=digest(token),expiresAt=new Date(Date.now()+30*60*1000);
   const connection=await pool.connect();
   try{
    await connection.query('BEGIN');
    await connection.query("SELECT set_config('kele.actor_id',$1,true)",[userId]);
    const consumed=await connection.query('INSERT INTO kele.login_proofs(proof_hash,user_id) VALUES($1,$2) ON CONFLICT(proof_hash) DO NOTHING RETURNING proof_hash',[digest(verifiedProof),userId]);
    if(!consumed.rows.length)throw new Error('LOGIN_PROOF_REPLAYED');
    await connection.query('INSERT INTO kele.login_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hash,userId,expiresAt.toISOString()]);
    await connection.query('COMMIT');return {token,expiresAt:expiresAt.toISOString()};
   }catch(error){await connection.query('ROLLBACK');throw error;}
   finally{connection.release();}
  },
  async verify(token:string):Promise<{userId:string}|null>{
   if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
   const connection=await pool.connect();
   try{
    await connection.query('BEGIN');
    await connection.query("SELECT set_config('kele.session_hash',$1,true)",[digest(token)]);
    const result=await connection.query<{user_id:string}>('SELECT user_id FROM kele.login_sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',[digest(token)]);
    await connection.query('COMMIT');return result.rows[0]?{userId:result.rows[0].user_id}:null;
   }catch(error){await connection.query('ROLLBACK');throw error;}
   finally{connection.release();}
  },
  async revoke(userId:string,token:string){
   const connection=await pool.connect();
   try{
    await connection.query('BEGIN');
    await connection.query("SELECT set_config('kele.actor_id',$1,true),set_config('kele.session_hash',$2,true)",[userId,digest(token)]);
    await connection.query('UPDATE kele.login_sessions SET revoked_at=now() WHERE token_hash=$1 AND user_id=$2 AND revoked_at IS NULL',[digest(token),userId]);
    await connection.query('COMMIT');
   }catch(error){await connection.query('ROLLBACK');throw error;}
   finally{connection.release();}
  }
 };
}
