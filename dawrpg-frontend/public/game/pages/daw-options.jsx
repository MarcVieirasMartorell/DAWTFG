// daw-options.jsx — Full-screen OPTIONS page for DAW RPG.
//
// Responsibilities:
//   - Defines all theme data (DAW_BASE_THEME and DAW_WORLD_THEMES) and exposes
//     applyTheme / applyWorldTheme helpers that write CSS custom properties onto
//     the document root so every component picks up the palette automatically.
//   - Provides loadDawSettings / saveDawSettings for persisting user preferences
//     (mode, CRT effect, volume, music toggle) to localStorage.
//   - Renders the tabbed OptionsPage component with four sub-sections:
//     DISPLAY, AUDIO, GAMEPLAY, and ABOUT.

const { useState: useStateO, useEffect: useEffectO, useCallback: useCallbackO } = React;

// ── Base theme (menus, UI, everything outside map / battle) ─────────────
// Mostly black-and-white so the coloured world themes feel earned.
const DAW_BASE_THEME = {
  dark: {
    '--bg-0':'#080808','--bg-1':'#111111','--bg-2':'#1c1c1c',
    '--fg-dim':'#4a4a4a','--fg':'#999999','--fg-bright':'#e8e8e8',
    '--hl':'#cccccc','--cream':'#f0f0f0',
    '--jrpg-blue':'#1a1a1a','--jrpg-blue-hi':'#2e2e2e',
  },
  light: {
    '--bg-0':'#f0ece4',  // warm off-white paper
    '--bg-1':'#e4dfd5',
    '--bg-2':'#cec8bc',
    '--fg-dim':'#6e6358',
    '--fg':'#2e2416',
    '--fg-bright':'#100c06',  // near-black warm
    '--hl':'#7a3a10',         // dark amber accent
    '--cream':'#120e08',      // near-black (inverted role in light)
    '--jrpg-blue':'#dcd8d0',  // warm light gray for cards
    '--jrpg-blue-hi':'#c8c4ba',
  },
};

// ── Per-world themes (map + battle only) ─────────────────────────────────
// Two variants for each world: dark (default) and light.
const DAW_WORLD_THEMES = {
  w1: {
    dark: {
      '--bg-0':'#06150c','--bg-1':'#0d2818','--bg-2':'#143a25',
      '--fg-dim':'#5a8a3a','--fg':'#a5b985','--fg-bright':'#d4f4a3',
      '--hl':'#d4a373','--cream':'#fefae0',
      '--jrpg-blue':'#101a6e','--jrpg-blue-hi':'#3d4ad8',
    },
    light: {
      '--bg-0':'#e8f4e0','--bg-1':'#d4e8b8','--bg-2':'#bad490',
      '--fg-dim':'#3a6018','--fg':'#182e08','--fg-bright':'#0a1802',
      '--hl':'#7a3a10','--cream':'#0c1604',
      '--jrpg-blue':'#d0e8b8','--jrpg-blue-hi':'#3d4ad8',
    },
  },
  w2: {
    dark: {
      '--bg-0':'#03081a','--bg-1':'#0a1a30','--bg-2':'#13294a',
      '--fg-dim':'#3d6aa3','--fg':'#9bc4ff','--fg-bright':'#e6f1ff',
      '--hl':'#ff6ec7','--cream':'#f4faff',
      '--jrpg-blue':'#0a2670','--jrpg-blue-hi':'#3060d4',
    },
    light: {
      '--bg-0':'#ddeef8','--bg-1':'#c4ddf0','--bg-2':'#a0c4e4',
      '--fg-dim':'#1e4878','--fg':'#081a3c','--fg-bright':'#020a1c',
      '--hl':'#8a2060','--cream':'#040c1c',
      '--jrpg-blue':'#bcd6ee','--jrpg-blue-hi':'#3060d4',
    },
  },
  w3: {
    dark: {
      '--bg-0':'#180a00','--bg-1':'#2a1300','--bg-2':'#3d1d00',
      '--fg-dim':'#a36418','--fg':'#e9b65c','--fg-bright':'#ffd98a',
      '--hl':'#ff8a3a','--cream':'#fff1cf',
      '--jrpg-blue':'#3a1a00','--jrpg-blue-hi':'#7a3a00',
    },
    light: {
      '--bg-0':'#f0e4cc','--bg-1':'#e4d0a8','--bg-2':'#d0b880',
      '--fg-dim':'#5a3008','--fg':'#2a1404','--fg-bright':'#140800',
      '--hl':'#b02a0c','--cream':'#100800',
      '--jrpg-blue':'#dcc8a0','--jrpg-blue-hi':'#7a3a00',
    },
  },
};

