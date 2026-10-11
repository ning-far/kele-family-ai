import type {DatabasePool} from './profile-repository.ts';
export type AcceptanceResult={id:string;profileId:string;status:'accepted';replayed:boolean};
export function createInvitationAcceptor(pool:DatabasePool){
 return async(actor:string,id:string):Promise<AcceptanceResult>=>{
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(actor)||!uuid.test(id))throw new Error('INVALID_INVITATION');
  const connection=await pool.connect();
  try{
   await connection.query('BEGIN');
   await connection.query("SELECT set_config('kele.actor_id',$1,true)",[actor.toLowerCase()]);
   const result=await connection.query<{id:string;profile_id:string;replayed:boolean}>('SELECT * FROM kele.accept_learning_invitation($1)',[id.toLowerCase()]);
   const row=result.rows[0];if(!row)throw new Error('FORBIDDEN');
   await connection.query('COMMIT');
   return {id:row.id,profileId:row.profile_id,status:'accepted',replayed:row.replayed};
  }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
 };
}
