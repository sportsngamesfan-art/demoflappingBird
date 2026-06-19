import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Dashboard() {
  const [stats, setStats] = useState({ players: 0, scores: 0, assets: 0, events_today: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      const [
        { count: scores },
        { count: assets },
        { count: events },
        { data: recentAudit },
      ] = await Promise.all([
        supabase.from('leaderboard').select('*', { count: 'exact', head: true }),
        supabase.from('game_assets').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      setStats({ scores: scores ?? 0, assets: assets ?? 0, events_today: events ?? 0 });
      setRecent(recentAudit ?? []);
    }
    load();
  }, []);

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'2rem' },
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem', marginBottom:'2rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem' },
    num: { fontSize:'2rem', fontWeight:'700', color:'#a78bfa' },
    lbl: { color:'#9999bb', fontSize:'.85rem', marginTop:'.3rem' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'.88rem' },
    th: { padding:'.6rem 1rem', background:'#16162a', color:'#9999bb', fontWeight:'600', textAlign:'left', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.6rem 1rem', borderBottom:'1px solid #1a1a2e', color:'#c0c0d8' },
  };

  return (
    <div>
      <h1 style={s.h1}>Dashboard</h1>
      <div style={s.grid}>
        {[
          { num: stats.scores, lbl: 'Total Scores' },
          { num: stats.assets, lbl: 'Active Assets' },
          { num: stats.events_today, lbl: 'Events Today' },
        ].map(({ num, lbl }) => (
          <div key={lbl} style={s.card}>
            <div style={s.num}>{num}</div>
            <div style={s.lbl}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={s.card}>
        <h2 style={{ fontSize:'1rem', fontWeight:'600', color:'#e0e0f0', marginBottom:'1rem' }}>Recent Admin Activity</h2>
        {recent.length === 0 ? <p style={{ color:'#555' }}>No activity yet.</p> : (
          <table style={s.table}>
            <thead><tr><th style={s.th}>Time</th><th style={s.th}>Admin</th><th style={s.th}>Action</th><th style={s.th}>Entity</th></tr></thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.id}>
                  <td style={s.td}>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={s.td}>{r.admin_email}</td>
                  <td style={s.td}>{r.action}</td>
                  <td style={s.td}>{r.entity_type} {r.entity_id ? `#${r.entity_id.slice(0,8)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
