import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('real Postgres role/row isolation, CRUD, ownership, bounds and repeatable setup',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon nologin; create role authenticated nologin;create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${A}'),('${B}');`);
    const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
    async function as(role,user,query,parameters=[]){
      await db.exec('begin');
      try{
        await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
        const result=await db.query(query,parameters);await db.exec('commit');return result;
      }catch(error){await db.exec('rollback');throw error;}
    }
    await assert.rejects(as('anon','','select * from public.resumes'),/permission denied/i);
    await assert.rejects(as('authenticated','','insert into public.resumes(raw_text) values ($1)',['Unknown owner']),/null|row-level/i);
    const a=(await as('authenticated',A,'insert into public.resumes(raw_text) values ($1) returning id,user_id',['A resume note'])).rows[0];assert.equal(a.user_id,A);
    const b=(await as('authenticated',B,'insert into public.resumes(raw_text) values ($1) returning id,user_id',['B resume note'])).rows[0];assert.equal(b.user_id,B);
    assert.deepEqual((await as('authenticated',A,'select id from public.resumes')).rows,[{id:a.id}]);
    assert.deepEqual((await as('authenticated',B,'select id from public.resumes')).rows,[{id:b.id}]);
    assert.equal((await as('authenticated',B,'select id from public.resumes where id=$1',[a.id])).rows.length,0);
    assert.equal((await as('authenticated',B,'update public.resumes set raw_text=$1 where id=$2 returning id',['Stolen',a.id])).rows.length,0);
    assert.equal((await as('authenticated',B,'delete from public.resumes where id=$1 returning id',[a.id])).rows.length,0);
    await assert.rejects(as('authenticated',A,'update public.resumes set user_id=$1 where id=$2',[B,a.id]),/permission denied/i);
    await assert.rejects(as('authenticated',A,'insert into public.resumes(user_id,raw_text) values($1,$2)',[B,'Forged']),/permission denied/i);
    // Ownership policies must also fail if a future grant broadens column permissions.
    await db.exec('grant insert(user_id),update(user_id) on public.resumes to authenticated');
    await assert.rejects(as('authenticated',A,'update public.resumes set user_id=$1 where id=$2',[B,a.id]),/row-level/i);
    await assert.rejects(as('authenticated',A,'insert into public.resumes(user_id,raw_text) values($1,$2)',[B,'Forged']),/row-level/i);
    await db.exec(schema);
    await assert.rejects(as('authenticated',A,'update public.resumes set user_id=$1 where id=$2',[B,a.id]),/permission denied/i);
    for(const value of ['', ' \t\r\n', 'x'.repeat(40001)])await assert.rejects(as('authenticated',A,'insert into public.resumes(raw_text) values($1)',[value]),/check constraint/i);
    await assert.rejects(as('authenticated',A,'insert into public.resumes(raw_text) values($1)',[null]),/not-null/i);
    assert.equal((await as('authenticated',A,'update public.resumes set raw_text=$1 where id=$2 returning raw_text',['Updated note',a.id])).rows[0].raw_text,'Updated note');
    assert.equal((await as('authenticated',A,'delete from public.resumes where id=$1 returning id',[a.id])).rows.length,1);
    assert.equal((await as('authenticated',A,'select id from public.resumes')).rows.length,0);
    assert.equal((await as('authenticated',B,'select id from public.resumes')).rows.length,1);
    const flags=(await db.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='public.resumes'::regclass")).rows[0];assert.equal(flags.relrowsecurity,true);assert.equal(flags.relforcerowsecurity,true);
  }finally{await db.close();}
});
