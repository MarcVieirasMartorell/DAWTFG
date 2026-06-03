// daw-battle-ui.jsx — Battle HUD overlay sub-components for the battle scene.
// This file defines all UI panels rendered on top of the battle canvas:
//   • BattleTopbar      — top status bar showing stage name, phase, unit counts, and tier.
//   • unitPos / ArenaUnits — positions and renders every combatant sprite + status badges on
//                           the battle field, including floating damage/heal popups.
//   • UnitSprite        — converts a unit's pixel-art grid into an SVG sprite.
//   • EnemyHPBar        — compact HP bar shown above each enemy sprite.
//   • BattleMessage     — context-sensitive narrative strip between the arena and command panel.
//   • CommandPanel      — interactive command menu (main / script / item / target sub-menus).
//   • PartyHUD          — right-side party panel with INTG/CPU/ATB/LMT resource bars.
//   • BossIntroOverlay  — animated "KERNEL ALERT" splash shown before a boss fight.
//   • IntroOverlay      — lighter encounter-open splash for normal fights.
//   • VictoryOverlay    — post-battle rewards screen on win.
//   • DefeatOverlay     — KERNEL_PANIC screen on party wipe.
//   • BattleTweaks      — dev/debug tweaks panel wired into the shared TweaksPanel system.
// All components are exported to window so the battle scene script can reference them.

const { useEffect: useEffectU, useState: useStateU, useRef: useRefU, useMemo: useMemoU } = React;

// ── Topbar ────────────────────────────────────────────────────────────

// Renders the top bar of the battle HUD: a fake terminal path, boss tag, tier,
// surviving enemy/hero counts, and the current phase label.
function BattleTopbar({ stage, phase, units, boss, tier }){
  // Count only alive units on each side to display accurate totals.
  const enemyCount = Object.values(units).filter(u => u.side==='enemy' && u.alive).length;
  const heroCount  = Object.values(units).filter(u => u.side==='hero'  && u.alive).length;
  return (
    <div className={'b-topbar ' + (boss?'b-topbar-boss':'')}>
      {/* Fake terminal path that mimics a Windows-style battle command prompt. */}
      <div className="b-path">
        C:\WORKSTATION\BATTLES\{(stage||'').replace(/ /g,'_')}\&gt; encounter --resolve
        {boss && <span className="b-boss-tag">  [BOSS]</span>}
        <span className="b-blink"/>
      </div>
      <div className="b-trinfo">
        {tier && <span><b>TIER</b> {tier}</span>}
        <span><b>FOES</b> {enemyCount}</span>
        <span><b>PARTY</b> {heroCount}/3</span>
        <span><b>PHASE</b> {phase.toUpperCase()}</span>
      </div>
    </div>
  );
}

// ── Arena units ───────────────────────────────────────────────────────
// Position: enemies on left, heroes on right, ground line ~ y=300

// Calculates absolute pixel positions for every unit on the battle field.
// Enemies are staggered across the left half using preset slots; a solo boss
// gets a centered position. Heroes are stacked in a vertical column on the right.
function unitPos(units){
  const enemies = Object.entries(units).filter(([id,u])=>u.side==='enemy');
  const heroes  = Object.entries(units).filter(([id,u])=>u.side==='hero');
  const pos = {};
  // Enemies — staggered around left half
  const eslots = [
    { x: 160, y: 110 },
    { x: 280, y: 200 },
    { x: 100, y: 240 },
    { x: 380, y: 140 },
  ];
  enemies.forEach(([id], i) => { pos[id] = eslots[i % eslots.length]; });
  // For bosses (1 enemy) center
  if(enemies.length === 1){ pos[enemies[0][0]] = { x: 200, y: 140 }; }
  // Heroes — vertical column on right
  const hslots = [
    { x: 880, y: 130 },
    { x: 970, y: 200 },
    { x: 880, y: 270 },
  ];
  heroes.forEach(([id], i) => { pos[id] = hslots[i] || { x: 900, y: 130 + i*70 }; });
  return pos;
}

