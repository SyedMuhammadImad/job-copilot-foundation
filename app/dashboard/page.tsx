import {createClient} from '@/lib/supabase/server';
import {publicConfig} from '@/lib/config';
import {redirect} from 'next/navigation';
import AddResumeForm from './AddResumeForm';
import SignOutButton from './SignOutButton';
import NoteEditor from './NoteEditor';
export const dynamic='force-dynamic';
export default async function DashboardPage(){
 if(!publicConfig())redirect('/?setup=required');const client=await createClient();const {data,error:authError}=await client.auth.getClaims();
 if(authError||!data?.claims?.sub)redirect('/login');
 const {data:notes,error}=await client.from('resumes').select('id,raw_text,created_at').order('created_at',{ascending:false}).limit(100);
 return <main><div className="topline"><p className="eyebrow">Job Copilot</p><SignOutButton/></div><h1>Your resume notes</h1><p className="muted">Signed in as {String(data.claims.email??'your account')}</p>
 <AddResumeForm/><h2>Saved notes</h2>{error?<p role="alert" className="error">Notes could not be loaded. Check the connection and database setup, then reload.</p>:!notes?.length?<p>No notes yet. Add your first note above.</p>:<><p className="muted">Showing your latest {notes.length} notes.</p>{notes.map(note=><NoteEditor key={note.id} note={note}/>)}</>}
 </main>;
}
