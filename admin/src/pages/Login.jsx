import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  const s = {
    wrap: { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f0f1a' },
    card: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'12px', padding:'2.5rem', width:'360px' },
    title: { fontSize:'1.5rem', fontWeight:'700', color:'#a78bfa', marginBottom:'2rem', textAlign:'center' },
    label: { display:'block', color:'#9999bb', fontSize:'.85rem', marginBottom:'.4rem' },
    input: { width:'100%', padding:'.65rem .9rem', background:'#0f0f1a', border:'1px solid #2a2a4a', borderRadius:'7px', color:'#e0e0f0', fontSize:'.95rem', outline:'none', marginBottom:'1rem' },
    btn: { width:'100%', padding:'.75rem', background:'#7c3aed', color:'#fff', border:'none', borderRadius:'7px', fontSize:'1rem', fontWeight:'600', cursor:'pointer', marginTop:'.5rem' },
    err: { color:'#f44', fontSize:'.85rem', marginTop:'.5rem', textAlign:'center' },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>🎮 Admin Login</div>
        <form onSubmit={handleLogin}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={s.btn} disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {error && <p style={s.err}>{error}</p>}
      </div>
    </div>
  );
}
