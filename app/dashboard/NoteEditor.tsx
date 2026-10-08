"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
type Note={id:string,raw_text:string,created_at:string};
export default function NoteEditor({note}:{note:Note}){const router=useRouter();const [editing,setEditing]=useState(false);const [confirm,setConfirm]=useState(false);const [text,setText]=useState(note.raw_text);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const active=useRef(false);
 async function change(remove=false){if(active.current)return;const value=text.trim();if(!remove&&(!value||value.length>40000)){setError('Enter a note between 1 and 40,000 characters.');return;}active.current=true;setBusy(true);setError('');
  try{const client=createClient();const query=remove?client.from('resumes').delete():client.from('resumes').update({raw_text:value});const result=await query.eq('id',note.id).select('id').single();if(result.error||!result.data)throw new Error('Change failed. The note may have been removed or your session may have expired.');setEditing(false);setConfirm(false);router.refresh();}
  catch(cause){setError(cause instanceof Error?cause.message:'Unable to connect. Your edit is still here.');}finally{active.current=false;setBusy(false);}}
 return <article className="card" aria-label="Saved resume note"><p className="muted"><time dateTime={note.created_at}>{new Date(note.created_at).toISOString().slice(0,10)}</time></p>
 {editing?<><label htmlFor={'note-'+note.id}>Edit resume note</label><textarea id={'note-'+note.id} value={text} onChange={e=>setText(e.target.value)} rows={7} required maxLength={40000} disabled={busy}/><button disabled={busy} onClick={()=>change()}>Save changes</button><button className="secondary" disabled={busy} onClick={()=>{setEditing(false);setText(note.raw_text);setError('');}}>Cancel</button></>:<><pre className="note-preview" tabIndex={0}>{note.raw_text}</pre><button className="secondary" disabled={busy} onClick={()=>{setText(note.raw_text);setEditing(true);setConfirm(false);}}>Edit note</button></>}
 {!confirm?<button className="danger" disabled={busy} onClick={()=>setConfirm(true)}>Delete note</button>:<div role="group" aria-label="Confirm deletion"><p>This permanently removes this note.</p><button className="danger" disabled={busy} onClick={()=>change(true)}>Confirm delete</button><button className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Keep note</button></div>}
 {error&&<p className="error" role="alert">{error}</p>}</article>;
}
