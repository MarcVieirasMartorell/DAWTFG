// daw-app.jsx
// Root application component for DAW (Defending A Workstation).
//
// Responsibilities:
//   - Auth gate: renders LoginScreen until a valid account session is established.
//   - Session restore: on mount, reads `daw.session` from localStorage and
//     re-fetches the player's full state from the API so nothing is stale.
//   - Global state: owns account, player name, party composition, unlocked
//     heroes, wallet, shop inventory, node clears, world progression, and
//     playtime. All state is debounced-saved to the API every 3 seconds.
//   - Routing: a single `route` string selects which page component is rendered
//     (title | intro | map | battle | shop | profile | options | devmode |
//     custommaps | admin). The map is kept mounted (display:none) to preserve
//     scroll/camera state between route transitions.
//   - Overlays: transient unlock toasts (hero / world) and the dev-mode intro
//     dialog are rendered above all page content with capture-phase keyboard
//     listeners so they intercept input before map or battle handlers fire.
//   - Dev/custom playtest: snapshots real state before injecting a custom
//     project world, then restores it on exit.

const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } = React;

// Snapshot original base sprites NOW, before applySprites can mutate ENEMY_KINDS / HEROES_DEF.
// All previous scripts have already run so window.ENEMY_KINDS and window.HEROES_DEF are set.
window.ENEMY_GRIDS_BASE  = Object.fromEntries(Object.entries(window.ENEMY_KINDS  || {}).map(([k,v]) => [k, v.grid]));
window.HERO_SPRITES_BASE = Object.fromEntries(Object.entries(window.HEROES_DEF   || {}).map(([k,v]) => [k, v.sprite]));

// All possible menu items. Items with needsCompletion are only shown after
// all 3 world bosses are cleared (w1:boss, w2:boss, w3:boss).
// Items with needsAdmin are only shown when account.isAdmin === true.
const ALL_MENU_ITEMS = [
  { id:'continue',   label:'CONTINUE',       desc:'RESUME YOUR SAVE STATE' },
  { id:'new',        label:'NEW GAME',        desc:'WIPE PROGRESS AND BOOT FRESH' },
  { id:'profile',    label:'PROFILE',         desc:'STATS · ACHIEVEMENTS · IDENTITY' },
  { id:'shop',       label:'REGISTRY MARKET', desc:'BUY ITEMS AND HEROES' },
  { id:'options',    label:'OPTIONS',         desc:'DISPLAY · AUDIO · GAMEPLAY' },
  { id:'devmode',    label:'DEV MODE',        desc:'BUILD YOUR OWN MAP, HEROES, ENEMIES', needsCompletion: true },
  { id:'custommaps', label:'CUSTOM MAPS',     desc:'BROWSE & PLAY COMMUNITY-MADE MODS',  needsCompletion: true },
  { id:'admin',      label:'ADMIN PANEL',     desc:'MANAGE USERS · PRIVILEGES · WALLETS', needsAdmin: true },
  { id:'logout',     label:'LOG OUT',         desc:'DISCONNECT FROM MIPMIP COMPANY' },
];

// Returns true if the player has cleared the final boss of all three worlds,
// which unlocks the DEV MODE and CUSTOM MAPS menu entries.
function hasBeatenGame(clears){
  return ['w1:boss','w2:boss','w3:boss'].every(k => clears.includes(k));
}

// Which map node clears unlock which hero on victory.
const NODE_HERO_UNLOCK = {
  'mid':  'ROOT.SH',     // mini-boss KEYLOG.RAT
  'boss': 'INDEX.LOG',   // boss TROJAN.WORM
};

// Lines displayed character-by-character in the boot crawl animation that
// plays the first time a logged-in player lands on the title screen.
const BOOT_LINES = [
  { t:'MIPMIP COMPANY BIOS v3.14  COPYRIGHT (C) 2026', cls:'' },
  { t:'POST.....................................[ OK ]', cls:'ok' },
  { t:'MEMORY TEST 65536K..........................[ OK ]', cls:'ok' },
  { t:'MOUNTING /HEROES............................[ OK ]', cls:'ok' },
  { t:'LOADING DEFENSE PROTOCOLS...................[ OK ]', cls:'ok' },
  { t:'SCANNING FOR INTRUSIONS....[ 3 THREATS DETECTED ]', cls:'warn' },
  { t:'> RUN DAW.EXE', cls:'' },
];

// useTypedLines — custom hook that animates an array of text lines as a
// typewriter effect. Each character is revealed after a short random delay,
// with a longer pause between lines. Returns [shownLines, isDone].
// `enabled` must be true for the effect to run (avoids running while logged out).
function useTypedLines(lines, speed=14, enabled=true){
  const [shown, setShown] = useState([]);
  const [done, setDone] = useState(false);
  useEffect(()=>{
    if(!enabled){ setShown([]); setDone(false); return; }
    let cancelled = false;
    let lineIdx = 0;
    let charIdx = 0;
    const out = [];
    setShown([]); setDone(false);
    // Recursive timer that advances one character (or one line boundary) per call.
    function tick(){
      if(cancelled) return;
      if(lineIdx >= lines.length){ setDone(true); return; }
      const cur = lines[lineIdx];
      if(charIdx <= cur.t.length){
        out[lineIdx] = { ...cur, t: cur.t.slice(0, charIdx) };
        setShown([...out]);
        charIdx++;
        setTimeout(tick, speed + (Math.random()*10|0));  // small random jitter for realism
      } else {
        // Finished this line — advance to the next with a longer pause.
        out[lineIdx] = cur;
        lineIdx++;
        charIdx = 0;
        setTimeout(tick, 90);
      }
    }
    setTimeout(tick, 200);  // brief initial delay before the crawl starts
    return ()=>{ cancelled = true; };
  }, [lines, enabled]);
  return [shown, done];
}

// ── Email verification banner ─────────────────────────────────────────────

