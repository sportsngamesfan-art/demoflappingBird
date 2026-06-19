import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fbbf24'];

export default function Analytics() {
  const [daily, setDaily] = useState([]);
  const [gameBreakdown, setGameBreakdown] = useState([]);
  const [avgDuration, setAvgDuration] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from('analytics_events')
        .select('event_name, game_name, duration_ms, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (!data) { setLoading(false); return; }

      // Daily game starts
      const dayMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dayMap[d.toISOString().slice(0, 10)] = { date: d.toLocaleDateString('en', { weekday:'short' }), starts: 0 };
      }
      data.filter(e => e.event_name === 'game_start').forEach(e => {
        const key = e.created_at.slice(0, 10);
        if (dayMap[key]) dayMap[key].starts++;
      });
      setDaily(Object.values(dayMap));

      // Game breakdown
      const gameCounts = {};
      data.filter(e => e.event_name === 'game_start' && e.game_name).forEach(e => {
        gameCounts[e.game_name] = (gameCounts[e.game_name] ?? 0) + 1;
      });
      setGameBreakdown(Object.entries(gameCounts).map(([name, value]) => ({ name, value })));

      // Avg duration
      const durs = {};
      const counts = {};
      data.filter(e => e.event_name === 'game_end' && e.game_name && e.duration_ms).forEach(e => {
        durs[e.game_name] = (durs[e.game_name] ?? 0) + e.duration_ms;
        counts[e.game_name] = (counts[e.game_name] ?? 0) + 1;
      });
      const avg = {};
      Object.keys(durs).forEach(g => { avg[g] = Math.round(durs[g] / counts[g] / 1000); });
      setAvgDuration(avg);

      setLoading(false);
    }
    load();
  }, []);

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'2rem' },
    grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'1.5rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem' },
    ch: { fontSize:'1rem', fontWeight:'600', color:'#e0e0f0', marginBottom:'1rem' },
    row: { display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem' },
    stat: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1rem 1.5rem', flex:'1', minWidth:'150px' },
    num: { fontSize:'1.6rem', fontWeight:'700', color:'#a78bfa' },
    lbl: { color:'#9999bb', fontSize:'.8rem', marginTop:'.2rem' },
  };

  if (loading) return <div style={{ color:'#888', paddingTop:'3rem', textAlign:'center' }}>Loading analytics…</div>;

  const totalStarts = gameBreakdown.reduce((a, b) => a + b.value, 0);

  return (
    <div>
      <h1 style={s.h1}>Analytics</h1>
      <div style={s.row}>
        <div style={s.stat}><div style={s.num}>{totalStarts}</div><div style={s.lbl}>Game Starts (7d)</div></div>
        {Object.entries(avgDuration).slice(0, 3).map(([g, sec]) => (
          <div key={g} style={s.stat}><div style={s.num}>{sec}s</div><div style={s.lbl}>Avg session ({g})</div></div>
        ))}
      </div>
      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.ch}>Game Starts — Last 7 Days</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <XAxis dataKey="date" tick={{ fill:'#9999bb', fontSize:12 }} />
              <YAxis tick={{ fill:'#9999bb', fontSize:12 }} />
              <Tooltip contentStyle={{ background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0' }} />
              <Bar dataKey="starts" fill="#a78bfa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={s.card}>
          <div style={s.ch}>Starts by Game</div>
          {gameBreakdown.length === 0 ? <p style={{ color:'#555', marginTop:'3rem', textAlign:'center' }}>No data yet</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gameBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {gameBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {Object.keys(avgDuration).length > 0 && (
        <div style={s.card}>
          <div style={s.ch}>Average Session Duration by Game (seconds)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Object.entries(avgDuration).map(([name, sec]) => ({ name, seconds: sec }))}>
              <XAxis dataKey="name" tick={{ fill:'#9999bb', fontSize:12 }} />
              <YAxis tick={{ fill:'#9999bb', fontSize:12 }} />
              <Tooltip contentStyle={{ background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0' }} />
              <Bar dataKey="seconds" fill="#60a5fa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
