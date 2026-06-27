import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

// Chess omitted: it has no runtime-configurable parameters (no timer feature).
const GAMES = ['flappy', 'shooter', 'pacman', 'reaction'];

const DEFAULT_CONFIGS = {
  flappy: {
    levels: { easy: { pipeSpeed: 2.5, pipeGap: 200, pipeInterval: 2200 }, medium: { pipeSpeed: 3.5, pipeGap: 160, pipeInterval: 1800 }, hard: { pipeSpeed: 5.0, pipeGap: 115, pipeInterval: 1400 } },
    gravity: 0.45,
    flapForce: -8.5,
  },
  shooter: {
    gravity: 0.55,
    jumpForce: 10.5,
    playerSpeed: 3.5,
    bulletSpeed: 9,
    camSpeed: 0.8,
  },
  pacman: {
    pacmanSpeedBase: 5,
    frightenDuration: 8,
    extraLifeScore: 10000,
  },
  reaction: {
    rounds: 5,
    penaltyMs: 1000,
    minDelayMs: 1000,
    maxDelayMs: 4000,
  },
};

export default function GameConfig() {
  const [game, setGame] = useState('flappy');
  const [configs, setConfigs] = useState({});
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => { loadConfigs(); }, [game]);

  async function loadConfigs() {
    const { data } = await supabase.from('game_configs').select('*').eq('game_name', game);
    const map = {};
    (data ?? []).forEach(r => { map[r.config_key] = r; });
    setConfigs(map);

    // Pre-fill editor with DB values or defaults
    const defaults = DEFAULT_CONFIGS[game] ?? {};
    const ed = {};
    Object.entries(defaults).forEach(([key, defVal]) => {
      ed[key] = JSON.stringify(map[key]?.config_value ?? defVal, null, 2);
    });
    setEditing(ed);
  }

  async function handleSave(key) {
    let value;
    try { value = JSON.parse(editing[key]); } catch { return setMsg('Invalid JSON for ' + key); }
    setSaving(s => ({ ...s, [key]: true }));
    const oldRow = configs[key];
    const { data, error } = await supabase.from('game_configs').upsert({ game_name: game, config_key: key, config_value: value, updated_at: new Date().toISOString() }, { onConflict: 'game_name,config_key' }).select().single();
    if (!error) {
      await log('config_change', 'game_config', data.id, oldRow?.config_value ?? null, value);
      await loadConfigs();
      setMsg(`Saved ${game}/${key}`);
      setTimeout(() => setMsg(''), 3000);
    }
    setSaving(s => ({ ...s, [key]: false }));
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    tabs: { display:'flex', gap:'.5rem', marginBottom:'1.5rem', flexWrap:'wrap' },
    tab: (active) => ({ padding:'.45rem 1rem', background: active ? '#7c3aed' : '#16162a', border: active ? 'none' : '1px solid #2a2a4a', color: active ? '#fff' : '#9999bb', borderRadius:'7px', cursor:'pointer', fontSize:'.9rem', fontWeight: active ? '600' : '400' }),
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem', marginBottom:'1rem' },
    key: { fontSize:'.85rem', fontWeight:'700', color:'#a78bfa', marginBottom:'.5rem' },
    textarea: { width:'100%', minHeight:'100px', background:'#0f0f1a', border:'1px solid #2a2a4a', borderRadius:'7px', color:'#e0e0f0', padding:'.6rem .8rem', fontSize:'.85rem', fontFamily:'monospace', resize:'vertical', marginBottom:'.75rem' },
    btn: (d) => ({ padding:'.4rem .9rem', background: d ? '#333' : '#7c3aed', color: d ? '#666' : '#fff', border:'none', borderRadius:'6px', cursor: d ? 'not-allowed' : 'pointer', fontSize:'.85rem' }),
    msg: { color:'#4ade80', fontSize:'.85rem', marginBottom:'1rem' },
    date: { color:'#555', fontSize:'.75rem', marginBottom:'.5rem' },
  };

  const defaults = DEFAULT_CONFIGS[game] ?? {};

  return (
    <div>
      <h1 style={s.h1}>Game Config</h1>
      <div style={s.tabs}>
        {GAMES.map(g => <button key={g} style={s.tab(game === g)} onClick={() => setGame(g)}>{g}</button>)}
      </div>
      {msg && <p style={s.msg}>✓ {msg}</p>}
      {Object.keys(defaults).map(key => (
        <div key={key} style={s.card}>
          <div style={s.key}>{key}</div>
          {configs[key] && <div style={s.date}>Last saved: {new Date(configs[key].updated_at).toLocaleString()}</div>}
          <textarea style={s.textarea} value={editing[key] ?? ''} onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))} />
          <button style={s.btn(saving[key])} onClick={() => handleSave(key)} disabled={saving[key]}>
            {saving[key] ? 'Saving…' : 'Save'}
          </button>
        </div>
      ))}
    </div>
  );
}