// EmailVerifyBanner — renders a sticky banner at the top of the stage when the
// account's email address has not yet been confirmed. Provides a RESEND button
// that calls the API once and then shows a confirmation tick. Can be dismissed.
function EmailVerifyBanner({ account, blip }){
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if(dismissed) return null;
  if(!account?.email || account?.emailVerified) return null;

  // Calls the API to re-send the verification email; guards against double-sends.
  function resend(){
    if(sending || sent) return;
    setSending(true);
    blip && blip(720);
    DAW_API.resendVerification(account.id)
      .then(()=>{ setSent(true); setSending(false); })
      .catch(()=>{ setSending(false); });
  }

  return (
    <div style={{
      background:'var(--bg-1)', borderBottom:'2px solid var(--bg-2)',
      padding:'6px 16px', display:'flex', alignItems:'center', gap:12,
      fontFamily:"'VT323',monospace", fontSize:16, color:'var(--fg-dim)',
      letterSpacing:'.04em', flexShrink:0,
    }}>
      <span style={{flex:1}}>
        ⚠ EMAIL UNVERIFIED — check <b style={{color:'var(--fg)'}}>{account.email}</b> for a verification link
      </span>
      {sent
        ? <span style={{color:'var(--fg-bright)'}}>✓ SENT</span>
        : <button style={{
            appearance:'none', background:'transparent',
            border:'1px solid var(--fg-dim)', color:'var(--fg)',
            fontFamily:"'VT323',monospace", fontSize:15,
            letterSpacing:'.08em', padding:'2px 10px', cursor:'default',
            opacity: sending ? .5 : 1,
          }}
          onClick={resend}
          onMouseEnter={e=>{ e.target.style.background='var(--fg)'; e.target.style.color='var(--bg-0)'; }}
          onMouseLeave={e=>{ e.target.style.background='transparent'; e.target.style.color='var(--fg)'; }}>
          {sending ? 'SENDING...' : 'RESEND'}
        </button>
      }
      <button style={{
        appearance:'none', background:'transparent', border:'none',
        color:'rgba(212,163,115,.6)', fontFamily:"'VT323',monospace",
        fontSize:18, cursor:'default', padding:'0 4px',
      }}
      onClick={()=>{ blip && blip(360); setDismissed(true); }}
      title="dismiss">✕</button>
    </div>
  );
}

// ── Route-independent unlock toast ────────────────────────────────────────
// Rendered at App root, above everything (z=100). Uses a capture-phase keyboard
// listener so it intercepts Enter/Escape BEFORE map/battle/shop handlers fire.

// UnlockToast — modal overlay that announces a newly-unlocked hero or world.
// A capture-phase keydown listener ensures it blocks all other input until
// the player confirms. `kind` is 'hero' or 'world' and affects the header text.
function UnlockToast({ title, primary, body, kind='hero', blip, onDismiss }){
  useEffect(()=>{
    function onKey(e){
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape'){
        e.preventDefault();
        e.stopPropagation();
        onDismiss && onDismiss();
      }
    }
    // Capture phase so it fires before bubble-phase listeners (the map/battle).
    window.addEventListener('keydown', onKey, true);
    return ()=>window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  return (
    <div className="overlay" style={{zIndex:100}}
      onClick={(e)=>{ if(e.target===e.currentTarget){ blip && blip(540); onDismiss && onDismiss(); } }}>
      <div className="dialog" style={{textAlign:'center', maxWidth: 520}}>
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:9,
          color:'var(--hl)', letterSpacing:'.24em', marginBottom:12,
        }}>
          ▣ {kind === 'world' ? 'NEW REGION DISCOVERED' : 'ROSTER EXPANDED'} ▣
        </div>
        <h3 style={{margin:'0 0 10px', letterSpacing:'.14em'}}>{title}</h3>
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:16,
          color:'var(--fg-bright)', letterSpacing:'.06em', margin:'14px 0 6px',
          textShadow:'0 0 10px rgba(212,244,163,.4)',
          animation: 'cursorblink 1.2s steps(2) infinite',
        }}>
          {primary}
        </div>
        <p style={{whiteSpace:'pre-wrap', marginTop:14, marginBottom:18,
          fontSize:18, color:'var(--cream)'}}>{body}</p>
        <div className="row" style={{justifyContent:'center'}}>
          <button className="sel" autoFocus
            onClick={()=>{ blip && blip(960); onDismiss && onDismiss(); }}>
            CONFIRM
          </button>
        </div>
        <div style={{
          marginTop:14, fontFamily:"'VT323',monospace", fontSize:14,
          color:'rgba(254,250,224,.55)', letterSpacing:'.04em'
        }}>
          press ⏎ or ESC to dismiss
        </div>
      </div>
    </div>
  );
}

// ── Dev-mode intro overlay ───────────────────────────────────────────────
// Shown once at the start of a custom-mod playtest, displaying author's
// intro dialogue. Capture-phase Enter/Escape so it intercepts before map.

