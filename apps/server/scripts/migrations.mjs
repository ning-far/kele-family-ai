import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';

const directory=new URL('../migrations/',import.meta.url);
const files=(await readdir(directory)).filter(name=>/^\d+_[a-z_]+\.sql$/.test(name)).sort();
const migrations=await Promise.all(files.map(async name=>{
 const sql=await readFile(new URL(name,directory),'utf8');
 return {name,sql,checksum:createHash('sha256').update(sql).digest('hex')};
}));
if(!process.argv.includes('--apply')){
 console.log('Migration preview: '+fileURLToPath(directory));
 for(const migration of migrations)console.log(migration.name+' '+migration.checksum);
 console.log('No database changes performed.');
}else{
 if(!process.env.MIGRATION_DATABASE_URL)throw new Error('MIGRATION_DATABASE_URL_REQUIRED');
 const client=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL,connectionTimeoutMillis:5000});
 await client.connect();
 try{
  await client.query("SELECT pg_advisory_lock(hashtext('kele-migrations'))");
  await client.query('CREATE SCHEMA IF NOT EXISTS kele');
  await client.query('CREATE TABLE IF NOT EXISTS kele.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const migration of migrations){
   const existing=await client.query('SELECT checksum FROM kele.schema_migrations WHERE name=$1',[migration.name]);
   if(existing.rows.length){if(existing.rows[0].checksum!==migration.checksum)throw new Error('MIGRATION_CHECKSUM_CHANGED: '+migration.name);continue;}
   // SQL files own their transaction; inject the ledger write before COMMIT.
   if(!/^BEGIN;/m.test(migration.sql)||!/^COMMIT;\s*$/m.test(migration.sql))throw new Error('MIGRATION_TRANSACTION_REQUIRED');
   const body=migration.sql.replace(/^COMMIT;\s*$/m,'');
   try{
    await client.query(body);
    await client.query('INSERT INTO kele.schema_migrations(name,checksum) VALUES($1,$2)',[migration.name,migration.checksum]);
    await client.query('COMMIT');console.log('Applied '+migration.name);
   }catch(error){await client.query('ROLLBACK');throw error;}
  }
 }finally{await client.end();}
}
