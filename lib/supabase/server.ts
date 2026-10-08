import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicConfig } from '@/lib/config';

// Use this INSIDE server components (default, no "use client") only.
// It reads the logged-in user's session from cookies, so queries made
// with this client run AS that user — which is exactly what lets RLS
// policies like "auth.uid() = user_id" work correctly.
export async function createClient() {
  const cookieStore = await cookies();
  const config=publicConfig();
  if(!config)throw new Error('Supabase public configuration is missing or invalid');

  return createServerClient(
    config.url,
    config.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies directly.
            // Safe to ignore here — proxy.ts handles session
            // refresh on every request instead.
          }
        },
      },
    }
  );
}
