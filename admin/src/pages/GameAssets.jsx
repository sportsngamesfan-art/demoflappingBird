import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

// All image slots that appear in the live site
const LOBBY_SLOTS = [
  { game:'lobby', type:'hero_banner', key:'flappy',   label:'Hero — Flappy Bird',   emoji:'🐦', dim:'1536×1024' },
  { game:'lobby', type:'hero_banner', key:'reaction', label:'Hero — Reaction Tap',  emoji:'⚡', dim:'1536×1024' },
  { game:'lobby', type:'hero_banner', key:'shooter',  label:'Hero — Shooter',       emoji:'🔫', dim:'1536×1024' },
  { game:'lobby', type:'hero_banner', key:'pacman',   label:'Hero — Pac-Man',       emoji:'👻', dim:'1536×1024' },
  { game:'lobby', type:'hero_banner', key:'chess',    label:'Hero — Chess',         emoji:'♟️', dim:'1536×1024' },
  { game:'lobby', type:'card_art',    key:'flappy',   label:'Card — Flappy Bird',   emoji:'🐦', dim:'1024×1024' },
  { game:'lobby', type:'card_art',    key:'reaction', label:'Card — Reaction Tap',  emoji:'⚡', dim:'1024×1024' },
  { game:'lobby', type:'card_art',    key:'shooter',  label:'Card — Shooter',       emoji:'🔫', dim:'1024×1024' },
  { game:'lobby', type:'card_art',    key:'pacman',   label:'Card — Pac-Man',       emoji:'👻', dim:'1024×1024' },
  { game:'lobby', type:'card_art',    key:'chess',    label:'Card — Chess',         emoji:'♟️', dim:'1024×1024' },
  { game:'splash', type:'carousel',   key:'slide_1',  label:'Splash — Slide 1',     emoji:'🎮', dim:'1536×1024' },
  { game:'splash', type:'carousel',   key:'slide_2',  label:'Splash — Slide 2',     emoji:'🎮', dim:'1536×1024' },
  { game:'splash', type:'carousel',   key:'slide_3',  label:'Splash — Slide 3',     emoji:'🎮', dim:'1536×1024' },
];

const GAMES = ['lobby', 'splash', 'flappy', 'chess', 'shooter', 'pacman', 'reaction'];
const ASSET_TYPES = {
  lobby:    ['card_art', 'hero_banner'],
  splash:   ['carousel'],
  flappy:   ['card_art', 'background'],
  chess:    ['card_art', 'piece_sprite'],
  shooter:  ['card_art', 'background'],
  pacman:   ['card_art', 'background'],
  reaction: ['card_art'],
};

