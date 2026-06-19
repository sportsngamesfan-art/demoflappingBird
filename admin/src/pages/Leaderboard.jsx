import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

const GAMES = ['', 'flappy', 'chess', 'pacman', 'shooter', 'reaction'];

export default function Leaderboard() {
  const [game, setGame] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => { load(); }, [game, page]);

  async function load() {
    setLoading(true);
    let q = supabase.from('leaderboard').select('*').order('score', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (game) q = q.eq('game_name', game);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }

  async function handleDelete(row) {
    if (!confirm(`Delete score ${row.score} for ${row.player_name}?`)) return;
    await supabase.from('leaderboard').delete().eq('id', row.id);
    await log('score_delete', 'leaderboard', row.id, row, null);
    await load();
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    toolbar: { display:'flex', gap:'1rem', marginBottom:'1rem', alignItems:'center' },
    select: { background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .9rem', borderRadius:'7px', fontSize:'.9rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'.85rem' },
    th: { padding:'.65rem 1rem', background:'#1a1a30', color:'#9999bb', fontWeight:'600', textAlign:'left', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.65rem 1rem', borderBottom:'1px solid #1a1a2e', color:'#c0c0d8' },
    delBtn: { background:'transparent', border:'1px solid #3d1515', color:'#f87171', padding:'.25rem .6rem', borderRadius:'5px', cursor:'pointer', fontSize:'.8rem' },
    nav: { display:'flex', gap:'.5rem', justifyContent:'center', padding:'1rem' },
    navBtn: (d) => ({ padding:'.4rem .9rem', background: d ? '#7c3aed' : '#2a2a4a', color:'#e0e0f0', border:'none', borderRadius:'6px', cursor: d ? 'pointer' : 'not-allowed', opacity: d ? 1 : .4 }),
  };

  return (
    <div>
      <h1 style={s.h1}>Leaderboard</h1>
      <div style={s.toolbar}>
        <select style={s.select} value={game} onChange={e => { setGame(e.target.value); setPage(0); }}>
          {GAMES.map(g => <option key={g} value={g}>{g || 'All games'}</option>)}
        </select>
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Player</th>
            <th style={s.th}>Game</th>
            <th style={s.th}>Score</th>
            <th style={s.th}>Level</th>
            <th style={s.th}>Date</th>
            <th style={s.th}></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', color:'#555' }}>Loading…</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id}>
                <td style={s.td}>{page * PAGE_SIZE + i + 1}</td>
                <td style={s.td}>{r.player_name}</td>
                <td style={s.td}>{r.game_name ?? '—'}</td>
                <td style={s.td}>{r.score}</td>
                <td style={s.td}>{r.level ?? '—'}</td>
                <td style={s.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={s.td}><button style={s.delBtn} onClick={() => handleDelete(r)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={s.nav}>
          <button style={s.navBtn(page > 0)} onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
          <span style={{ color:'#9999bb', padding:'.4rem .9rem' }}>Page {page + 1}</span>
          <button style={s.navBtn(rows.length === PAGE_SIZE)} onClick={() => setPage(p => p + 1)} disabled={rows.length < PAGE_SIZE}>Next →</button>
        </div>
      </div>
    </div>
  );
}