// Renders all unit sprites, status badges, targeting reticles, and floating damage
// popups on the battle field. Computes positions once via useMemo for performance,
// then derives which units belong to the current targeting pool on each render.
function ArenaUnits({ units, phase, activeHero, menu, targetSel, pendingAction, activeAnim, popups }){
  // Cache positions — only recalculate when the units object reference changes.
  const positions = useMemoU(()=>unitPos(units), [units]);

  // Determine target pool for highlight
  // Decides which side (enemy or hero) is targetable based on the pending action's kind.
  // Returns an array of unit IDs that can be selected when the target sub-menu is open.
  const targetPool = useMemoU(()=>{
    if(!activeHero || menu !== 'target' || !pendingAction) return [];
    // Items that are bombs hit enemies; healing/buff scripts hit heroes; attacks hit enemies.
    const side = pendingAction.kind === 'item'
      ? (pendingAction.item.kind === 'bomb' ? 'enemy' : 'hero')
      : pendingAction.kind === 'script'
        ? (pendingAction.script.kind === 'heal' || pendingAction.script.kind === 'buff' ? 'hero' : 'enemy')
        : 'enemy';
    return Object.entries(units).filter(([id,u])=>u.side===side && u.alive).map(([id])=>id);
  }, [units, menu, activeHero, pendingAction]);

  return (
    <div className="b-units">
      {Object.entries(units).map(([id, u])=>{
        if(!u.alive && Date.now() - (u.deathAt||0) > 600) {
          // Once death anim has played, still render placeholder for spacing (optional - skip)
        }
        const p = positions[id]; if(!p) return null;
        // Scale factor: bosses get 7px per grid cell, the PHISH.WYRM enemy gets 5, all others get 4.
        const sc = u.boss ? 7
                 : u.side === 'enemy' && u.kind === 'PHISH.WYRM' ? 5
                 : u.side === 'enemy' ? 4
                 : 4;
        // Determine per-unit visual state flags for CSS class composition.
        const isActor = activeAnim && activeAnim.actorId === id;   // currently performing action
        const isTarget = activeAnim && activeAnim.targetId === id; // being acted upon
        const isActive = id === activeHero;                        // currently awaiting player input
        const isAimed  = targetPool.length > 0 && targetPool[targetSel] === id; // cursor is on this unit
        // Flash the unit briefly when it receives damage; hurtAt is stamped by the battle engine.
        const hurt = u.hurtAt && (Date.now() - u.hurtAt) < 220;
        const cls = [
          'b-unit',
          'b-side-'+u.side,
          isActive && 'b-active',
          isAimed && 'b-aimed',
          isActor && 'b-actor',
          isTarget && 'b-tgt',
          !u.alive && 'b-dead',
          hurt && 'b-hurt',
        ].filter(Boolean).join(' ');
        return (
          <div key={id} className={cls} style={{ left: p.x, top: p.y }}>
            {/* Show HP bar only for enemies; heroes use the PartyHUD panel instead. */}
            {u.side === 'enemy' && <EnemyHPBar u={u}/>}
            <UnitSprite u={u} scale={sc} isActive={isActive}/>
            {/* Name label: enemies get an underscore-separated suffix from their ID. */}
            <div className="b-namelabel">{u.displayName ?? u.kind}{u.side==='enemy' ? `_${id.slice(1)}`:''}</div>
            {/* Status effect badges — each maps to an in-game debuff/buff. */}
            {u.silenced > 0 && <div className="b-stat b-stat-silence">CHMOD 000</div>}
            {u.frozen > 0 && <div className="b-stat b-stat-freeze">QRTN</div>}
            {u.shield > 0 && <div className="b-stat b-stat-shield">FIREWALL</div>}
            {u.taunt > 0 && u.side==='hero' && <div className="b-stat b-stat-taunt">AGGRO</div>}
            {u.exposed && u.side==='enemy' && <div className="b-stat b-stat-expose">EXPOSED</div>}
            {/* Targeting reticle brackets rendered over the currently aimed unit. */}
            {isAimed && <div className="b-reticle">[ ]</div>}
          </div>
        );
      })}
      {/* Popups layer — floating damage/heal numbers that fly above the targeted unit. */}
      <div className="b-popups">
        {popups.map(p => {
          const pos = positions[p.unitId]; if(!pos) return null;
          return (
            <div key={p.id} className={`b-pop b-pop-${p.kind}`}
              style={{ left: pos.x, top: pos.y - 16 }}>
              {p.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Renders a single unit's pixel-art sprite as an SVG by delegating to BSprite.
// The SVG dimensions are derived from the sprite grid dimensions multiplied by the scale factor.
function UnitSprite({ u, scale, isActive }){
  const w = u.sprite[0].length * scale;
  const h = u.sprite.length * scale;
  return (
    <svg className="b-sprite"
      width={w} height={h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges" overflow="visible">
      {isActive && u.side === 'hero' && (
        <ellipse className="b-turn-glow" cx={w/2} cy={h+2} rx={w*0.58} ry={11}/>
      )}
      <BSprite grid={u.sprite} scale={scale}
        body={u.body} rim={u.rim} dark={u.dark} acc={u.acc} eye={u.eye}/>
    </svg>
  );
}

// Renders a compact HP bar above an enemy sprite showing current/max HP as
// a colored fill and a text readout.
function EnemyHPBar({ u }){
  const pct = (u.hp / u.hpMax) * 100;
  return (
    <div className="b-ehp">
      <div className="b-ehp-fill" style={{ width: pct+'%' }}/>
      <div className="b-ehp-text">{u.hp}/{u.hpMax}</div>
    </div>
  );
}

// ── Message strip (between arena & bottom) ────────────────────────────

// Renders a single-line context message strip between the arena and the command panel.
// Priority order: phase messages (intro/victory/defeat) → active hero prompts → last log line → idle.
// Also shows the last three battle log entries in small text below the main line.
function BattleMessage({ units, activeHero, menu, pendingAction, log, phase, stage }){
  const last = log[log.length - 1];
  let line = '';
  if(phase === 'intro')      line = `> attaching tty… ${stage}  encounter spawned.`;
  else if(phase === 'victory') line = '> all hostile processes terminated.';
  else if(phase === 'defeat')  line = '> all party processes faulted.  KERNEL_PANIC.';
  else if(activeHero){
    const h = units[activeHero].displayName ?? units[activeHero].kind;
    if(menu === 'main')   line = `> ${h} :: awaiting command...`;
    else if(menu === 'script') line = `> ${h} :: scripts/ — pick a process to run`;
    else if(menu === 'item')   line = `> ${h} :: inventory/ — pick a file`;
    else if(menu === 'target'){
      // Derive the verb from what the player has queued up (item use, script name, or default "click").
      const verb = pendingAction?.kind === 'item' ? 'use'
                 : pendingAction?.kind === 'script' ? (pendingAction.script.label||'cast')
                 : 'click';
      line = `> ${h} :: ${verb} — select target`;
    }
  } else if(last) line = last.line;
  else line = '> system idle.';
  return (
    <div className="b-msg">
      <div className="b-msg-glyph">▶</div>
      <div className="b-msg-text">{line}</div>
      {/* Show the last 3 log entries as a scrolling history beneath the active message. */}
      <div className="b-msg-log">
        {log.slice(-3).map(L => (
          <div key={L.id} className={'b-msg-line b-msg-'+L.kind}>{L.line}</div>
        ))}
      </div>
    </div>
  );
}

// ── Command panel ─────────────────────────────────────────────────────

// Renders the interactive command panel in the bottom-left of the battle HUD.
// When no hero is active it shows a "waiting" state. When a hero is active it
// switches between four sub-menus: main (attack/script/item/defend), script list,
// item list, and the target-selection overlay (which reuses the main grid view).
function CommandPanel({ units, activeHero, menu, menuSel, targetSel, pendingAction, items,
                       onCommit, onPickMain, onCommitScript, onPickScript,
                       onCommitItem, onPickItem, onSelectTarget, onBack, mainOptions }){
  // No hero has a full ATB yet — show a spinner/wait state.
  if(!activeHero){
    return (
      <div className="b-cmd b-cmd-wait">
        <div className="b-legend">▣ COMMAND</div>
        <div className="b-wait-text">
          <div className="b-wait-tick">▮</div>
          <div>process scheduler busy…</div>
          <div className="b-wait-sub">waiting for next ready hero</div>
        </div>
      </div>
    );
  }
  const hero = units[activeHero];
  const heroDef = HEROES_DEF[hero.kind];

  // Target selection — dedicated panel with tappable unit rows.
  if(menu === 'target'){
    const side = !pendingAction ? 'enemy' :
      pendingAction.kind === 'item'
        ? (pendingAction.item?.kind === 'bomb' ? 'enemy' : 'hero')
        : pendingAction.kind === 'script'
          ? (pendingAction.script?.kind === 'heal' || pendingAction.script?.kind === 'buff' ? 'hero' : 'enemy')
          : 'enemy';
    const pool = Object.entries(units).filter(([id,u])=>u.side===side && u.alive);
    const verb = pendingAction?.kind === 'item' ? (pendingAction.item?.label||'USE')
               : pendingAction?.kind === 'script' ? (pendingAction.script?.label||'SCRIPT')
               : 'EXECUTE';
    return (
      <div className="b-cmd">
        <div className="b-legend">▣ TARGET — {verb}</div>
        <div className="b-script-list">
          {pool.map(([id, u], i) => (
            <div key={id}
              className={'b-script-item b-target-item ' + (i===targetSel?'sel':'')}
              onMouseEnter={()=>{ /* highlight handled by targetSel */ }}
              onClick={()=>onSelectTarget && onSelectTarget(id)}>
              <span className="b-cur">▶</span>
              <span className="b-script-label">{u.displayName ?? u.kind}{u.side==='enemy'?`_${id.slice(1)}`:''}</span>
              <span className="b-script-cost">{u.hp}/{u.hpMax}</span>
            </div>
          ))}
        </div>
        <div className="b-cmd-foot">[ESC] back · tap to confirm</div>
      </div>
    );
  }

  // Main command menu.
  if(menu === 'main'){
    const opts = mainOptions(hero);
    return (
      <div className="b-cmd">
        <div className="b-legend">▣ COMMAND — {hero.displayName ?? hero.kind}</div>
        <div className="b-cmd-grid">
          {opts.map((o, i) => (
            <div key={o.label}
              className={'b-cmd-item ' + (i===menuSel?'sel ':'') + (o.disabled?'disabled':'')}
              onMouseEnter={()=>!o.disabled && onPickMain(i)}
              onClick={()=>!o.disabled && onCommit(o.label)}>
              <span className="b-cur">▶</span>
              <span className="b-cmd-label">{o.label}</span>
            </div>
          ))}
        </div>
        {/* Description line for the currently highlighted option. */}
        <div className="b-cmd-desc">&gt; {opts[menuSel].desc}</div>
      </div>
    );
  }

  // Script sub-menu: lists the hero's executable abilities with CPU cost.
  // Entries are greyed out (disabled) when the hero lacks sufficient CPU.
  if(menu === 'script'){
    const scripts = heroDef.scripts;
    const sel = scripts[menuSel];
    return (
      <div className="b-cmd">
        <div className="b-legend">▣ SCRIPT — {hero.displayName ?? hero.kind}</div>
        <div className="b-script-list">
          {scripts.map((s, i)=>{
            // A script is blocked when the hero's current CPU is below the script's cost.
            const blocked = hero.cpu < s.cost;
            return (
              <div key={s.id}
                className={'b-script-item ' + (i===menuSel?'sel ':'') + (blocked?'disabled':'')}
                onMouseEnter={()=>!blocked && onPickScript(i)}
                onClick={()=>!blocked && onCommitScript(s)}>
                <span className="b-cur">▶</span>
                <span className="b-script-label">{s.label}</span>
                <span className="b-script-cost">{s.cost} CPU</span>
              </div>
            );
          })}
        </div>
        <div className="b-cmd-desc">&gt; {sel.desc}</div>
        <div className="b-cmd-foot">[ESC] back</div>
      </div>
    );
  }

  // Item sub-menu: shows only items with qty > 0; collapses to an "empty" message otherwise.
  if(menu === 'item'){
    const list = items.filter(i => i.qty > 0);
    if(list.length === 0){
      return (
        <div className="b-cmd">
          <div className="b-legend">▣ INVENTORY — {hero.displayName ?? hero.kind}</div>
          <div className="b-cmd-desc">&gt; ~/ is empty.</div>
          <div className="b-cmd-foot">[ESC] back</div>
        </div>
      );
    }
    // Guard: if menuSel somehow points past the list end, fall back to the first item.
    const sel = list[menuSel] || list[0];
    return (
      <div className="b-cmd">
        <div className="b-legend">▣ INVENTORY — {hero.displayName ?? hero.kind}</div>
        <div className="b-script-list">
          {list.map((it, i)=>(
            <div key={it.id}
              className={'b-script-item ' + (i===menuSel?'sel':'')}
              onMouseEnter={()=>onPickItem(i)}
              onClick={()=>onCommitItem(it)}>
              <span className="b-cur">▶</span>
              <span className="b-script-label">{it.label}</span>
              <span className="b-script-cost">x{it.qty}</span>
            </div>
          ))}
        </div>
        <div className="b-cmd-desc">&gt; {sel.desc}</div>
        <div className="b-cmd-foot">[ESC] back</div>
      </div>
    );
  }
  return null;
}

// ── Party HUD (right side) ────────────────────────────────────────────

// Renders the right-side party panel listing every hero with their four resource bars:
// INTG (HP), CPU (mana equivalent), ATB (charge gauge), and LMT (limit break gauge).
// The currently active hero's row is highlighted with the "sel" class.
function PartyHUD({ units, activeHero }){
  const heroes = Object.entries(units).filter(([id,u])=>u.side==='hero');
  return (
    <div className="b-party">
      <div className="b-legend">▣ PARTY</div>
      <div className="b-party-rows">
        {heroes.map(([id,u])=>{
          // Compute percentage fills for each bar (0–100).
          const hpPct = (u.hp/u.hpMax)*100;
          const cpuPct = (u.cpu/u.cpuMax)*100;
          const atbPct = u.atb;     // already stored as 0–100
          const limitPct = u.limit; // already stored as 0–100
          const active = id === activeHero;
          return (
            <div key={id} className={'b-party-row ' + (active?'sel ':'') + (!u.alive?'dead':'')}>
              <div className="b-pr-head">
                <span className="b-pr-name">{u.displayName ?? u.kind}</span>
                {!u.alive && <span className="b-pr-down">[FAULTED]</span>}
                {active && <span className="b-pr-tag">▶ READY</span>}
              </div>
              <div className="b-pr-bars">
                <div className="b-pr-bar">
                  <span className="b-pr-lbl">INTG</span>
                  <div className="b-pr-track"><div className="b-pr-fill hp" style={{width:hpPct+'%'}}/></div>
                  <span className="b-pr-val">{u.hp}/{u.hpMax}</span>
                </div>
                <div className="b-pr-bar">
                  <span className="b-pr-lbl">CPU</span>
                  <div className="b-pr-track"><div className="b-pr-fill cpu" style={{width:cpuPct+'%'}}/></div>
                  <span className="b-pr-val">{u.cpu}/{u.cpuMax}</span>
                </div>
                <div className="b-pr-bar">
                  <span className="b-pr-lbl">ATB</span>
                  {/* Add "rdy" class when ATB hits 100 to trigger a CSS glow effect. */}
                  <div className="b-pr-track"><div className={'b-pr-fill atb '+(u.atb>=100?'rdy':'')} style={{width:atbPct+'%'}}/></div>
                  <span className="b-pr-val">{u.atb>=100?'!!':Math.floor(u.atb)+'%'}</span>
                </div>
                <div className="b-pr-bar">
                  <span className="b-pr-lbl">HRB</span>
                  {/* Show "RDY" text instead of percentage once the hard reboot gauge is full. */}
                  <div className="b-pr-track"><div className={'b-pr-fill lmt '+(u.limit>=100?'rdy':'')} style={{width:limitPct+'%'}}/></div>
                  <span className="b-pr-val">{u.limit>=100?'RDY':Math.floor(u.limit)+'%'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="b-party-foot">↑↓ select &middot; ⏎ confirm &middot; ESC back</div>
    </div>
  );
}

// ── Intro overlay (hex resolve) ───────────────────────────────────────

// Animated boss encounter splash screen.
// Uses a tick counter (updated every 90 ms) to reveal log lines one by one,
// simulating a terminal scan before the fight begins.
function BossIntroOverlay({ stage, bossKind }){
  const [tickN, setTick] = useStateU(0);
  // Increment tick every 90 ms to drive the progressive log-line reveal animation.
  useEffectU(()=>{
    const iv = setInterval(()=>setTick(t=>t+1), 90);
    return ()=>clearInterval(iv);
  }, []);
  const lines = [
    '> kernel.alert :: PRIORITY ROOT',
    '> scanning...',
    '> signature: '+(bossKind||'TROJAN.WORM'),
    '> integrity: CATASTROPHIC',
    '> all sectors compromised.',
    '> attaching combat tty.',
  ];
  return (
    <div className="b-overlay b-boss-intro">
      <div className="b-boss-card">
        <div className="b-boss-warn">!!  KERNEL ALERT  !!</div>
        <div className="b-boss-eyebrow">BOSS PROCESS DETECTED</div>
        <div className="b-boss-name">{bossKind || 'TROJAN.WORM'}</div>
        <div className="b-boss-quote">&ldquo;all sectors corrupt. all packets mine.&rdquo;</div>
        <div className="b-boss-log">
          {/* Reveal one additional log line per two ticks, capped at lines.length. */}
          {lines.slice(0, Math.min(lines.length, 1 + Math.floor(tickN/2))).map((l,i)=>(
            <div key={i} className={'b-boss-logline '+(i===lines.length-1?'last':'')}>{l}</div>
          ))}
        </div>
        <div className="b-boss-foot">[ENTER] CONFRONT</div>
      </div>
      <div className="b-glitch-bands"/>
    </div>
  );
}

// Simple static intro overlay for normal (non-boss) encounters.
// Renders a random row of hex addresses to give a "loading symbols" aesthetic.
function IntroOverlay({ stage }){
  return (
    <div className="b-overlay b-intro">
      <div className="b-intro-card">
        <div className="b-intro-eyebrow">UNKNOWN PROCESS ENCOUNTERED</div>
        <div className="b-intro-stage">{stage}</div>
        <div className="b-intro-sub"> attaching tty… resolving symbols…</div>
        {/* Eight random 4-digit hex tokens shown as a fake memory address dump. */}
        <div className="b-intro-hex">
          {Array.from({length:8}).map((_,i)=>(
            <span key={i}>{Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0')} </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Post-battle victory overlay. Tallies XP and bytes earned from all defeated enemies
// and displays a loot summary. Clicking anywhere (or pressing Enter) calls onContinue.
function VictoryOverlay({ units, stage, onContinue, boss }){
  // Sum up XP from every enemy unit; bytes = XP * random multiplier 2–4.
  const xp = Object.values(units).filter(u=>u.side==='enemy').reduce((a,u)=>a + (u.xp||0), 0);
  const bytes = xp * rnd(2,4);
  return (
    <div className={'b-overlay b-victory '+(boss?'b-vic-boss':'')} onClick={onContinue}>
      <div className="b-vic-card">
        <div className="b-vic-banner">{boss ? 'SYSTEM RESTORED' : 'VICTORY'}</div>
        <div className="b-vic-sub">{boss
          ? 'kernel reclaimed. workstation hum returns.'
          : 'all hostile processes terminated.'}</div>
        <div className="b-vic-list">
          <div><span>+ XP</span><b>{xp}</b></div>
          <div><span>+ BYTES</span><b>{bytes}</b></div>
          {/* Boss fights award a named key item; normal fights award generic drops. */}
          <div><span>+ LOOT</span><b>{boss ? 'KERNEL.KEY, defrag_tonic x3, root.kit x1' : 'patch.dll x1, buffer.zip x1'}</b></div>
        </div>
        <div className="b-vic-foot">[ENTER] continue</div>
      </div>
    </div>
  );
}

// Defeat overlay shown when the entire party reaches 0 HP.
// Displays a fake kernel panic stack trace for thematic flavor.
// Clicking anywhere (or pressing Enter) calls onContinue to return to the map.
function DefeatOverlay({ onContinue }){
  return (
    <div className="b-overlay b-defeat" onClick={onContinue}>
      <div className="b-def-card">
        <div className="b-def-banner">KERNEL_PANIC</div>
        <div className="b-def-sub">your party processes have all faulted.</div>
        <div className="b-def-stack">
          <div>panic: not syncing — fatal exception in interrupt</div>
          <div>cpu: 0  pid: 1  comm: daw.exe</div>
          <div>stack: <b>0x4A2F</b> &lt;party.terminate&gt;</div>
        </div>
        <div className="b-def-foot">[ENTER] retry from last save</div>
      </div>
    </div>
  );
}

// ── Tweaks panel hook into existing TweaksPanel ───────────────────────

// Dev/debug tweaks panel that plugs into the shared TweaksPanel UI system.
// Allows changing the active battle stage, animation speed, color palette, and CRT effect.
// Palette and CRT changes are applied immediately via window globals and DOM attributes.
function BattleTweaks({ stage, setStage, speed, setSpeed }){
  return (
    <TweaksPanel>
      <TweakSection label="ENCOUNTER"/>
      <TweakSelect label="Stage" value={stage}
        options={Object.keys(STAGES).map(k=>({value:k, label:k}))}
        onChange={(v)=>setStage(v)}/>
      <TweakSlider label="Battle speed" value={speed} min={0.5} max={3} step={0.1}
        onChange={(v)=>setSpeed(v)}/>
      <TweakSection label="DISPLAY"/>
      {/* Palette change is stored on window.__BATTLE_THEME and applied via a globally registered helper. */}
      <TweakRadio label="Palette" value={window.__BATTLE_THEME||'phosphor'}
        options={[
          {value:'phosphor', label:'PHOS'},
          {value:'amber',    label:'AMBR'},
          {value:'ice',      label:'ICE'},
        ]}
        onChange={(v)=>{ window.__BATTLE_THEME=v; window.__applyTheme&&window.__applyTheme(v); }}/>
      {/* CRT mode is stored on window.__BATTLE_CRT and toggled via a data attribute on the .crt element. */}
      <TweakRadio label="CRT" value={window.__BATTLE_CRT||'scanlines'}
        options={[
          {value:'scanlines', label:'SCAN'},
          {value:'curve',     label:'CURV'},
          {value:'off',       label:'OFF'},
        ]}
        onChange={(v)=>{ window.__BATTLE_CRT=v;
          const el=document.querySelector('.crt'); if(el) el.setAttribute('data-crt',v); }}/>
    </TweaksPanel>
  );
}

// ── Mobile Arena ────────────────────────────────────────────────────────────
// Renders the battle field in a vertical layout: enemies at top, heroes at
// bottom. When menu === 'target', units in the target pool receive an onClick
// handler and a glow border so the player can tap them directly.
function MobileArena({ units, menu, targetSel, pendingAction, activeAnim, onSelectTarget, stage, activeHero }){
  const enemies = Object.entries(units).filter(([,u]) => u.side==='enemy');
  const heroes  = Object.entries(units).filter(([,u]) => u.side==='hero');

  // Compute which unit IDs are valid targets (same logic as ArenaUnits / keyboard handler).
  const targetPool = useMemoU(()=>{
    if(menu !== 'target' || !pendingAction) return [];
    const side = pendingAction.kind === 'item'
      ? (pendingAction.item?.kind === 'bomb' ? 'enemy' : 'hero')
      : pendingAction.kind === 'script'
        ? (pendingAction.script?.kind === 'heal' || pendingAction.script?.kind === 'buff' ? 'hero' : 'enemy')
        : 'enemy';
    return Object.entries(units).filter(([id,u]) => u.side===side && u.alive).map(([id]) => id);
  }, [units, menu, pendingAction]);

  function renderUnit(id, u, isHero){
    const sc = u.boss ? 10 : isHero ? 5 : 6;
    const isTargetable = targetPool.includes(id);
    const isAimed = isTargetable && targetPool[targetSel] === id;
    const isActor = activeAnim?.actorId === id;
    const cls = [
      'mb-unit',
      'mb-side-' + (isHero ? 'hero' : 'enemy'),
      isAimed      && 'mb-aimed',
      isTargetable && 'mb-targetable',
      !u.alive     && 'mb-dead',
      isActor      && 'mb-actor',
    ].filter(Boolean).join(' ');
    return (
      <div key={id} className={cls}
        onClick={isTargetable ? ()=>onSelectTarget && onSelectTarget(id) : undefined}>
        {!isHero && <EnemyHPBar u={u}/>}
        <div className="mb-sprite-wrap">
          <UnitSprite u={u} scale={sc} isActive={isHero && id === activeHero}/>
        </div>
        <div className="mb-namelabel">{u.displayName ?? u.kind}{!isHero ? `_${id.slice(1)}` : ''}</div>
        {u.silenced > 0 && <div className="b-stat b-stat-silence">CHMOD</div>}
        {u.frozen   > 0 && <div className="b-stat b-stat-freeze">QRTN</div>}
        {u.shield   > 0 && <div className="b-stat b-stat-shield">FWALL</div>}
        {u.exposed && !isHero && <div className="b-stat b-stat-expose">EXP</div>}
        {isAimed && <div className="mb-reticle-arrow">▼</div>}
      </div>
    );
  }

  return (
    <div className="mb-arena">
      <BattleBG stage={stage||'TEMP CAVES'}/>
      <div className="mb-unit-row mb-enemy-row">
        {enemies.map(([id,u]) => renderUnit(id, u, false))}
      </div>
      <div className="mb-unit-row mb-hero-row">
        {heroes.map(([id,u]) => renderUnit(id, u, true))}
      </div>
    </div>
  );
}

// ── Mobile Battle Layout ─────────────────────────────────────────────────────
// Full-screen battle layout for mobile / tablet (≤ 760 px wide).
// Arena takes 3 flex parts, command+party panel takes 2 flex parts.
function MobileBattleLayout({
  units, phase, encState, activeHero, menu, menuSel, targetSel,
  pendingAction, items, log, popups, activeAnim,
  mainOptions, onPickMain, onCommit, onPickScript, onCommitScript,
  onPickItem, onCommitItem, onSelectTarget, onBack,
  onComplete, stage, setStage,
}){
  return (
    <div className="mb-layout">
      <BattleTopbar stage={encState.bg} phase={phase} units={units} boss={encState.boss} tier={encState.tier}/>
      <MobileArena
        units={units} menu={menu} targetSel={targetSel}
        pendingAction={pendingAction} activeAnim={activeAnim}
        onSelectTarget={onSelectTarget} stage={encState.bg}
        activeHero={activeHero}/>
      <BattleMessage units={units} activeHero={activeHero} menu={menu} pendingAction={pendingAction}
        log={log} phase={phase} stage={encState.bg}/>
      <div className="mb-panel">
        <div className="mb-cmdcol">
          <CommandPanel
            units={units} activeHero={activeHero} menu={menu} menuSel={menuSel}
            targetSel={targetSel} pendingAction={pendingAction} items={items}
            onPickMain={onPickMain} onCommit={onCommit}
            onPickScript={onPickScript} onCommitScript={onCommitScript}
            onPickItem={onPickItem} onCommitItem={onCommitItem}
            onSelectTarget={onSelectTarget} onBack={onBack}
            mainOptions={mainOptions}/>
        </div>
        <div className="mb-statcol">
          <PartyHUD units={units} activeHero={activeHero}/>
        </div>
      </div>
      {phase==='victory' && <VictoryOverlay units={units} stage={encState.bg} boss={encState.boss}
        onContinue={()=>{ if(onComplete) onComplete({result:'victory',encounter:encState}); else setStage(stage); }}/>}
      {phase==='defeat' && <DefeatOverlay
        onContinue={()=>{ if(onComplete) onComplete({result:'defeat',encounter:encState}); else setStage(stage); }}/>}
      {phase==='intro' && <IntroOverlay stage={encState.bg}/>}
      {phase==='boss-intro' && <BossIntroOverlay stage={encState.bg} bossKind={Object.values(units).find(u=>u.boss)?.displayName ?? encState.enemies[0]}/>}
    </div>
  );
}

// Expose all battle UI components to the global window so the battle scene
// script (loaded separately) can reference them without a module bundler.
Object.assign(window, {
  BattleTopbar, ArenaUnits, BattleMessage, CommandPanel, PartyHUD,
  IntroOverlay, BossIntroOverlay, VictoryOverlay, DefeatOverlay, BattleTweaks,
  MobileArena, MobileBattleLayout,
});