const DEFAULT_PROMPTS = {
  'lobby/hero_banner/flappy':   'Epic Flappy Bird hero banner, cartoon bird dodging neon pipes at high speed, vibrant sky, wide cinematic format, gaming platform art',
  'lobby/hero_banner/reaction': 'Reaction Tap hero banner, lightning bolt striking glowing target, electric blue energy burst, wide cinematic game banner',
  'lobby/hero_banner/shooter':  'Retro side-scroller shooter hero banner, neon explosions, laser beams, pixel art spacecraft, wide cinematic format',
  'lobby/hero_banner/pacman':   'Pac-Man hero banner, neon arcade maze, colorful ghosts chasing, electric yellow glow, wide cinematic format',
  'lobby/hero_banner/chess':    'Chess hero banner, dramatic chess board with glowing gold and silver pieces, dark fantasy atmosphere, wide cinematic format',
  'lobby/card_art/flappy':      'Pixel art cartoon bird flying through green pipes, vibrant blue sky, retro 16-bit arcade style, game card art, dark background',
  'lobby/card_art/reaction':    'Lightning bolt striking a glowing target, electric blue and white, reaction speed game art, dark background',
  'lobby/card_art/shooter':     'Retro side-scrolling shooter scene, laser beams, explosions, pixel art, neon colors, game card art',
  'lobby/card_art/pacman':      'Classic arcade Pac-Man maze, neon grid, colorful ghosts, vibrant digital art, game card art',
  'lobby/card_art/chess':       'Minimalist isometric chess board with glowing gold pieces, dark fantasy style, game card art, cinematic lighting',
  'splash/carousel/slide_1':    'Epic multiplayer gaming platform collage, five colorful game characters together, vibrant neon colors, cinematic wide format promotional art',
  'splash/carousel/slide_2':    'Neon arcade night scene, retro gaming characters in action, bright pixel art style, wide promotional banner',
  'splash/carousel/slide_3':    'Social gaming platform art, friends playing together online, colorful abstract digital illustration, wide cinematic format',
  'flappy/card_art/main':       'Cute cartoon pixel bird mid-flight, colorful pipes, blue sky with clouds, retro game style card art',
  'flappy/background/sky':      'Parallax scrolling game background, warm sunset sky, fluffy clouds, green rolling hills, cartoon style',
  'chess/card_art/main':        'Dramatic chess board with glowing pieces, gold vs silver, dark mystical atmosphere, game card art',
  'chess/piece_sprite/king_white':   'White chess king piece, 3D rendered, clean isolated on white background, game icon style, top view',
  'chess/piece_sprite/king_black':   'Black chess king piece, 3D rendered, clean isolated on white background, game icon style, top view',
  'chess/piece_sprite/queen_white':  'White chess queen piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/queen_black':  'Black chess queen piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/rook_white':   'White chess rook piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/rook_black':   'Black chess rook piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/bishop_white': 'White chess bishop piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/bishop_black': 'Black chess bishop piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/knight_white': 'White chess knight piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/knight_black': 'Black chess knight piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/pawn_white':   'White chess pawn piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/pawn_black':   'Black chess pawn piece, 3D rendered, clean isolated on white background, game icon',
  'shooter/card_art/main':      'Retro 2D side-scroller shooter game, hero character shooting aliens, pixel art neon style, game card art',
  'shooter/background/space':   'Retro space shooter background, starfield, distant planets, nebula clouds, pixel art style',
  'pacman/card_art/main':       'Colorful Pac-Man eating pellets in a maze, four ghosts chasing, vibrant arcade art, game card art',
  'pacman/background/neon':     'Neon glowing maze corridor, dark background, electric blue and pink grid lines, futuristic game background',
  'reaction/card_art/main':     'Speedometer at maximum, electric sparks, neon blue energy, reaction time challenge game art',
};

const ASSET_KEYS = {
  'chess/piece_sprite': ['king_white','king_black','queen_white','queen_black','rook_white','rook_black','bishop_white','bishop_black','knight_white','knight_black','pawn_white','pawn_black'],
  'splash/carousel': ['slide_1','slide_2','slide_3'],
};

