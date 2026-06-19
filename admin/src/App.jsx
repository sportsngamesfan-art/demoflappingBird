import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Analytics from './pages/Analytics.jsx';
import AuditLog from './pages/AuditLog.jsx';
import GameAssets from './pages/GameAssets.jsx';
import GameConfig from './pages/GameConfig.jsx';
import Players from './pages/Players.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [adminRole, setAdminRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkAdmin(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkAdmin(session.user.id);
      else { setAdminRole(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId) {
    const { data } = await supabase.from('admin_roles').select('role').eq('user_id', userId).maybeSingle();
    setAdminRole(data?.role ?? null);
    setLoading(false);
  }

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888' }}>Loading…</div>;
  if (!session) return <Login />;
  if (!adminRole) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:'1rem' }}>
      <p style={{ color:'#f44', fontSize:'1.1rem' }}>Access denied — not an admin account.</p>
      <button onClick={() => supabase.auth.signOut()} style={{ padding:'.5rem 1.2rem',background:'#333',color:'#eee',border:'none',borderRadius:'6px',cursor:'pointer' }}>Sign out</button>
    </div>
  );

  const pages = { dashboard: Dashboard, analytics: Analytics, auditlog: AuditLog, assets: GameAssets, config: GameConfig, players: Players, leaderboard: Leaderboard, admins: AdminUsers };
  const PageComponent = pages[page] || Dashboard;

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar page={page} setPage={setPage} role={adminRole} />
      <main style={{ flex:1, overflow:'auto', padding:'2rem', background:'#0f0f1a' }}>
        <PageComponent role={adminRole} />
      </main>
    </div>
  );
}
