import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'https://owqqfjyisewemtxjgexq.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_9gmatl0oDebnQsENECo0jQ_Mf8OmZZA'
);

export const PLAYER_COLORS = [0xFFD700, 0xFF4455, 0x44AAFF, 0x44DD66, 0xBB44FF, 0xFF8822];
export const RANK_MEDALS   = ['🥇', '🥈', '🥉'];

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Notify nav overlay — lazy import avoids circular dep
  import('../nav.js').then(m => m.setNavContext(id)).catch(() => {});
}

export function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

export async function submitScore({ player_name, score, level = null, game_name }) {
  const row = { player_name, score, game_name };
  if (level) row.level = level;
  await supabase.from('leaderboard').insert(row);
}

export async function loadLeaderboard(game_name, tbodyId, columns) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">Loading…</td></tr>';

  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_name,score,level,game_name')
    .eq('game_name', game_name)
    .order('score', { ascending: columns?.ascending ?? false })
    .limit(20);

  if (error || !data?.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;opacity:.5">No scores yet!</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((r, i) => columns.render(r, i)).join('');
}
