import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null si no configuraste Supabase: la app funciona igual, solo en el dispositivo. */
export const supabase: SupabaseClient | null =
  url && key && !url.includes('TU-PROYECTO')
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'placard.auth' },
      })
    : null

export const BUCKET = 'fotos'