export default function GameAssets() {
  const [game, setGame] = useState('lobby');
  const [assetType, setAssetType] = useState('hero_banner');
  const [assetKey, setAssetKey] = useState('flappy');
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastCost, setLastCost] = useState(null);
  const [slotStatuses, setSlotStatuses] = useState({});

  const comboKey = `${game}/${assetType}/${assetKey}`;

  // Load slot statuses for the overview panel
  const loadSlotStatuses = useCallback(async () => {
    const { data } = await supabase
      .from('game_assets')
      .select('game_name, asset_type, asset_key, is_active, url')
      .eq('is_active', true)
      .in('game_name', ['lobby', 'splash']);
    const map = {};
    for (const r of (data ?? [])) map[`${r.game_name}/${r.asset_type}/${r.asset_key}`] = r.url;
    setSlotStatuses(map);
  }, []);

  useEffect(() => { loadSlotStatuses(); }, []);

  useEffect(() => {
    setAssetType(ASSET_TYPES[game]?.[0] ?? 'card_art');
  }, [game]);

  useEffect(() => {
    const keys = ASSET_KEYS[`${game}/${assetType}`];
    setAssetKey(keys ? keys[0] : (game === 'lobby' ? 'flappy' : 'main'));
  }, [game, assetType]);

  useEffect(() => {
    setPrompt(DEFAULT_PROMPTS[comboKey] ?? '');
    loadAssets();
  }, [comboKey]);

  async function loadAssets() {
    const { data } = await supabase
      .from('game_assets')
      .select('*')
      .eq('game_name', game)
      .eq('asset_type', assetType)
      .eq('asset_key', assetKey)
      .order('created_at', { ascending: false });
    setAssets(data ?? []);
  }

  async function handleGenerate() {
    if (!prompt.trim()) return setError('Enter a prompt first.');
    setGenerating(true); setError(''); setLastCost(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt, game_name: game, asset_type: assetType, asset_key: assetKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Generation failed');
      if (json.cost_usd != null) setLastCost(json.cost_usd);
      await loadAssets();
      await loadSlotStatuses();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleActivate(asset) {
    await supabase.from('game_assets').update({ is_active: false })
      .eq('game_name', game).eq('asset_type', assetType).eq('asset_key', assetKey);
    await supabase.from('game_assets').update({ is_active: true }).eq('id', asset.id);
    await log('asset_activate', 'game_asset', asset.id, { is_active: false }, { is_active: true, url: asset.url });
    await loadAssets();
    await loadSlotStatuses();
  }

  async function handleDelete(asset) {
    if (!confirm('Delete this asset?')) return;
    await supabase.from('game_assets').delete().eq('id', asset.id);
    await log('score_delete', 'game_asset', asset.id, { url: asset.url }, null);
    await loadAssets();
    await loadSlotStatuses();
  }

  function jumpToSlot(slot) {
    setGame(slot.game);
    setTimeout(() => {
      setAssetType(slot.type);
      setTimeout(() => setAssetKey(slot.key), 50);
    }, 50);
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1rem' },
    h2: { fontSize:'1rem', fontWeight:'600', color:'#9999bb', marginBottom:'.75rem', marginTop:'1.5rem' },
    row: { display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem', alignItems:'flex-end' },
    group: { display:'flex', flexDirection:'column', gap:'.4rem' },
    label: { color:'#9999bb', fontSize:'.8rem', fontWeight:'600' },
    select: { background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .9rem', borderRadius:'7px', fontSize:'.9rem' },
    promptWrap: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem', marginBottom:'1.5rem' },
    textarea: { width:'100%', minHeight:'80px', background:'#0f0f1a', border:'1px solid #2a2a4a', borderRadius:'7px', color:'#e0e0f0', padding:'.7rem .9rem', fontSize:'.9rem', resize:'vertical', marginBottom:'1rem', boxSizing:'border-box' },
    btn: (dis) => ({ padding:'.65rem 1.6rem', background: dis ? '#333' : '#7c3aed', color: dis ? '#666' : '#fff', border:'none', borderRadius:'7px', fontSize:'.95rem', fontWeight:'600', cursor: dis ? 'not-allowed' : 'pointer' }),
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem' },
    imgCard: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    img: { width:'100%', aspectRatio:'1/1', objectFit:'cover', display:'block' },
    imgFooter: { padding:'.75rem', display:'flex', gap:'.5rem', justifyContent:'space-between', alignItems:'center' },
    activeBadge: { fontSize:'.75rem', fontWeight:'700', color:'#4ade80', background:'#0d2d1a', padding:'.2rem .5rem', borderRadius:'4px' },
    err: { color:'#f44', fontSize:'.85rem', marginTop:'.5rem' },
    // Slot overview
    slotGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'.6rem', marginBottom:'2rem' },
    slotCard: (filled, active) => ({
      background: filled ? '#0d1f12' : '#16162a',
      border: `1px solid ${filled ? '#4ade80' : '#3a1a1a'}`,
      borderRadius:'8px', padding:'.6rem .8rem', cursor:'pointer',
      display:'flex', flexDirection:'column', gap:'.3rem',
    }),
    slotThumb: { width:'100%', aspectRatio:'16/9', objectFit:'cover', borderRadius:'4px', marginBottom:'.3rem' },
    slotPlaceholder: { width:'100%', aspectRatio:'16/9', background:'repeating-linear-gradient(45deg,#1a1a2e 0,#1a1a2e 10px,#16162a 10px,#16162a 20px)', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', marginBottom:'.3rem' },
    slotLabel: { fontSize:'.75rem', color:'#ccc', fontWeight:'600', lineHeight:'1.2' },
    slotDim: { fontSize:'.65rem', color:'#555' },
    slotStatus: (filled) => ({ fontSize:'.65rem', fontWeight:'700', color: filled ? '#4ade80' : '#f87171' }),
  };

  const pieceKeys = ASSET_KEYS[`${game}/${assetType}`];
  const filledCount = LOBBY_SLOTS.filter(sl => slotStatuses[`${sl.game}/${sl.type}/${sl.key}`]).length;

  return (
    <div>
      <h1 style={s.h1}>Game Assets</h1>

      {/* ── Lobby / Splash slot overview ── */}
      <div style={{ background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.25rem', marginBottom:'2rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem' }}>
          <span style={{ color:'#e0e0f0', fontWeight:'700', fontSize:'.95rem' }}>Live Image Slots</span>
          <span style={{ fontSize:'.8rem', color: filledCount === LOBBY_SLOTS.length ? '#4ade80' : '#f59e0b', fontWeight:'600' }}>
            {filledCount} / {LOBBY_SLOTS.length} filled
          </span>
        </div>
        <div style={s.slotGrid}>
          {LOBBY_SLOTS.map(sl => {
            const k = `${sl.game}/${sl.type}/${sl.key}`;
            const url = slotStatuses[k];
            const isSelected = game === sl.game && assetType === sl.type && assetKey === sl.key;
            return (
              <div key={k} style={{ ...s.slotCard(!!url), outline: isSelected ? '2px solid #7c3aed' : 'none' }} onClick={() => jumpToSlot(sl)} title="Click to generate">
                {url
                  ? <img src={url} alt={sl.label} style={s.slotThumb} loading="lazy" decoding="async" />
                  : <div style={s.slotPlaceholder}>{sl.emoji}</div>}
                <div style={s.slotLabel}>{sl.label}</div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={s.slotDim}>{sl.dim}</span>
                  <span style={s.slotStatus(!!url)}>{url ? '✓ Active' : '✗ Missing'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Generator ── */}
      <div style={s.row}>
        <div style={s.group}>
          <span style={s.label}>Game</span>
          <select style={s.select} value={game} onChange={e => setGame(e.target.value)}>
            {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={s.group}>
          <span style={s.label}>Asset Type</span>
          <select style={s.select} value={assetType} onChange={e => setAssetType(e.target.value)}>
            {(ASSET_TYPES[game] ?? []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {pieceKeys ? (
          <div style={s.group}>
            <span style={s.label}>Key</span>
            <select style={s.select} value={assetKey} onChange={e => setAssetKey(e.target.value)}>
              {pieceKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        ) : (game === 'lobby' && assetType !== 'hero_banner' ? null : (
          game === 'lobby' && (
            <div style={s.group}>
              <span style={s.label}>Game</span>
              <select style={s.select} value={assetKey} onChange={e => setAssetKey(e.target.value)}>
                {['flappy','reaction','shooter','pacman','chess'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )
        ))}
      </div>

      <div style={s.promptWrap}>
        <div style={{ ...s.label, marginBottom:'.5rem' }}>
          Prompt (GPT Image 2 · {(['hero_banner','background','carousel'].includes(assetType) ? '1536×1024 landscape' : '1024×1024 square')})
        </div>
        <textarea style={s.textarea} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Enter image generation prompt…" />
        <button style={s.btn(generating)} onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating…' : '✨ Generate Image'}
        </button>
        {generating && (
          <div style={{ marginTop:'.75rem', display:'flex', alignItems:'center', gap:'.75rem' }}>
            <div style={{ width:'180px', height:'6px', background:'#1a1a2e', borderRadius:'3px', overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#7c3aed', borderRadius:'3px', animation:'genProgress 8s linear forwards' }} />
            </div>
            <span style={{ color:'#9999bb', fontSize:'.8rem' }}>Generating…</span>
          </div>
        )}
        <style>{`@keyframes genProgress { from { width:0% } to { width:95% } }`}</style>
        {error && <p style={s.err}>{error}</p>}
        {lastCost != null && (
          <p style={{ color:'#a78bfa', fontSize:'.82rem', marginTop:'.5rem' }}>
            Cost: <strong>${lastCost.toFixed(3)}</strong> (estimated)
          </p>
        )}
      </div>

      <h2 style={s.h2}>Generated Assets ({assets.length})</h2>
      <div style={s.grid}>
        {assets.map(a => (
          <div key={a.id} style={{ ...s.imgCard, border: a.is_active ? '1px solid #4ade80' : '1px solid #2a2a4a' }}>
            <img src={a.url} alt={a.asset_key} style={{ ...s.img, aspectRatio: ['hero_banner','background','carousel'].includes(assetType) ? '16/9' : '1/1' }} loading="lazy" decoding="async" />
            <div style={s.imgFooter}>
              {a.is_active ? <span style={s.activeBadge}>✓ Active</span> : (
                <button onClick={() => handleActivate(a)} style={{ ...s.btn(false), padding:'.3rem .7rem', fontSize:'.8rem' }}>Activate</button>
              )}
              <button onClick={() => handleDelete(a)} style={{ background:'transparent', border:'1px solid #3d1515', color:'#f87171', padding:'.3rem .7rem', borderRadius:'5px', cursor:'pointer', fontSize:'.8rem' }}>Delete</button>
            </div>
          </div>
        ))}
        {assets.length === 0 && <p style={{ color:'#555', gridColumn:'1/-1' }}>No assets generated yet for this combination.</p>}
      </div>
    </div>
  );
}
