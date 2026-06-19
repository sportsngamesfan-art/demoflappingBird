import { supabase } from '../core/shared.js';

const SESSION_ID = (() => {
  let id = sessionStorage.getItem('_sid');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('_sid', id); }
  return id;
})();

export function track(event_name, extras = {}) {
  const { player_name, game_name, duration_ms, metadata } = extras;
  supabase.from('analytics_events').insert({
    event_name,
    session_id: SESSION_ID,
    game_name: game_name ?? null,
    player_name: player_name ?? null,
    duration_ms: duration_ms ?? null,
    metadata: metadata ?? null,
  }).then();
}
