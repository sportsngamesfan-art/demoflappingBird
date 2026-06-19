import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

export default function AdminUsers({ role }) {
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [addId, setAddId] = useState('');
  const [addRole, setAddRole] = useState('editor');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('admin_roles').select('user_id, role, created_at');
    setAdmins(data ?? []);
  }

  async function handleAddRole(userId, adminRole) {
    if (!userId.trim()) return;
    const { error } = await supabase.from('admin_roles').upsert({ user_id: userId, role: adminRole });
    if (error) { setError(error.message); return; }
    await log('role_change', 'admin_role', userId, null, { role: adminRole });
    setMsg('Role assigned.'); setTimeout(() => setMsg(''), 3000);
    await load();
  }

  async function handleRemove(row) {
    if (!confirm(`Remove admin role for ${row.user_id}?`)) return;
    await supabase.from('admin_roles').delete().eq('user_id', row.user_id);
    await log('role_change', 'admin_role', row.user_id, { role: row.role }, null);
    await load();
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem', marginBottom:'1.5rem' },
    label: { display:'block', color:'#9999bb', fontSize:'.82rem', marginBottom:'.35rem' },
    input: { width:'100%', background:'#0f0f1a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .8rem', borderRadius:'7px', fontSize:'.9rem', marginBottom:'.8rem' },
    select: { background:'#0f0f1a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .8rem', borderRadius:'7px', fontSize:'.9rem', marginBottom:'.8rem', width:'100%' },
    btn: { padding:'.5rem 1.2rem', background:'#7c3aed', color:'#fff', border:'none', borderRadius:'7px', cursor:'pointer', fontSize:'.9rem' },
    table: { width:'100%', borderCollapse:'collapse', fontSize:'.85rem' },
    th: { padding:'.6rem 1rem', background:'#1a1a30', color:'#9999bb', fontWeight:'600', textAlign:'left', borderBottom:'1px solid #2a2a4a' },
    td: { padding:'.6rem 1rem', borderBottom:'1px solid #1a1a2e', color:'#c0c0d8' },
    err: { color:'#f44', fontSize:'.85rem', marginTop:'.5rem' },
    msg: { color:'#4ade80', fontSize:'.85rem', marginTop:'.5rem' },
    rmBtn: { background:'transparent', border:'1px solid #3d1515', color:'#f87171', padding:'.25rem .6rem', borderRadius:'5px', cursor:'pointer', fontSize:'.8rem' },
    badge: (r) => ({ display:'inline-block', padding:'.2rem .5rem', borderRadius:'4px', fontSize:'.75rem', fontWeight:'700', background: r === 'superadmin' ? '#2d1a4a' : '#1a2040', color: r === 'superadmin' ? '#c084fc' : '#60a5fa' }),
  };

  if (role !== 'superadmin') {
    return (
      <div>
        <h1 style={s.h1}>Admin Users</h1>
        <p style={{ color:'#888' }}>Superadmin access required.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={s.h1}>Admin Users</h1>
      <div style={s.card}>
        <h2 style={{ fontSize:'1rem', fontWeight:'600', color:'#e0e0f0', marginBottom:'1rem' }}>Assign Role by User ID</h2>
        <p style={{ color:'#777', fontSize:'.85rem', marginBottom:'1rem' }}>Create the user in Supabase Dashboard → Auth → Users first, then copy their UUID here.</p>
        <label style={s.label}>User UUID</label>
        <input style={s.input} value={addId} onChange={e => setAddId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        <label style={s.label}>Role</label>
        <select style={s.select} value={addRole} onChange={e => setAddRole(e.target.value)}>
          <option value="editor">editor</option>
          <option value="superadmin">superadmin</option>
        </select>
        <button style={s.btn} onClick={() => handleAddRole(addId, addRole)}>Assign Role</button>
        {error && <p style={s.err}>{error}</p>}
        {msg && <p style={s.msg}>{msg}</p>}
      </div>
      <div style={{ background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' }}>
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>User ID</th>
            <th style={s.th}>Role</th>
            <th style={s.th}>Added</th>
            <th style={s.th}></th>
          </tr></thead>
          <tbody>
            {admins.map(r => (
              <tr key={r.user_id}>
                <td style={s.td}><code style={{ fontSize:'.8rem' }}>{r.user_id}</code></td>
                <td style={s.td}><span style={s.badge(r.role)}>{r.role}</span></td>
                <td style={s.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={s.td}><button style={s.rmBtn} onClick={() => handleRemove(r)}>Remove</button></td>
              </tr>
            ))}
            {admins.length === 0 && <tr><td colSpan={4} style={{ ...s.td, textAlign:'center', color:'#555' }}>No admins yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
