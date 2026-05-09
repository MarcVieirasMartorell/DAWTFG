// daw-admin.jsx — Admin panel: user management + sprite editor.
// Only accessible when account.isAdmin === true.
//
// The file is structured in three major layers:
//   1. Small shared UI primitives (StatPill, Section, Row, AdminBtn).
//   2. UserDetail — right-hand detail pane for a single selected user,
//      including wallet editor, admin-flag toggle, and account seeding.
//   3. SpriteEditorPanel — full sprite + stats override editor for every
//      base-game hero and enemy, backed by DAW_API.getSprites / updateSprites.
//   4. AdminPage — top-level shell that owns the two-tab layout (USERS /
//      SPRITES) and the filterable user list in the left sidebar.
//
// All API mutations go through DAW_API; blip() plays a confirmation tone.

const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA, useRef: useRefA } = React;

// ── Helpers ───────────────────────────────────────────────────────────────

// Formats a date value as a locale date string, returning '—' for falsy input.
function fmt(dt){ if(!dt) return '—'; return new Date(dt).toLocaleDateString(); }

// Formats a date value as a full locale date+time string, returning '—' for falsy input.
function fmtTime(dt){ if(!dt) return '—'; return new Date(dt).toLocaleString(); }

// ── Stat pill ─────────────────────────────────────────────────────────────

// Renders a small metric tile with a large value and a tiny label below it.
// Pass highlight=true to make the value glow with the bright accent colour.
function StatPill({ label, value, highlight }){
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      padding:'8px 14px', background:'rgba(0,0,0,.35)',
      border:'1px solid rgba(254,250,224,.2)',
      minWidth:80,
    }}>
      <div style={{fontFamily:"'VT323',monospace", fontSize:22,
        color: highlight ? 'var(--fg-bright)' : 'var(--cream)',
        textShadow: highlight ? '0 0 10px rgba(212,244,163,.4)' : 'none' }}>
        {value ?? '—'}
      </div>
      <div style={{fontSize:8, color:'rgba(254,250,224,.5)', letterSpacing:'.1em'}}>{label}</div>
    </div>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────