// Routes that use the world-coloured theme; everything else gets the base theme.
const WORLD_THEME_ROUTES = new Set(['map', 'battle']);

// Applies only the world-specific palette for the given worldId and mode variant.
// Used when the route is already known to be a world route and the caller wants
// to skip the route-check branch in applyTheme.
function applyWorldTheme(worldId, mode){
  const t = (DAW_WORLD_THEMES[worldId] || DAW_WORLD_THEMES.w1)[mode === 'light' ? 'light' : 'dark'];
  const root = document.documentElement;
  Object.entries(t).forEach(([k,v])=>root.style.setProperty(k,v));
}

// Main entry-point: call this whenever worldId, mode, OR route changes.
// Selects either the world palette (for map/battle) or the base UI palette,
// then writes every CSS variable onto the document root in one pass.
function applyTheme(worldId, mode, route){
  const themes = WORLD_THEME_ROUTES.has(route)
    ? (DAW_WORLD_THEMES[worldId] || DAW_WORLD_THEMES.w1)
    : DAW_BASE_THEME;
  const t = themes[mode === 'light' ? 'light' : 'dark'];
  const root = document.documentElement;
  Object.entries(t).forEach(([k,v])=>root.style.setProperty(k,v));
}

// ── Settings storage (device-level, not per-account) ────────────────────
const DAW_SETTINGS_KEY = 'daw.settings.v1';

// Defaults written to localStorage on first run; merged with any saved values.
const DAW_DEFAULT_SETTINGS = {
  mode:    'dark',        // 'dark' | 'light'
  crt:     'scanlines',   // 'scanlines' | 'curve' | 'off'
  volume:  60,            // 0..100
  music:   false,         // chiptune loop on/off
};

// Reads and merges saved settings from localStorage, returning defaults on parse error.
function loadDawSettings(){
  try {
    const raw = JSON.parse(localStorage.getItem(DAW_SETTINGS_KEY) || '{}') || {};
    return { ...DAW_DEFAULT_SETTINGS, ...raw };
  } catch(e){ return { ...DAW_DEFAULT_SETTINGS }; }
}

// Persists the current settings object to localStorage; silently ignores quota errors.
function saveDawSettings(s){
  try { localStorage.setItem(DAW_SETTINGS_KEY, JSON.stringify(s)); } catch(e){}
}

// Expose theme helpers and settings utilities globally so other scripts can call them.
Object.assign(window, {
  DAW_BASE_THEME, DAW_WORLD_THEMES, WORLD_THEME_ROUTES,
  applyWorldTheme, applyTheme,
  DAW_DEFAULT_SETTINGS, loadDawSettings, saveDawSettings,
});

