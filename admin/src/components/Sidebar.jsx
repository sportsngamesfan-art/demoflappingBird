import React from 'react';
import { supabase } from '../lib/supabase.js';

const NAV = [
  { key:'dashboard',   label:'Dashboard',    icon:'📊' },
  { key:'analytics',   label:'Analytics',    icon:'📈' },
  { key:'auditlog',    label:'Audit Log',    icon:'📋' },
  { key:'assets',      label:'Game Assets',  icon:'🎨' },
  { key:'config',      label:'Game Config',  icon:'⚙️' },
  { key:'players',     label:'Players',      icon:'👤' },
  { key:'leaderboard', label:'Leaderboard',  icon:'🏆' },
  { key:'admins',      label:'Admin Users',  icon:'🔑', superadmin: true },
];

export default function Sidebar({ page, setPage, role }) {
  const s = {
    sidebar: { width:'220px', background:'#16162a', borderRight:'1px solid #2a2a4a', display:'flex', flexDirection:'column', padding:'1rem 0' },
    logo: { padding:'1rem 1.5rem', fontSize:'1.1rem', fontWeight:'700', color:'#a78bfa', borderBottom:'1px solid #2a2a4a', marginBottom:'.5rem' },
    btn: (active) => ({ display:'flex', alignItems:'center', gap:'.7rem', width:'100%', padding:'.65rem 1.5rem', background: active ? '#2a2a4a' : 'transparent', color: active ? '#a78bfa' : '#9999bb', border:'none', cursor:'pointer', textAlign:'left', fontSize:'.92rem', borderLeft: active ? '3px solid #a78bfa' : '3px solid transparent', transition:'all .15s' }),
    footer: { marginTop:'auto', padding:'1rem 1.5rem', borderTop:'1px solid #2a2a4a' },
    signout: { background:'transparent', border:'1px solid #333', color:'#888', padding:'.4rem .8rem', borderRadius:'5px', cursor:'pointer', fontSize:'.85rem', width:'100%' },
  };

  return (
    <aside style={s.sidebar}>
      <div style={s.logo}>🎮 Admin Panel</div>
      {NAV.filter(n => !n.superadmin || role === 'superadmin').map(n => (
        <button key={n.key} style={s.btn(page === n.key)} onClick={() => setPage(n.key)}>
          <span>{n.icon}</span>{n.label}
        </button>
      ))}
      <div style={s.footer}>
        <button style={s.signout} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </aside>
  );
}
