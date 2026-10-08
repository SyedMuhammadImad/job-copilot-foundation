// Isolated integration: local GoTrue/PostgREST fixture, real RLS, signed sessions and a production build.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startFixture,accounts} from './mock_supabase.mjs';
const origin='http://127.0.0.1:9132';
const next=new URL('../node_modules/next/dist/bin/next',import.meta.url);
async function child(args,env){
 const process_=spawn(process.execPath,[next.pathname.replace(/^\/(?=[A-Za-z]:)/,''),...args],{env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';process_.stdout.on('data',x=>{output+=x});process_.stderr.on('data',x=>{output+=x});
 return {process_,output:()=>output,finish:()=>new Promise((resolve,reject)=>{process_.once('error',reject);process_.once('exit',code=>code===0?resolve():reject(new Error('Next process failed: '+output.slice(-4000))));})};
}
test('production browser auth, isolated note CRUD, error preservation, confirmation and refresh cookies', {timeout:420000},async()=>{
 const fixture=await startFixture();let browser,server;
 try{
  const env={NEXT_PUBLIC_SUPABASE_URL:fixture.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:fixture.publicKey,NEXT_TELEMETRY_DISABLED:'1'};
  console.log('Building production application');const build=await child(['build'],env);await build.finish();console.log('Build passed; starting browser checks');
  server=await child(['start','--hostname','127.0.0.1','--port','9132'],env);
  let running=false;
  for(let i=0;i<100;i++){try{const response=await fetch(origin);if(response.ok){running=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(running,'Production server must start');
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??(process.platform==='win32'?'msedge':undefined)});
  const first=await browser.newContext();const page=await first.newPage();page.on('requestfailed',request=>console.log('Request failed:',new URL(request.url()).pathname,request.failure()?.errorText));page.on('console',message=>{if(message.type()==='error')console.log('Console error:',message.text().slice(0,500));});page.on('pageerror',error=>console.log('Browser error:',error.message));page.on('response',async response=>{if(response.url().includes('/rest/'))console.log('Data response:',response.request().method(),response.status(),await response.text());});
  await page.goto(origin+'/dashboard');assert.ok(page.url().endsWith('/login'));
  await page.getByLabel('Email',{exact:true}).fill(accounts[0].email);await page.getByLabel('Password',{exact:true}).fill('invalid password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('p[role=alert]').waitFor();assert.match(await page.locator('p[role=alert]').innerText(),/Sign in failed/);
  await page.getByLabel('Password',{exact:true}).fill(fixture.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  console.log('Authentication passed');const original='<script>globalThis.LEAK_TEST=true</script> Systems engineer resume';
  await page.getByLabel('Resume text or notes').fill(original);await page.getByRole('button',{name:'Save note',exact:true}).click();
  try{await page.getByRole('article',{name:'Saved resume note'}).waitFor();}catch(error){console.log('Dashboard state:',await page.locator('main').innerText());throw error;}assert.equal(await page.locator('.note-preview').textContent(),original);assert.equal(await page.evaluate(()=>globalThis.LEAK_TEST),undefined);
  const failedText='Preserved unsaved note after temporary outage';fixture.mode.failInsert=true;
  await page.getByLabel('Resume text or notes').fill(failedText);await page.getByRole('button',{name:'Save note',exact:true}).click();await page.locator('p[role=alert]').waitFor();assert.equal(await page.getByLabel('Resume text or notes').inputValue(),failedText);assert.equal(await page.getByRole('article').count(),1);
  fixture.mode.failInsert=false;await page.getByRole('button',{name:'Save note',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  const second=await browser.newContext();const other=await second.newPage();await other.goto(origin+'/login');await other.getByLabel('Email',{exact:true}).fill(accounts[1].email);await other.getByLabel('Password',{exact:true}).fill(fixture.password);await other.getByRole('button',{name:'Sign in',exact:true}).click();await other.waitForURL('**/dashboard');assert.equal(await other.getByRole('article').count(),0);
  await other.getByLabel('Resume text or notes').fill('Second account note');await other.getByRole('button',{name:'Save note',exact:true}).click();await other.getByRole('article').waitFor();
  await page.reload();assert.equal(await page.getByRole('article').count(),2);assert.equal(await page.getByText('Second account note',{exact:true}).count(),0);
  const note=page.getByRole('article').nth((await page.getByRole('article').allTextContents()).findIndex(text=>text.includes(original)));await note.getByRole('button',{name:'Edit note',exact:true}).click();await note.getByLabel('Edit resume note').fill('Updated first-account note');await note.getByRole('button',{name:'Save changes'}).click();await page.getByText('Updated first-account note',{exact:true}).waitFor();
  const saved=page.getByRole('article').filter({hasText:'Updated first-account note'});await saved.getByRole('button',{name:'Delete note',exact:true}).click();await saved.getByRole('button',{name:'Keep note'}).click();assert.equal(await page.getByRole('article').count(),2);
  await saved.getByRole('button',{name:'Delete note',exact:true}).click();await saved.getByRole('button',{name:'Confirm delete'}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length===1);
  await other.reload();assert.equal(await other.getByRole('article').count(),1);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const dashboardResponse=await first.request.get(origin+'/dashboard');assert.match(dashboardResponse.headers()['cache-control'],/private.*no-store/);
  console.log('CRUD and account isolation passed');const cookies=(await first.cookies()).filter(x=>x.name.includes('auth-token'));assert.equal(cookies.length,1);
  const expiredContext=await browser.newContext();const expired=fixture.session(accounts[0],-60);fixture.mode.rejectRefresh=true;
  await expiredContext.addCookies([{...cookies[0],value:'base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url'),expires:-1}]);
  const redirect=await expiredContext.request.get(origin+'/dashboard',{maxRedirects:0});assert.equal(redirect.status(),307);assert.ok(redirect.headers().location.endsWith('/login'));
  assert.ok(redirect.headers()['set-cookie']?.includes(cookies[0].name),'Refreshed/cleared auth cookie must survive redirect');assert.match(redirect.headers()['cache-control'],/private/);fixture.mode.rejectRefresh=false;
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');await page.goto(origin+'/dashboard');assert.ok(page.url().endsWith('/login'));
  await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('confirmation@example.test');await page.getByLabel('Password',{exact:true}).fill(fixture.password);await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('status').waitFor();assert.match(await page.getByRole('status').textContent(),/confirmation/);assert.ok(page.url().endsWith('/login'));
  console.log('Expiry, logout and confirmation passed');if(process.env.VERIFICATION_OUTPUT)await writeFile(process.env.VERIFICATION_OUTPUT,JSON.stringify({passed:true,production_build:true,real_postgres_rls:true,provider:'local mock with ephemeral ES256 sessions',cases:['anonymous redirect','invalid signin','valid signin','safe literal note rendering','create','failed save preserves text','cross-user visibility','edit','cancel deletion','delete','other-owner preservation','mobile width','private cache headers','expired-session redirect preserves cookie clearing','signout','email confirmation stays logged out'],limitation:'Hosted Supabase delivery/deployment and real email are not certified'},null,2));
 }finally{if(browser)await browser.close();if(server)server.process_.kill();await fixture.close();}
});