// Displays full account info for a single user and exposes admin mutation actions
// (wallet set, admin flag toggle, seed/unlock-all). Fetches fresh data from the
// API whenever userId changes.
function UserDetail({ userId, requesterId, blip, onRefreshList }){
  const [state,   setState]   = useStateA(null);    // full user object returned by adminGetUser
  const [loading, setLoading] = useStateA(true);
  const [saving,  setSaving]  = useStateA(false);
  const [msg,     setMsg]     = useStateA('');      // status message shown in the Actions section
  const [walletInput, setWalletInput] = useStateA('');
  const msgTimer = useRefA(null);                   // holds the auto-clear timeout handle

  // Shows a temporary status message that auto-dismisses after 3 seconds.
  function flash(text, ok=true){
    setMsg({ text, ok });
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(()=>setMsg(''), 3000);
  }

  // Fetches user data whenever the selected userId changes; resets local state first.
  useEffectA(()=>{
    if(!userId) return;
    setLoading(true); setState(null); setMsg('');
    DAW_API.adminGetUser(userId, requesterId)
      .then(s => {
        setState(s);
        // Pre-populate the wallet input with the loaded value so the field isn't blank.
        setWalletInput(String(s.progress?.wallet ?? 0));
      })
      .catch(()=>flash('Failed to load user.', false))
      .finally(()=>setLoading(false));
  }, [userId, requesterId]);

  // Sends an arbitrary partial-update payload to the API then refreshes local state.
  // label is displayed as the success message; blip tones differ for success vs error.
  const patch = useCallbackA(async (data, label)=>{
    setSaving(true);
    try {
      const updated = await DAW_API.adminUpdateUser(userId, requesterId, data);
      setState(updated);
      // Keep the wallet input in sync with whatever the server confirmed.
      setWalletInput(String(updated.progress?.wallet ?? 0));
      onRefreshList && onRefreshList();
      flash(label + ' — done.');
      blip && blip(960);   // high-pitched success tone
    } catch(e){
      flash('Error: ' + (e.message || 'unknown'), false);
      blip && blip(220);   // low-pitched error tone
    } finally {
      setSaving(false);
    }
  }, [userId, requesterId, blip, onRefreshList]);

  // Empty-selection placeholder shown when no user is selected in the list.
  if(!userId) return (
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      color:'rgba(254,250,224,.35)', fontFamily:"'VT323',monospace", fontSize:20,
      letterSpacing:'.06em'}}>
      SELECT A USER
    </div>
  );

  // Loading state while the API call is in flight.
  if(loading) return (
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--fg-dim)', fontFamily:"'VT323',monospace", fontSize:18}}>
      LOADING...
    </div>
  );

  // Fallback if the API returned nothing (e.g. deleted account).
  if(!state) return (
    <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--bad)', fontFamily:"'VT323',monospace", fontSize:18}}>
      USER NOT FOUND
    </div>
  );

  // Destructure the server payload into named locals for cleaner JSX below.
  const { account, progress } = state;
  const clears   = state.clears   || [];
  const heroes   = state.unlockedHeroes || [];
  const worlds   = state.worldsUnlocked || [];
  const inv      = state.inventory || {};
  const party    = state.party     || [];

  return (
    <div style={{flex:1, overflowY:'auto', padding:'18px 22px',
      fontFamily:"'Press Start 2P',monospace", color:'var(--cream)'}}>
      {/* Header — username, optional ADMIN badge, and numeric ID */}
      <div style={{display:'flex', alignItems:'baseline', gap:14, marginBottom:18, flexWrap:'wrap'}}>
        <div style={{fontSize:16, color:'var(--fg-bright)',
          textShadow:'0 0 10px rgba(212,244,163,.4)'}}>
          {account.username}
        </div>
        {account.isAdmin && (
          <span style={{fontSize:8, letterSpacing:'.14em',
            background:'var(--hl)', color:'var(--bg-0)', padding:'3px 8px'}}>
            ADMIN
          </span>
        )}
        <div style={{fontSize:9, color:'rgba(254,250,224,.5)', letterSpacing:'.08em', marginLeft:'auto'}}>
          ID #{account.id}
        </div>
      </div>

      <Section label="IDENTITY">
        <Row label="EMAIL" value={account.email || '(none)'} />
        <Row label="CREATED" value={fmtTime(account.createdAt)} />
        <Row label="LAST LOGIN" value={fmtTime(account.lastLogin)} />
      </Section>

      <Section label="PROGRESS">
        {/* Quick-glance stat pills for the most important numeric counters */}
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:10}}>
          <StatPill label="WALLET" value={progress?.wallet ?? 0} highlight />
          <StatPill label="CLEARS" value={clears.length} />
          <StatPill label="HEROES" value={heroes.length} />
          <StatPill label="WORLDS" value={worlds.length} />
        </div>
        <Row label="WORLD" value={progress?.currentWorldId || '—'} />
        <Row label="HAS SAVE" value={progress?.hasSave ? 'YES' : 'NO'} />
        <Row label="PARTY" value={party.join(', ') || '—'} />
      </Section>

      <Section label="INVENTORY">
        {/* Render each inventory entry as a "key: count" chip, or show an empty notice. */}
        {Object.keys(inv).length === 0
          ? <div style={{fontFamily:"'VT323',monospace", fontSize:16,
              color:'rgba(254,250,224,.4)'}}>empty</div>
          : <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {Object.entries(inv).map(([k,v])=>(
                <span key={k} style={{fontFamily:"'VT323',monospace", fontSize:16,
                  background:'rgba(0,0,0,.4)', border:'1px solid rgba(254,250,224,.2)',
                  padding:'2px 8px', color:'var(--cream)'}}>
                  {k}: {v}
                </span>
              ))}
            </div>
        }
      </Section>

      <Section label="ACTIONS">
        {/* Temporary status/error message rendered above the action controls */}
        {msg && (
          <div style={{
            fontFamily:"'VT323',monospace", fontSize:17,
            color: msg.ok ? 'var(--fg-bright)' : 'var(--bad)',
            marginBottom:12, letterSpacing:'.04em',
          }}>
            {msg.ok ? '> ' : '! '}{msg.text}
          </div>
        )}

        {/* Wallet editor — strips non-digits and caps at 8 characters client-side */}
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
          <div style={{fontSize:9, color:'rgba(254,250,224,.6)', letterSpacing:'.1em', width:70}}>WALLET</div>
          <input
            value={walletInput}
            onChange={e=>setWalletInput(e.target.value.replace(/\D/g,'').slice(0,8))}
            style={{
              background:'rgba(0,0,0,.5)', border:'2px solid rgba(254,250,224,.4)',
              color:'var(--cream)', fontFamily:"'VT323',monospace", fontSize:18,
              padding:'4px 10px', width:120, letterSpacing:'.04em', outline:'none',
            }}
          />
          <AdminBtn disabled={saving} onClick={()=>patch({ wallet: parseInt(walletInput,10)||0 }, 'Wallet updated')}>
            SET WALLET
          </AdminBtn>
        </div>

        {/* Admin flag toggle — button label and patch payload flip based on current status */}
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
          <div style={{fontSize:9, color:'rgba(254,250,224,.6)', letterSpacing:'.1em', width:70}}>ADMIN</div>
          <div style={{fontFamily:"'VT323',monospace", fontSize:16, color:'var(--cream)',
            background:'rgba(0,0,0,.35)', border:'1px solid rgba(254,250,224,.2)',
            padding:'4px 10px', minWidth:60, textAlign:'center'}}>
            {account.isAdmin ? 'YES' : 'NO'}
          </div>
          <AdminBtn disabled={saving} onClick={()=>patch({ isAdmin: !account.isAdmin },
            account.isAdmin ? 'Admin revoked' : 'Admin granted')}>
            {account.isAdmin ? 'REVOKE ADMIN' : 'GRANT ADMIN'}
          </AdminBtn>
        </div>

        {/* Seed action — unlocks all heroes, worlds, items, and sets wallet to max */}
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <div style={{fontSize:9, color:'rgba(254,250,224,.6)', letterSpacing:'.1em', width:70}}>SEED</div>
          <AdminBtn disabled={saving} danger
            onClick={()=>patch({ seed: true }, 'Account seeded (all unlocked)')}>
            UNLOCK EVERYTHING
          </AdminBtn>
          <div style={{fontFamily:"'VT323',monospace", fontSize:14,
            color:'rgba(254,250,224,.4)'}}>
            gives all heroes, worlds, items, 99999¥
          </div>
        </div>
      </Section>
    </div>
  );
}

