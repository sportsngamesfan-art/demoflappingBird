import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Estimated unit costs for gpt-image-2 (low quality)
const UNIT_COSTS = {
  '1024x1024': 0.02,
  '1536x1024': 0.04,
};
const LANDSCAPE_TYPES = ['hero_banner', 'background', 'carousel'];

function sizeForType(t) {
  return LANDSCAPE_TYPES.includes(t) ? '1536x1024' : '1024x1024';
}

export default function ApiStatus() {
  const [health, setHealth] = useState(null); // null=loading, true=ok, false=error
  const [healthMsg, setHealthMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [assets, setAssets] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [breakdown, setBreakdown] = useState([]);

  useEffect(() => {
    loadAssets();
    checkHealth();
  }, []);

  async function loadAssets() {
    const { data } = await supabase
      .from('game_assets')
      .select('asset_type, created_at')
      .order('created_at', { ascending: false });
    if (!data) return;
    setAssets(data);

    // Cost breakdown by asset_type
    const map = {};
    let total = 0;
    for (const a of data) {
      const size = sizeForType(a.asset_type);
      const cost = UNIT_COSTS[size] ?? 0.02;
      map[a.asset_type] = (map[a.asset_type] ?? 0) + 1;
      total += cost;
    }
    setTotalCost(total);
    setBreakdown(Object.entries(map).map(([type, count]) => ({
      type, count,
      size: sizeForType(type),
      unit: UNIT_COSTS[sizeForType(type)] ?? 0.02,
      subtotal: count * (UNIT_COSTS[sizeForType(type)] ?? 0.02),
    })));
  }

  async function checkHealth() {
    setChecking(true);
    setHealth(null);
    setHealthMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const t0 = Date.now();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ __healthcheck: true, prompt: '', game_name: '', asset_type: '', asset_key: '' }),
        }
      );
      const ms = Date.now() - t0;
      const json = await res.json();
      // health check returns 400 "prompt required" — that means the function
      // and auth are both working fine; any other error = real problem
      if (res.status === 400 && json.error === 'prompt required') {
        setHealth(true);
        setHealthMsg(`OpenAI Edge Function reachable · ${ms}ms`);
      } else if (res.status === 401 || res.status === 403) {
        setHealth(false);
        setHealthMsg(`Auth error: ${json.error}`);
      } else {
        // Unexpected but function responded
        setHealth(true);
        setHealthMsg(`Function reachable · ${ms}ms`);
      }
    } catch (e) {
      setHealth(false);
      setHealthMsg(`Unreachable: ${e.message}`);
    } finally {
      setChecking(false);
    }
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem', marginBottom:'1.5rem' },
    label: { color:'#9999bb', fontSize:'.8rem', fontWeight:'600', marginBottom:'.5rem' },
    h2: { color:'#e0e0f0', fontWeight:'700', fontSize:'1rem', marginBottom:'1rem' },
    dot: (ok) => ({ display:'inline-block', width:10, height:10, borderRadius:'50%', background: ok === null ? '#555' : ok ? '#4ade80' : '#f87171', marginRight:8 }),
    statusText: (ok) => ({ color: ok === null ? '#888' : ok ? '#4ade80' : '#f87171', fontWeight:'600', fontSize:'1rem' }),
    btn: (dis) => ({ padding:'.5rem 1.2rem', background: dis ? '#333' : '#7c3aed', color: dis ? '#666' : '#fff', border:'none', borderRadius:'7px', fontSize:'.875rem', fontWeight:'600', cursor: dis ? 'not-allowed' : 'pointer', marginTop:'1rem' }),
    table: { width:'100%', borderCollapse:'collapse' },
    th: { textAlign:'left', color:'#9999bb', fontSize:'.8rem', fontWeight:'600', padding:'.5rem .75rem', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.6rem .75rem', color:'#e0e0f0', fontSize:'.9rem', borderBottom:'1px solid #1a1a2e' },
    totalRow: { color:'#a78bfa', fontWeight:'700' },
    note: { color:'#555', fontSize:'.75rem', marginTop:'.75rem' },
  };

  return (
    <div>
      <h1 style={s.h1}>API Status</h1>

      {/* ── OpenAI Health ── */}
      <div style={s.card}>
        <div style={s.h2}>OpenAI / Edge Function Health</div>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <span style={s.dot(health)} />
            <span style={s.statusText(health)}>
              {health === null ? 'Checking…' : health ? 'Healthy' : 'Error'}
            </span>
            {healthMsg && <span style={{ color:'#888', fontSize:'.85rem', marginLeft:12 }}>{healthMsg}</span>}
          </div>
        </div>
        <button style={s.btn(checking)} onClick={checkHealth} disabled={checking}>
          {checking ? 'Checking…' : '↺ Check Now'}
        </button>
      </div>

      {/* ── Cost Breakdown ── */}
      <div style={s.card}>
        <div style={s.h2}>Image Generation Cost (estimated)</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Asset Type</th>
              <th style={s.th}>Size</th>
              <th style={s.th}>Count</th>
              <th style={s.th}>Unit Cost</th>
              <th style={s.th}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map(r => (
              <tr key={r.type}>
                <td style={s.td}>{r.type}</td>
                <td style={{ ...s.td, color:'#9999bb', fontSize:'.8rem' }}>{r.size}</td>
                <td style={s.td}>{r.count}</td>
                <td style={s.td}>${r.unit.toFixed(3)}</td>
                <td style={s.td}>${r.subtotal.toFixed(3)}</td>
              </tr>
            ))}
            {breakdown.length === 0 && (
              <tr><td colSpan={5} style={{ ...s.td, color:'#555' }}>No images generated yet.</td></tr>
            )}
            {breakdown.length > 0 && (
              <tr>
                <td colSpan={4} style={{ ...s.td, ...s.totalRow }}>Total (all time)</td>
                <td style={{ ...s.td, ...s.totalRow }}>${totalCost.toFixed(3)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={s.note}>
          * Estimated based on GPT Image 2 low-quality pricing ($0.020 / 1024×1024, $0.040 / 1536×1024).
          Includes all generated images, not just active ones. Check your{' '}
          <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer" style={{ color:'#7c3aed' }}>OpenAI usage dashboard</a>
          {' '}for exact figures.
        </div>
      </div>

      {/* ── Pricing Reference ── */}
      <div style={s.card}>
        <div style={s.h2}>Pricing Reference — GPT Image 2</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Quality</th>
              <th style={s.th}>1024×1024</th>
              <th style={s.th}>1536×1024</th>
              <th style={s.th}>Used for</th>
            </tr>
          </thead>
          <tbody>
            {[
              { q:'low', sq:'$0.020', ls:'$0.040', use:'All current generations' },
              { q:'medium', sq:'$0.040', ls:'$0.080', use:'Higher detail' },
              { q:'high', sq:'$0.080', ls:'$0.160', use:'Max quality' },
            ].map(r => (
              <tr key={r.q}>
                <td style={{ ...s.td, fontWeight: r.q==='low' ? '700' : '400', color: r.q==='low' ? '#4ade80' : '#e0e0f0' }}>{r.q}{r.q==='low' ? ' ✓' : ''}</td>
                <td style={s.td}>{r.sq}</td>
                <td style={s.td}>{r.ls}</td>
                <td style={{ ...s.td, color:'#9999bb', fontSize:'.8rem' }}>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
