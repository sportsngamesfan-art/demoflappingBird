import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/audit.js';

const GAMES = ['lobby', 'flappy', 'chess', 'shooter', 'pacman', 'reaction'];
const ASSET_TYPES = {
  lobby:    ['card_art', 'hero_banner'],
  flappy:   ['card_art', 'background'],
  chess:    ['card_art', 'piece_sprite'],
  shooter:  ['card_art', 'background'],
  pacman:   ['card_art', 'background'],
  reaction: ['card_art'],
};

const DEFAULT_PROMPTS = {
  'lobby/card_art/flappy':    'Pixel art cartoon bird flying through green pipes, vibrant blue sky, retro 16-bit arcade style, game card art, dark background',
  'lobby/card_art/chess':     'Minimalist isometric chess board with glowing gold pieces, dark fantasy style, game card art, cinematic lighting',
  'lobby/card_art/shooter':   'Retro side-scrolling shooter game scene, laser beams, explosions, pixel art, neon colors, game card art',
  'lobby/card_art/pacman':    'Classic arcade Pac-Man maze, neon grid, colorful ghosts, vibrant digital art, game card art',
  'lobby/card_art/reaction':  'Lightning bolt striking a glowing target, electric blue and white, reaction speed game art, dark background',
  'lobby/hero_banner/main':   'Epic multiplayer gaming platform promotional banner, multiple game characters, vibrant neon colors, cinematic wide format',
  'flappy/card_art/main':     'Cute cartoon pixel bird mid-flight, colorful pipes, blue sky with clouds, retro game style card art',
  'flappy/background/sky':    'Parallax scrolling game background, warm sunset sky, fluffy clouds, green rolling hills, cartoon style',
  'chess/card_art/main':      'Dramatic chess board with glowing pieces, gold vs silver, dark mystical atmosphere, game card art',
  'chess/piece_sprite/king_white':  'White chess king piece, 3D rendered, clean isolated on white background, game icon style, top view',
  'chess/piece_sprite/king_black':  'Black chess king piece, 3D rendered, clean isolated on white background, game icon style, top view',
  'chess/piece_sprite/queen_white': 'White chess queen piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/queen_black': 'Black chess queen piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/rook_white':  'White chess rook piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/rook_black':  'Black chess rook piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/bishop_white':'White chess bishop piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/bishop_black':'Black chess bishop piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/knight_white':'White chess knight piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/knight_black':'Black chess knight piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/pawn_white':  'White chess pawn piece, 3D rendered, clean isolated on white background, game icon',
  'chess/piece_sprite/pawn_black':  'Black chess pawn piece, 3D rendered, clean isolated on white background, game icon',
  'shooter/card_art/main':    'Retro 2D side-scroller shooter game, hero character shooting aliens, pixel art neon style, game card art',
  'shooter/background/space': 'Retro space shooter background, starfield, distant planets, nebula clouds, pixel art style',
  'pacman/card_art/main':     'Colorful Pac-Man eating pellets in a maze, four ghosts chasing, vibrant arcade art, game card art',
  'pacman/background/neon':   'Neon glowing maze corridor, dark background, electric blue and pink grid lines, futuristic game background',
  'reaction/card_art/main':   'Speedometer at maximum, electric sparks, neon blue energy, reaction time challenge game art',
};

const ASSET_KEYS = {
  'chess/piece_sprite': ['king_white','king_black','queen_white','queen_black','rook_white','rook_black','bishop_white','bishop_black','knight_white','knight_black','pawn_white','pawn_black'],
};

