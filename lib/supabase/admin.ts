import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Uses the service_role key which bypasses Row Level Security.
// This file must never be imported from a Client Component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