// ── OptionsPage component ───────────────────────────────────────────────
// Top-level options screen with four tabs (DISPLAY / AUDIO / GAMEPLAY / ABOUT).
// Handles keyboard navigation (1-4 tab switch, ESC back, +/- volume nudge)
// and delegates rendering of each tab to the sub-components below.
function OptionsPage({ blip, settings, onChange, audio, onExit, currentWorldId='w1' }){
  const [sectionSel, setSectionSel] = useStateO(0);
  const sections = ['DISPLAY','AUDIO','GAMEPLAY','ABOUT'];

  // Keyboard nav: 1-4 tab, ESC exit, arrow keys for control nudges per section
  useEffectO(()=>{
    function onKey(e){
      // Ignore keypresses that originate inside text input elements.
      if(e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if(e.key === 'Escape'){ onExit && onExit(); e.preventDefault(); return; }
      if(e.key === '1'){ setSectionSel(0); blip && blip(540); return; }
      if(e.key === '2'){ setSectionSel(1); blip && blip(540); return; }
      if(e.key === '3'){ setSectionSel(2); blip && blip(540); return; }
      if(e.key === '4'){ setSectionSel(3); blip && blip(540); return; }
      // Volume shortcut (always live regardless of tab)
      if(e.key === '+' || e.key === '='){
        onChange('volume', Math.min(100, settings.volume + 5)); blip && blip(720);
        e.preventDefault(); return;
      }
      if(e.key === '-' || e.key === '_'){
        onChange('volume', Math.max(0, settings.volume - 5)); blip && blip(540);
        e.preventDefault(); return;
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [blip, onExit, settings, onChange]);

  return (
    <div className="daw-shell">
      <div className="pf-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onExit && onExit(); }}
          title="back to menu (ESC)">← BACK</button>
        <span className="pf-bc">/SYSTEM/OPTIONS</span>
        <div className="pf-hud">
          <span><b>BUILD</b> v0.9</span>
          <span><b>MODE</b> {settings.mode.toUpperCase()}</span>
          <span><b>VOL</b> {settings.volume}</span>
        </div>
      </div>

      <div className="pf-tabs">
        {sections.map((s,i)=>(
          <button key={s}
            className={'pf-tab '+(sectionSel===i?'active':'')}
            onClick={()=>{ setSectionSel(i); blip && blip(720); }}>
            <span className="pf-tab-key">[{i+1}]</span>{s}
          </button>
        ))}
      </div>

      <div className="pf-stage">
        {sectionSel === 0 && (
          <OptionsDisplay blip={blip} settings={settings} onChange={onChange}/>
        )}
        {sectionSel === 1 && (
          <OptionsAudio blip={blip} settings={settings} onChange={onChange} audio={audio}/>
        )}
        {sectionSel === 2 && (
          <OptionsGameplay blip={blip} currentWorldId={currentWorldId}/>
        )}
        {sectionSel === 3 && (
          <OptionsAbout/>
        )}
      </div>

      <div className="pf-foot">
        <div>
          <b>1</b>/<b>2</b>/<b>3</b>/<b>4</b> SWITCH TAB &middot;
          {' '}<b>+</b>/<b>−</b> VOLUME &middot; <b>ESC</b> BACK
        </div>
        <div>options persist on this device</div>
      </div>
    </div>
  );
}

// ── DISPLAY tab ──────────────────────────────────────────────────────────
// Renders two cards: a dark/light mode toggle + CRT effect picker, and a
// read-only swatch preview of every world's palette in the current mode.
function OptionsDisplay({ blip, settings, onChange }){
  return (
    <div className="opt-grid one-col">
      <div className="opt-card">
        <div className="pf-legend">▣ MODE</div>
        <div className="opt-section-title">COLOR SCHEME</div>
        <div className="opt-section-desc">
          The world map and battles each carry their own palette identity.
          This toggle controls whether those palettes render in their dark
          or light variant.
        </div>
        <div className="opt-row">
          <button className={'opt-pill '+(settings.mode==='dark'?'sel':'')}
            onClick={()=>{ onChange('mode','dark'); blip && blip(720); }}>
            <span className="sw" style={{background:'#06150c',borderColor:'#a5b985'}}/>
            DARK
          </button>
          <button className={'opt-pill '+(settings.mode==='light'?'sel':'')}
            onClick={()=>{ onChange('mode','light'); blip && blip(720); }}>
            <span className="sw" style={{background:'#eef4e2',borderColor:'#365920'}}/>
            LIGHT
          </button>
        </div>

        <div className="opt-section-title" style={{marginTop:24}}>CRT EFFECT</div>
        <div className="opt-section-desc">
          The vintage display treatment over the whole game.
        </div>
        <div className="opt-row">
          <button className={'opt-pill '+(settings.crt==='scanlines'?'sel':'')}
            onClick={()=>{ onChange('crt','scanlines'); blip && blip(720); }}>SCANLINES</button>
          <button className={'opt-pill '+(settings.crt==='curve'?'sel':'')}
            onClick={()=>{ onChange('crt','curve'); blip && blip(720); }}>CURVED</button>
          <button className={'opt-pill '+(settings.crt==='off'?'sel':'')}
            onClick={()=>{ onChange('crt','off'); blip && blip(720); }}>OFF</button>
        </div>
      </div>
    </div>
  );
}

// ── AUDIO tab ────────────────────────────────────────────────────────────
// Renders master volume (slider + mute toggle), music on/off toggle,
// and three test buttons for auditioning the blip sound at different pitches.
function OptionsAudio({ blip, settings, onChange, audio }){
  return (
    <div className="opt-grid one-col">
      <div className="opt-card">
        <div className="pf-legend">▣ AUDIO</div>
        <div className="opt-section-title">MASTER VOLUME</div>
        <div className="opt-section-desc">
          Controls blips, the chiptune loop, and battle SFX. Use + / − to
          nudge, or drag the slider.
        </div>
        <div className="opt-slider-row">
          <span className="opt-slider-val">{settings.volume}</span>
          <div className="opt-slider-track">
            {/* Filled bar visually mirrors the range input's current value */}
            <div className="opt-slider-fill" style={{width: settings.volume+'%'}}/>
            <input type="range" min="0" max="100" step="1"
              value={settings.volume}
              onChange={(e)=>{ onChange('volume', parseInt(e.target.value,10)); }}
              className="opt-slider-input"/>
          </div>
          {/* MUTE toggles between 0 and 60 so unmuting restores a sensible level */}
          <button className="opt-mute"
            onClick={()=>{ onChange('volume', settings.volume>0?0:60); blip && blip(540); }}>
            {settings.volume === 0 ? 'UNMUTE' : 'MUTE'}
          </button>
        </div>

        <div className="opt-section-title" style={{marginTop:28}}>CHIPTUNE LOOP</div>
        <div className="opt-section-desc">
          Background music for the title and map screens.
        </div>
        <div className="opt-row">
          <button className={'opt-pill '+(settings.music?'sel':'')}
            onClick={()=>{ onChange('music', true); blip && blip(720); }}>♪ ON</button>
          <button className={'opt-pill '+(!settings.music?'sel':'')}
            onClick={()=>{ onChange('music', false); blip && blip(540); }}>♪ OFF</button>
        </div>

        <div className="opt-section-title" style={{marginTop:28}}>TEST</div>
        {/* Let the user audition three different blip frequencies live */}
        <div className="opt-row">
          <button className="opt-pill" onClick={()=>blip && blip(540)}>BLIP A</button>
          <button className="opt-pill" onClick={()=>blip && blip(720)}>BLIP B</button>
          <button className="opt-pill" onClick={()=>blip && blip(960)}>BLIP C</button>
        </div>
      </div>
    </div>
  );
}

// ── GAMEPLAY tab ─────────────────────────────────────────────────────────
// Displays the active world region and a static keybindings reference grid.
// No interactive controls — keybindings are fixed and not remappable here.
function OptionsGameplay({ blip, currentWorldId }){
  return (
    <div className="opt-grid one-col">
      <div className="opt-card">
        <div className="pf-legend">▣ GAMEPLAY</div>
        <div className="opt-section-title">CURRENT REGION</div>
        <div className="opt-section-desc">
          Active world theme: <b style={{color:'var(--fg-bright)'}}>{currentWorldId.toUpperCase()}</b>.
          Switch worlds from the map's world bar (TAB).
        </div>

        <div className="opt-section-title" style={{marginTop:28}}>CONTROLS</div>
        {/* Two-column key → action grid listing every global hotkey */}
        <div className="opt-controls-grid">
          <div className="opt-kv"><span className="k">↑↓←→</span><span className="v">navigate / travel</span></div>
          <div className="opt-kv"><span className="k">ENTER / SPACE</span><span className="v">confirm / engage</span></div>
          <div className="opt-kv"><span className="k">ESC</span><span className="v">back / cancel</span></div>
          <div className="opt-kv"><span className="k">TAB</span><span className="v">cycle worlds (on map)</span></div>
          <div className="opt-kv"><span className="k">1 / 2 / 3</span><span className="v">switch tabs (shop / profile)</span></div>
          <div className="opt-kv"><span className="k">+ / −</span><span className="v">adjust volume (here)</span></div>
        </div>
      </div>
    </div>
  );
}

// ── ABOUT tab ────────────────────────────────────────────────────────────
// Static credit screen: game title, tagline, elevator-pitch blurb, and build metadata.
function OptionsAbout(){
  return (
    <div className="opt-grid one-col">
      <div className="opt-card">
        <div className="pf-legend">▣ ABOUT</div>
        {/* Large pixel-font title with a green glow text-shadow */}
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:28,
          color:'var(--fg-bright)', letterSpacing:'.08em',
          textShadow:'0 4px 0 var(--bg-2), 0 0 18px rgba(212,244,163,.4)',
          margin:'10px 0 20px'
        }}>
          D A W
        </div>
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:10,
          color:'var(--hl)', letterSpacing:'.28em', marginBottom:24
        }}>
          DEFENDING · A · WORKSTATION
        </div>
        <div className="opt-section-desc" style={{maxWidth:560}}>
          A retro RPG built on the metaphor that your workstation is the
          dungeon and processes are the heroes. This game was made as the
          last project for my Web Development course.
        </div>
        {/* Key–value credit rows */}
        <div className="opt-credits">
          <div className="opt-cr-row"><span>BUILD</span><b>v0.9</b></div>
          <div className="opt-cr-row"><span>RUNTIME</span><b>React + babel-standalone</b></div>
          <div className="opt-cr-row"><span>SAVE</span><b>REST API · MySQL</b></div>
          <div className="opt-cr-row"><span>FONT</span><b>Press Start 2P · VT323</b></div>
          <div className="opt-cr-row"><span>MIPMIP COMPANY</span><b>© 2026</b></div>
        </div>
      </div>
    </div>
  );
}

// Expose OptionsPage globally so daw-app.jsx can mount it without a module bundler.
Object.assign(window, { OptionsPage });
