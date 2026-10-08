"use client";
import Link from 'next/link';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {publicConfig} from '@/lib/config';
export default function LoginPage(){
 const router=useRouter();const active=useRef(false);const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [mode,setMode]=useState<'signin'|'signup'>('signin');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 if(!publicConfig())return <main><h1>Workspace configuration required</h1><Link href="/">Back to setup</Link></main>;
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(active.current)return;active.current=true;setBusy(true);setMessage('');setError('');
  try{
   const client=createClient();const values={email:email.trim(),password};
   if(mode==='signin'){const result=await client.auth.signInWithPassword(values);if(result.error)throw new Error('Sign in failed. Check your email and password.');}
   else{const result=await client.auth.signUp(values);if(result.error)throw new Error('Account creation failed. Check the details or try signing in.');
    if(!result.data.session){setMessage('Check your email for the confirmation link, then sign in.');setMode('signin');setPassword('');return;}}
   router.replace('/dashboard');router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to connect. Please try again.');}
  finally{active.current=false;setBusy(false);}
 }
 return <main><p className="eyebrow">Job Copilot</p><h1>{mode==='signin'?'Welcome back':'Create your account'}</h1><p>Your notes are visible only to your account.</p>
  <form onSubmit={submit} className="card"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
  <label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode==='signin'?'current-password':'new-password'} minLength={mode==='signup'?8:1} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
  {mode==='signup'&&<p className="muted">Use at least eight characters. Email confirmation may be required.</p>}
  <button disabled={busy} type="submit">{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</button>
  <button className="secondary" type="button" disabled={busy} onClick={()=>{setMode(mode==='signin'?'signup':'signin');setError('');setMessage('');}}>{mode==='signin'?'Create an account':'Use an existing account'}</button>
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  </form><Link href="/">Back to home</Link></main>;
}
