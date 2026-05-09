// daw-profile.jsx — Profile / Party / Bestiary / Social tabs.
//
// This file defines the full player-profile screen for the DAWTFG game.
// It is loaded as a plain browser script (no bundler), so React hooks are
// destructured from the global `React` object and all components are exposed
// on `window` at the bottom.
//
// Sections in this file:
//   - Avatar localStorage helpers  (loadAvatar / storeAvatar)
//   - Palette presets              (AVATAR_PALETTES / DEFAULT_PALETTE)
//   - Stat / rank helpers          (fmtPlaytime, fmtDate, computeLevel, computeRank, computeAchievements)
//   - AvatarDisplay                renders a saved sprite or uploaded image as a pixel avatar
//   - SpriteEditorMini             canvas-backed pixel editor with per-slot colour pickers
//   - AvatarEditorModal            full-screen modal wrapping the editor (preset / draw / upload tabs)
//   - ProfileTab                   identity card + achievements for the current player
//   - SocialTab                    following / followers lists with follow-back support
//   - PartyTab                     hero slot manager with keyboard navigation
//   - PartyDetail                  detail panel shown next to the roster in PartyTab
//   - BestiaryTab                  enemy encyclopedia, entries unlocked by encountering enemies
//   - ProfilePage                  top-level page shell with tab bar and keyboard shortcuts

const {
  useState: useStateP, useEffect: useEffectP, useMemo: useMemoP,
  useCallback: useCallbackP, useRef: useRefP,
} = React;

// ── Avatar localStorage helpers ────────────────────────────────────────

// Reads the player's saved avatar object from localStorage; returns null on
// missing or corrupt data.
function loadAvatar(accountId) {
  try { return JSON.parse(localStorage.getItem(`daw.pfp.${accountId}`) || 'null'); }
  catch(e) { return null; }
}

// Persists the avatar object to localStorage, or removes the key when avatar
// is null/undefined (i.e. the player removed their avatar).
function storeAvatar(accountId, avatar) {
  if (!avatar) { localStorage.removeItem(`daw.pfp.${accountId}`); return; }
  localStorage.setItem(`daw.pfp.${accountId}`, JSON.stringify(avatar));
}

// ── Palette presets for the sprite editor ─────────────────────────────
// Each entry maps the five sprite colour roles (body, rim, dark, acc, eye)
// to specific hex values.  These mirror the hero colour schemes used by BSprite.
const AVATAR_PALETTES = [
  { name:'CURSOR', body:'#2a3a55', rim:'#a5b985', dark:'#020806', acc:'#fefae0', eye:'#fefae0' },
  { name:'GUARD',  body:'#3a3a18', rim:'#d4f4a3', dark:'#020806', acc:'#fefae0', eye:'#fefae0' },
  { name:'PURGE',  body:'#1a0a2a', rim:'#d4a373', dark:'#020806', acc:'#a5b985', eye:'#ff6ec7' },
  { name:'PING',   body:'#3a3a18', rim:'#fefae0', dark:'#020806', acc:'#d4a373', eye:'#9bc4ff' },
  { name:'ROOT',   body:'#0a2a18', rim:'#a5e58a', dark:'#020806', acc:'#d4a373', eye:'#ffdc4a' },
  { name:'INDEX',  body:'#2a1a0a', rim:'#d4a373', dark:'#020806', acc:'#ffdc4a', eye:'#ff6ec7' },
  { name:'GHOST',  body:'#1a1a3a', rim:'#9bc4ff', dark:'#020806', acc:'#e6f1ff', eye:'#ff6ec7' },
  { name:'TOXIC',  body:'#0a2a0a', rim:'#a5e58a', dark:'#020806', acc:'#d4f4a3', eye:'#ffdc4a' },
];

// The palette applied to a new blank sprite by default (GUARD theme).
const DEFAULT_PALETTE = AVATAR_PALETTES[1];

// Returns a blank 18-row × 16-column pixel grid where every cell is '.'
// (transparent/erased).
function emptyGrid() {
  return Array.from({length: 18}, () => '.'.repeat(16));
}

// ── Stats / rank helpers ───────────────────────────────────────────────

// Formats a playtime in seconds as HH:MM:SS with zero-padded fields.
function fmtPlaytime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Formats an ISO date string or Date-like value as YYYY-MM-DD; returns '—'
// for falsy input.
function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toISOString().slice(0, 10);
}

// Derives the player level from their clear history.
// ':start' entries are excluded because they represent entering a node, not
// completing it.  Level is clamped between 1 and 99.
function computeLevel(clears) {
  const meaningful = clears.filter(c => !c.endsWith(':start')).length;
  return Math.min(99, Math.max(1, 1 + meaningful * 2));
}

// Maps a numeric level to a named rank string and display tier.
// Returns an object { rank, tier } consumed by ProfileTab.
function computeRank(level) {
  if (level < 5)  return { rank:'NOVICE',      tier:1 };
  if (level < 12) return { rank:'APPRENTICE',  tier:2 };
  if (level < 24) return { rank:'OPERATIVE',   tier:3 };
  if (level < 40) return { rank:'SPECIALIST',  tier:4 };
  if (level < 70) return { rank:'GUARDIAN',    tier:5 };
  return              { rank:'ROOT ACCESS',   tier:'∞' };
}

// Builds the full list of achievement objects, each with an `unlocked` boolean
// derived from the player's clear list and unlocked hero roster.
function computeAchievements(clears, unlockedHeroes) {
  const cs = new Set(clears);
  // hasClear checks whether any entry ends with the given suffix (e.g. 'mid', 'boss').
  const hasClear = (suffix) => clears.some(c => c.endsWith(`:${suffix}`));
  return [
    { id:'a1', icon:'$',  name:'FIRST LOGIN',     desc:'Connected to sectorware.net.',               unlocked: true },
    { id:'a2', icon:'⚑',  name:'FIRST SECTOR',    desc:'Cleared your first encounter.',              unlocked: clears.length > 0 },
    { id:'a3', icon:'⚔',  name:'MINI-BOSS DOWN',  desc:'Survived a mini-boss process.',              unlocked: hasClear('mid') },
    { id:'a4', icon:'★',  name:'FIRST BOSS',       desc:'Eliminated a world-level root process.',    unlocked: hasClear('boss') },
    { id:'a5', icon:'⚑',  name:'WORLD 2 REACHED', desc:'Breached the second subnet.',                unlocked: cs.has('w1:boss') },
    { id:'a6', icon:'★',  name:'GAME CLEAR',       desc:'All three world bosses defeated.',           unlocked: cs.has('w1:boss') && cs.has('w2:boss') && cs.has('w3:boss') },
    { id:'a7', icon:'▣',  name:'FULL ROSTER',      desc:'All 6 heroes unlocked.',                    unlocked: unlockedHeroes.length >= 6 },
    { id:'a8', icon:'@',  name:'COLLECTOR',         desc:'More than 10 node clears on record.',       unlocked: clears.filter(c=>!c.endsWith(':start')).length > 10 },
  ];
}

// ── Avatar display ─────────────────────────────────────────────────────

// Renders the player's avatar at the requested pixel size.
// Supports three states:
//   • no avatar saved  → falls back to the default GUARD sprite from window.B_GUARD
//   • avatar.type === 'image'  → shows the stored data-URL as a pixelated <img>
//   • avatar.type === 'sprite' → renders a custom pixel grid via BSprite inside an SVG
// `size` controls the displayed square dimensions; the SVG viewBox is always
// 16 × 18 cells so `scale` is derived as floor(size / 16).
function AvatarDisplay({ avatar, size = 112 }) {
  const scale = Math.max(1, Math.floor(size / 16));
  const W = scale * 16, H = scale * 18;

  if (!avatar) {
    const g = window.B_GUARD;
    // If the default sprite hasn't loaded yet, render a placeholder box.
    if (!g) return <div style={{width:W,height:H,background:'rgba(0,0,0,.35)',border:'2px solid rgba(254,250,224,.2)'}} />;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
        <BSprite grid={g} scale={scale} x={0} y={0}
          body="#3a3a18" rim="#d4f4a3" dark="#020806" acc="#fefae0" eye="#fefae0" />
      </svg>
    );
  }
  if (avatar.type === 'image') {
    return <img src={avatar.dataUrl} alt="avatar"
      style={{width:W, height:H, imageRendering:'pixelated', objectFit:'cover',
              display:'block', border:'2px solid rgba(254,250,224,.2)'}} />;
  }
  if (avatar.type === 'sprite') {
    const p = avatar.palette || DEFAULT_PALETTE;
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
        <BSprite grid={avatar.grid} scale={scale} x={0} y={0}
          body={p.body} rim={p.rim} dark={p.dark} acc={p.acc} eye={p.eye} />
      </svg>
    );
  }
  return null;
}

// ── Pixel sprite editor (canvas-backed, no re-render on paint) ────────

