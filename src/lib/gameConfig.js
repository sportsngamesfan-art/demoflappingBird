// Live game config loader. Games call loadGameConfig('flappy') on init and get
// back a { config_key: config_value } map sourced from the Supabase
// `game_configs` table (written by the admin panel). Falls back silently to an
// empty object on any error so games can use their hardcoded defaults.
import { supabase } from '../core/shared.js';

const _cache = {};

export async function loadGameConfig(gameName) {
  if (_cache[gameName]) return _cache[gameName];
  try {
    const { data } = await supabase
      .from('game_configs')
      .select('config_key, config_value')
      .eq('game_name', gameName);
    const map = Object.fromEntries((data ?? []).map(r => [r.config_key, r.config_value]));
    _cache[gameName] = map;
    return map;
  } catch (_) {
    return {};
  }
}
