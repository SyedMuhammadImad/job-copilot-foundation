"use client";
import {useRef,useState} from 'react';import {useRouter} from 'next/navigation';import {createClient} from '@/lib/supabase/client';
export default function SignOutButton(){const router=useRouter();const active=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function signOut(){if(active.current)return;active.current=true;setBusy(true);setError('');try{const {error}=await createClient().auth.signOut();if(error)throw error;router.replace('/login');router.refresh();}catch{setError('Sign out failed. Please try again.');}finally{active.current=false;setBusy(false);}}
 return <div><button className="secondary" onClick={signOut} disabled={busy}>{busy?'Signing out…':'Sign out'}</button>{error&&<p role="alert" className="error">{error}</p>}</div>;
}
