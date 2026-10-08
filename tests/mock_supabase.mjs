// Local test provider: real PostgreSQL RLS and ephemeral signed JWTs; no hosted account or email.
import {createServer} from 'node:http';
import {generateKeyPairSync,sign,verify,randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
export const accounts=[{id:'11111111-1111-4111-8111-111111111111',email:'first@example.test'},
 {id:'22222222-2222-4222-8222-222222222222',email:'second@example.test'}];

export async function startFixture(port=9131){
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk={...publicKey.export({format:'jwk'}),kid:'local-fixture',alg:'ES256',use:'sig'};
 const url='http://127.0.0.1:'+port;const publicKeyValue='sb_publishable_'+randomBytes(24).toString('hex');
 const password=randomBytes(24).toString('base64url');const db=new PGlite();const refreshes=new Map();let queue=Promise.resolve();let mode={failInsert:false,rejectRefresh:false};
 await db.exec(`create role anon nologin; create role authenticated nologin;create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
  insert into auth.users values ('${accounts[0].id}'),('${accounts[1].id}');`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 function tokenFor(account,seconds=3600){
  const now=Math.floor(Date.now()/1000);const message=encoded({alg:'ES256',typ:'JWT',kid:'local-fixture'})+'.'+encoded({sub:account.id,email:account.email,aud:'authenticated',role:'authenticated',iss:url+'/auth/v1',iat:now-20,exp:now+seconds});
  return message+'.'+sign('sha256',Buffer.from(message),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 }
 function authenticated(request){
  const token=(request.headers.authorization??'').replace(/^Bearer /,'');const parts=token.split('.');
  if(parts.length!==3||!verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url')))throw new Error('unauthorized');
  const claims=JSON.parse(Buffer.from(parts[1],'base64url'));if(claims.exp<=Date.now()/1000)throw new Error('expired');
  const account=accounts.find(x=>x.id===claims.sub);if(!account)throw new Error('unknown account');return account;
 }
 function user(account){return {...account,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};}
 function session(account,seconds=3600){const refresh=randomUUID();refreshes.set(refresh,account);return {access_token:tokenFor(account,seconds),token_type:'bearer',expires_in:seconds,expires_at:Math.floor(Date.now()/1000)+seconds,refresh_token:refresh,user:user(account)};}
 async function body(request){let result='';for await(const part of request){result+=part;if(result.length>200000)throw new Error('body too large');}return result?JSON.parse(result):{};}
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 async function transaction(account,sql,values=[]){return serial(async()=>{
  await db.exec('begin');try{await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[account.id]);const result=await db.query(sql,values);await db.exec('commit');return result.rows;}
  catch(error){await db.exec('rollback');throw error;}
 });}
 const server=createServer(async(request,response)=>{
  const target=new URL(request.url,url);
  response.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:9132');response.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version,content-profile,accept-profile');response.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  function send(code,value){response.statusCode=code;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(value));}
  if(request.method==='OPTIONS'){response.statusCode=204;response.end();return;}
  try{
   if(target.pathname==='/health'){send(200,{fixture:true});return;}
   if(target.pathname==='/auth/v1/.well-known/jwks.json'){send(200,{keys:[jwk]});return;}
   if(target.pathname==='/auth/v1/signup'){const values=await body(request);send(200,{id:randomUUID(),email:values.email,aud:'authenticated',email_confirmed_at:null,user_metadata:{},app_metadata:{}});return;}
   if(target.pathname==='/auth/v1/token'){
    const values=await body(request);let account;
    if(target.searchParams.get('grant_type')==='refresh_token'){account=refreshes.get(values.refresh_token);if(mode.rejectRefresh)account=null;}
    else if(values.password===password)account=accounts.find(x=>x.email===values.email);
    if(!account){send(400,{code:'invalid_credentials',msg:'Invalid test credentials'});return;}send(200,session(account));return;
   }
   if(target.pathname==='/auth/v1/user'){send(200,user(authenticated(request)));return;}
   if(target.pathname==='/auth/v1/logout'){authenticated(request);send(200,{});return;}
   if(target.pathname==='/rest/v1/resumes'){
    const account=authenticated(request);const identifier=target.searchParams.get('id');const id=identifier?.replace(/^eq\./,'');
    if(id&&!/^[a-f0-9-]{36}$/i.test(id))throw new Error('invalid id');
    let rows=[];
    if(request.method==='GET')rows=await transaction(account,'select id,raw_text,created_at from public.resumes order by created_at desc limit 100');
    else if(request.method==='POST'){if(mode.failInsert){send(503,{message:'Temporary fixture outage'});return;}const values=await body(request);const record=Array.isArray(values)?values[0]:values;rows=await transaction(account,'insert into public.resumes(raw_text) values($1) returning id,raw_text,created_at',[record.raw_text]);}
    else if(request.method==='PATCH'){const values=await body(request);rows=await transaction(account,'update public.resumes set raw_text=$1 where id=$2 returning id,raw_text,created_at',[values.raw_text,id]);}
    else if(request.method==='DELETE')rows=await transaction(account,'delete from public.resumes where id=$1 returning id,raw_text,created_at',[id]);
    else{send(405,{message:'Unsupported method'});return;}
    const single=(request.headers.accept??'').includes('application/vnd.pgrst.object+json');
    if(single&&rows.length!==1){send(406,{code:'PGRST116',message:'Expected one visible row'});return;}send(200,single?rows[0]:rows);return;
   }
   send(404,{message:'Unknown fixture endpoint'});
  }catch(error){send(error.message==='unauthorized'||error.message==='expired'?401:400,{message:'Fixture request rejected'});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url,publicKey:publicKeyValue,password,session,mode,transaction,close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