// Renders a labelled section block with a dashed divider — purely a layout wrapper.
function Section({ label, children }){
  return (
    <div style={{marginBottom:20}}>
      <div style={{
        fontSize:8, letterSpacing:'.2em', color:'rgba(254,250,224,.5)',
        borderBottom:'1px dashed rgba(254,250,224,.2)',
        paddingBottom:6, marginBottom:10,
      }}>▸ {label}</div>
      {children}
    </div>
  );
}

// Renders a single label/value data row with a thin separator line below it.
function Row({ label, value }){
  return (
    <div style={{display:'flex', gap:10, padding:'4px 0',
      borderBottom:'1px solid rgba(254,250,224,.08)', alignItems:'baseline'}}>
      <div style={{fontSize:8, color:'rgba(254,250,224,.45)', letterSpacing:'.1em', width:80, flexShrink:0}}>
        {label}
      </div>
      <div style={{fontFamily:"'VT323',monospace", fontSize:16, color:'var(--cream)',
        letterSpacing:'.04em', wordBreak:'break-all'}}>
        {value}
      </div>
    </div>
  );
}

// A styled action button; pass danger=true for a red destructive variant.
// Hover swaps the fill colour to give clear visual feedback without a CSS file.
function AdminBtn({ children, onClick, disabled, danger }){
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance:'none', background:'transparent',
        border:`2px solid ${danger ? 'var(--bad)' : 'var(--cream)'}`,
        color: danger ? 'var(--bad)' : 'var(--cream)',
        fontFamily:"'Press Start 2P',monospace", fontSize:9,
        letterSpacing:'.1em', padding:'6px 12px',
        cursor: disabled ? 'not-allowed' : 'default',
        opacity: disabled ? .5 : 1,
        transition:'background .12s, color .12s',
      }}
      // Inline hover handlers are used because there is no attached CSS file for admin UI.
      onMouseEnter={e=>{
        if(disabled) return;
        e.currentTarget.style.background = danger ? 'var(--bad)' : 'var(--cream)';
        e.currentTarget.style.color = 'var(--bg-0)';
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = danger ? 'var(--bad)' : 'var(--cream)';
      }}>
      {children}
    </button>
  );
}

// ── Sprite panel helpers ──────────────────────────────────────────────────

// Renders a small preview SVG of a sprite grid using the shared BSprite renderer.
// Scales the sprite down to fit within a fixed 32×36 px thumbnail bounding box.
function AdminSpriteSvg({ sprite, palette }){
  const BS = window.BSprite;
  if (!BS || !sprite || !sprite.length) return null;
  const cols = sprite[0].length, rows = sprite.length;
  const maxW = 32, maxH = 36;
  // Pick the largest integer scale factor that fits both axes inside the bounding box.
  const sc = Math.max(1, Math.min(Math.floor(maxW / cols), Math.floor(maxH / rows)));
  const w = cols * sc, h = rows * sc;
  return (
    <svg width={maxW} height={maxH} viewBox={`0 0 ${maxW} ${maxH}`} shapeRendering="crispEdges">
      <BS grid={sprite} scale={sc}
        x={Math.round((maxW - w) / 2)} y={Math.round((maxH - h) / 2)}
        body={palette.body} rim={palette.rim} dark={palette.dark}
        acc={palette.acc} eye={palette.eye} />
    </svg>
  );
}

// Merges the base hero definition with any server overrides into a flat working copy
// that the sprite editor can mutate freely without touching the canonical base data.
function buildHeroCopy(id, def, ov){
  // Use the pre-mutation snapshot so applySprites can't corrupt the base reference.
  const base = window.HERO_SPRITES_BASE?.[id] || def.sprite || [];
  const ovGrid = (ov.grid && ov.grid.length > 0) ? ov.grid : null;
  // Only keep server override if it matches the original base dimensions exactly.
  const useOvGrid = ovGrid && base.length > 0 &&
    ovGrid.length === base.length && ovGrid[0]?.length === base[0]?.length;
  return {
    id,
    name: id,
    sprite: useOvGrid ? ovGrid : base,
    palette: {
      body: ov.body || def.body || '#333333',
      rim:  ov.rim  || def.rim  || '#ffffff',
      dark: ov.dark || def.dark || '#111111',
      acc:  ov.acc  || def.acc  || '#ffffff',
      eye:  ov.eye  || def.eye  || '#ffffff',
    },
    role:      ov.role      || def.role      || '',
    bio:       ov.bio       || def.bio       || '',
    hpMax:     ov.hpMax     || def.hpMax     || 200,
    cpuMax:    ov.cpuMax    || def.cpuMax    || 60,
    spd:       ov.spd       || def.spd       || 1.0,
    atk:       ov.atk       || def.atk       || [20, 32],
    limitName: ov.limitName || def.limitName || '',
    limitDesc: ov.limitDesc || def.limitDesc || '',
    abilities: ov.scripts   || def.scripts   || [],
  };
}

