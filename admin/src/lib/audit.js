import { supabase } from './supabase.js';

export async function log(action, entity_type, entity_id, old_value, new_value) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('audit_logs').insert({
    admin_id: user.id,
    admin_email: user.email,
    action,
    entity_type,
    entity_id: entity_id ? String(entity_id) : null,
    old_value: old_value ?? null,
    new_value: new_value ?? null,
  });
}
