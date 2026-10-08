import Link from 'next/link';
import {publicConfig} from '@/lib/config';
export default function Home(){const configured=!!publicConfig();return <main>
  <p className="eyebrow">Job Copilot</p><h1>Your resume workspace</h1>
  <p>Keep private resume notes in one place. Create, edit and remove notes from your own account.</p>
  {configured?<Link className="button" href="/login">Open your workspace</Link>:<section className="card"><h2>Connect your workspace</h2><p>Set the Supabase project URL and publishable key, then apply the database schema described in the README before rebuilding the app.</p><p>Never use a secret or service-role key in browser configuration.</p></section>}
</main>}