export default function GameAssets() {
  const [game, setGame] = useState('lobby');
  const [assetType, setAssetType] = useState('card_art');
  const [assetKey, setAssetKey] = useState('flappy');
  const [prompt, setPrompt] = useState('');
  const [assets, setAssets] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const comboKey = `${game}/${assetType}/${assetKey}`;

  useEffect(() => {
    setAssetType(ASSET_TYPES[game]?.[0] ?? 'card_art');
  }, [game]);

  useEffect(() => {
    const keys = ASSET_KEYS[`${game}/${assetType}`];
    setAssetKey(keys ? keys[0] : 'main');
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
    setGenerating(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://owqqfjyisewemtxjgexq.supabase.co/functions/v1/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, game_name: game, asset_type: assetType, asset_key: assetKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Generation failed');
      await loadAssets();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleActivate(asset) {
    // Deactivate all for this combo first
    await supabase.from('game_assets')
      .update({ is_active: false })
      .eq('game_name', game).eq('asset_type', assetType).eq('asset_key', assetKey);
    // Activate this one
    await supabase.from('game_assets').update({ is_active: true }).eq('id', asset.id);
    await log('asset_activate', 'game_asset', asset.id, { is_active: false }, { is_active: true, url: asset.url });
    await loadAssets();
  }

  async function handleDelete(asset) {
    if (!confirm('Delete this asset?')) return;
    await supabase.from('game_assets').delete().eq('id', asset.id);
    await log('score_delete', 'game_asset', asset.id, { url: asset.url }, null);
    await loadAssets();
  }

  const s = {
    h1: { fontSize:'1.6rem', fontWeight:'700', color:'#e0e0f0', marginBottom:'1.5rem' },
    row: { display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem', alignItems:'flex-end' },
    group: { display:'flex', flexDirection:'column', gap:'.4rem' },
    label: { color:'#9999bb', fontSize:'.8rem', fontWeight:'600' },
    select: { background:'#16162a', border:'1px solid #2a2a4a', color:'#e0e0f0', padding:'.5rem .9rem', borderRadius:'7px', fontSize:'.9rem' },
    promptWrap: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', padding:'1.5rem', marginBottom:'1.5rem' },
    textarea: { width:'100%', minHeight:'80px', background:'#0f0f1a', border:'1px solid #2a2a4a', borderRadius:'7px', color:'#e0e0f0', padding:'.7rem .9rem', fontSize:'.9rem', resize:'vertical', marginBottom:'1rem' },
    btn: (dis) => ({ padding:'.65rem 1.6rem', background: dis ? '#333' : '#7c3aed', color: dis ? '#666' : '#fff', border:'none', borderRadius:'7px', fontSize:'.95rem', fontWeight:'600', cursor: dis ? 'not-allowed' : 'pointer' }),
    grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem' },
    imgCard: { background:'#16162a', border:'1px solid #2a2a4a', borderRadius:'10px', overflow:'hidden' },
    img: { width:'100%', aspectRatio:'1/1', objectFit:'cover', display:'block' },
    imgFooter: { padding:'.75rem', display:'flex', gap:'.5rem', justifyContent:'space-between', alignItems:'center' },
    activeBadge: { fontSize:'.75rem', fontWeight:'700', color:'#4ade80', background:'#0d2d1a', padding:'.2rem .5rem', borderRadius:'4px' },
    err: { color:'#f44', fontSize:'.85rem', marginTop:'.5rem' },
  };

  const pieceKeys = ASSET_KEYS[`${game}/${assetType}`];

  return (
    <div>
      <h1 style={s.h1}>Game Assets</h1>
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
        {pieceKeys && (
          <div style={s.group}>
            <span style={s.label}>Piece</span>
            <select style={s.select} value={assetKey} onChange={e => setAssetKey(e.target.value)}>
              {pieceKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={s.promptWrap}>
        <div style={{ ...s.label, marginBottom:'.5rem' }}>Prompt (DALL-E 3)</div>
        <textarea style={s.textarea} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Enter image generation prompt…" />
        <button style={s.btn(generating)} onClick={handleGenerate} disabled={generating}>
          {generating ? '⏳ Generating…' : '✨ Generate Image'}
        </button>
        {error && <p style={s.err}>{error}</p>}
      </div>

      <h2 style={{ fontSize:'1rem', fontWeight:'600', color:'#9999bb', marginBottom:'1rem' }}>Generated Assets ({assets.length})</h2>
      <div style={s.grid}>
        {assets.map(a => (
          <div key={a.id} style={{ ...s.imgCard, border: a.is_active ? '1px solid #4ade80' : '1px solid #2a2a4a' }}>
            <img src={a.url} alt={a.asset_key} style={s.img} loading="lazy" />
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