// A compact pixel-art editor that renders onto a <canvas> and avoids React
// re-renders during painting by keeping grid state in a ref.
// Props:
//   initGrid    — initial 18-row string array (one char per pixel)
//   initPalette — initial colour mapping for the five paint roles
//   onSave      — called with { type:'sprite', grid, palette } when SAVE is clicked
//   onCancel    — called when the ✕ button is clicked
//   blip        — optional sound-effect callback(frequency)
function SpriteEditorMini({ initGrid, initPalette, onSave, onCancel, blip }) {
  const CELL = 13; // pixel size of each grid cell on the canvas (in CSS pixels)
  const canvasRef = useRefP(null);
  // gridRef holds the mutable grid so painting doesn't trigger re-renders.
  const gridRef   = useRefP(initGrid ? [...initGrid] : emptyGrid());
  // palRef mirrors palette state in a ref so event handlers always see the
  // latest colours without needing to be re-registered.
  const palRef    = useRefP(initPalette ? {...initPalette} : {...DEFAULT_PALETTE});
  const [pal, setPal] = useStateP(initPalette ? {...initPalette} : {...DEFAULT_PALETTE});
  const [tool, setTool] = useStateP('#'); // active paint character; '.' means erase
  const toolRef   = useRefP('#');  // ref copy so mouse handlers read current tool
  const painting  = useRefP(false); // true while the mouse button is held down
  // previewV is a counter bumped after each stroke to force the preview SVG to re-render.
  const [previewV, setPreviewV] = useStateP(0);

  // Maps a single-character paint code to the hex colour in the current palette.
  // Returns null for '.' (transparent/erase).
  function chToColor(ch, p) {
    if (ch === '#') return p.body;
    if (ch === 'r') return p.rim;
    if (ch === 'k') return p.dark;
    if (ch === 'a') return p.acc;
    if (ch === 'e') return p.eye;
    return null;
  }

  // Redraws the entire canvas from gridRef and palRef; also overlays a faint
  // grid line pattern so individual cells are visible.
  function redrawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const p = palRef.current;
    for (let r = 0; r < 18; r++) {
      for (let c = 0; c < 16; c++) {
        const ch = gridRef.current[r]?.[c] || '.';
        const col = chToColor(ch, p);
        // Transparent cells get a checkerboard pattern so the canvas background shows through.
        ctx.fillStyle = col || ((r+c)%2===0 ? '#282828' : '#1c1c1c');
        ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
      }
    }
    // Draw faint grid lines over the pixel cells.
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= 18; r++) {
      ctx.beginPath(); ctx.moveTo(0, r*CELL); ctx.lineTo(16*CELL, r*CELL); ctx.stroke();
    }
    for (let c = 0; c <= 16; c++) {
      ctx.beginPath(); ctx.moveTo(c*CELL, 0); ctx.lineTo(c*CELL, 18*CELL); ctx.stroke();
    }
  }

  // Draw the initial grid state once the canvas element is in the DOM.
  useEffectP(() => { redrawCanvas(); }, []);

  // Converts a mouse event's client coordinates to a {r, c} grid cell index;
  // returns null when the pointer is outside the canvas bounds.
  function getCell(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / CELL);
    const r = Math.floor((e.clientY - rect.top) / CELL);
    if (c < 0 || c >= 16 || r < 0 || r >= 18) return null;
    return {r, c};
  }

  // Paints a single cell with the active tool character.
  // Skips the cell if it already holds the same character to avoid redundant
  // canvas operations.  Only the affected cell is repainted rather than the
  // whole canvas for performance.
  function paintAt(r, c) {
    const t = toolRef.current;
    const g = gridRef.current;
    if (g[r]?.[c] === t) return;
    // Replace the character at column c in row r (strings are immutable).
    gridRef.current = g.map((row, ri) => ri === r ? row.slice(0,c) + t + row.slice(c+1) : row);
    // Redraw just this cell
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const col = chToColor(t, palRef.current);
    ctx.fillStyle = col || ((r+c)%2===0 ? '#282828' : '#1c1c1c');
    ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    // Redraw the grid border for this cell so it isn't obscured by the fill.
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(c*CELL+.25, r*CELL+.25, CELL-.5, CELL-.5);
  }

  // Updates a single palette slot (e.g. 'body', 'rim') to a new hex value,
  // then redraws the full canvas so existing pixels reflect the colour change.
  function changePalette(key, val) {
    palRef.current = {...palRef.current, [key]: val};
    setPal({...palRef.current});
    redrawCanvas();
    setPreviewV(v => v + 1);
  }

  // Tool definitions: glyph is the character written into the grid,
  // label is the tooltip text, and key is the palette slot name (null for erase).
  // key=null means erase (no color), key=string means a palette slot
  const TOOLS = [
    {glyph:'.', label:'ERASE', key: null},
    {glyph:'#', label:'BODY',  key: 'body'},
    {glyph:'r', label:'RIM',   key: 'rim'},
    {glyph:'k', label:'DARK',  key: 'dark'},
    {glyph:'a', label:'ACC',   key: 'acc'},
    {glyph:'e', label:'EYE',   key: 'eye'},
  ];

  // Inline style objects kept in a local S object to avoid polluting the JSX.
  const S = {
    root: {display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap'},
    tools: {display:'flex', flexDirection:'column', gap:4, flexShrink:0},
    toolBox: (active) => ({
      width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
      position:'relative', boxSizing:'border-box',
      background: active ? 'rgba(254,250,224,.15)' : 'transparent',
      border: active ? '2px solid var(--cream)' : '2px solid rgba(254,250,224,.3)',
      cursor:'pointer', padding:0, flexShrink:0,
    }),
    colorDot: (color) => ({
      width:16, height:16, pointerEvents:'none',
      background: color || 'transparent',
      // Dashed border indicates the erase tool (no colour fill).
      border: color ? 'none' : '1px dashed rgba(254,250,224,.5)',
    }),
    palLabel: {fontFamily:"'VT323',monospace", fontSize:13, color:'rgba(254,250,224,.6)', letterSpacing:'.06em'},
    col: {display:'flex', flexDirection:'column', alignItems:'flex-start', gap:8},
    preview: {background:'rgba(0,0,0,.4)', border:'2px solid rgba(254,250,224,.2)', padding:4},
    act: {display:'flex', gap:6, marginTop:4},
    btn: (primary) => ({
      appearance:'none',
      background: primary ? 'rgba(212,244,163,.15)' : 'transparent',
      border:`2px solid ${primary ? 'var(--fg-bright)' : 'rgba(254,250,224,.4)'}`,
      color: primary ? 'var(--fg-bright)' : 'var(--cream)',
      fontFamily:"'Press Start 2P',monospace", fontSize:8, letterSpacing:'.1em',
      padding:'5px 8px', cursor:'pointer',
    }),
  };

  // Activates a paint tool and optionally plays a UI blip sound.
  function selectTool(glyph) { setTool(glyph); toolRef.current = glyph; blip&&blip(540); }

  return (
    <div style={S.root}>
      {/* Vertical tool strip: erase button + one colour-picker label per palette slot */}
      <div style={S.tools}>
        {TOOLS.map(t => {
          const active = tool === t.glyph;
          if (t.key === null) {
            // Erase tool: plain button with a dashed transparent swatch.
            return (
              <button key={t.glyph} style={S.toolBox(active)} title={t.label}
                onClick={()=>selectTool(t.glyph)}>
                <div style={S.colorDot(null)} />
              </button>
            );
          }
          // Color tool: swatch shows current color; hidden input[type=color] handles picking.
          // One click selects the tool AND opens the native color picker.
          // The <label> wrapper forwards the click to the hidden <input type="color"> so the
          // native colour picker opens whenever the user clicks the swatch.
          return (
            <label key={t.glyph} style={S.toolBox(active)} title={t.label}>
              <div style={S.colorDot(pal[t.key])} />
              <input type="color" value={pal[t.key]}
                onClick={()=>selectTool(t.glyph)}
                onChange={e=>changePalette(t.key, e.target.value)}
                style={{position:'absolute', inset:0, opacity:0, width:'100%', height:'100%',
                        cursor:'pointer', padding:0, border:'none'}} />
            </label>
          );
        })}
      </div>

      {/* Main drawing canvas — mouse events drive the paint-on-drag behaviour */}
      <canvas ref={canvasRef}
        width={16*CELL} height={18*CELL}
        style={{cursor:'crosshair', imageRendering:'pixelated', border:'2px solid rgba(254,250,224,.3)', flexShrink:0}}
        onMouseDown={e => { painting.current=true; const cell=getCell(e); if(cell) paintAt(cell.r,cell.c); }}
        onMouseMove={e => { if(!painting.current) return; const cell=getCell(e); if(cell) paintAt(cell.r,cell.c); }}
        onMouseUp={()=>{ painting.current=false; setPreviewV(v=>v+1); }}
        onMouseLeave={()=>{ painting.current=false; }}
      />

      {/* Right column: live SVG preview and Save / Cancel actions */}
      <div style={S.col}>
        <div style={S.palLabel}>PREVIEW</div>
        {/* key={previewV} forces the SVG to re-render after each paint stroke */}
        <div style={S.preview} key={previewV}>
          <svg width={4*16} height={4*18} viewBox={`0 0 ${4*16} ${4*18}`} shapeRendering="crispEdges">
            <BSprite grid={gridRef.current} scale={4} x={0} y={0}
              body={pal.body} rim={pal.rim} dark={pal.dark} acc={pal.acc} eye={pal.eye} />
          </svg>
        </div>
        <div style={S.act}>
          <button style={S.btn(true)}
            onClick={()=>{ blip&&blip(960); onSave({type:'sprite', grid:[...gridRef.current], palette:{...palRef.current}}); }}>
            SAVE
          </button>
          <button style={S.btn(false)} onClick={()=>{ blip&&blip(360); onCancel(); }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar editor modal ────────────────────────────────────────────────

// Full-screen overlay that lets the player change their avatar via three tabs:
//   PRESETS — pick a pre-built hero sprite
//   DRAW    — open SpriteEditorMini and paint a custom sprite
//   UPLOAD  — choose a local image file (scaled down to pixel-art size)
// Props:
//   accountId — used for localStorage key (not used directly here; passed through onSave)
//   current   — the currently saved avatar object (may be null)
//   onSave    — called with the new avatar object after the player confirms
//   onClose   — called to dismiss the modal without saving
//   blip      — optional sound-effect callback(frequency)
function AvatarEditorModal({ accountId, current, onSave, onClose, blip }) {
  const [tab, setTab] = useStateP('preset');
  const [selectedPreset, setSelectedPreset] = useStateP(null);

  // Filter to only presets whose sprite data has loaded onto window (e.g. window.B_GUARD).
  const PRESETS = [
    { label:'CURSOR.EXE', grid: window.B_CURSOR, palette: AVATAR_PALETTES[0] },
    { label:'GUARD.SYS',  grid: window.B_GUARD,  palette: AVATAR_PALETTES[1] },
    { label:'PURGE.BAT',  grid: window.B_PURGE,  palette: AVATAR_PALETTES[2] },
    { label:'PING.DLL',   grid: window.B_PING,   palette: AVATAR_PALETTES[3] },
    { label:'ROOT.SH',    grid: window.B_ROOT,   palette: AVATAR_PALETTES[4] },
    { label:'INDEX.LOG',  grid: window.B_INDEX,  palette: AVATAR_PALETTES[5] },
  ].filter(p => p.grid);

  // Handles a file-input change: reads the file as a data URL, draws it onto a
  // 32×36 canvas (pixel-art resolution), then calls onSave with the resulting
  // PNG data URL.  imageSmoothingEnabled=false preserves sharp edges.
  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 36;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, 32, 36);
        const dataUrl = canvas.toDataURL('image/png');
        onSave({ type:'image', dataUrl });
        blip && blip(960);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Seed the draw tab with the player's existing sprite data (if any) so edits
  // continue from where they left off rather than starting from a blank canvas.
  const initGrid = (current?.type === 'sprite' ? current.grid : null) || emptyGrid();
  const initPalette = (current?.type === 'sprite' ? current.palette : null) || DEFAULT_PALETTE;

  const S = {
    overlay: {position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-start',justifyContent:'center',
              background:'rgba(0,0,0,.7)', overflowY:'auto', padding:'16px 8px'},
    box: {background:'var(--jrpg-blue)',border:'4px solid var(--cream)',
          boxShadow:'0 0 0 2px var(--bg-0),0 0 0 6px var(--cream)',
          padding:'16px 12px', maxWidth:720, width:'100%', flexShrink:0,
          fontFamily:"'Press Start 2P',monospace", color:'var(--cream)'},
    header: {display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14},
    title: {fontSize:10, letterSpacing:'.18em'},
    tabs: {display:'flex', gap:6, marginBottom:14},
    tabBtn: (active) => ({
      appearance:'none',
      background: active ? 'var(--cream)' : 'transparent',
      color: active ? 'var(--jrpg-blue)' : 'var(--cream)',
      border:'2px solid var(--cream)', fontFamily:"'Press Start 2P',monospace",
      fontSize:8, letterSpacing:'.1em', padding:'5px 10px', cursor:'pointer',
    }),
    presetGrid: {display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:8},
    presetCard: (sel) => ({
      border:`2px solid ${sel ? 'var(--fg-bright)' : 'rgba(254,250,224,.3)'}`,
      background: sel ? 'rgba(212,244,163,.1)' : 'transparent',
      cursor:'pointer', padding:8, display:'flex', flexDirection:'column', alignItems:'center', gap:6,
      transition:'border-color .12s',
    }),
    presetName: {fontSize:8, letterSpacing:'.08em', color:'rgba(254,250,224,.8)', textAlign:'center'},
    closeBtn: {appearance:'none', background:'transparent', border:'none',
               color:'rgba(254,250,224,.6)', fontSize:16, cursor:'pointer', fontFamily:"'VT323',monospace"},
    applyBtn: {appearance:'none',marginTop:12,
               background:'rgba(212,244,163,.15)', border:'2px solid var(--fg-bright)',
               color:'var(--fg-bright)', fontFamily:"'Press Start 2P',monospace",
               fontSize:9, letterSpacing:'.1em', padding:'7px 14px', cursor:'pointer'},
    uploadArea: {border:'2px dashed rgba(254,250,224,.4)', padding:32, textAlign:'center',
                 fontFamily:"'VT323',monospace", fontSize:18, color:'rgba(254,250,224,.7)',
                 cursor:'pointer', letterSpacing:'.04em'},
    uploadNote: {marginTop:10, fontSize:14, color:'rgba(254,250,224,.5)', lineHeight:1.4},
  };

  return (
    // Clicking the dark overlay (not the inner box) closes the modal.
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget){blip&&blip(360);onClose();}}}>
      <div style={S.box}>
        <div style={S.header}>
          <span style={S.title}>▣ AVATAR EDITOR</span>
          <button style={S.closeBtn} onClick={()=>{blip&&blip(360);onClose();}}>✕ CLOSE</button>
        </div>

        {/* Tab switcher: PRESETS / DRAW / UPLOAD */}
        <div style={S.tabs}>
          {[['preset','PRESETS'],['draw','DRAW'],['upload','UPLOAD']].map(([k,l])=>(
            <button key={k} style={S.tabBtn(tab===k)} onClick={()=>{setTab(k);blip&&blip(540);}}>
              {l}
            </button>
          ))}
        </div>

        {/* PRESETS tab: grid of hero sprite thumbnails */}
        {tab === 'preset' && (
          <div>
            <div style={S.presetGrid}>
              {PRESETS.map((p,i) => {
                const sel = selectedPreset?.label === p.label;
                return (
                  <div key={p.label} style={S.presetCard(sel)}
                    onClick={()=>{setSelectedPreset(p);blip&&blip(540);}}>
                    <svg width={5*16} height={5*18} viewBox={`0 0 ${5*16} ${5*18}`} shapeRendering="crispEdges">
                      <BSprite grid={p.grid} scale={5} x={0} y={0}
                        body={p.palette.body} rim={p.palette.rim} dark={p.palette.dark}
                        acc={p.palette.acc} eye={p.palette.eye} />
                    </svg>
                    <div style={S.presetName}>{p.label}</div>
                  </div>
                );
              })}
            </div>
            {/* APPLY button appears only after the player selects a preset */}
            {selectedPreset && (
              <button style={S.applyBtn}
                onClick={()=>{
                  blip&&blip(960);
                  onSave({type:'sprite', grid:[...selectedPreset.grid], palette:{...selectedPreset.palette}});
                }}>
                APPLY {selectedPreset.label}
              </button>
            )}
          </div>
        )}

        {/* DRAW tab: full pixel editor component */}
        {tab === 'draw' && (
          <SpriteEditorMini
            initGrid={initGrid}
            initPalette={initPalette}
            onSave={avatar=>{ blip&&blip(960); onSave(avatar); }}
            onCancel={()=>{ blip&&blip(360); onClose(); }}
            blip={blip}
          />
        )}

        {/* UPLOAD tab: file picker + preview of existing image avatar */}
        {tab === 'upload' && (
          <div>
            <label style={S.uploadArea}>
              <div>⬆ UPLOAD IMAGE</div>
              <div style={S.uploadNote}>
                Any format — will be scaled to pixel art size.
                <br/>JPG, PNG, GIF, WebP accepted.
              </div>
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload} />
            </label>
            {/* Show the current image avatar with a REMOVE option when applicable */}
            {current?.type === 'image' && (
              <div style={{marginTop:14, display:'flex', alignItems:'center', gap:12}}>
                <div style={{fontFamily:"'VT323',monospace", fontSize:16, color:'rgba(254,250,224,.7)'}}>CURRENT:</div>
                <img src={current.dataUrl} alt="current avatar"
                  style={{width:64,height:72,imageRendering:'pixelated',objectFit:'cover',
                          border:'2px solid rgba(254,250,224,.3)'}} />
                <button style={{
                  appearance:'none',background:'transparent',border:'2px solid rgba(255,100,100,.5)',
                  color:'rgba(255,100,100,.8)',fontFamily:"'VT323',monospace",fontSize:15,
                  padding:'4px 10px',cursor:'pointer',letterSpacing:'.06em'
                }} onClick={()=>{ onSave(null); blip&&blip(360); }}>
                  REMOVE
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PROFILE TAB ────────────────────────────────────────────────────────

// Renders the identity card (avatar, handle, rank, stats) on the left and an
// 8-tile achievement grid on the right for the current player.
// Also mounts the AvatarEditorModal when the player clicks the avatar frame.
function ProfileTab({ account, playerName, sectorsCleared, wallet, playtimeSec, clears, unlockedHeroes, blip }) {
  const [avatarEditorOpen, setAvatarEditorOpen] = useStateP(false);
  // Load avatar lazily from localStorage the first time the tab mounts.
  const [avatar, setAvatar] = useStateP(() => loadAvatar(account?.id));
  const isMobile = window.innerWidth <= 760;

  // Persists the new avatar to localStorage then closes the editor modal.
  function handleSaveAvatar(newAvatar) {
    setAvatar(newAvatar);
    if (account?.id) storeAvatar(account.id, newAvatar);
    setAvatarEditorOpen(false);
  }

  const level = computeLevel(clears);
  const { rank, tier } = computeRank(level);
  const achievements = computeAchievements(clears, unlockedHeroes);
  const memberSince = account?.createdAt ? fmtDate(account.createdAt) : '—';
  // ':start' entries are node-entry events, not completions.
  const totalClears = clears.filter(c => !c.endsWith(':start')).length;

  const S = {
    grid: isMobile
        ? {display:'flex', flexDirection:'column', gap:14, paddingBottom:14}
        : {display:'grid', gridTemplateColumns:'auto 1fr', gap:14, height:'100%'},
    card: {background:'var(--jrpg-blue)', border:'3px solid var(--cream)',
           boxShadow:'0 0 0 1px var(--bg-0)',
           padding:'14px 12px', display:'flex', flexDirection:'column', gap:8,
           fontFamily:"'Press Start 2P',monospace", color:'var(--cream)',
           ...(isMobile ? {overflow:'visible'} : {width:200, overflow:'hidden'})},
    legend: {fontFamily:"'Press Start 2P',monospace", fontSize:9, letterSpacing:'.18em',
             color:'var(--cream)', background:'rgba(0,0,0,.4)',
             border:'2px solid var(--cream)', padding:'3px 8px', marginBottom:4},
    avatarFrame: {border:'3px solid var(--cream)', boxShadow:'0 0 0 1px var(--bg-0), 0 0 12px rgba(212,244,163,.15)',
                  lineHeight:0, position:'relative', cursor:'pointer', alignSelf:'flex-start'},
    // 'EDIT' overlay label fades in on hover via opacity controlled in JSX.
    editHint: {position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,.7)',
               fontFamily:"'VT323',monospace", fontSize:12, textAlign:'center',
               color:'rgba(254,250,224,.8)', padding:'2px 0', letterSpacing:'.04em',
               opacity:0, transition:'opacity .15s'},
    handle: {fontSize:13, letterSpacing:'.1em', color:'var(--fg-bright)',
             textShadow:'0 0 8px rgba(212,244,163,.3)', marginTop:2, wordBreak:'break-all'},
    rankLine: {fontFamily:"'VT323',monospace", fontSize:15, color:'var(--hl)',
               letterSpacing:'.06em'},
    statRow: {display:'flex', justifyContent:'space-between', alignItems:'baseline',
              padding:'4px 0', borderBottom:'1px dashed rgba(254,250,224,.15)',
              gap:6},
    statLbl: {fontSize:8, color:'rgba(254,250,224,.55)', letterSpacing:'.1em'},
    statVal: {fontFamily:"'VT323',monospace", fontSize:16, color:'var(--cream)', letterSpacing:'.04em'},
    editBtn: {appearance:'none', background:'transparent', border:'2px solid rgba(254,250,224,.4)',
              color:'rgba(254,250,224,.7)', fontFamily:"'Press Start 2P',monospace",
              fontSize:8, letterSpacing:'.08em', padding:'4px 8px', cursor:'pointer', marginTop:4,
              transition:'border-color .12s, color .12s', alignSelf:'flex-start'},
    right: {display:'flex', flexDirection:'column', minHeight:0},
    section: {background:'rgba(0,0,0,.25)', border:'2px solid rgba(254,250,224,.15)', padding:12,
              flex: isMobile ? '0 0 auto' : '1 1 auto',
              display:'flex', flexDirection:'column', minHeight:0},
    sectionTitle: {fontFamily:"'Press Start 2P',monospace", fontSize:9, letterSpacing:'.18em',
                   color:'var(--cream)', marginBottom:10,
                   borderBottom:'1px solid rgba(254,250,224,.2)', paddingBottom:6,
                   flexShrink:0},
    // Achievements always render in a fixed 4×2 grid regardless of count.
    achvGrid: isMobile
        ? {display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8}
        : {display:'grid', gridTemplateColumns:'repeat(4,1fr)', gridTemplateRows:'repeat(2,1fr)',
           gap:8, flex:'1 1 auto', minHeight:0},
    achv: (unlocked) => ({
      padding:'10px 12px',
      border:`2px solid ${unlocked ? 'rgba(212,244,163,.4)' : 'rgba(254,250,224,.12)'}`,
      background: unlocked ? 'rgba(212,244,163,.06)' : 'rgba(0,0,0,.2)',
      opacity: unlocked ? 1 : .55,
      display:'flex', flexDirection:'column', justifyContent:'center', gap:6,
    }),
    achvIcon: {fontFamily:"'VT323',monospace", fontSize:22, color:'var(--hl)', lineHeight:1},
    achvName: {fontFamily:"'Press Start 2P',monospace", fontSize:7, color:'var(--cream)',
               letterSpacing:'.08em', marginTop:4, lineHeight:1.4},
    achvDesc: {fontFamily:"'VT323',monospace", fontSize:13, color:'rgba(254,250,224,.6)',
               letterSpacing:'.02em', marginTop:3, lineHeight:1.3},
    emailRow: {display:'flex', gap:8, alignItems:'center', marginTop:2},
    emailVal: {fontFamily:"'VT323',monospace", fontSize:15, color:'rgba(254,250,224,.7)', letterSpacing:'.02em'},
    // Badge is green when email is verified, amber when unverified.
    badge: (ok) => ({
      fontFamily:"'Press Start 2P',monospace", fontSize:7, padding:'2px 6px', letterSpacing:'.1em',
      border:`1px solid ${ok ? 'rgba(212,244,163,.5)' : 'rgba(212,163,115,.5)'}`,
      color: ok ? 'var(--fg-bright)' : 'var(--hl)', background:'rgba(0,0,0,.3)',
    }),
  };

  const [hoveringAvatar, setHoveringAvatar] = useStateP(false);

  return (
    <div style={S.grid}>
      {/* Left card: avatar, identity, email, and numeric stats */}
      <div style={S.card}>
        <div style={S.legend}>▣ IDENTITY</div>
        {/* Avatar frame — click anywhere on it to open the editor */}
        <div style={S.avatarFrame}
          onMouseEnter={()=>setHoveringAvatar(true)}
          onMouseLeave={()=>setHoveringAvatar(false)}
          onClick={()=>{ blip&&blip(720); setAvatarEditorOpen(true); }}>
          <AvatarDisplay avatar={avatar} size={112} />
          {/* 'EDIT' hint fades in on hover */}
          <div style={{...S.editHint, opacity: hoveringAvatar ? 1 : 0}}>EDIT</div>
        </div>
        {/* Secondary text button below the avatar for accessibility */}
        <button style={S.editBtn}
          onClick={()=>{ blip&&blip(720); setAvatarEditorOpen(true); }}
          onMouseEnter={e=>{e.target.style.borderColor='var(--cream)';e.target.style.color='var(--cream)';}}
          onMouseLeave={e=>{e.target.style.borderColor='rgba(254,250,224,.4)';e.target.style.color='rgba(254,250,224,.7)';}}>
          EDIT AVATAR
        </button>
        <div style={S.handle}>{playerName}</div>
        <div style={S.rankLine}>{rank} · T{tier}</div>

        {/* Email + verification badge (hidden when no email is set) */}
        {account?.email && (
          <div style={S.emailRow}>
            <div style={S.emailVal}>{account.email}</div>
            <div style={S.badge(account.emailVerified)}>
              {account.emailVerified ? '✓ OK' : '! UNVERIFIED'}
            </div>
          </div>
        )}

        {/* Stats table rendered from a plain array of [label, value] pairs */}
        <div style={{display:'flex',flexDirection:'column',gap:0,marginTop:4}}>
          {[
            ['LEVEL',    level],
            ['SECTORS',  `${sectorsCleared} / 9`],
            ['CLEARS',   totalClears],
            ['WALLET',   `${wallet} BIT`],
            ['HEROES',   `${unlockedHeroes.length} / 6`],
            ['PLAYTIME', fmtPlaytime(playtimeSec)],
            ['MEMBER',   memberSince],
          ].map(([lbl, val]) => (
            <div key={lbl} style={S.statRow}>
              <span style={S.statLbl}>{lbl}</span>
              <span style={S.statVal}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: achievements grid */}
      <div style={S.right}>
        <div style={S.section}>
          <div style={S.sectionTitle}>▣ ACHIEVEMENTS</div>
          <div style={S.achvGrid}>
            {achievements.map(a => (
              <div key={a.id} style={S.achv(a.unlocked)}>
                <div style={S.achvIcon}>{a.icon}</div>
                <div style={S.achvName}>{a.name}</div>
                <div style={S.achvDesc}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Avatar editor modal — rendered in a portal-like fixed overlay */}
      {avatarEditorOpen && (
        <AvatarEditorModal
          accountId={account?.id}
          current={avatar}
          onSave={handleSaveAvatar}
          onClose={()=>{ blip&&blip(360); setAvatarEditorOpen(false); }}
          blip={blip}
        />
      )}
    </div>
  );
}

// ── SOCIAL TAB ─────────────────────────────────────────────────────────

// Shows the player's following and followers lists side by side.
// Supports unfollowing someone the player follows, and following back a
// follower who is not yet followed in return (mutual state shown as ✓ MUTUAL).
function SocialTab({ account, blip }) {
  const [following,  setFollowing]  = useStateP([]);
  const [followers,  setFollowers]  = useStateP([]);
  const [loading,    setLoading]    = useStateP(true);
  const [flash,      setFlash]      = useStateP(null); // ephemeral toast message

  // Fetch both lists in parallel when the account ID is known.
  useEffectP(() => {
    if (!account) return;
    Promise.all([
      DAW_API.getFollowing(account.id),
      DAW_API.getFollowers(account.id),
    ]).then(([fw, fb]) => {
      setFollowing(Array.isArray(fw) ? fw : []);
      setFollowers(Array.isArray(fb) ? fb : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [account?.id]);

  // Displays a temporary status message for 1.8 seconds.
  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  }

  // Calls the API to unfollow then removes the entry from local state
  // optimistically to avoid a full re-fetch.
  async function handleUnfollow(targetId, name) {
    await DAW_API.unfollow(account.id, targetId).catch(() => {});
    setFollowing(arr => arr.filter(a => a.id !== targetId));
    showFlash(`UNFOLLOWED ${name}`);
    blip && blip(360);
  }

  // Calls the API to follow, then adds the account to the local following list
  // if it isn't already present (the account object is sourced from followers).
  async function handleFollow(targetId, name) {
    await DAW_API.follow(account.id, targetId).catch(() => {});
    const isAlreadyFollowing = following.some(a => a.id === targetId);
    if (!isAlreadyFollowing) {
      const target = followers.find(a => a.id === targetId);
      if (target) setFollowing(arr => [...arr, target]);
    }
    showFlash(`FOLLOWING ${name}`);
    blip && blip(720);
  }

  // Memoised Set of account IDs the player is following; used for O(1) mutual
  // detection when rendering the followers list.
  const followingIds = useMemoP(() => new Set(following.map(a => a.id)), [following]);

  const isMobile = window.innerWidth <= 760;
  const S = {
    root: isMobile
        ? {display:'flex', flexDirection:'column', gap:12, height:'100%', minHeight:0, overflowY:'auto'}
        : {display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, height:'100%', minHeight:0, overflow:'hidden'},
    col: {display:'flex', flexDirection:'column', gap:0, minHeight:0, overflow: isMobile ? 'visible' : 'hidden'},
    panel: {background:'rgba(0,0,0,.25)', border:'2px solid rgba(254,250,224,.15)',
            display:'flex', flexDirection:'column', flex: isMobile ? '0 0 auto' : '1 1 auto', overflow: isMobile ? 'visible' : 'hidden'},
    panelHead: {padding:'8px 12px', borderBottom:'2px solid rgba(254,250,224,.15)',
                display:'flex', justifyContent:'space-between', alignItems:'center'},
    panelTitle: {fontFamily:"'Press Start 2P',monospace", fontSize:9, letterSpacing:'.18em', color:'var(--cream)'},
    count: {fontFamily:"'VT323',monospace", fontSize:18, color:'var(--hl)'},
    list: {overflowY:'auto', flex: isMobile ? '0 0 auto' : '1 1 auto', maxHeight: isMobile ? 280 : undefined},
    row: {display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
          borderBottom:'1px dashed rgba(254,250,224,.1)'},
    chip: (color) => ({
      width:28, height:28, background:color,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Press Start 2P',monospace", fontSize:8, color:'var(--cream)',
      flexShrink:0, letterSpacing:0,
    }),
    name: {fontFamily:"'VT323',monospace", fontSize:18, color:'var(--cream)', letterSpacing:'.04em', flex:'1 1 auto'},
    // danger=true → red border for UNFOLLOW; false → green for FOLLOW
    btn: (danger) => ({
      appearance:'none',
      background:'transparent',
      border:`2px solid ${danger ? 'rgba(255,100,100,.4)' : 'rgba(212,244,163,.4)'}`,
      color: danger ? 'rgba(255,100,100,.8)' : 'var(--fg-bright)',
      fontFamily:"'Press Start 2P',monospace", fontSize:7, letterSpacing:'.08em',
      padding:'3px 7px', cursor:'pointer', flexShrink:0,
    }),
    empty: {padding:24, textAlign:'center', fontFamily:"'VT323',monospace", fontSize:18,
            color:'rgba(254,250,224,.4)', letterSpacing:'.04em', lineHeight:1.5},
    hint: {padding:'8px 12px', fontFamily:"'VT323',monospace", fontSize:14,
           color:'rgba(254,250,224,.4)', letterSpacing:'.04em', borderTop:'1px dashed rgba(254,250,224,.1)'},
  };

  // Deterministically maps a username string to a muted hue so each user chip
  // has a consistent colour across sessions without requiring server data.
  function chipColor(username) {
    let h = 0;
    // Simple polynomial hash over char codes.
    for (let i = 0; i < username.length; i++) h = (h*31 + username.charCodeAt(i))|0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 38% 28%)`;
  }

  return (
    <div style={S.root}>
      {/* Following column */}
      <div style={S.col}>
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>FOLLOWING</span>
            <span style={S.count}>{following.length}</span>
          </div>
          <div style={S.list}>
            {loading && <div style={S.empty}>LOADING...</div>}
            {!loading && following.length === 0 && (
              <div style={S.empty}>
                NOT FOLLOWING ANYONE YET<br/>
                <span style={{fontSize:14}}>Find authors in Custom Maps.</span>
              </div>
            )}
            {!loading && following.map(a => (
              <div key={a.id} style={S.row}>
                <div style={S.chip(chipColor(a.username))}>
                  {a.username.slice(0,2).toUpperCase()}
                </div>
                <div style={S.name}>{a.username}</div>
                <button style={S.btn(true)}
                  onClick={()=>handleUnfollow(a.id, a.username)}>
                  UNFOLLOW
                </button>
              </div>
            ))}
          </div>
          <div style={S.hint}>Follow authors from the <b>Custom Maps</b> mod detail panel.</div>
        </div>
      </div>

      {/* Followers column */}
      <div style={S.col}>
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>FOLLOWERS</span>
            <span style={S.count}>{followers.length}</span>
          </div>
          <div style={S.list}>
            {loading && <div style={S.empty}>LOADING...</div>}
            {!loading && followers.length === 0 && (
              <div style={S.empty}>
                NO FOLLOWERS YET<br/>
                <span style={{fontSize:14}}>Share your mods to get discovered.</span>
              </div>
            )}
            {!loading && followers.map(a => {
              // Check once per row so the follow-back button/label is consistent.
              const alreadyFollowing = followingIds.has(a.id);
              return (
                <div key={a.id} style={S.row}>
                  <div style={S.chip(chipColor(a.username))}>
                    {a.username.slice(0,2).toUpperCase()}
                  </div>
                  <div style={S.name}>{a.username}</div>
                  {/* Show FOLLOW button only when not already following back */}
                  {!alreadyFollowing && (
                    <button style={S.btn(false)}
                      onClick={()=>handleFollow(a.id, a.username)}>
                      FOLLOW
                    </button>
                  )}
                  {/* Show ✓ MUTUAL label when the relationship is bidirectional */}
                  {alreadyFollowing && (
                    <span style={{fontFamily:"'VT323',monospace",fontSize:14,color:'var(--fg-bright)',letterSpacing:'.06em'}}>
                      ✓ MUTUAL
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ephemeral toast that appears at screen bottom after follow/unfollow */}
      {flash && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--jrpg-blue)', border:'2px solid var(--fg-bright)',
          fontFamily:"'VT323',monospace", fontSize:18, color:'var(--fg-bright)',
          padding:'8px 20px', letterSpacing:'.08em', zIndex:80,
        }}>{flash}</div>
      )}
    </div>
  );
}

// ── PARTY TAB ─────────────────────────────────────────────────────────

// Renders the three active party slots and the full hero roster.
// Two focus modes drive keyboard navigation:
//   'slot'   — arrow keys cycle through the three party slots
//   'roster' — arrow keys browse the roster; Enter assigns the highlighted
//              hero to the selected slot
function PartyTab({ blip, party, setParty, unlockedHeroes = ROSTER, focus, setFocus }) {
  // Fall back to the default three-hero party if the prop is missing or malformed.
  const safeParty = party && party.length === 3 ? party : ['CURSOR.EXE', 'GUARD.SYS', 'PURGE.BAT'];
  const [slotSel, setSlotSel] = useStateP(0);  // which party slot is currently selected (0–2)
  const [hover, setHover] = useStateP(safeParty[0]); // hero name highlighted in the roster

  // Memoised callback so it can be listed as a stable useEffect dependency.
  const isUnlocked = useCallbackP((name) => unlockedHeroes.includes(name), [unlockedHeroes]);

  // Global keydown handler for navigating slots and roster with arrow keys.
  // Registered with capture=true so it fires before child handlers.
  useEffectP(() => {
    function onKey(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (focus === 'slot') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          setSlotSel((s) => (s - 1 + 3) % 3); blip && blip(540); e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          setSlotSel((s) => (s + 1) % 3); blip && blip(540); e.preventDefault();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Enter in slot mode switches focus to roster so the player can pick a hero.
          setHover(safeParty[slotSel]); setFocus('roster'); blip && blip(720); e.preventDefault();
        }
      } else {
        // Roster mode: navigate the ROSTER array circularly.
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          const i = ROSTER.indexOf(hover);
          setHover(ROSTER[(i - 1 + ROSTER.length) % ROSTER.length]);
          blip && blip(540); e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          const i = ROSTER.indexOf(hover);
          setHover(ROSTER[(i + 1) % ROSTER.length]);
          blip && blip(540); e.preventDefault();
        } else if (e.key === 'Enter' || e.key === ' ') {
          // Assign the highlighted hero to the selected slot (plays error blip if locked).
          if (isUnlocked(hover)) { assignTo(slotSel, hover); setFocus('slot'); blip && blip(960); }
          else { blip && blip(220); }
          e.preventDefault();
        } else if (e.key === 'Escape') {
          // Cancel roster browsing and return to slot selection.
          setFocus('slot'); blip && blip(360); e.preventDefault();
          e.stopPropagation(); e.stopImmediatePropagation();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hover, slotSel, blip, focus, safeParty, isUnlocked, setFocus]);

  // Assigns `name` to the given party slot, swapping it with the displaced hero
  // if that hero is already in a different slot (avoids duplicates).
  function assignTo(slot, name) {
    if (!isUnlocked(name)) { blip && blip(220); return; }
    const next = [...safeParty];
    const existing = next.indexOf(name);
    // If the hero is already in another slot, put the displaced hero there instead.
    if (existing !== -1 && existing !== slot) next[existing] = next[slot];
    next[slot] = name;
    setParty(next);
  }

  return (
    <div className="pt-root">
      {/* Active party slots */}
      <div className="pt-slots">
        {[0, 1, 2].map((i) => {
          const name = safeParty[i];
          const d = HEROES_DEF[name];
          if (!d) return <div key={i} className="pt-slot" />;
          const isCurrent = i === slotSel && focus === 'slot';
          return (
            <div key={i}
              className={'pt-slot ' + (i === slotSel ? 'sel ' : '') + (isCurrent ? 'cursor' : '')}
              onClick={() => {setSlotSel(i);setFocus('slot');blip && blip(540);}}>
              <div className="pt-sl-no">SLOT 0{i + 1}{i === slotSel && focus === 'slot' ? ' ◀' : ''}</div>
              <div className="pt-sl-sprite">
                <svg width="96" height="108" viewBox="0 0 96 108" shapeRendering="crispEdges">
                  <BSprite grid={d.sprite} scale={6} x={0} y={0}
                    body={d.body} rim={d.rim} dark={d.dark} acc={d.acc} eye={d.eye} />
                </svg>
              </div>
              <div className="pt-sl-name">{name}</div>
              <div className="pt-sl-role">{d.role || ''}</div>
              {/* HP and CPU stat bars; widths are clamped to 100 % */}
              <div className="pt-sl-bars">
                <span className="lbl">HP</span>
                <div className="trk"><div className="fl hp" style={{ width: Math.min(100, d.hpMax / 4.5) + '%' }} /></div>
                <span className="val">{d.hpMax}</span>
                <span className="lbl">CPU</span>
                <div className="trk"><div className="fl cpu" style={{ width: Math.min(100, d.cpuMax) + '%' }} /></div>
                <span className="val">{d.cpuMax}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full roster grid + detail panel */}
      <div className={'pt-roster-wrap ' + (focus === 'roster' ? 'focus' : '')}>
        <div className="pf-legend">
          ▣ ROSTER {focus === 'roster' ? `→ SLOT 0${slotSel + 1}` : '· LOCKED'}
        </div>
        <div className="pt-roster">
          {ROSTER.map((name) => {
            const d = HEROES_DEF[name];
            const equipped = safeParty.includes(name);
            const active = name === hover && focus === 'roster';
            const unlocked = isUnlocked(name);
            return (
              <div key={name}
                className={'pt-card ' + (equipped ? 'equipped ' : '') + (active ? 'active ' : '') + (unlocked ? '' : 'locked')}
                onMouseEnter={() => {if (focus === 'roster') {setHover(name);blip && blip(540);}}}
                onClick={() => { setHover(name); if (focus !== 'roster') setFocus('roster'); }}
                // Double-click assigns without needing to press Enter.
                onDoubleClick={() => {if (unlocked) {assignTo(slotSel, name);setFocus('slot');blip && blip(960);}}}>
                <div className={'pt-card-tag ' + (equipped ? 'tag-equipped' : '') + (!unlocked ? ' tag-locked' : '')}>
                  {!unlocked ? '✕ LOCKED' : equipped ? '▣ EQUIPPED' : '> ROSTER'}
                </div>
                <div className="pt-card-spr">
                  <svg width="84" height="78" viewBox="0 0 84 78" shapeRendering="crispEdges">
                    <BSprite grid={d.sprite} scale={5} x={0} y={0}
                      body={d.body} rim={d.rim} dark={d.dark} acc={d.acc} eye={d.eye} />
                  </svg>
                  {!unlocked && <div className="pt-card-lock-veil">🔒</div>}
                </div>
                {/* Hide hero name/role when locked to preserve the mystery */}
                <div className="pt-card-name">{unlocked ? name : '???'}</div>
                <div className="pt-card-role">
                  {unlocked ? d.role || '' : HERO_UNLOCK_HINT[name] || 'LOCKED'}
                </div>
              </div>
            );
          })}
        </div>
        {/* Detail panel tracks either the hovered roster card or the selected slot */}
        <PartyDetail name={focus === 'roster' ? hover : safeParty[slotSel]}
          equipped={safeParty.includes(focus === 'roster' ? hover : safeParty[slotSel])}
          unlocked={isUnlocked(focus === 'roster' ? hover : safeParty[slotSel])}
          slotSel={slotSel} focus={focus}
          onAssign={() => {assignTo(slotSel, hover);setFocus('slot');blip && blip(960);}} />
      </div>
    </div>
  );
}

// Renders the hero detail panel shown to the right of the roster in PartyTab.
// Displays sprite, bio, limit break, and a context-sensitive ASSIGN button.
function PartyDetail({ name, equipped, unlocked = true, slotSel, focus = 'roster', onAssign }) {
  const d = HEROES_DEF[name];
  if (!d) return null;
  // The button is only active when the player is in roster focus, the hero isn't
  // already equipped, and the hero is unlocked.
  const canAssign = focus === 'roster' && !equipped && unlocked;
  return (
    <div className="pt-detail">
      <div className="pt-detail-head">
        <div className="pt-detail-spr">
          <svg width="84" height="108" viewBox="0 0 84 108" shapeRendering="crispEdges">
            <BSprite grid={d.sprite} scale={5} x={0} y={0}
              body={d.body} rim={d.rim} dark={d.dark} acc={d.acc} eye={d.eye} />
          </svg>
        </div>
        <div className="pt-detail-meta">
          <div className="pt-detail-name">{unlocked ? name : '??? · LOCKED'}</div>
          <div className="pt-detail-role">{unlocked ? d.role || '—' : HERO_UNLOCK_HINT[name] || 'LOCKED'}</div>
          <div className="pt-detail-bio">{unlocked ? d.bio || '—' : 'This hero has not been unlocked yet.'}</div>
          <div className="pt-detail-limit">
            LIMIT &nbsp; <b>{unlocked ? d.limitName : '???'}</b>
            <div style={{ fontFamily:"'VT323',monospace", fontSize:14, color:'rgba(254,250,224,.7)', marginTop:4 }}>
              {unlocked ? d.limitDesc : 'Limit break details available after unlock.'}
            </div>
          </div>
        </div>
      </div>
      <div className="pt-detail-actions">
        {/* Button label changes based on focus state and whether the hero is assignable */}
        <button className={'pt-act ' + (canAssign ? 'primary' : '')}
          disabled={!canAssign} onClick={onAssign}>
          {!unlocked ? '🔒 ' + (HERO_UNLOCK_HINT[name] || 'LOCKED') :
          focus === 'slot' ? `▣ CURRENTLY IN SLOT 0${slotSel + 1}` :
          equipped ? '▣ ALREADY EQUIPPED' :
          `ASSIGN → SLOT 0${slotSel + 1}`}
        </button>
      </div>
    </div>
  );
}

// ── BESTIARY TAB ─────────────────────────────────────────────────────

// Renders an enemy encyclopedia.  Each entry is discovered the first time the
// player encounters that enemy in a cleared node, derived from the clears list
// and the global WORLDS map definition.
function BestiaryTab({ blip, clears = [] }) {
  const [enemies, setEnemies] = useStateP([]);
  const [sel, setSel]         = useStateP('');    // currently selected enemy id
  const [loading, setLoading] = useStateP(true);
  const [mobileStage, setMobileStage] = useStateP('list'); // 'list' | 'detail' — mobile only
  const isMobile = window.innerWidth <= 760;

  // Fetch enemy metadata from the API once on mount.
  useEffectP(() => {
    DAW_API.getEnemies()
      .then(data => { setEnemies(data); if (data.length) setSel(data[0].id); })
      .finally(() => setLoading(false));
  }, []);

  // Compute the set of discovered enemy IDs by cross-referencing cleared node
  // encounter data from window.WORLDS.
  const discovered = useMemoP(() => {
    const s = new Set();
    const worlds = window.WORLDS || [];
    const clearSet = new Set(clears);
    worlds.forEach(w => {
      w.nodes.forEach(n => {
        // Only nodes that have been cleared (not just started) reveal their enemies.
        if (n.encounter && clearSet.has(`${w.id}:${n.id}`)) {
          n.encounter.enemies.forEach(e => s.add(e));
        }
      });
    });
    return s;
  }, [clears]);

  // Arrow-key navigation through the enemy list.
  useEffectP(() => {
    function onKey(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const idx = enemies.findIndex(b => b.id === sel);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const n = enemies[(idx - 1 + enemies.length) % enemies.length];
        if (n) { setSel(n.id); blip && blip(540); }
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const n = enemies[(idx + 1) % enemies.length];
        if (n) { setSel(n.id); blip && blip(540); }
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, blip, enemies]);

  if (loading) return <div className="bs-empty" style={{padding:40}}>LOADING BESTIARY...</div>;

  const cur = enemies.find(b => b.id === sel);
  const k   = cur ? ENEMY_KINDS[cur.id] : null; // sprite/colour data from the global ENEMY_KINDS map
  const isDiscovered = cur ? discovered.has(cur.id) : false;
  const isBoss = cur?.class === 'ROOT-LEVEL';

  // ── Mobile: entity list ──
  if(isMobile && mobileStage === 'list'){
    return (
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
        <div className="bs-list-wrap" style={{flex:1, minHeight:0, overflowY:'auto'}}>
          <div className="pf-legend" style={{ left:18 }}>▣ BESTIARY</div>
          <div className="bs-list">
            {enemies.map(b => {
              const kk   = ENEMY_KINDS[b.id];
              const disc = discovered.has(b.id);
              return (
                <div key={b.id}
                  className={'bs-card ' + (sel === b.id ? 'sel ' : '') + (disc ? '' : 'unknown')}
                  onClick={() => { setSel(b.id); blip && blip(540); setMobileStage('detail'); }}
                  onMouseEnter={() => { if (disc) blip && blip(540); }}>
                  <div className="bs-card-spr">
                    {disc && kk
                      ? <svg width="120" height="92" viewBox="0 0 120 92" shapeRendering="crispEdges">
                          <BSprite grid={kk.grid} scale={3}
                            x={Math.max(0, Math.round((120 - kk.grid[0].length * 3) / 2))}
                            y={Math.max(0, Math.round(( 92 - kk.grid.length    * 3) / 2))}
                            body={kk.body} rim={kk.rim} dark={kk.dark} acc={kk.acc} eye={kk.eye} />
                        </svg>
                      : <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:32, color:'rgba(254,250,224,.35)' }}>?</span>
                    }
                  </div>
                  <div className="bs-card-name">{disc ? b.id : 'UNKNOWN'}</div>
                  <div className="bs-card-meta">
                    <span>NO.{b.displayNo}</span>
                    <span>{disc ? b.class : '---'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile: detail view ──
  if(isMobile && mobileStage === 'detail'){
    return (
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
          borderBottom:'2px solid var(--bg-2)', flexShrink:0, background:'rgba(0,0,0,.2)',
        }}>
          <button className="daw-back-btn" onClick={()=>{ setMobileStage('list'); blip&&blip(360); }}>← LIST</button>
          {cur && (
            <span style={{fontFamily:"'VT323',monospace", fontSize:16, color:'var(--fg-bright)',
              letterSpacing:'.04em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:'1 1 auto'}}>
              {isDiscovered ? cur.id : 'UNKNOWN'}
            </span>
          )}
        </div>
        <div style={{flex:1, overflowY:'auto', padding:14}}>
          <div className="bs-detail-wrap" style={{height:'auto', minHeight:'auto', overflow:'visible'}}>
            <div className="pf-legend" style={{ left:18 }}>▣ DETAIL</div>
            {cur && isDiscovered && k
              ? <div className="bs-detail" style={{overflow:'visible', minHeight:'auto'}}>
                  <div className="bs-detail-head">
                    <div className={'bs-detail-spr ' + (isBoss ? 'boss' : '')}>
                      {(()=>{ const sc=isBoss?3:4;
                        const cx=Math.max(0,Math.round((120-k.grid[0].length*sc)/2));
                        const cy=Math.max(0,Math.round((120-k.grid.length   *sc)/2));
                        return (
                          <svg width="120" height="120" viewBox="0 0 120 120" shapeRendering="crispEdges">
                            <BSprite grid={k.grid} scale={sc} x={cx} y={cy}
                              body={k.body} rim={k.rim} dark={k.dark} acc={k.acc} eye={k.eye} />
                          </svg>
                        );
                      })()}
                    </div>
                    <div className="bs-detail-info">
                      <div className="bs-detail-no">NO. {cur.displayNo}</div>
                      <div className="bs-detail-name">{cur.id}</div>
                      <div className="bs-detail-class">{cur.class}</div>
                      <div className="bs-meta" style={{ marginTop: 8 }}>
                        {isBoss && <span className="bs-tag boss">BOSS</span>}
                        <span className="bs-tag where">{cur.whereFound}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bs-stats">
                    <div className="bs-stat"><span>INTEGRITY</span><b>{cur.hp}</b></div>
                    <div className="bs-stat"><span>DMG</span><b>{cur.dmgMin}–{cur.dmgMax}</b></div>
                    <div className="bs-stat"><span>ATB SPD</span><b>{Number(cur.spd).toFixed(2)}</b></div>
                    <div className="bs-stat"><span>XP DROP</span><b>{cur.xp}</b></div>
                  </div>
                  <div className="bs-desc">{cur.description}</div>
                </div>
              : <div className="bs-empty">
                  [ENTRY LOCKED]<br /><br />
                  Encounter this process in the wild to unlock its bestiary entry.
                </div>
            }
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: original two-panel layout ──
  return (
    <div className="bs-root">
      {/* Scrollable list of enemy cards on the left */}
      <div className="bs-list-wrap">
        <div className="pf-legend" style={{ left: 18 }}>▣ BESTIARY</div>
        <div className="bs-list">
          {enemies.map(b => {
            const kk   = ENEMY_KINDS[b.id];
            const disc = discovered.has(b.id);
            return (
              <div key={b.id}
                className={'bs-card ' + (sel === b.id ? 'sel ' : '') + (disc ? '' : 'unknown')}
                onClick={() => { setSel(b.id); blip && blip(540); }}
                onMouseEnter={() => { if (disc) blip && blip(540); }}>
                <div className="bs-card-spr">
                  {disc && kk
                    ? <svg width="120" height="92" viewBox="0 0 120 92" shapeRendering="crispEdges">
                        {/* Centre the sprite within the fixed 120×92 card area */}
                        <BSprite grid={kk.grid} scale={3}
                          x={Math.max(0, Math.round((120 - kk.grid[0].length * 3) / 2))}
                          y={Math.max(0, Math.round(( 92 - kk.grid.length    * 3) / 2))}
                          body={kk.body} rim={kk.rim} dark={kk.dark} acc={kk.acc} eye={kk.eye} />
                      </svg>
                    : <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:32, color:'rgba(254,250,224,.35)' }}>?</span>
                  }
                </div>
                <div className="bs-card-name">{disc ? b.id : 'UNKNOWN'}</div>
                <div className="bs-card-meta">
                  <span>NO.{b.displayNo}</span>
                  <span>{disc ? b.class : '---'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel on the right — shows full stats when discovered */}
      <div className="bs-detail-wrap">
        <div className="pf-legend" style={{ left: 18 }}>▣ DETAIL</div>
        {cur && isDiscovered && k
          ? <div className="bs-detail">
              <div className="bs-detail-head">
                <div className={'bs-detail-spr ' + (isBoss ? 'boss' : '')}>
                  {/* IIFE calculates scale/offset so bosses render slightly smaller */}
                  {(()=>{ const sc=isBoss?3:4;
                    const cx=Math.max(0,Math.round((120-k.grid[0].length*sc)/2));
                    const cy=Math.max(0,Math.round((120-k.grid.length   *sc)/2));
                    return (
                      <svg width="120" height="120" viewBox="0 0 120 120" shapeRendering="crispEdges">
                        <BSprite grid={k.grid} scale={sc} x={cx} y={cy}
                          body={k.body} rim={k.rim} dark={k.dark} acc={k.acc} eye={k.eye} />
                      </svg>
                    );
                  })()}
                </div>
                <div className="bs-detail-info">
                  <div className="bs-detail-no">NO. {cur.displayNo}</div>
                  <div className="bs-detail-name">{cur.id}</div>
                  <div className="bs-detail-class">{cur.class}</div>
                  <div className="bs-meta" style={{ marginTop: 8 }}>
                    {isBoss && <span className="bs-tag boss">BOSS</span>}
                    <span className="bs-tag where">{cur.whereFound}</span>
                  </div>
                </div>
              </div>
              <div className="bs-stats">
                <div className="bs-stat"><span>INTEGRITY</span><b>{cur.hp}</b></div>
                <div className="bs-stat"><span>DMG</span><b>{cur.dmgMin}–{cur.dmgMax}</b></div>
                <div className="bs-stat"><span>ATB SPD</span><b>{Number(cur.spd).toFixed(2)}</b></div>
                <div className="bs-stat"><span>XP DROP</span><b>{cur.xp}</b></div>
              </div>
              <div className="bs-desc">{cur.description}</div>
            </div>
          : <div className="bs-empty">
              [ENTRY LOCKED]<br /><br />
              Encounter this process in the wild to unlock its bestiary entry.
            </div>
        }
      </div>
    </div>
  );
}

// ── Data constants (roster + hero unlock hints) ───────────────────────
// Ordered list of all hero names; determines display order in PartyTab.
const ROSTER = ['CURSOR.EXE', 'GUARD.SYS', 'PURGE.BAT', 'PING.DLL', 'ROOT.SH', 'INDEX.LOG'];
// Maps locked hero names to the unlock condition shown in place of their role text.
const HERO_UNLOCK_HINT = {
  'PING.DLL':  'BUY @ REGISTRY MARKET',
  'ROOT.SH':   'CLEAR THE MINI-BOSS',
  'INDEX.LOG': 'CLEAR THE FINAL BOSS',
};

// ── PROFILE PAGE ───────────────────────────────────────────────────────

// Top-level page component that wraps all profile tabs (Profile, Party,
// Bestiary, Social) in a shared shell with a top bar, tab switcher, and
// keyboard shortcut hints in the footer.
function ProfilePage({
  blip, playerName = 'USER', initialTab = 'profile',
  party, setParty, unlockedHeroes = ROSTER, clears = [],
  wallet = 0, playtimeSec = 0, account,
  onExit,
}) {
  const [tab, setTab] = useStateP(initialTab);
  // partyFocus is lifted to this level so the page can reset it to 'slot'
  // whenever the player switches tabs.
  const [partyFocus, setPartyFocus] = useStateP('slot');
  const isMobile = window.innerWidth <= 760;
  // Sync the active tab with the parent when initialTab changes externally.
  useEffectP(() => { setTab(initialTab); }, [initialTab]);

  // Number keys 1-4 switch tabs; Escape exits the profile screen entirely.
  useEffectP(() => {
    function onKey(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === '1') { setTab('profile');  setPartyFocus('slot'); blip && blip(540); } else
      if (e.key === '2') { setTab('party');    setPartyFocus('slot'); blip && blip(540); } else
      if (e.key === '3') { setTab('bestiary'); setPartyFocus('slot'); blip && blip(540); } else
      if (e.key === '4') { setTab('social');   setPartyFocus('slot'); blip && blip(540); } else
      if (e.key === 'Escape') { onExit && onExit(); e.preventDefault(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blip, onExit]);

  // ':start' and any entry containing 'start' are not counted as completed sectors.
  const sectorsCleared = clears.filter(c => !c.endsWith(':start') && !c.includes('start')).length;
  const level = computeLevel(clears);

  return (
    <div className="daw-shell">
      {/* Top bar: back button, breadcrumb path, and quick HUD stats */}
      <div className="pf-topbar">
        <button className="daw-back-btn"
          onClick={() => { blip && blip(360); onExit && onExit(); }}
          title="back (ESC)">← BACK</button>
        <span className="pf-bc">/USERS/{playerName}/profile</span>
        <div className="pf-hud">
          <span><b>HANDLE</b> {playerName}</span>
          <span><b>LV</b> {level}</span>
          <span><b>CLEARED</b> {sectorsCleared}</span>
          <span><b>$</b> {wallet} BIT</span>
        </div>
      </div>

      {/* Tab bar — each button shows its keyboard shortcut in brackets */}
      <div className="pf-tabs">
        {[['profile','PROFILE','1'],['party','PARTY / HEROES','2'],['bestiary','BESTIARY','3'],['social','SOCIAL','4']].map(([id,label,key])=>(
          <button key={id} className={'pf-tab ' + (tab === id ? 'active' : '')}
            onClick={() => {setTab(id);setPartyFocus('slot');blip && blip(720);}}>
            <span className="pf-tab-key">[{key}]</span>{label}
          </button>
        ))}
      </div>

      {/* Main content area — only the active tab is mounted */}
      <div className="pf-stage">
        {tab === 'profile' && (
          <ProfileTab
            account={account}
            playerName={playerName}
            sectorsCleared={sectorsCleared}
            wallet={wallet}
            playtimeSec={playtimeSec}
            clears={clears}
            unlockedHeroes={unlockedHeroes}
            blip={blip}
          />
        )}
        {tab === 'party' && (
          <PartyTab blip={blip} party={party} setParty={setParty}
            unlockedHeroes={unlockedHeroes} focus={partyFocus} setFocus={setPartyFocus} />
        )}
        {tab === 'bestiary' && <BestiaryTab blip={blip} clears={clears} />}
        {tab === 'social' && <SocialTab account={account} blip={blip} />}
      </div>

      {/* Footer: context-sensitive key hints — hidden on mobile */}
      {!isMobile && (
        <div className="pf-foot">
          <div>
            <b>1</b>/<b>2</b>/<b>3</b>/<b>4</b> SWITCH TAB &middot;
            {tab === 'party' && partyFocus === 'slot' && <> <b>←→</b> PICK SLOT &middot; <b>⏎</b> CHANGE HERO &middot;</>}
            {tab === 'party' && partyFocus === 'roster' && <> <b>↑↓←→</b> BROWSE &middot; <b>⏎</b> ASSIGN &middot; <b>ESC</b> CANCEL &middot;</>}
            {tab === 'bestiary' && <> <b>↑↓</b> SELECT &middot;</>}
            {' '}<b>ESC</b> BACK
          </div>
          <div>v1.05 &middot; profile.sync OK</div>
        </div>
      )}
    </div>
  );
}

// Expose the three entry-point components on window so other scripts loaded
// after this file can reference them without a module bundler.
Object.assign(window, { ProfilePage, AvatarDisplay, AvatarEditorModal });