// Merges the base enemy definition with any server overrides into a flat working copy,
// following the same dimension-guard logic as buildHeroCopy.
function buildEnemyCopy(id, def, ov){
  // Use the pre-mutation snapshot so applySprites can't corrupt the base reference.
  const base = window.ENEMY_GRIDS_BASE?.[id] || def.grid || [];
  const ovGrid = (ov.grid && ov.grid.length > 0) ? ov.grid : null;
  // Only keep server override if it matches the original base dimensions exactly.
  const useOvGrid = ovGrid && base.length > 0 &&
    ovGrid.length === base.length && ovGrid[0]?.length === base[0]?.length;
  return {
    id,
    name: id,
    sprite: useOvGrid ? ovGrid : base,
    palette: {
      body: ov.body || def.body || '#333333',
      rim:  ov.rim  || def.rim  || '#ffffff',
      dark: ov.dark || def.dark || '#111111',
      acc:  ov.acc  || def.acc  || '#ffffff',
      eye:  ov.eye  || def.eye  || '#ffffff',
    },
    hp:  ov.hp  || def.hp  || 80,
    dmg: ov.dmg || def.dmg || [10, 16],
    spd: ov.spd || def.spd || 1.0,
    xp:  ov.xp  || def.xp  || 20,
    attacks: ov.attacks || def.attacks || [],
  };
}

// ── Sprite editor panel ───────────────────────────────────────────────────

