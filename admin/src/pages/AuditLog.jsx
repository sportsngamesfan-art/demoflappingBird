import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ACTIONS = ['', 'config_change', 'asset_activate', 'score_delete', 'role_change', 'player_ban'];

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (filter) q = q.eq('action', filter);
      const { data } = await q;
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [filter, page]);

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    toolbar: { display:'flex', gap:'1rem', marginBottom:'1rem', alignItems:'center' },
    select: { background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .9rem', borderRadius:'7px', fontSize:'.9rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'.85rem' },
    th: { padding:'.65rem 1rem', background:'#1a1a30', color:'#9999bb', fontWeight:'600', textAlign:'left', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.65rem 1rem', borderBottom:'1px solid #1a1a2e', color:'#c0c0d8', verticalAlign:'top' },
    badge: (a) => ({ display:'inline-block', padding:'.2rem .55rem', borderRadius:'4px', fontSize:'.78rem', fontWeight:'600', background: a === 'score_delete' ? '#3d1515' : a === 'role_change' ? '#1a2040' : '#1a3020', color: a === 'score_delete' ? '#f87171' : a === 'role_change' ? '#60a5fa' : '#4ade80' }),
    nav: { display:'flex', gap:'.5rem', justifyContent:'center', padding:'1rem' },
    navBtn: (d) => ({ padding:'.4rem .9rem', background: d ? '#7c3aed' : '#2a2a4a', color:'#e0e0f0', border:'none', borderRadius:'6px', cursor: d ? 'pointer' : 'not-allowed', opacity: d ? 1 : .4 }),
  };

  return (
    <div>
      <h1 style={s.h1}>Audit Log</h1>
      <div style={s.toolbar}>
        <select style={s.select} value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}>
          {ACTIONS.map(a => <option key={a} value={a}>{a || 'All actions'}</option>)}
        </select>
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Time</th>
            <th style={s.th}>Admin</th>
            <th style={s.th}>Action</th>
            <th style={s.th}>Entity</th>
            <th style={s.th}>Changes</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', color:'#555' }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ ...s.td, textAlign:'center', color:'#555' }}>No logs found.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={s.td}>{new Date(r.created_at).toLocaleString()}</td>
                <td style={s.td}>{r.admin_email}</td>
                <td style={s.td}><span style={s.badge(r.action)}>{r.action}</span></td>
                <td style={s.td}>{r.entity_type}{r.entity_id ? ` #${r.entity_id.slice(0,8)}` : ''}</td>
                <td style={s.td} title={JSON.stringify({ old: r.old_value, new: r.new_value }, null, 2)}>
                  {r.old_value !== null || r.new_value !== null ? '(hover for diff)' : '—'}
                </td>
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