// DevIntroOverlay — full-screen dialog that displays the mod author's custom
// intro text before the player enters the injected world. Dismissed by any
// confirm key or by clicking the backdrop.
function DevIntroOverlay({ text, blip, onDismiss }){
  useEffect(()=>{
    function onKey(e){
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape'){
        e.preventDefault(); e.stopPropagation();
        onDismiss && onDismiss();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return ()=>window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  // Fall back to a default message if the mod author provided no intro text.
  const safeText = (text && text.trim()) || '> NO INTRO DIALOGUE SET.\n> press ⏎ to begin.';
  return (
    <div className="overlay" style={{zIndex:100}}
      onClick={(e)=>{ if(e.target===e.currentTarget){ blip && blip(540); onDismiss && onDismiss(); } }}>
      <div className="dialog" style={{maxWidth: 640, textAlign:'left'}}>
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:9,
          color:'var(--hl)', letterSpacing:'.24em', marginBottom:14, textAlign:'center'
        }}>
          ▣ DEV MOD · NEW GAME ▣
        </div>
        <pre style={{
          margin:0, fontFamily:"'VT323',monospace", fontSize:20,
          color:'var(--cream)', letterSpacing:'.02em', lineHeight:1.45,
          whiteSpace:'pre-wrap', wordBreak:'break-word',
          background:'rgba(0,0,0,.35)', padding:'16px 18px',
          border:'1px dashed rgba(254,250,224,.25)'
        }}>{safeText}</pre>
        <div className="row" style={{justifyContent:'center', marginTop:16}}>
          <button className="sel" autoFocus
            onClick={()=>{ blip && blip(960); onDismiss && onDismiss(); }}>
            BEGIN
          </button>
        </div>
        <div style={{
          marginTop:10, fontFamily:"'VT323',monospace", fontSize:14,
          color:'rgba(254,250,224,.55)', letterSpacing:'.04em', textAlign:'center'
        }}>
          press ⏎ to begin · ESC to skip
        </div>
      </div>
    </div>
  );
}

// applySprites — mutates HEROES_DEF and ENEMY_KINDS in-place with admin-saved
// sprite and stat overrides fetched from the API. Called once on mount so
// every component that reads those tables gets the canonical admin version.
function applySprites(overrides) {
  if (!overrides) return;
  // Apply hero overrides: pixel grid, colour palette, base stats, and scripts.
  Object.entries(overrides.heroes || {}).forEach(([name, ov]) => {
    const def = HEROES_DEF[name];
    if (!def) return;
    if (Array.isArray(ov.grid) && ov.grid.length > 0) def.sprite = ov.grid;
    ['body','rim','dark','acc','eye'].forEach(k => { if (ov[k]) def[k] = ov[k]; });
    if (ov.hpMax)     def.hpMax     = ov.hpMax;
    if (ov.cpuMax)    def.cpuMax    = ov.cpuMax;
    if (ov.spd)       def.spd       = ov.spd;
    if (Array.isArray(ov.atk) && ov.atk.length === 2) def.atk = ov.atk.slice();
    if (ov.role)      def.role      = ov.role;
    if (ov.bio)       def.bio       = ov.bio;
    if (ov.limitName) def.limitName = ov.limitName;
    if (ov.limitDesc) def.limitDesc = ov.limitDesc;
    if (Array.isArray(ov.scripts) && ov.scripts.length > 0) def.scripts = ov.scripts;
  });
  // Apply enemy overrides: pixel grid, colour palette, combat stats, and attacks.
  Object.entries(overrides.enemies || {}).forEach(([name, ov]) => {
    const def = ENEMY_KINDS[name];
    if (!def) return;
    if (Array.isArray(ov.grid) && ov.grid.length > 0) def.grid = ov.grid;
    ['body','rim','dark','acc','eye'].forEach(k => { if (ov[k]) def[k] = ov[k]; });
    if (ov.hp)  def.hp  = ov.hp;
    if (ov.spd) def.spd = ov.spd;
    if (ov.xp)  def.xp  = ov.xp;
    if (Array.isArray(ov.dmg) && ov.dmg.length === 2) def.dmg = ov.dmg.slice();
    if (Array.isArray(ov.attacks) && ov.attacks.length > 0) def.attacks = ov.attacks;
  });
}
// Expose applySprites globally so the admin panel can call it after saving.
window.applySprites = applySprites;

// App — root component. Owns all global state and renders the correct page
// based on `route`. The component tree is structured as a flat switch on
// `route` rather than a router library to keep the dependency footprint minimal.
function App(){
  // Device-level settings (volume, light/dark mode, CRT, music). Persisted in
  // localStorage, NOT per-account.
  const [settings, setSettings] = useState(()=>loadDawSettings());

  // Persists a single settings key change to localStorage immediately.
  const updateSetting = useCallback((key, val)=>{
    setSettings(s => {
      const ns = { ...s, [key]: val };
      saveDawSettings(ns);
      return ns;
    });
  }, []);

  // Mirror the CRT toggle setting onto the DOM element that the CSS uses
  // to enable/disable the scanline effect.
  useEffect(()=>{
    const el = document.querySelector('.crt');
    if(el) el.setAttribute('data-crt', settings.crt);
  }, [settings.crt]);

  // ── Account / auth ────────────────────────────────────────────────────

  // Attempt to pre-populate account from a cached localStorage session so the
  // player can skip re-entering credentials on page reload. The full hydration
  // (including fresh API data) happens in the session-restore effect below.
  const [account, setAccount] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('daw.session') || 'null');
      return parsed?.id ? parsed : null;
    } catch(e) { return null; }
  });
  const [sessionLoading, setSessionLoading] = useState(true);  // true while restoring

  // Audio (created lazily; volume + music driven by settings)
  const audioRef = useRef(null);

  // Creates the audio engine on first call and applies the current volume
  // setting immediately. Subsequent calls return the existing instance.
  const ensureAudio = useCallback(()=>{
    if(!audioRef.current){
      try {
        audioRef.current = makeAudio();
        // Apply current volume immediately
        const vol = (settings.volume || 0) / 100 * 0.4; // scale: 0..0.4
        audioRef.current.setVolume && audioRef.current.setVolume(vol);
      }
      catch(e){ console.warn('audio init failed', e); }
    }
    return audioRef.current;
  }, [settings.volume]);

  // Keep audio gain in sync with settings.volume whenever it changes.
  useEffect(()=>{
    const a = audioRef.current; if(!a) return;
    const vol = (settings.volume || 0) / 100 * 0.4;
    a.setVolume && a.setVolume(vol);
  }, [settings.volume]);

  // Start or stop the chiptune background music track when the music
  // toggle changes in settings.
  useEffect(()=>{
    const a = ensureAudio(); if(!a) return;
    if(settings.music){ a.start(); }
    else { a.stop(); }
  }, [settings.music, ensureAudio]);

  // Browsers require a user gesture before the AudioContext can play.
  // Resume the context on the first pointer-down or keydown event.
  useEffect(()=>{
    function unlock(){
      const a = ensureAudio(); if(a){ a.resume(); }
    }
    window.addEventListener('pointerdown', unlock, { once:true });
    window.addEventListener('keydown',     unlock, { once:true });
    return ()=>{
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ensureAudio]);

  // Plays a short blip tone at frequency `f` Hz (defaults to 720 Hz).
  // Used throughout the UI to give menu navigation tactile audio feedback.
  const blip = useCallback((f=720)=>{
    const a = audioRef.current; if(a) a.blip(f, 0.06, 'square', 0.22);
  }, []);

  // ── Per-account state (loaded from account.progress on login) ─────────
  // Initialized to defaults; replaced on successful auth.
  const [playerName,     setPlayerName]     = useState('USER');
  const [party,          setParty]          = useState(DAW_DEFAULT_PARTY);
  const [unlockedHeroes, setUnlockedHeroes] = useState(DAW_STARTER_HEROES);
  const [wallet,         setWallet]         = useState(DAW_DEFAULT_WALLET);
  const [shopInv,        setShopInv]        = useState(DAW_DEFAULT_INV);
  const [clears,         setClears]         = useState([]);  // namespaced "wId:nId"
  const [hasSave,        setHasSave]        = useState(false);
  const [currentWorldId, setCurrentWorldId] = useState('w1');
  const [worldsUnlocked, setWorldsUnlocked] = useState(['w1']);
  const [playtimeSec,    setPlaytimeSec]    = useState(0);
  const sessionStartRef = useRef(Date.now());  // timestamp of when this session began, for playtime accumulation

  // Visible menu items — completion-gated + admin-gated filtering.
  // Recomputed only when the clears array or account admin flag changes.
  const menuItems = useMemo(()=>
    ALL_MENU_ITEMS.filter(m =>
      (!m.needsCompletion || hasBeatenGame(clears)) &&
      (!m.needsAdmin || account?.isAdmin)
    ),
  [clears, account]);

  // Keep the selection cursor in bounds when menuItems shrinks (e.g. admin
  // logs out) or grows (e.g. game beaten).
  useEffect(()=>{ setSel(s => Math.min(s, menuItems.length - 1)); }, [menuItems.length]);

  // Transient (not persisted): toasts that block input until dismissed.
  const [heroUnlockToast,  setHeroUnlockToast]  = useState(null); // {name}
  const [worldUnlockToast, setWorldUnlockToast] = useState(null); // {world}

  // Save-in-flight guard: prevents the persistence effect from firing
  // while we're still loading the initial state from the API.
  const skipSaveRef = useRef(false);
  const saveTimerRef = useRef(null);

  // hydrateFromApiState — overwrites all per-account React state with the
  // FullPlayerState shape returned by DAW_API.getPlayer(). Called after
  // successful login and on session restore.
  const hydrateFromApiState = useCallback((state)=>{
    const p = state.progress || {};
    setPlayerName(p.playerName || state.account.username);
    setParty(Array.isArray(state.party) && state.party.length ? state.party : [...DAW_DEFAULT_PARTY]);
    setUnlockedHeroes(Array.isArray(state.unlockedHeroes) && state.unlockedHeroes.length
      ? state.unlockedHeroes : [...DAW_STARTER_HEROES]);
    setWallet(typeof p.wallet === 'number' ? p.wallet : DAW_DEFAULT_WALLET);
    setShopInv(state.inventory && typeof state.inventory === 'object'
      ? { ...DAW_DEFAULT_INV, ...state.inventory } : { ...DAW_DEFAULT_INV });
    setClears(Array.isArray(state.clears) ? state.clears : []);
    setHasSave(!!p.hasSave);
    setCurrentWorldId(p.currentWorldId || 'w1');
    setWorldsUnlocked(Array.isArray(state.worldsUnlocked) && state.worldsUnlocked.length
      ? state.worldsUnlocked : ['w1']);
    setPlaytimeSec(typeof p.playtimeSec === 'number' ? p.playtimeSec : 0);
    sessionStartRef.current = Date.now();  // reset session timer so elapsed time is measured from now
  }, []);

  // hydrateDefaults — resets all per-account state to starter values for a
  // brand-new account (no existing save on the API).
  const hydrateDefaults = useCallback((username)=>{
    setPlayerName(username || 'USER');
    setParty([...DAW_DEFAULT_PARTY]);
    setUnlockedHeroes([...DAW_STARTER_HEROES]);
    setWallet(DAW_DEFAULT_WALLET);
    setShopInv({ ...DAW_DEFAULT_INV });
    setClears([]);
    setHasSave(false);
    setCurrentWorldId('w1');
    setWorldsUnlocked(['w1']);
    setPlaytimeSec(0);
    sessionStartRef.current = Date.now();
  }, []);

  // ── Session restore on page load ──────────────────────────────────────

  // Runs once on mount. Loads the cached session from localStorage and
  // validates it against the API. If valid, hydrates all state; if invalid
  // (expired token, API error), drops the cache and shows the login screen.
  // Admin status is refreshed in a parallel request to avoid a stale cached flag.
  useEffect(()=>{
    // Load admin sprite overrides first (non-fatal if API is down)
    DAW_API.getSprites().then(applySprites).catch(()=>{});

    const raw = localStorage.getItem('daw.session');
    if(!raw){ setSessionLoading(false); return; }
    let cached;
    try { cached = JSON.parse(raw); } catch(e){ localStorage.removeItem('daw.session'); setSessionLoading(false); return; }
    if(!cached?.id){ localStorage.removeItem('daw.session'); setSessionLoading(false); return; }

    // Block the save effect while we're still loading so we don't write
    // default state over the player's real save.
    skipSaveRef.current = true;
    Promise.all([
      DAW_API.getPlayer(cached.id),
      // Catch admin-status failure gracefully — fall back to the cached flag.
      DAW_API.getAdminStatus(cached.id).catch(()=>({ isAdmin: cached.isAdmin || false })),
    ])
      .then(([state, adminStatus]) => {
        hydrateFromApiState(state);
        const freshAccount = { ...cached, ...(state.account || {}), isAdmin: adminStatus.isAdmin };
        setAccount(freshAccount);
        localStorage.setItem('daw.session', JSON.stringify(freshAccount));
        setTimeout(()=>{ skipSaveRef.current = false; }, 500);
      })
      .catch(()=>{
        // Session invalid or API down — drop it and show login
        localStorage.removeItem('daw.session');
        setAccount(null);
      })
      .finally(()=>{ setSessionLoading(false); });
  }, []); // runs once on mount

  // Debounced API save whenever per-account state changes (3 s delay).
  // Skipped during dev playtests to avoid writing mod-injected state to the
  // real save slot, and suppressed while the initial session restore is running.
  useEffect(()=>{
    if(!account) return;
    if(devPlayMode) return;
    if(skipSaveRef.current) return;
    if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(()=>{
      // Add the elapsed wall-clock seconds from this session to the stored total.
      const elapsedSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      DAW_API.saveProgress(account.id, {
        playerName, party, unlockedHeroes,
        wallet, inventory: shopInv, clears,
        playtimeSec: playtimeSec + elapsedSec,
        hasSave,
        currentWorldId, worldsUnlocked,
      }).catch(e => console.warn('save failed', e));
    }, 3000);
  }, [account, playerName, party, unlockedHeroes, wallet, shopInv, clears, hasSave, currentWorldId, worldsUnlocked, devPlayMode, playtimeSec]);

  // Adds a hero to the unlocked roster if not already present.
  const unlockHero = useCallback((name, source)=>{
    if(!name) return;
    setUnlockedHeroes(arr => arr.includes(name) ? arr : [...arr, name]);
  }, []);

  // ── Boot/title animation (runs each time we land on the title) ────────

  // Boot crawl lines (typed character by character). Only active when logged in.
  const [boot, bootDone] = useTypedLines(BOOT_LINES, 9, !!account);
  const [titleIn, setTitleIn] = useState(false);  // controls title CSS animation class
  const [menuIn, setMenuIn]   = useState(false);   // controls menu CSS animation class

  // After the boot crawl finishes, stagger the title and menu fade-in animations.
  useEffect(()=>{
    if(!account){ setTitleIn(false); setMenuIn(false); return; }
    if(bootDone){
      const t1 = setTimeout(()=>setTitleIn(true), 250);
      const t2 = setTimeout(()=>setMenuIn(true), 1500);
      return ()=>{ clearTimeout(t1); clearTimeout(t2); };
    }
  }, [bootDone, account]);

  // Menu state
  const [sel, setSel] = useState(0);           // highlighted menu item index
  const [overlay, setOverlay] = useState(null); // confirmation dialog descriptor
  const [overlaySel, setOverlaySel] = useState(0);

  // Route state: 'title' | 'intro' | 'map' | 'battle' | 'shop' | 'profile'
  const [route, setRoute] = useState('title');

  // Apply theme: world-coloured on map/battle, base B&W everywhere else.
  // useLayoutEffect fires before the browser paints, preventing a flash of the
  // default W1 CSS variables (set in index.html) when transitioning from login.
  // NOTE: must be after `route` is declared so the dep array captures the real value.
  useLayoutEffect(()=>{
    applyTheme(currentWorldId, settings.mode, route);
  }, [currentWorldId, settings.mode, route]);

  // Battle context — set by the map when the player enters a fight node.
  // Cleared to null when the battle scene exits.
  const [battle, setBattle] = useState(null);

  // mapMounted tracks whether the WorldMap component has ever been rendered.
  // Once true it stays true; the map is then toggled with display:none instead
  // of being unmounted, preserving camera position between routes.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(()=>{ if(route === 'map') setMapMounted(true); }, [route]);

  // Reset transient route state when the user logs out so the next login
  // starts from the title screen with no stale battle or map context.
  useEffect(()=>{
    if(!account){
      setRoute('title');
      setOverlay(null);
      setBattle(null);
      setMapMounted(false);
    }
  }, [account]);

  // Which profile tab to open when the user picks PARTY/HEROES or BESTIARY.
  const [profileTab, setProfileTab] = useState('profile');
  // Track where we came from when entering shop/profile so EXIT returns there.
  const [shopFrom, setShopFrom] = useState('map');
  const [profileFrom, setProfileFrom] = useState('title');

  // Dev mode / custom playtest. Snapshot ref preserves real account state
  // while the user is inside a custom playtest so we can restore on exit.
  const [devPlayMode, setDevPlayMode] = useState(false);
  const [devIntro, setDevIntro] = useState(null); // string | null — shown once at playtest start
  const [devPlayFrom, setDevPlayFrom] = useState('devmode'); // which route to return to on exit
  const devSnapshotRef = useRef(null);  // stores pre-playtest state so it can be restored

  // startBattle — stores the battle descriptor and switches to the battle route.
  const startBattle = useCallback((b)=>{
    setBattle(b);
    setRoute('battle');
  }, []);

  // openShop — navigates to the shop from the map and records the origin.
  const openShop = useCallback(()=>{
    setShopFrom('map');
    setRoute('shop');
  }, []);

  // closeShop — returns to whichever route opened the shop.
  const closeShop = useCallback(()=>{
    setRoute(shopFrom);
    blip(540);
  }, [blip, shopFrom]);

  // finishBattle — called by BattleScene via the onComplete prop.
  // On victory: records the node clear, checks for hero/world unlocks, stacks
  // unlock toasts. On defeat: routes back to the title. Always clears battle state.
  const finishBattle = useCallback((result)=>{
    if(result.result === 'victory' && battle){
      // Mark node cleared (namespaced by current world)
      const clearKey = `${currentWorldId}:${battle.nodeId}`;
      setClears(c => c.includes(clearKey) ? c : [...c, clearKey]);
      setHasSave(true);
      // Hero unlock on miniboss / boss
      const unlock = NODE_HERO_UNLOCK[battle.nodeId];
      if(unlock){
        setUnlockedHeroes(arr => {
          if(arr.includes(unlock)) return arr;
          // Show route-independent toast with its own input capture
          setHeroUnlockToast({ name: unlock });
          return [...arr, unlock];
        });
      }
      // World unlock on boss clear — unlock the next world in the WORLDS array.
      if(battle.nodeId === 'boss'){
        const idx = WORLDS.findIndex(w => w.id === currentWorldId);
        const nextW = WORLDS[idx + 1];
        if(nextW && !worldsUnlocked.includes(nextW.id)){
          setWorldsUnlocked(arr => arr.includes(nextW.id) ? arr : [...arr, nextW.id]);
          // Delay the world-unlock toast slightly so it doesn't overlap the hero toast
          // if both fire simultaneously (boss of a node that also awards a hero).
          setTimeout(()=>setWorldUnlockToast({ world: nextW }), unlock ? 120 : 0);
        }
      }
    }
    setBattle(null);
    // Defeat routes back to title; victory routes back to the map.
    setRoute(result.result === 'defeat' ? 'title' : 'map');
    blip(540);
  }, [battle, blip, currentWorldId, worldsUnlocked]);

  // startNewGame — wipes all per-account progress back to starter values,
  // records a hasSave flag so the map is accessible, and routes to the
  // name-entry intro screen.
  const startNewGame = useCallback(()=>{
    // Wipe progress for this account but keep credentials
    setParty([...DAW_DEFAULT_PARTY]);
    setUnlockedHeroes([...DAW_STARTER_HEROES]);
    setWallet(DAW_DEFAULT_WALLET);
    setShopInv({ ...DAW_DEFAULT_INV });
    setClears([]);
    setCurrentWorldId('w1');
    setWorldsUnlocked(['w1']);
    setHasSave(true);
    setOverlay(null);
    setRoute('intro');
    blip(960);
  }, [blip]);

  // continueGame — resumes an existing save by routing directly to the map.
  const continueGame = useCallback(()=>{
    setOverlay(null);
    setRoute('map');
    blip(960);
  }, [blip]);

  // logOut — clears the local session cache, resets account state, and returns
  // to the title/login screen.
  const logOut = useCallback(()=>{
    localStorage.removeItem('daw.session');
    setOverlay(null);
    setRoute('title');
    setAccount(null);
    blip(360);
  }, [blip]);

  // ── DEV MODE playtest launch ─────────────────────────────────────────

  // launchDevPlaytest — injects a custom project world via window.injectProject,
  // snapshots the real game state, replaces party/world/clears with the mod's
  // values, and shows the mod's intro dialog before routing to the map.
  const launchDevPlaytest = useCallback((project)=>{
    if(!window.injectProject) return;
    const devWorldId = window.injectProject(project);
    if(!devWorldId) return;
    // Snapshot pre-playtest state so we can restore on exit.
    devSnapshotRef.current = {
      party: [...party],
      currentWorldId,
      worldsUnlocked: [...worldsUnlocked],
      clears: [...clears],
      hasSave,
      unlockedHeroes: [...unlockedHeroes],
    };
    // Build party from custom heroes; pad with defaults only if dev provided <3
    // (validator should prevent this but be defensive).
    const customIds = (project.heroes || []).map(h => h.id);
    const padded = [...customIds, ...DAW_DEFAULT_PARTY].slice(0, 3);
    setDevPlayMode(true);
    setDevPlayFrom(route === 'custommaps' ? 'custommaps' : 'devmode');
    setParty(padded);
    // Make sure injected custom hero ids count as "unlocked" so battles accept them.
    setUnlockedHeroes(arr => Array.from(new Set([...arr, ...customIds, ...DAW_DEFAULT_PARTY])));
    setCurrentWorldId(devWorldId);
    setWorldsUnlocked([devWorldId]);
    // Fresh playthrough — don't carry mod-namespaced clears from a previous run.
    setClears(c => c.filter(x => !x.startsWith(devWorldId + ':')));
    setDevIntro(project.intro || '');
  }, [party, currentWorldId, worldsUnlocked, clears, hasSave, unlockedHeroes, route]);

  // exitDevPlaytest — restores all snapshotted pre-playtest state and returns
  // the player to whichever page launched the playtest.
  const exitDevPlaytest = useCallback(()=>{
    const snap = devSnapshotRef.current;
    if(snap){
      setParty(snap.party);
      setCurrentWorldId(snap.currentWorldId);
      setWorldsUnlocked(snap.worldsUnlocked);
      setClears(snap.clears);
      setHasSave(snap.hasSave);
      setUnlockedHeroes(snap.unlockedHeroes);
    }
    setDevPlayMode(false);
    setDevIntro(null);
    setRoute(devPlayFrom);
    blip(360);
  }, [blip, devPlayFrom]);

  // dismissDevIntro — closes the dev intro dialog and routes to the map so
  // the playtest can begin. Called by DevIntroOverlay's confirm/dismiss action.
  const dismissDevIntro = useCallback(()=>{
    setDevIntro(null);
    setRoute('map');
    blip(960);
  }, [blip]);

  // openItem — handles a menu item selection on the title screen.
  // Routes to the correct page or shows a confirmation overlay depending on the
  // item id. 'new' and 'continue' have guard dialogs when a save already exists
  // or is missing respectively.
  const openItem = useCallback((id)=>{
    blip(880);
    if(id === 'new'){
      if(hasSave){
        // Warn before overwriting an existing save.
        setOverlay({ kind:'newgame',
          title:'NEW GAME',
          body:'OVERWRITE YOUR SAVE?\nALL PROGRESS, HEROES AND ITEMS WILL BE PURGED.\nTHIS CANNOT BE UNDONE.',
          choices:['YES, WIPE','CANCEL'],
          actions:[startNewGame, ()=>{ setOverlay(null); blip(360); }] });
      } else {
        startNewGame();
      }
    } else if(id === 'continue'){
      if(hasSave){
        continueGame();
      } else {
        // No save found — offer to start a new game instead.
        setOverlay({ kind:'msg',
          title:'NO SAVE FOUND',
          body:'NO SAVE STATE ON RECORD.\nSTART A NEW GAME TO INITIALIZE\nYOUR /HOME SECTOR.',
          choices:['START NEW GAME','BACK'],
          actions:[ startNewGame, ()=>{ setOverlay(null); blip(360); } ]
        });
      }
    } else if(id === 'shop'){
      setOverlay(null);
      setShopFrom('title');
      setRoute('shop');
    } else if(id === 'party'){
      setOverlay(null);
      setProfileTab('party');
      setProfileFrom('title');
      setRoute('profile');
    } else if(id === 'profile'){
      setOverlay(null);
      setProfileTab('profile');
      setProfileFrom('title');
      setRoute('profile');
    } else if(id === 'bestiary'){
      setOverlay(null);
      setProfileTab('bestiary');
      setProfileFrom('title');
      setRoute('profile');
    } else if(id === 'options'){
      setOverlay(null);
      setRoute('options');
    } else if(id === 'devmode'){
      setOverlay(null);
      setRoute('devmode');
    } else if(id === 'custommaps'){
      setOverlay(null);
      setRoute('custommaps');
    } else if(id === 'admin'){
      setOverlay(null);
      setRoute('admin');
    } else if(id === 'logout'){
      setOverlay({ kind:'logout',
        title:'LOG OUT',
        body:`DISCONNECT ${playerName}?\nYOUR SAVE IS PERSISTED TO\nMIPMIP COMPANY.`,
        choices:['DISCONNECT','CANCEL'],
        actions:[ logOut, ()=>{ setOverlay(null); blip(360); } ]});
    }
    setOverlaySel(0);
  }, [blip, hasSave, startNewGame, continueGame, playerName, logOut, clears]);

  // Keyboard navigation (title menu only) — handles arrow-key selection and
  // Enter confirmation for both the main menu grid and any open overlay dialog.
  useEffect(()=>{
    function onKey(e){
      if(!account) return;
      if(route !== 'title') return;
      if(overlay){
        // Navigate overlay choices with arrow keys; confirm with Enter; dismiss with Escape.
        const n = overlay.choices.length;
        if(e.key==='ArrowDown'||e.key==='ArrowRight'){
          setOverlaySel(s=>(s+1)%n); blip(540); e.preventDefault();
        } else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){
          setOverlaySel(s=>(s-1+n)%n); blip(540); e.preventDefault();
        } else if(e.key==='Enter'){
          if(overlay.actions && overlay.actions[overlaySel]){
            overlay.actions[overlaySel]();
          } else {
            blip(960); setOverlay(null);
          }
          e.preventDefault();
        } else if(e.key==='Escape'){
          blip(360); setOverlay(null); e.preventDefault();
        }
        return;
      }
      if(!menuIn) return;
      const n = menuItems.length;
      // Arrow keys move by 3 columns vertically (the menu is a 3-column grid)
      // and by 1 item horizontally.
      if(e.key==='ArrowDown'){ setSel(s=>(s+3<n) ? s+3 : s); blip(540); e.preventDefault(); }
      else if(e.key==='ArrowUp'){ setSel(s=>(s-3>=0) ? s-3 : s); blip(540); e.preventDefault(); }
      else if(e.key==='ArrowRight'){ setSel(s=>(s+1)%n); blip(540); e.preventDefault(); }
      else if(e.key==='ArrowLeft'){ setSel(s=>(s-1+n)%n); blip(540); e.preventDefault(); }
      else if(e.key==='Enter'||e.key===' '){
        openItem(menuItems[sel].id); e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [sel, menuIn, overlay, overlaySel, blip, openItem, route, account]);

  // ── AUTH GATE ─────────────────────────────────────────────────────────
  // If no account, show the login screen and nothing else.
  if(!account){
    // Show a minimal loading indicator while checking the cached session.
    if(sessionLoading) return (
      <div className="crt" data-crt={settings.crt}>
        <div className="stage" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,color:'var(--hl)',letterSpacing:'.2em'}}>
            RESTORING SESSION...
          </div>
        </div>
      </div>
    );
    // Show LoginScreen. On success, hydrate state from the API (or defaults for
    // a new account) and set the account to trigger the main render path.
    return (
      <div className="crt" data-crt={settings.crt}>
        <div className="stage">
          <LoginScreen blip={blip}
            onAuthed={async ({account: acct, hasSave})=>{
              skipSaveRef.current = true;
              if(hasSave){
                try {
                  const state = await DAW_API.getPlayer(acct.id);
                  hydrateFromApiState(state);
                } catch(e){
                  console.warn('load save failed', e);
                  hydrateDefaults(acct.username);
                }
              } else {
                hydrateDefaults(acct.username);
              }
              localStorage.setItem('daw.session', JSON.stringify(acct));
              setAccount(acct);
              // Allow saves after state has settled
              setTimeout(()=>{ skipSaveRef.current = false; }, 500);
              blip(960);
            }} />
        </div>
      </div>
    );
  }

  return (
    <div className="crt" data-crt={settings.crt}>
      <div className="stage">
        {/* Fixed topbar with player name, options shortcut, and logout button */}
        <div className="topbar">
          <div className="path">
            C:\WORKSTATION\&gt; RUN DAW.EXE — USER: <b style={{color:'var(--fg-bright)'}}>{playerName}</b>
            <span className="blink"></span>
          </div>
          <div className="right">
            <span>v1.05</span>
            <button className="sndtoggle"
              onClick={()=>openItem('options')}
              title="open options">
              ⚙ OPTIONS
            </button>
            <button className="sndtoggle"
              onClick={()=>openItem('logout')}
              title="log out">
              ↩ LOGOUT
            </button>
          </div>
        </div>

        {/* Email verification banner — only visible when email is unverified */}
        <EmailVerifyBanner account={account} blip={blip} />

        {/* Intro screen — cinematic new-game sequence */}
        {route === 'intro' && (
          <Intro blip={blip}
            username={account?.username}
            onCancel={()=>{ setRoute('title'); blip(360); }}
            onComplete={()=>{ setHasSave(true); setRoute('map'); blip(960); }} />
        )}

        {/* WorldMap — kept mounted after first visit so camera state is preserved.
            Shown via CSS display rather than unmounting. */}
        {mapMounted && (
          <div style={{position:'absolute', inset:0, zIndex:5,
                       display: route==='map' ? 'block' : 'none'}}>
            <WorldMap blip={blip} playerName={playerName}
              onExit={()=>{ if(devPlayMode){ exitDevPlaytest(); } else { setRoute('title'); blip(360); } }}
              onEngage={startBattle}
              onShop={openShop}
              onClearNode={(nodeId, worldId, reward)=>{
                const key = `${worldId}:${nodeId}`;
                setClears(c => c.includes(key) ? c : [...c, key]);
                if(reward && reward.length > 0){
                  setShopInv(inv => {
                    const next = {...inv};
                    reward.forEach(r => { if(r.itemId) next[r.itemId] = (next[r.itemId]||0) + (r.qty||1); });
                    return next;
                  });
                }
              }}
              externalClears={clears}
              wallet={wallet}
              worldId={currentWorldId}
              worldsUnlocked={worldsUnlocked}
              onSwitchWorld={(id)=>{ setCurrentWorldId(id); blip(720); }}
              active={route==='map'} />
          </div>
        )}

        {/* Shop screen — buy items and unlock heroes */}
        {route === 'shop' && (
          <ShopScreen blip={blip} playerName={playerName}
            wallet={wallet}
            inventory={shopInv}
            unlockedHeroes={unlockedHeroes}
            onBuy={(item, qty, total)=>{
              setShopInv(I => ({...I, [item.id]: (I[item.id]||0) + qty}));
            }}
            onSell={(item, qty, total)=>{
              setShopInv(I => ({...I, [item.id]: Math.max(0,(I[item.id]||0) - qty)}));
            }}
            onAdjustWallet={(delta)=>{ setWallet(w => Math.max(0, w + delta)); }}
            onUnlockHero={(heroId)=>{ unlockHero(heroId, 'shop'); }}
            onExit={closeShop} />
        )}

        {/* Battle screen — only rendered when a battle descriptor exists */}
        {route === 'battle' && battle && (
          <BattleScene
            encounter={battle.encounter}
            party={party}
            onComplete={finishBattle}
          />
        )}

        {/* Profile page — stats, party management, and bestiary */}
        {route === 'profile' && (
          <ProfilePage blip={blip} playerName={playerName}
            initialTab={profileTab}
            party={party} setParty={setParty}
            unlockedHeroes={unlockedHeroes}
            clears={clears}
            wallet={wallet}
            account={account}
            // Compute live playtime by adding elapsed session seconds to the stored total.
            playtimeSec={playtimeSec + Math.floor((Date.now() - sessionStartRef.current) / 1000)}
            onExit={()=>{ setRoute(profileFrom); blip(360); }} />
        )}

        {/* Options page — audio, display, and gameplay toggles */}
        {route === 'options' && (
          <OptionsPage blip={blip}
            settings={settings}
            onChange={updateSetting}
            audio={audioRef.current}
            currentWorldId={currentWorldId}
            onExit={()=>{ setRoute('title'); blip(360); }} />
        )}

        {/* Dev mode page — mod editor and playtest launcher */}
        {route === 'devmode' && (
          <DevModePage blip={blip}
            account={account}
            onExit={()=>{ setRoute('title'); blip(360); }}
            onPlaytest={launchDevPlaytest} />
        )}

        {/* Custom maps page — browse and play community-submitted mods */}
        {route === 'custommaps' && (
          <CustomMapsPage blip={blip}
            account={account}
            onExit={()=>{ setRoute('title'); blip(360); }}
            onPlay={(mod)=>{ launchDevPlaytest(mod); }} />
        )}

        {/* Admin panel — guarded: only renders when account.isAdmin is true */}
        {route === 'admin' && account?.isAdmin && (
          <AdminPage blip={blip}
            account={account}
            onExit={()=>{ setRoute('title'); blip(360); }} />
        )}

        {/* Title screen — main menu, boot crawl, and game logo */}
        <div className="main" style={{display: route==='title' ? 'grid' : 'none'}}>
          {/* Boot crawl — collapses out once title appears */}
          <div className="boot" style={{
              height: titleIn ? 0 : 'auto',
              minHeight: 0,
              opacity: titleIn ? 0 : 1,
              overflow:'hidden',
              transition:'opacity .35s, height .5s, margin .35s',
              margin: titleIn ? 0 : undefined,
              padding: titleIn ? 0 : undefined,
            }}>
            {boot.map((l,i)=>(
              <span key={i} className={'ln '+(l.cls||'')}>{l.t}</span>
            ))}
          </div>

          {/* Game logo and tagline — fade in after the boot crawl collapses */}
          <div className="title-wrap">
            <div className={'title '+(titleIn?'in':'')}>D A W</div>
            <div className={'subtitle '+(titleIn?'in':'')}>
              DEFENDING<span className="pipe">|</span>A<span className="pipe">|</span>WORKSTATION
            </div>
          </div>

          {/* Animated title-screen scene (sprite art) */}
          <div className="scene-wrap">
            <Scene/>
          </div>

          {/* Main menu grid — each item highlights on hover and confirms on click */}
          <div className="menu-wrap">
            <div className={'menu '+(menuIn?'in':'')}>
              <div className="legend">▣ COMMAND &middot; {playerName}</div>
              <div className="menu-grid">
                {menuItems.map((m,i)=>{
                  const disabled = (m.id === 'continue' && !hasSave);
                  return (
                    <div key={m.id}
                      className={'menu-item '+(i===sel?'sel ':'')+(disabled?'disabled':'')}
                      onMouseEnter={()=>{ if(i!==sel){ setSel(i); blip(540);} }}
                      onClick={()=>openItem(m.id)}>
                      <span className="cursor">▶</span>
                      <span>{m.label}</span>
                    </div>
                  );
                })}
              </div>
              {/* Description bar — shows the highlighted item's description */}
              <div style={{
                marginTop:14, paddingTop:10,
                borderTop:'2px solid rgba(254,250,224,.25)',
                fontFamily:"'VT323', monospace", fontSize:18,
                color:'rgba(254,250,224,.78)', minHeight:24,
                letterSpacing:'.03em'
              }}>
                {menuIn && menuItems[sel] ? '> '+menuItems[sel].desc : '> AWAITING INPUT...'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer hint bar — always visible, shows keyboard shortcuts */}
        <div className="footer">
          <div className="keys">
            <span><b>↑↓←→</b> SELECT</span>
            <span><b>⏎</b> CONFIRM</span>
            <span><b>ESC</b> BACK</span>
            <span><b>♪</b> AUDIO</span>
          </div>
          <div>SIGNED IN AS <b style={{color:'var(--fg)'}}>{playerName}</b> &middot; © 2026 MIPMIP COMPANY</div>
        </div>

        {/* Overlay dialog — confirmation prompts (new game, logout, etc.) */}
        {overlay && (
          <div className="overlay" onClick={(e)=>{ if(e.target===e.currentTarget){ blip(360); setOverlay(null);} }}>
            <div className="dialog">
              <h3>▣ {overlay.title}</h3>
              <p style={{whiteSpace:'pre-wrap'}}>{overlay.body.replace(/\\n/g,'\n')}</p>
              <div className="row" style={{flexWrap:'wrap'}}>
                {overlay.choices.map((c,i)=>(
                  <button key={i}
                    className={i===overlaySel?'sel':''}
                    onMouseEnter={()=>{ if(i!==overlaySel){ setOverlaySel(i); blip(540);} }}
                    onClick={()=>{
                      if(overlay.actions && overlay.actions[i]) overlay.actions[i]();
                      else { blip(960); setOverlay(null); }
                    }}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Route-independent unlock toasts — capture keyboard regardless of route.
            World toast only shows when no hero toast is queued (they don't stack). */}
        {heroUnlockToast && (
          <UnlockToast
            title="NEW HERO UNLOCKED"
            primary={heroUnlockToast.name}
            body="Added to your roster. Assign via PARTY / HEROES."
            kind="hero"
            blip={blip}
            onDismiss={()=>{ setHeroUnlockToast(null); blip(540); }} />
        )}
        {worldUnlockToast && !heroUnlockToast && (
          <UnlockToast
            title="NEW WORLD UNLOCKED"
            primary={worldUnlockToast.world.name}
            body={`${worldUnlockToast.world.sub}\nSwitch via the world bar above the map (or TAB).`}
            kind="world"
            blip={blip}
            onDismiss={()=>{ setWorldUnlockToast(null); blip(540); }} />
        )}

        {/* DEV MODE custom intro overlay — shown once at playtest start */}
        {devIntro !== null && (
          <DevIntroOverlay text={devIntro} blip={blip} onDismiss={dismissDevIntro} />
        )}

        {/* Tweaks Panel */}
      </div>
    </div>
  );
}

// Mount the App component into the #root DOM element.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