// Full sprite + stats override editor for every base-game hero and enemy.
// Maintains a keyed copies map (e.g. "hero:Kira", "enemy:Slime") so edits to
// one entity don't affect others. Pushes the entire overrides object to the
// server in a single call when the admin clicks "PUSH ALL CHANGES".
// On mobile (isMobile=true) uses a two-stage flow: entity list → full-screen editor.
function SpriteEditorPanel({ account, blip, isMobile }){
  const ALL_HEROES  = Object.keys(HEROES_DEF);
  const ALL_ENEMIES = Object.keys(ENEMY_KINDS);

  const [copies,      setCopies]      = useStateA(null);
  const [sel,         setSel]         = useStateA({ kind:'hero', name: ALL_HEROES[0] });
  const [saving,      setSaving]      = useStateA(false);
  const [msg,         setMsg]         = useStateA('');
  const [mobileStage, setMobileStage] = useStateA('list'); // 'list' | 'editor' — mobile only
  const msgTimer = useRefA(null);

  // Shows a temporary status message that auto-dismisses after 4 seconds.
  function flash(text, ok=true){
    setMsg({ text, ok });
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(()=>setMsg(''), 4000);
  }

  // Builds the full copies map from base definitions + optional server overrides.
  function initCopies(serverOv){
    const ov = serverOv || { heroes:{}, enemies:{} };
    const c = {};
    ALL_HEROES.forEach(id => {
      c[`hero:${id}`] = buildHeroCopy(id, HEROES_DEF[id] || {}, ov.heroes?.[id] || {});
    });
    ALL_ENEMIES.forEach(id => {
      c[`enemy:${id}`] = buildEnemyCopy(id, ENEMY_KINDS[id] || {}, ov.enemies?.[id] || {});
    });
    return c;
  }

  // On mount, fetch existing server overrides and initialise the copies map;
  // falls back to pure base definitions if the fetch fails.
  useEffectA(()=>{
    DAW_API.getSprites()
      .then(data => setCopies(initCopies(data)))
      .catch(()  => setCopies(initCopies(null)));
  }, []);

  // Composite key used to look up / write the currently selected entity in copies.
  const selKey = `${sel.kind}:${sel.name}`;
  const wc = copies?.[selKey] || null;   // working copy for the selected entity

  // Immutably updates only the selected entity's entry in the copies map.
  function updateWc(next){ setCopies(prev => ({ ...prev, [selKey]: next })); }

  // Resets the selected entity back to its unmodified base definition (clears overrides).
  function handleReset(){
    if (sel.kind === 'hero'){
      setCopies(prev => ({ ...prev, [selKey]: buildHeroCopy(sel.name, HEROES_DEF[sel.name] || {}, {}) }));
    } else {
      setCopies(prev => ({ ...prev, [selKey]: buildEnemyCopy(sel.name, ENEMY_KINDS[sel.name] || {}, {}) }));
    }
    blip && blip(360);
  }

  // Serialises all working copies into the overrides shape, POSTs to the server,
  // then calls window.applySprites so changes are visible immediately without a reload.
  async function handleSave(){
    if (!copies) return;
    setSaving(true);
    try {
      // Build the flat override payload from every hero and enemy working copy.
      const overrides = { heroes:{}, enemies:{} };
      ALL_HEROES.forEach(id => {
        const c = copies[`hero:${id}`]; if (!c) return;
        overrides.heroes[id] = {
          grid: c.sprite,
          body: c.palette.body, rim: c.palette.rim, dark: c.palette.dark,
          acc:  c.palette.acc,  eye: c.palette.eye,
          role: c.role, bio: c.bio,
          hpMax: c.hpMax, cpuMax: c.cpuMax, spd: c.spd, atk: c.atk,
          limitName: c.limitName, limitDesc: c.limitDesc,
          scripts: c.abilities,
        };
      });
      ALL_ENEMIES.forEach(id => {
        const c = copies[`enemy:${id}`]; if (!c) return;
        overrides.enemies[id] = {
          grid: c.sprite,
          body: c.palette.body, rim: c.palette.rim, dark: c.palette.dark,
          acc:  c.palette.acc,  eye: c.palette.eye,
          hp: c.hp, dmg: c.dmg, spd: c.spd, xp: c.xp, attacks: c.attacks,
        };
      });
      await DAW_API.updateSprites(account.id, overrides);
      // Hot-apply overrides to the running game without waiting for a page reload.
      window.applySprites && window.applySprites(overrides);
      flash('Changes pushed — active on next page load.');
      blip && blip(960);
    } catch(e){
      flash('Save failed: ' + (e.message || 'unknown'), false);
      blip && blip(220);
    } finally {
      setSaving(false);
    }
  }

  // A single clickable row in the list; shows a tiny sprite preview and the entity name.
  // On mobile, selecting also advances to the editor stage.
  function SideRow({ kind, name }){
    const isSelected = sel.kind === kind && sel.name === name;
    const wc = copies?.[`${kind}:${name}`];
    return (
      <div onClick={()=>{ setSel({ kind, name }); blip && blip(540); if(isMobile) setMobileStage('editor'); }}
        style={{
          padding:'6px 10px', cursor:'default',
          background: isSelected ? 'var(--jrpg-blue)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--fg-bright)' : '3px solid transparent',
          borderBottom:'1px solid rgba(254,250,224,.06)',
          display:'flex', alignItems:'center', gap:8,
        }}>
        <div style={{flexShrink:0, lineHeight:0, width:32}}>
          {wc ? <AdminSpriteSvg sprite={wc.sprite} palette={wc.palette} /> : null}
        </div>
        <div style={{
          fontFamily:"'VT323',monospace", fontSize:13, letterSpacing:'.04em',
          color: isSelected ? 'var(--fg-bright)' : 'var(--cream)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:'1 1 auto',
        }}>{name}</div>
      </div>
    );
  }

  // ── Mobile: entity list ──
  if(isMobile && mobileStage === 'list'){
    return (
      <div style={{flex:1, overflowY:'auto'}}>
        {!copies && (
          <div style={{padding:'24px', fontFamily:"'VT323',monospace", fontSize:18,
            color:'var(--fg-dim)', textAlign:'center', letterSpacing:'.06em'}}>
            LOADING...
          </div>
        )}
        {copies && (<>
          <div style={{
            padding:'7px 14px', fontSize:8, letterSpacing:'.18em',
            color:'rgba(254,250,224,.4)', borderBottom:'1px solid rgba(254,250,224,.1)',
            background:'rgba(0,0,0,.2)', fontFamily:"'Press Start 2P',monospace",
          }}>HEROES</div>
          {ALL_HEROES.map(n => <SideRow key={n} kind="hero" name={n} />)}
          <div style={{
            padding:'7px 14px', fontSize:8, letterSpacing:'.18em',
            color:'rgba(254,250,224,.4)', borderBottom:'1px solid rgba(254,250,224,.1)',
            borderTop:'2px solid var(--bg-2)', background:'rgba(0,0,0,.2)',
            fontFamily:"'Press Start 2P',monospace",
          }}>ENEMIES</div>
          {ALL_ENEMIES.map(n => <SideRow key={n} kind="enemy" name={n} />)}
        </>)}
      </div>
    );
  }

  // ── Mobile: full-screen editor ──
  if(isMobile && mobileStage === 'editor'){
    return (
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
        {/* Back bar */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
          borderBottom:'2px solid var(--bg-2)', flexShrink:0, flexWrap:'wrap',
          background:'rgba(0,0,0,.2)',
        }}>
          <AdminBtn onClick={()=>{ setMobileStage('list'); blip && blip(360); }}>← LIST</AdminBtn>
          {wc && (
            <div style={{fontFamily:"'Press Start 2P',monospace", fontSize:9,
              color:'var(--fg-bright)', letterSpacing:'.08em',
              flex:'1 1 auto', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {sel.kind === 'hero' ? '▣' : '⚠'} {sel.name}
            </div>
          )}
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginLeft:'auto'}}>
            {wc && <AdminBtn onClick={handleReset}>RESET</AdminBtn>}
            <AdminBtn disabled={saving || !copies} onClick={handleSave}>
              {saving ? 'SAVING…' : 'PUSH CHANGES'}
            </AdminBtn>
          </div>
        </div>
        {msg && (
          <div style={{
            padding:'6px 14px', flexShrink:0,
            fontFamily:"'VT323',monospace", fontSize:15, letterSpacing:'.04em',
            color: msg.ok ? 'var(--fg-bright)' : '#ff8aa0',
            borderBottom:'1px solid rgba(254,250,224,.1)',
          }}>
            {msg.ok ? '> ' : '! '}{msg.text}
          </div>
        )}
        {!copies && (
          <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'VT323',monospace", fontSize:18, color:'var(--fg-dim)'}}>
            LOADING...
          </div>
        )}
        {copies && wc && (
          <div style={{flex:1, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:14}}>
            <div className="dv-card" style={{flexShrink:0, overflowX:'auto'}}>
              <div className="dv-leg">▣ SPRITE</div>
              <SpriteEditor
                key={selKey}
                sprite={wc.sprite} palette={wc.palette}
                cols={wc.sprite[0]?.length || 16} rows={wc.sprite.length || 18}
                onSprite={(grid) => updateWc({ ...wc, sprite: grid })}
                onPalette={(pal)  => updateWc({ ...wc, palette: pal })}
              />
            </div>
            <div className="dv-card" style={{flexShrink:0}}>
              {sel.kind === 'hero' ? (
                <div className="dv-stats">
                  <HeroAbilitiesForm abilities={wc.abilities}
                    onChange={(arr) => updateWc({ ...wc, abilities: arr })} />
                  <HeroStatsBlocks hero={wc} onChange={updateWc} />
                </div>
              ) : (
                <div className="dv-stats">
                  <EnemyAttacksForm attacks={wc.attacks}
                    onChange={(arr) => updateWc({ ...wc, attacks: arr })} />
                  <EnemyStatsBlocks enemy={wc} onChange={updateWc} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: original two-panel layout ──
  return (
    <div style={{flex:1, display:'flex', minHeight:0}}>

      {/* Sidebar — scrollable list of heroes then enemies, each as a SideRow */}
      <div style={{
        width:240, borderRight:'2px solid var(--bg-2)',
        display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0,
      }}>
        <div style={{
          padding:'7px 14px', fontSize:8, letterSpacing:'.18em',
          color:'rgba(254,250,224,.4)', borderBottom:'1px solid rgba(254,250,224,.1)',
          background:'rgba(0,0,0,.2)', flexShrink:0, fontFamily:"'Press Start 2P',monospace",
        }}>HEROES</div>
        {ALL_HEROES.map(n => <SideRow key={n} kind="hero" name={n} />)}

        <div style={{
          padding:'7px 14px', fontSize:8, letterSpacing:'.18em',
          color:'rgba(254,250,224,.4)', borderBottom:'1px solid rgba(254,250,224,.1)',
          borderTop:'2px solid var(--bg-2)', background:'rgba(0,0,0,.2)', flexShrink:0,
          fontFamily:"'Press Start 2P',monospace",
        }}>ENEMIES</div>
        {ALL_ENEMIES.map(n => <SideRow key={n} kind="enemy" name={n} />)}
      </div>

      {/* Main area — toolbar + optional status message + editor cards */}
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>

        {/* Toolbar — entity name badge on the left, RESET and PUSH buttons on the right */}
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
          borderBottom:'2px solid var(--bg-2)', flexShrink:0, flexWrap:'wrap',
        }}>
          {wc && (
            <div style={{fontFamily:"'Press Start 2P',monospace", fontSize:10,
              color:'var(--fg-bright)', letterSpacing:'.08em',
              textShadow:'0 0 8px rgba(212,244,163,.3)'}}>
              {sel.kind === 'hero' ? '▣' : '⚠'} {sel.name}
            </div>
          )}
          <div style={{marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap'}}>
            {wc && <AdminBtn onClick={handleReset}>RESET TO BASE</AdminBtn>}
            <AdminBtn disabled={saving || !copies} onClick={handleSave}>
              {saving ? 'SAVING...' : '▣ PUSH ALL CHANGES'}
            </AdminBtn>
          </div>
        </div>

        {/* Transient status/error message bar */}
        {msg && (
          <div style={{
            padding:'6px 16px', flexShrink:0,
            fontFamily:"'VT323',monospace", fontSize:16, letterSpacing:'.04em',
            color: msg.ok ? 'var(--fg-bright)' : '#ff8aa0',
            borderBottom:'1px solid rgba(254,250,224,.1)',
          }}>
            {msg.ok ? '> ' : '! '}{msg.text}
          </div>
        )}

        {/* Full-panel loading placeholder while copies are initialising */}
        {!copies && (
          <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'VT323',monospace", fontSize:20, color:'var(--fg-dim)', letterSpacing:'.06em'}}>
            LOADING...
          </div>
        )}

        {/* Editor area: sprite canvas card on the left, stats card on the right */}
        {copies && wc && (
          <div style={{flex:1, minHeight:0, display:'flex', gap:18, padding:18, overflow:'hidden'}}>

            {/* Sprite canvas card — shrinks to content width */}
            <div className="dv-card" style={{flexShrink:0, overflow:'auto', alignSelf:'flex-start'}}>
              <div className="dv-leg">▣ SPRITE</div>
              <SpriteEditor
                key={selKey}
                sprite={wc.sprite}
                palette={wc.palette}
                cols={wc.sprite[0]?.length || 16}
                rows={wc.sprite.length || 18}
                onSprite={(grid) => updateWc({ ...wc, sprite: grid })}
                onPalette={(pal)  => updateWc({ ...wc, palette: pal })}
              />
            </div>

            {/* Stats card — fills remaining width; heroes show abilities + stats, enemies show attacks + stats */}
            <div className="dv-card" style={{flex:'1 1 0', minWidth:0, overflow:'auto'}}>
              {sel.kind === 'hero' ? (
                <div className="dv-stats">
                  <HeroAbilitiesForm
                    abilities={wc.abilities}
                    onChange={(arr) => updateWc({ ...wc, abilities: arr })}
                  />
                  <HeroStatsBlocks hero={wc} onChange={updateWc} />
                </div>
              ) : (
                <div className="dv-stats">
                  <EnemyAttacksForm
                    attacks={wc.attacks}
                    onChange={(arr) => updateWc({ ...wc, attacks: arr })}
                  />
                  <EnemyStatsBlocks enemy={wc} onChange={updateWc} />
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────

// Top-level admin shell. Renders a two-tab layout: USERS (searchable list + detail pane)
// and SPRITES (the SpriteEditorPanel). Guards against non-admin access via the caller
// (this component assumes account.isAdmin is already verified before mounting).
function AdminPage({ blip, account, onExit }){
  const [page,       setPage]       = useStateA('users');  // active tab: 'users' | 'sprites'
  const [users,      setUsers]      = useStateA([]);
  const [selUser,    setSelUser]    = useStateA(null);     // id of the selected user in the list
  const [loading,    setLoading]    = useStateA(true);
  const [search,     setSearch]     = useStateA('');       // live filter string for the user list
  const [mobilePane, setMobilePane] = useStateA('list');   // 'list' | 'detail' — mobile USERS tab only
  const isMobile = window.innerWidth <= 760;

  // Fetches the full user list from the API and stores it in state.
  function loadUsers(){
    setLoading(true);
    DAW_API.adminGetUsers(account.id)
      .then(u => { setUsers(u); setLoading(false); })
      .catch(()=>{ setLoading(false); });
  }

  // Load users once on mount (account.id is stable for the lifetime of the admin session).
  useEffectA(()=>{ loadUsers(); }, [account.id]);

  // ESC exits back to the title menu.
  useEffectA(()=>{
    function onKey(e){ if(e.key==='Escape'){ blip && blip(360); onExit(); } }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [blip, onExit]);

  // Filter the user list by username (case-insensitive substring) or email address.
  const filtered = users.filter(u =>
    u.username.includes(search.toUpperCase()) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  // Factory that produces a styled tab button; highlights when its id matches the active page.
  // Switching tabs resets mobilePane to 'list' so the editor is never left open on the wrong tab.
  const TAB_BTN = (id, label) => (
    <button key={id}
      onClick={()=>{ setPage(id); setMobilePane('list'); blip && blip(540); }}
      style={{
        appearance:'none',
        background: page === id ? 'var(--cream)' : 'transparent',
        color: page === id ? 'var(--jrpg-blue)' : 'var(--cream)',
        border:'2px solid var(--cream)',
        fontFamily:"'Press Start 2P',monospace", fontSize:9,
        letterSpacing:'.12em', padding:'6px 14px', cursor:'default',
        transition:'background .12s, color .12s',
      }}>
      {label}
    </button>
  );

  return (
    <div style={{
      position:'absolute', inset:0,
      display:'flex', flexDirection:'column',
      background:'var(--bg-0)', zIndex:5,
      fontFamily:"'Press Start 2P',monospace",
    }}>
      {/* Top bar — back button, ADMIN PANEL title, page tabs, and (desktop-only) signed-in badge */}
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'8px 16px',
        borderBottom:'2px solid var(--bg-2)',
        background:'linear-gradient(to bottom,var(--bg-1),var(--bg-0))',
        flexShrink:0, flexWrap:'wrap',
      }}>
        <button className="daw-back-btn" onClick={()=>{ blip && blip(360); onExit(); }}>
          ← BACK
        </button>
        <div style={{fontSize:11, color:'var(--fg-bright)', letterSpacing:'.12em',
          textShadow:'0 0 8px rgba(212,244,163,.3)'}}>
          ADMIN PANEL
        </div>
        {/* Page tabs */}
        <div style={{display:'flex', gap:4, marginLeft:8}}>
          {TAB_BTN('users',   '▸ USERS')}
          {TAB_BTN('sprites', '▸ SPRITES')}
        </div>
        {!isMobile && (
          <div style={{marginLeft:'auto', fontSize:9, color:'var(--fg-dim)', letterSpacing:'.06em'}}>
            SIGNED IN AS <span style={{color:'var(--hl)'}}>{account.username}</span>
          </div>
        )}
      </div>

      {/* Body — conditionally renders either the USERS or SPRITES tab */}
      <div style={{flex:1, display:'flex', minHeight:0}}>

        {/* ── USERS page ── */}
        {page === 'users' && (<>

          {/* Mobile detail view: full-screen UserDetail with a ← LIST back bar */}
          {isMobile && mobilePane === 'detail' ? (
            <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
              <div style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
                borderBottom:'2px solid var(--bg-2)', flexShrink:0,
                background:'rgba(0,0,0,.2)',
              }}>
                <AdminBtn onClick={()=>{ setMobilePane('list'); blip && blip(360); }}>← LIST</AdminBtn>
              </div>
              <UserDetail
                userId={selUser}
                requesterId={account.id}
                blip={blip}
                onRefreshList={loadUsers}
              />
            </div>
          ) : (<>

            {/* User list — full width on mobile, fixed 260px sidebar on desktop */}
            <div style={{
              flex: isMobile ? '1 1 auto' : '0 0 260px',
              borderRight: isMobile ? 'none' : '2px solid var(--bg-2)',
              display:'flex', flexDirection:'column', overflow:'hidden',
            }}>
              <div style={{padding:'10px 12px', borderBottom:'1px solid var(--bg-2)', flexShrink:0}}>
                <input
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="search users..."
                  style={{
                    width:'100%', background:'rgba(0,0,0,.5)',
                    border:'2px solid rgba(254,250,224,.3)', color:'var(--cream)',
                    fontFamily:"'VT323',monospace", fontSize:16,
                    padding:'4px 8px', letterSpacing:'.04em', outline:'none',
                  }}
                />
              </div>
              <div style={{flex:1, overflowY:'auto'}}>
                {loading
                  ? <div style={{padding:'16px', fontFamily:"'VT323',monospace", fontSize:16,
                      color:'var(--fg-dim)', letterSpacing:'.04em'}}>LOADING...</div>
                  : filtered.map(u=>(
                      // Each user row shows username, optional ADM badge, email, id, and last login.
                      <div key={u.id}
                        onClick={()=>{ setSelUser(u.id); blip && blip(540); if(isMobile) setMobilePane('detail'); }}
                        style={{
                          padding:'10px 14px', cursor:'default',
                          borderBottom:'1px solid rgba(254,250,224,.08)',
                          background: selUser===u.id ? 'var(--jrpg-blue)' : 'transparent',
                          borderLeft: selUser===u.id ? '3px solid var(--fg-bright)' : '3px solid transparent',
                          transition:'background .1s',
                        }}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <div style={{fontSize:10, color: selUser===u.id ? 'var(--fg-bright)' : 'var(--cream)',
                            letterSpacing:'.06em'}}>
                            {u.username}
                          </div>
                          {u.isAdmin && (
                            <span style={{fontSize:7, background:'var(--hl)', color:'var(--bg-0)',
                              padding:'1px 4px', letterSpacing:'.08em'}}>ADM</span>
                          )}
                        </div>
                        {u.email && (
                          <div style={{fontFamily:"'VT323',monospace", fontSize:13,
                            color:'rgba(254,250,224,.45)', marginTop:2}}>
                            {u.email}
                          </div>
                        )}
                        <div style={{fontFamily:"'VT323',monospace", fontSize:12,
                          color:'rgba(254,250,224,.3)', marginTop:2}}>
                          #{u.id} · {fmt(u.lastLogin)}
                        </div>
                      </div>
                    ))
                }
              </div>
              {/* Footer showing how many users pass the current filter vs. total */}
              <div style={{padding:'8px 12px', borderTop:'1px solid var(--bg-2)',
                fontFamily:"'VT323',monospace", fontSize:13, color:'var(--fg-dim)',
                letterSpacing:'.04em', flexShrink:0}}>
                {filtered.length} / {users.length} USERS
              </div>
            </div>

            {/* Right pane: only shown on desktop — on mobile the list is full-width */}
            {!isMobile && (
              <UserDetail
                userId={selUser}
                requesterId={account.id}
                blip={blip}
                onRefreshList={loadUsers}
              />
            )}
          </>)}
        </>)}

        {/* ── SPRITES page ── */}
        {page === 'sprites' && (
          <SpriteEditorPanel account={account} blip={blip} isMobile={isMobile} />
        )}
      </div>

      {/* Footer branding bar */}
      <div style={{
        padding:'6px 16px', borderTop:'2px solid var(--bg-2)',
        background:'var(--bg-0)',
        fontFamily:"'VT323',monospace", fontSize:13, color:'var(--fg-dim)',
        letterSpacing:'.04em', flexShrink:0,
      }}>
        ADMIN CONSOLE · MIPMIP COMPANY
      </div>
    </div>
  );
}

// Expose AdminPage to the global scope so other scripts can mount it dynamically.
Object.assign(window, { AdminPage });
