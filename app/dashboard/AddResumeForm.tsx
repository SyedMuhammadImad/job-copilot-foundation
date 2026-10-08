"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
export default function AddResumeForm(){const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const active=useRef(false);const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(active.current)return;const value=text.trim();if(!value||value.length>40000){setError('Enter a note between 1 and 40,000 characters.');return;}active.current=true;setBusy(true);setError('');
  try{const {data,error}=await createClient().from('resumes').insert({raw_text:value}).select('id').single();if(error||!data)throw new Error('Save failed. Your text is still here; check your connection or sign in again.');setText('');router.refresh();}
  catch(cause){setError(cause instanceof Error?cause.message:'Unable to save. Your text is still here.');}finally{active.current=false;setBusy(false);}}
 return <form className="card" onSubmit={submit}><h2>Add a resume note</h2><label htmlFor="new-note">Resume text or notes</label><textarea id="new-note" rows={7} maxLength={40000} required value={text} onChange={e=>setText(e.target.value)} disabled={busy}/><p className="muted">{text.length.toLocaleString()} / 40,000 characters</p><button disabled={busy||!text.trim()}>{busy?'Saving…':'Save note'}</button>{error&&<p className="error" role="alert">{error}</p>}</form>;
}
