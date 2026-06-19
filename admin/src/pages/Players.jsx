import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

export default function Players() {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    if (!search.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from('leaderboard')
      .select('player_name')
      .ilike('player_name', `%${search}%`);
    const unique = [...new Set((data ?? []).map(r => r.player_name))];
    setPlayers(unique);
    setLoading(false);
  }

  async function loadPlayerScores(name) {
    setSelected(name);
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('player_name', name)
      .order('created_at', { ascending: false });
    setScores(data ?? []);
  }

  async function deleteScore(row) {
    if (!confirm(`Delete score ${row.score} for ${row.player_name}?`)) return;
    await supabase.from('leaderboard').delete().eq('id', row.id);
    await log('score_delete', 'leaderboard', row.id, row, null);
    await loadPlayerScores(selected);
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    row: { display:'flex', gap:'.75rem', marginBottom:'1.5rem' },
    input: { flex:1, background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.55rem .9rem', borderRadius:'7px', fontSize:'.9rem' },
    btn: { padding:'.55rem 1.2rem', background:'#7c3aed', color:'#fff', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'.9rem' },
    layout: { display:'grid', gridTemplateColumns:'240px 1fr', gap:'1.5rem' },
    list: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    listItem: (active) => ({ padding:'.7rem 1rem', cursor:'pointer', background: active ? '#2a2a4a' : 'transparent', color: active ? '#a78bfa' : '#c0c0d8', borderBottom:'1px solid #1a1a2e', fontSize:'.9rem' }),
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'.85rem' },
    th: { padding:'.6rem 1rem', background:'#1a1a30', color:'#9999bb', fontWeight:'600', textAlign:'left', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.6rem 1rem', borderBottom:'1px solid #1a1a2e', color:'#c0c0d8' },
    delBtn: { background:'transparent', border:'1px solid #3d1515', color:'#f87171', padding:'.25rem .6rem', borderRadius:'5px', cursor:'pointer', fontSize:'.8rem' },
  };

  return (
    <div>
      <h1 style={s.h1}>Players</h1>
      <div style={s.row}>
        <input style={s.input} placeholder="Search player name…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
        <button style={s.btn} onClick={doSearch}>Search</button>
      </div>
      <div style={s.layout}>
        <div style={s.list}>
          {loading && <div style={{ padding:'1rem', color:'#555', textAlign:'center' }}>Searching…</div>}
          {players.map(name => (
            <div key={name} style={s.listItem(selected === name)} onClick={() => loadPlayerScores(name)}>{name}</div>
          ))}
          {!loading && players.length === 0 && <div style={{ padding:'1rem', color:'#555', textAlign:'center' }}>No results</div>}
        </div>
        <div style={s.card}>
          {!selected ? (
            <p style={{ padding:'2rem', color:'#555', textAlign:'center' }}>Select a player to view scores</p>
          ) : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Game</th>
                <th style={s.th}>Score</th>
                <th style={s.th}>Level</th>
                <th style={s.th}>Date</th>
                <th style={s.th}></th>
              </tr></thead>
              <tbody>
                {scores.map(r => (
                  <tr key={r.id}>
                    <td style={s.td}>{r.game_name}</td>
                    <td style={s.td}>{r.score}</td>
                    <td style={s.td}>{r.level ?? '—'}</td>
                    <td style={s.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={s.td}><button style={s.delBtn} onClick={() => deleteScore(r)}>Delete</button></td>
                  </tr>
                ))}
                {scores.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', color:'#555' }}>No scores</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
