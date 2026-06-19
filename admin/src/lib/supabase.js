import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'https://owqqfjyisewemtxjgexq.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_9gmatl0oDebnQsENECo0jQ_Mf8OmZZA'
);
