/**
 * The Supabase project this app talks to unless the person chooses another one. Both values are public by design:
 * the publishable key only identifies the project, and Row Level Security (supabase/schema.sql) keeps every
 * account's data private. Never put a secret or service-role key here.
 * A build can override them with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 */
export const DEFAULT_SUPABASE_URL = 'https://fykzmhxvhdrxvqkkhlnd.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_WJm8jtZ1OXc55LA6jnf01w_jN30zjqL';

/**
 * The address of the hosted web app, if there is one. The desktop app and local previews cannot be the target of an
 * email link, so they use this. Leave empty to fall back to the Site URL set in the Supabase dashboard.
 */
export const WEB_URL = 'https://study-with-sarang.vercel.app/';
