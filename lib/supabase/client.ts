import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from '@/lib/config';

// Use this INSIDE client components ("use client" files) only.
// It reads the public URL + anon key, which are safe to expose to the
// browser because Row Level Security (RLS) — not this key — is what
// actually protects each user's data. The anon key alone grants nothing.
export function createClient() {
  const config=publicConfig();
  if(!config)throw new Error('Supabase public configuration is missing or invalid');
  return createBrowserClient(config.url,config.key);
}
