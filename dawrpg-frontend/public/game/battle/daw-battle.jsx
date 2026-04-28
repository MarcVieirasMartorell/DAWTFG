// daw-battle.jsx
// Core battle engine for DAW (Defending A Workstation).
// Implements a Final Fantasy-style Active Time Battle (ATB) system:
//   - Each unit (hero or enemy) has an ATB gauge that fills over time at a speed
//     determined by their `spd` stat. When a hero's gauge reaches 100 the player
//     is prompted to choose a command; when an enemy's gauge reaches 100 the AI
//     picks and executes an attack automatically.
//   - Supported player actions: EXECUTE (basic attack), SCRIPT (character skills),
//     ITEM (inventory consumables), GUARD (damage-halving defence stance),
//     LIMIT (once-per-charge super move), and FLEE.
//   - Status effects: shield (damage reduction for N hits), taunt (redirect enemy
//     aggro), expose (guarantees a critical hit), silence (skip turn), freeze
//     (pause ATB for N ticks).
//   - Win/lose detection runs after every action. Victory fires `onComplete` with
//     result:'victory'; total party wipe fires it with result:'defeat'.
//   - The 1280x800 pixel canvas scales responsively to fill any parent container
//     via a ResizeObserver + CSS transform.

const { useState: useStateB, useEffect: useEffectB, useRef: useRefB,
        useCallback: useCallbackB, useMemo: useMemoB } = React;

// ── Static data ───────────────────────────────────────────────────────

// Full stat and skill definitions for every playable hero.
// Each entry declares base stats, colour palette for the sprite renderer,
// a limit-break name/description, and a `scripts` array of learnable skills.
const HEROES_DEF = {
  'CURSOR.EXE': {
    sprite: B_CURSOR,
    body:'#2a3a55', rim:'#a5b985', dark:'#020806', acc:'#fefae0',
    eye:'#fefae0',
    hpMax: 220, cpuMax: 60, spd: 1.3,
    atk: [22, 36],
    limitName: 'CLICKSTORM',
    limitDesc: 'rage-click() — 6 random hits',
    role: 'POINTER',
    bio: 'Legacy input device. Precise single-target striker; cheap on CPU.',
    scripts: [
      { id:'click',      label:'click()',          cost: 0, dmg:[28,44],  kind:'single', desc:'Sharp double-click on one target.' },
      { id:'drag',       label:'drag(target)',     cost: 8, dmg:[18,30],  kind:'single', extra:'knockback', desc:'Knock target back; -1 ATB.' },
      { id:'selectall',  label:'select_all()',     cost:18, dmg:[14,24],  kind:'aoe',    desc:'Hits every active threat.' },
      { id:'inspect',    label:'inspect(elem)',    cost: 6, dmg:[0,0],    kind:'debuff', extra:'expose',  desc:'Expose weakness — next hits crit.' },
    ],
  },
  'GUARD.SYS': {
    sprite: B_GUARD,
    body:'#3a3a18', rim:'#d4f4a3', dark:'#020806', acc:'#fefae0',
    eye:'#fefae0',
    hpMax: 410, cpuMax: 80, spd: 0.95,
    atk: [16, 26],
    limitName: 'PORT 22 LOCKDOWN',
    limitDesc: 'firewall_all() — block next round',
    role: 'TANK',
    bio: 'System sentinel. High HP. Heals, shields and pulls aggro.',
    scripts: [
      { id:'patch',      label:'patch.dll(ally)',  cost: 8, heal:[60,90],  kind:'heal',   desc:'Restore an ally\'s INTEGRITY.' },
      { id:'shield',     label:'shield_up(ally)',  cost:10, kind:'buff',   extra:'shield', desc:'Halve incoming damage on ally.' },
      { id:'reroute',    label:'reroute(ally)',    cost: 6, kind:'buff',   extra:'taunt',  desc:'Pull all aggro to GUARD.SYS.' },
      { id:'backup',     label:'backup.zip()',     cost:24, heal:[40,55],  kind:'aoehel', desc:'Heal the whole party.' },
    ],
  },
  'PURGE.BAT': {
    sprite: B_PURGE,
    body:'#1a0a2a', rim:'#d4a373', dark:'#020806', acc:'#a5b985',
    eye:'#ff6ec7',
    hpMax: 175, cpuMax: 100, spd: 1.1,
    atk: [26, 40],
    limitName: 'rm -rf /malware/*',
    limitDesc: '999 dmg AoE — purge all',
    role: 'PURIFIER',
    bio: 'Antimalware shell. Heavy damage and brutal debuffs at high CPU cost.',
    scripts: [
      { id:'kill9',      label:'kill -9 (target)', cost:10, dmg:[44,72],  kind:'single', desc:'Force-terminate a process.' },
      { id:'chmod000',   label:'chmod 000(t)',     cost:12, kind:'debuff', extra:'silence', desc:'Strip target\'s privileges (skip turn).' },
      { id:'qrtn',       label:'quarantine(t)',    cost:14, kind:'debuff', extra:'freeze',  desc:'Encase target — no actions for 2 ticks.' },
      { id:'sudormrf',   label:'sudo rm -rf .',    cost:28, dmg:[34,52],  kind:'aoe',     desc:'Wipe-attempt AoE on all enemies.' },
    ],
  },
  'PING.DLL': {
    sprite: B_PING,
    body:'#1a3a55', rim:'#9bc4ff', dark:'#020816', acc:'#ffdc4a',
    eye:'#ffdc4a',
    hpMax: 160, cpuMax: 70, spd: 1.5,
    atk: [18, 28],
    limitName: 'TRACEROUTE',
    limitDesc: 'reveal-all + multi-hit chain',
    role: 'SCOUT',
    bio: 'Network probe. Hits fast, exposes weaknesses, scrambles enemy timing.',
    scripts: [
      { id:'ping',       label:'ping(target)',     cost: 2, dmg:[14,24],  kind:'single', desc:'Quick packet — fast & cheap.' },
      { id:'tracert',    label:'tracert()',        cost:10, dmg:[10,18],  kind:'aoe',    desc:'Hit every enemy + map their weak ports.' },
      { id:'jitter',     label:'jitter(target)',   cost: 6, kind:'debuff', extra:'freeze', desc:'Scramble target\'s ATB (loses turn).' },
      { id:'wget',       label:'wget(target)',     cost: 8, dmg:[20,32],  kind:'single', desc:'Yank packet — chance to steal an item.' },
    ],
  },
  'ROOT.SH': {
    sprite: B_ROOT,
    body:'#3a0a1a', rim:'#ffdc4a', dark:'#020806', acc:'#ffdc4a',
    eye:'#fefae0',
    hpMax: 280, cpuMax: 90, spd: 1.0,
    atk: [24, 38],
    limitName: 'sudo shutdown -h NOW',
    limitDesc: 'massive single-target nuke',
    role: 'ADMIN',
    bio: 'Privileged user. Versatile mix of damage, revive, and buffs.',
    scripts: [
      { id:'whoami',     label:'sudo whoami',      cost: 0, dmg:[26,40],  kind:'single', desc:'Identify-and-strike combo.' },
      { id:'grep',       label:'sudo grep(t)',     cost: 6, kind:'debuff', extra:'expose', desc:'Find target\'s exploit — next hit crits.' },
      { id:'restart',    label:'sudo restart(a)',  cost:14, heal:[100,140], kind:'heal',  desc:'Revive a faulted ally with high HP.' },
      { id:'nice',       label:'sudo nice -20',    cost:10, kind:'buff',   extra:'haste', desc:'Boost an ally\'s ATB rate.' },
    ],
  },
  'INDEX.LOG': {
    sprite: B_INDEX,
    body:'#3a2a18', rim:'#fefae0', dark:'#020806', acc:'#a5e58a',
    eye:'#a5e58a',
    hpMax: 200, cpuMax: 85, spd: 0.85,
    atk: [20, 30],
    limitName: 'STACK TRACE',
    limitDesc: 'expose all — party hits crit',
    role: 'ARCHIVIST',
    bio: 'Keeper of logs. Specialist in debuffs and information warfare.',
    scripts: [
      { id:'logwrite',   label:'log.write()',      cost: 2, dmg:[16,24],  kind:'single', desc:'Append a damaging entry to target.' },
      { id:'audit',      label:'audit.fail(t)',    cost: 6, kind:'debuff', extra:'expose', desc:'Force target to admit weakness.' },
      { id:'syslog',     label:'syslog.flood',     cost:12, kind:'debuff', extra:'silence', desc:'Drown all foes in noise — silence AoE.' },
      { id:'rotate',     label:'log.rotate(t)',    cost: 8, dmg:[28,42],  kind:'single', desc:'Recursive overwrite — heavy hit.' },
    ],
  },
};

// Consumable item catalogue shown in the ITEM battle menu.
// `kind` determines the resolution branch in resolveAction:
//   heal → restore hp, mp → restore cpu, revive → revive dead ally,
//   bomb → deal flat damage to an enemy.
const ITEMS_DEF = [
  { id:'patch',      label:'patch.dll',        qty:5, kind:'heal',  amt: 80, desc:'Restore 80 INTEGRITY to one ally.' },
  { id:'restore',    label:'restore_point.bak',qty:1, kind:'revive',amt:120, desc:'Revive one ally at 120 HP.' },
  { id:'buffer',     label:'buffer.zip',       qty:3, kind:'mp',    amt: 40, desc:'Restore 40 CPU% to one ally.' },
  { id:'rootkit',    label:'~/root.kit',       qty:2, kind:'bomb',  amt:140, desc:'Inverted exploit — 140 dmg to one foe.' },
];

// Built-in stage table used when no explicit `encounter` prop is passed.
// Each entry maps a human-readable stage name to its enemy pool.
const STAGES = {
  'POPUP MOOR':    { id:'1-1', path:'C:\\WORKSTATION\\MOORS', encs:['POPUP.IMP','POPUP.IMP','POPUP.IMP'] },
  'COOKIE WOODS':  { id:'1-2', path:'C:\\WORKSTATION\\WOODS', encs:['TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME'] },
  'TEMP CAVES':    { id:'1-3', path:'C:\\WORKSTATION\\TEMP',  encs:['CACHE.GHOUL','CACHE.GHOUL'] },
  'PROXY PASS':    { id:'1-4', path:'C:\\WORKSTATION\\NET',   encs:['PHISH.WYRM'] },
  'SECTOR FALLS':  { id:'1-5', path:'C:\\WORKSTATION\\DISK',  encs:['RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA'] },
  'CORE CHAMBER':  { id:'B',   path:'C:\\WORKSTATION\\CORE',  encs:['TROJAN.WORM'] },
};

// ── Helpers ───────────────────────────────────────────────────────────

// Returns a random integer in the inclusive range [a, b].
const rnd = (a,b) => Math.floor(a + Math.random()*(b-a+1));

// Generates a fake memory-address string used in damage popup flavour text.
const hexAddr = () => '0x'+Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0');

// Monotonically-increasing counter used as stable React list keys for log entries
// and popup notifications, avoiding index-based key collisions.
const tick = (()=> { let n=0; return ()=>++n; })();

// Clamps a value to the 0-100 range (used for ATB and limit gauge safety).
function clamp01(v){ return Math.max(0, Math.min(100, v)); }

// ── Main component ────────────────────────────────────────────────────

// BattleScene — the entire battle UI and game-loop for one encounter.
// Props:
//   stageKey        — fallback stage name when no `encounter` prop is given.
//   initialTurnSpeed — ATB tick multiplier (higher = faster turns).
//   encounter       — explicit encounter descriptor from the world map
//                     { bg, enemies[], tier, boss }. Overrides stageKey.
//   party           — array of 3 hero name strings for the current party.
//   onComplete      — called with { result:'victory'|'defeat', encounter }
//                     when the battle ends.
function BattleScene({ stageKey='TEMP CAVES', initialTurnSpeed=1, encounter, party, onComplete }){
  // Resolve encounter — explicit prop wins, else fall back to STAGES table.
  const resolvedEncounter = useMemoB(()=>{
    if(encounter && encounter.enemies) return {
      bg: encounter.bg || 'TEMP CAVES',
      enemies: encounter.enemies,
      tier: encounter.tier || 1,
      boss: !!encounter.boss,
    };
    const s = STAGES[stageKey] || STAGES['TEMP CAVES'];
    return { bg: stageKey, enemies: s.encs, tier: 1, boss: false };
  }, [encounter, stageKey]);

  // Build initial units --------------------------------------------------

  // Constructs the flat `units` map for a fresh encounter.
  // Heroes are built from HEROES_DEF; enemies from ENEMY_KINDS (defined in a
  // sibling file). Tier scaling is applied multiplicatively to HP, damage, and
  // speed. Boss units receive an additional 30% HP/damage boost.
  const initUnits = useCallbackB((enc) => {
    const tier = enc.tier || 1;
    // Tier scaling curve — each tier adds +35% HP, +22% damage, +6% speed.
    const hpMult  = 1 + (tier-1) * 0.35;
    const dmgMult = 1 + (tier-1) * 0.22;
    const spdMult = 1 + (tier-1) * 0.06;
    const partyNames = (party && party.length === 3) ? party
      : ['CURSOR.EXE','GUARD.SYS','PURGE.BAT'];
    // Build hero unit objects, staggering their starting ATB so they don't all
    // become ready at the same instant at the top of the first round.
    const heroes = partyNames.map((name, i) => {
      const d = HEROES_DEF[name] || HEROES_DEF['CURSOR.EXE'];
      return [`h${i}`, {
        side:'hero', kind:name, alive:true,
        hp: d.hpMax, hpMax: d.hpMax,
        cpu: d.cpuMax, cpuMax: d.cpuMax,
        atb: 15 + i*8, ready:false,
        limit: 25,   // limit starts partially charged so the first use isn't instant
        spd: d.spd,
        atk: d.atk,
        sprite: d.sprite,
        body: d.body, rim: d.rim, dark: d.dark, acc: d.acc, eye: d.eye,
        defending: false, exposed: false, shield: 0, taunt: 0,
        flash: 0, hopAt: 0, hurtAt: 0,
        portraitName: name,
      }];
    });
    // Build enemy unit objects, applying tier and optional boss multipliers.
    const enemies = enc.enemies.map((kind, i) => {
      const k = ENEMY_KINDS[kind];
      const isBoss = enc.boss && i === 0;  // only the first enemy is the boss unit
      const bossBoost = isBoss ? 1.3 : 1.0;
      return [`e${i}`, {
        side:'enemy', kind, alive:true, boss:isBoss,
        hp: Math.round(k.hp * hpMult * bossBoost),
        hpMax: Math.round(k.hp * hpMult * bossBoost),
        atb: rnd(0,40),  // randomise starting ATB so enemies don't act in lock-step
        spd: k.spd * spdMult,
        atk: [Math.round(k.dmg[0]*dmgMult*(isBoss?1.4:1)), Math.round(k.dmg[1]*dmgMult*(isBoss?1.4:1))],
        // Scale each named attack's damage/heal ranges by tier and boss multipliers.
        attacks: Array.isArray(k.attacks) ? k.attacks.map(a => {
          const o = { name: a.name, kind: a.kind || 'single' };
          if(a.dmg)  o.dmg  = [Math.round(a.dmg[0]*dmgMult*(isBoss?1.4:1)), Math.round(a.dmg[1]*dmgMult*(isBoss?1.4:1))];
          if(a.heal) o.heal = [Math.round(a.heal[0]*(isBoss?1.3:1)), Math.round(a.heal[1]*(isBoss?1.3:1))];
          return o;
        }) : null,
        xp: Math.round(k.xp * (1 + (tier-1)*0.4)),
        sprite: k.grid,
        body: k.body, rim: k.rim, dark: k.dark, acc: k.acc, eye: k.eye,
        flash: 0, deathAt: 0, hurtAt: 0,
        silenced: 0, frozen: 0,
        phase: 1,
      }];
    });
    return Object.fromEntries([...heroes, ...enemies]);
  }, [party]);

  const [units, setUnits] = useStateB(() => initUnits(resolvedEncounter));
  const [encState, setEncState] = useStateB(resolvedEncounter);
  const [speed, setSpeed] = useStateB(initialTurnSpeed);

  // Reset all battle state whenever the encounter descriptor changes
  // (e.g. the map sends a new fight node while the component stays mounted).
  useEffectB(() => {
    setEncState(resolvedEncounter);
    setUnits(initUnits(resolvedEncounter));
    setLog([]); setPopups([]); setPhase(resolvedEncounter.boss ? 'boss-intro' : 'intro');
    setActiveHero(null); setMenu('main'); setMenuSel(0);
    setPendingAction(null); setTargetSel(0);
    animLock.current = false;
  }, [resolvedEncounter, initUnits]);

  // Stage controls for the standalone Tweaks panel (only used by Battle Scene.html).
  // Inside the Landing flow the encounter is driven by the map, not this state.
  const [stage, setStage] = useStateB(stageKey);

  // When the standalone stage selector changes, rebuild the encounter descriptor.
  useEffectB(()=>{
    if(encounter) return; // stage tweak disabled when encounter prop is in control
    const s = STAGES[stage];
    if(!s) return;
    setEncState({ bg: stage, enemies: s.encs, tier: 1, boss: stage==='CORE CHAMBER' });
  }, [stage, encounter]);

  // When encState is rebuilt (standalone mode only), reinitialise all units and
  // reset menus/phase to a clean slate.
  useEffectB(()=>{
    if(encounter) return;
    setUnits(initUnits(encState));
    setLog([]); setPopups([]); setPhase(encState.boss ? 'boss-intro' : 'intro');
    setActiveHero(null); setMenu('main'); setMenuSel(0);
    setPendingAction(null); setTargetSel(0);
    animLock.current = false;
  }, [encState, encounter, initUnits]);

  // Command stack: 'main' | 'script' | 'item' | 'target' | 'limit'
  const [activeHero, setActiveHero] = useStateB(null); // id of hero currently awaiting player input
  const [menu, setMenu] = useStateB('main');            // which sub-menu panel is shown
  const [menuSel, setMenuSel] = useStateB(0);           // highlighted row within the current menu
  const [pendingAction, setPendingAction] = useStateB(null); // {kind, label, source, payload}
  const [targetSel, setTargetSel] = useStateB(0);       // which unit is highlighted in target-select mode
  const [items, setItems] = useStateB(ITEMS_DEF.map(i => ({...i})));  // live item stack (qty decrements on use)
  const [log, setLog] = useStateB([]);                  // combat log lines (capped at 30)
  const [popups, setPopups] = useStateB([]);            // floating damage/status popups { id, unitId, text, kind, t }
  const [phase, setPhase] = useStateB('intro');         // intro | boss-intro | battle | victory | defeat
  const [activeAnim, setActiveAnim] = useStateB(null);  // { actorId, targetId, kind } — drives sprite animation
  const animLock = useRefB(false);                      // true while an action animation is in-flight; blocks ATB

  // Intro: hex resolve into pixels (or boss warning).
  // Automatically advances to 'battle' after the intro cinematic delay.
  useEffectB(()=>{
    if(phase === 'intro'){
      const t = setTimeout(()=> setPhase('battle'), 1400);
      return ()=>clearTimeout(t);
    }
    if(phase === 'boss-intro'){
      // Boss intro is longer to give the player time to read the warning.
      const t = setTimeout(()=> setPhase('battle'), 2600);
      return ()=>clearTimeout(t);
    }
  }, [phase]);

  // Append a line to the combat log, capping history at the last 30 entries.
  const pushLog = useCallbackB((line, kind='') => {
    setLog(L => [...L.slice(-30), { id: tick(), line, kind }]);
  }, []);

  // Spawn a floating popup above a unit (damage number, status text, etc.)
  // and automatically remove it after 1.2 seconds.
  const pushPop = useCallbackB((unitId, text, kind='dmg') => {
    const id = tick();
    setPopups(P => [...P, { id, unitId, text, kind, t: Date.now() }]);
    setTimeout(()=> setPopups(P => P.filter(p => p.id !== id)), 1200);
  }, []);

  // ATB tick — fires every 80 ms while `phase === 'battle'`.
  // Each alive, unfrozen unit's ATB advances by spd * speed.
  // Heroes whose ATB reaches 100 get their `ready` flag set, triggering
  // the pick-active-hero effect below. The animLock guard pauses the tick
  // during action animations so gauges don't run while moves play out.
  useEffectB(()=>{
    if(phase !== 'battle') return;
    const iv = setInterval(()=>{
      setUnits(prev => {
        if(animLock.current) return prev;
        const next = {...prev};
        let changed = false;
        for(const [id, u] of Object.entries(prev)){
          if(!u.alive) continue;
          // Heroes stay frozen at 100 until the player issues a command.
          if(u.side === 'hero' && u.atb >= 100) continue;
          // Enemies stay frozen at 100 until the AI acts (handled in the enemy
          // turn driver effect below).
          if(u.side === 'enemy' && u.atb >= 100) continue;
          // Frozen units burn down their freeze counter instead of advancing ATB.
          if(u.frozen && u.frozen > 0){
            next[id] = {...u, frozen: u.frozen - 1};
            changed = true; continue;
          }
          const v = Math.min(100, u.atb + u.spd * speed);
          if(v !== u.atb){ next[id] = {...u, atb: v, ready: v >= 100 && u.side==='hero' }; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 80);
    return ()=>clearInterval(iv);
  }, [phase, speed]);

  // Pick active hero — promotes the first ready hero to `activeHero` so the
  // player can input their command. Only one hero can be active at a time.
  useEffectB(()=>{
    if(activeHero) return;
    const ready = Object.entries(units).find(([id,u]) => u.side==='hero' && u.alive && u.atb >= 100);
    if(ready){
      setActiveHero(ready[0]);
      setMenu('main'); setMenuSel(0);
    }
  }, [units, activeHero]);

  // Enemy turn driver — finds the first enemy whose ATB has reached 100 and is
  // not silenced or frozen, then immediately fires its attack. Only one enemy
  // acts at a time; animLock prevents re-entry during the attack animation.
  useEffectB(()=>{
    if(phase !== 'battle') return;
    if(animLock.current) return;
    const enemy = Object.entries(units).find(([id,u]) =>
      u.side==='enemy' && u.alive && u.atb >= 100 && !u.silenced && !u.frozen);
    if(!enemy) return;
    const [eid, eu] = enemy;
    // Pick a target hero — prefer the unit that has taunted (pulled aggro).
    const heroes = Object.entries(units).filter(([id,u]) => u.side==='hero' && u.alive);
    if(heroes.length === 0) return;
    // Taunt: targets the taunting hero
    const taunting = heroes.find(([id,u]) => u.taunt > 0);
    const [tid, tu] = taunting || heroes[rnd(0, heroes.length-1)];
    runEnemyAttack(eid, tid);
  }, [units, phase]);

  // Run an enemy attack with animation -----------------------------------

  // Executes a single enemy turn: picks an attack pattern from the enemy's
  // `attacks` array (or falls back to its plain `atk` range), plays the hop
  // animation, waits ~360 ms, resolves damage/heal/status, then clears the
  // animLock and calls checkBattleEnd.
  const runEnemyAttack = useCallbackB((eid, tid) => {
    if(animLock.current) return;
    animLock.current = true;
    const e = units[eid]; const t = units[tid];
    if(!e || !t) { animLock.current = false; return; }
    // Pick a named attack pattern if available; else fall back to plain attack.
    const pick = (Array.isArray(e.attacks) && e.attacks.length)
      ? e.attacks[rnd(0, e.attacks.length - 1)] : null;
    const kind = pick?.kind || 'single';
    const atkLabel = pick ? pick.name.toLowerCase() : 'attack';
    const atkRange = pick && pick.dmg ? pick.dmg : e.atk;
    const healRange = pick && pick.heal ? pick.heal : [20, 40];

    // Humanise the log target tag based on attack type.
    const targetTag =
      kind === 'aoe'    ? '(*all)' :
      kind === 'heal'   ? '(ally)' :
      kind === 'shield' ? '(self)' :
      kind === 'buff'   ? '(self)' : `(${t.kind})`;
    pushLog(`> ${e.kind}_${eid.slice(1)} :: ${atkLabel}${targetTag}`, 'enemy');
    setActiveAnim({ actorId: eid, targetId: tid, kind: 'enemy-attack' });
    setUnits(p => ({...p, [eid]: {...p[eid], hopAt: Date.now()}}));

    setTimeout(()=>{
      if(kind === 'aoe'){
        // Hit all alive heroes for independently rolled damage each.
        const heroIds = Object.entries(units)
          .filter(([id,u]) => u.side==='hero' && u.alive).map(([id]) => id);
        setUnits(p => {
          const next = {...p};
          heroIds.forEach(hid => {
            const hu = {...next[hid]};
            const roll = rnd(atkRange[0], atkRange[1]);
            let d = roll;
            if(hu.defending) d = Math.floor(d * 0.4);  // GUARD reduces to 40%
            if(hu.shield > 0){ d = Math.floor(d * 0.5); hu.shield = Math.max(0, hu.shield - 1); }
            hu.hp = Math.max(0, hu.hp - d);
            hu.hurtAt = Date.now();
            // Damage received fills the limit gauge — bigger hits charge it faster.
            hu.limit = Math.min(100, hu.limit + Math.min(24, Math.max(6, d)));
            if(hu.hp <= 0) hu.alive = false;
            hu.defending = false;   // defending stance resets after absorbing one attack
            next[hid] = hu;
          });
          next[eid] = {...next[eid], atb: 0};  // reset enemy ATB after acting
          return next;
        });
        // Spawn individual damage popups per hero (best-effort approximation of the
        // final damage amount — the exact values are computed inside setUnits above).
        heroIds.forEach(hid => {
          const hu = units[hid];
          const d = rnd(atkRange[0], atkRange[1]);
          pushPop(hid, `${d}`, 'dmg');
        });
        pushLog(`  └─ AOE — every hero hit`, 'dmg');
      }
      else if(kind === 'heal'){
        // Heal the enemy ally with the lowest HP percentage (self-inclusive).
        const allies = Object.entries(units)
          .filter(([id,u]) => u.side==='enemy' && u.alive)
          .sort((a,b) => (a[1].hp/a[1].hpMax) - (b[1].hp/b[1].hpMax));
        const [aid, au] = allies[0] || [eid, e];
        const amt = rnd(healRange[0], healRange[1]);
        setUnits(p => {
          const next = {...p};
          const aa = {...next[aid]};
          aa.hp = Math.min(aa.hpMax, aa.hp + amt);  // cap at hpMax to avoid overflow
          next[aid] = aa;
          next[eid] = {...next[eid], atb: 0};
          return next;
        });
        pushPop(aid, `+${amt}`, 'heal');
        pushLog(`  └─ ${au.kind}: +${amt} INTEGRITY (healed)`, 'heal');
      }
      else if(kind === 'shield'){
        // Grant self a 2-hit damage-absorbing firewall.
        setUnits(p => {
          const next = {...p};
          next[eid] = {...next[eid], shield: 2, atb: 0};
          return next;
        });
        pushPop(eid, `+FIREWALL`, 'block');
        pushLog(`  └─ ${e.kind}: firewall raised (2 hits)`, 'block');
      }
      else if(kind === 'buff'){
        // Self-haste: jump the enemy's ATB forward so their next turn comes sooner.
        setUnits(p => {
          const next = {...p};
          next[eid] = {...next[eid], atb: 60};  // jump to 60% — still needs more time before acting again
          return next;
        });
        pushLog(`  └─ ${e.kind}: process priority boosted`, '');
      }
      else {
        // Single-target damage (default case).
        const dmgRoll = rnd(atkRange[0], atkRange[1]);
        const blocked = t.shield > 0;
        const defending = t.defending;
        let dmg = dmgRoll;
        if(defending) dmg = Math.floor(dmg * 0.4);   // GUARD reduces damage to 40%
        if(blocked)   dmg = Math.floor(dmg * 0.5);   // shield halves damage
        setUnits(p => {
          const next = {...p};
          const tt = {...next[tid]};
          tt.hp = Math.max(0, tt.hp - dmg);
          tt.hurtAt = Date.now();
          tt.limit = Math.min(100, tt.limit + Math.min(32, Math.max(8, dmg)));
          if(tt.shield > 0) tt.shield = Math.max(0, tt.shield - 1);  // consume one shield charge
          if(tt.hp <= 0){ tt.alive = false; }
          tt.defending = false;
          next[tid] = tt;
          next[eid] = {...next[eid], atb: 0};
          return next;
        });
        pushPop(tid, `${dmg} [${hexAddr()}]`, blocked ? 'block' : 'dmg');
        pushLog(`  └─ ${t.kind}: -${dmg} INTEGRITY${blocked?' (firewall absorbed 50%)':''}${defending?' (defending)':''}`, 'dmg');
      }
      // Release the animation lock and check for a winner.
      setTimeout(()=>{
        setActiveAnim(null);
        animLock.current = false;
        checkBattleEnd();
      }, 240);
    }, 360);  // 360 ms hop animation before applying damage
  }, [units, pushLog, pushPop]);

  // Battle end check — reads the current unit map and transitions `phase` to
  // 'victory' or 'defeat' if one side has been completely eliminated.
  const checkBattleEnd = useCallbackB(() => {
    setUnits(p => {
      const enemiesAlive = Object.values(p).some(u => u.side==='enemy' && u.alive);
      const heroesAlive  = Object.values(p).some(u => u.side==='hero' && u.alive);
      if(!enemiesAlive){ setPhase('victory'); }
      else if(!heroesAlive){ setPhase('defeat'); }
      return p;
    });
  }, []);

  // Execute a hero command ----------------------------------------------

  // resolveAction — the central action resolver for all hero commands.
  // Plays the actor's hop animation, waits ~320 ms, then applies the action's
  // effect to the unit map in a single `setUnits` call. Afterwards it clears
  // the animLock, resets the active hero, and checks for battle end.
  // `action` shape: { kind, source, targetId?, script?, item?, cost?, label }
  const resolveAction = useCallbackB((action) => {
    const { kind, source, targetId, script, item, label } = action;
    const actor = units[source];
    if(!actor) return;
    animLock.current = true;
    setActiveAnim({ actorId: source, targetId, kind });
    setUnits(p => ({...p, [source]: {...p[source], hopAt: Date.now()}}));

    setTimeout(()=>{
      setUnits(prev => {
        const next = {...prev};
        const act = {...next[source]};
        let logLine = '';
        let logKind = 'hero';

        // Deduct CPU cost before resolving the effect.
        if(action.cost) act.cpu = Math.max(0, act.cpu - action.cost);

        if(kind === 'execute'){
          // Basic attack — uses actor.atk range, target-side damage.
          const dmg = rollDamage(actor, prev[targetId]);
          applyDamage(next, targetId, dmg.amount, dmg.crit, false, source);
          logLine = `> ${actor.kind} :: click(${prev[targetId].kind}_${targetId.slice(1)})  → -${dmg.amount}${dmg.crit?' BUFFER_OVERFLOW':''}`;
        }
        else if(kind === 'guard'){
          // Set defending flag — next hit deals only 40% damage.
          next[source] = {...next[source], defending: true};
          logLine = `> ${actor.kind} :: firewall_up()  → +DEF this round`;
        }
        else if(kind === 'flee'){
          // Flee is always "failed" in the current design; kept as a log stub.
          logLine = `> ${actor.kind} :: process.exit(0)  → escape attempt failed`;
        }
        else if(kind === 'script' && script){
          if(script.kind === 'single' && script.dmg){
            // Single-target skill damage — uses script.dmg range.
            const dmg = rollDamage(actor, prev[targetId], script.dmg);
            applyDamage(next, targetId, dmg.amount, dmg.crit, false, source);
            logLine = `> ${actor.kind} :: ${script.label} → ${prev[targetId].kind}_${targetId.slice(1)} -${dmg.amount}${dmg.crit?' BUFFER_OVERFLOW':''}`;
          }
          else if(script.kind === 'aoe' && script.dmg){
            // AoE damage — hits every living enemy with independently rolled damage.
            let parts = [];
            Object.entries(prev).forEach(([id, u])=>{
              if(u.side === 'enemy' && u.alive){
                const dmg = rollDamage(actor, u, script.dmg);
                applyDamage(next, id, dmg.amount, false, false, source);
                parts.push(`${u.kind.split('.')[0]}:-${dmg.amount}`);
              }
            });
            logLine = `> ${actor.kind} :: ${script.label}  →  AoE [${parts.join(' ')}]`;
          }
          else if(script.kind === 'heal'){
            // Single-target ally heal.
            const amt = rnd(script.heal[0], script.heal[1]);
            const tt = {...next[targetId]};
            tt.hp = Math.min(tt.hpMax, tt.hp + amt);
            next[targetId] = tt;
            pushPop(targetId, `+${amt} INTG`, 'heal');
            logLine = `> ${actor.kind} :: ${script.label} → ${prev[targetId].kind} +${amt} INTEGRITY`;
            logKind = 'heal';
          }
          else if(script.kind === 'aoehel'){
            // AoE heal — restores the same rolled amount to every living hero.
            const amt = rnd(script.heal[0], script.heal[1]);
            Object.entries(prev).forEach(([id, u])=>{
              if(u.side === 'hero' && u.alive){
                const tt = {...next[id]};
                tt.hp = Math.min(tt.hpMax, tt.hp + amt);
                next[id] = tt;
                pushPop(id, `+${amt}`, 'heal');
              }
            });
            logLine = `> ${actor.kind} :: ${script.label}  → all party +${amt} INTEGRITY`;
            logKind = 'heal';
          }
          else if(script.kind === 'buff' && script.extra === 'shield'){
            // Apply a 2-hit firewall to the target ally.
            next[targetId] = {...next[targetId], shield: 2};
            logLine = `> ${actor.kind} :: ${script.label}  → ${prev[targetId].kind} SHIELDED`;
          }
          else if(script.kind === 'buff' && script.extra === 'taunt'){
            // Pull all enemy aggro to the caster for 3 enemy actions.
            next[source] = {...next[source], taunt: 3};
            logLine = `> ${actor.kind} :: reroute() → aggro pulled to ${actor.kind}`;
          }
          else if(script.kind === 'debuff' && script.extra === 'silence'){
            // Silence: target skips their next 2 ATB actions.
            next[targetId] = {...next[targetId], silenced: 2};
            pushPop(targetId, 'CHMOD 000', 'status');
            logLine = `> ${actor.kind} :: ${script.label}  → ${prev[targetId].kind} PERMISSION_DENIED`;
          }
          else if(script.kind === 'debuff' && script.extra === 'freeze'){
            // Freeze: pause target's ATB for ~28 ticks (≈ 2.2 seconds at default speed).
            next[targetId] = {...next[targetId], frozen: 28, atb: 0};
            pushPop(targetId, 'QUARANTINED', 'status');
            logLine = `> ${actor.kind} :: ${script.label}  → ${prev[targetId].kind} QUARANTINED`;
          }
          else if(script.kind === 'debuff' && script.extra === 'expose'){
            // Expose: mark the target so the next hit against them is a guaranteed crit.
            next[targetId] = {...next[targetId], exposed: true};
            pushPop(targetId, 'EXPOSED', 'status');
            logLine = `> ${actor.kind} :: ${script.label}  → ${prev[targetId].kind} weakness exposed`;
          }
        }
        else if(kind === 'item' && item){
          if(item.kind === 'heal'){
            // Heal item — restore flat HP to one ally.
            const tt = {...next[targetId]};
            tt.hp = Math.min(tt.hpMax, tt.hp + item.amt);
            next[targetId] = tt;
            pushPop(targetId, `+${item.amt} INTG`, 'heal');
            logLine = `> ${actor.kind} :: use(${item.label}) on ${prev[targetId].kind}  → +${item.amt} INTEGRITY`;
            logKind = 'heal';
          }
          else if(item.kind === 'mp'){
            // CPU restore item — replenish skill resource for one ally.
            const tt = {...next[targetId]};
            tt.cpu = Math.min(tt.cpuMax, tt.cpu + item.amt);
            next[targetId] = tt;
            pushPop(targetId, `+${item.amt} CPU%`, 'heal');
            logLine = `> ${actor.kind} :: use(${item.label}) on ${prev[targetId].kind}  → +${item.amt} CPU%`;
            logKind = 'heal';
          }
          else if(item.kind === 'revive'){
            // Revive item — bring a dead ally back with the item's fixed HP value.
            const tt = {...next[targetId]};
            tt.hp = item.amt; tt.alive = true; tt.atb = 0;
            next[targetId] = tt;
            pushPop(targetId, `REVIVED`, 'heal');
            logLine = `> ${actor.kind} :: restore_point.bak(${prev[targetId].kind})  → process reanimated`;
            logKind = 'heal';
          }
          else if(item.kind === 'bomb'){
            // Offensive item — flat damage ignoring expose, always treated as crit popup.
            applyDamage(next, targetId, item.amt, true, false, source);
            logLine = `> ${actor.kind} :: deploy(${item.label}) → ${prev[targetId].kind} -${item.amt}`;
          }
          // Decrement the item's remaining quantity (cannot go below 0).
          setItems(I => I.map(x => x.id === item.id ? {...x, qty: Math.max(0, x.qty-1)} : x));
        }
        else if(kind === 'limit'){
          // Limit break — hero-specific super move, fires once the gauge is full.
          const heroKind = actor.kind;
          if(heroKind === 'CURSOR.EXE'){
            // CLICKSTORM: 6 random hits spread across alive enemies, each rolling 35-55.
            const enemies = Object.entries(prev).filter(([id,u]) => u.side==='enemy' && u.alive);
            let parts = [];
            for(let i=0; i<6; i++){
              if(enemies.length === 0) break;
              const [tid, tu] = enemies[rnd(0, enemies.length-1)];
              const amt = rnd(35, 55);
              applyDamage(next, tid, amt, true, false, source);
              parts.push(`${tu.kind.split('.')[0]}_-${amt}`);
            }
            logLine = `>>> LIMIT :: CURSOR.EXE :: CLICKSTORM  ${parts.join(' ')}`;
          }
          else if(heroKind === 'GUARD.SYS'){
            // PORT 22 LOCKDOWN: give every living hero a 3-hit shield and the defending flag.
            Object.entries(prev).forEach(([id, u])=>{
              if(u.side==='hero' && u.alive){
                next[id] = {...next[id], shield: 3, defending: true};
              }
            });
            logLine = `>>> LIMIT :: GUARD.SYS :: PORT 22 LOCKDOWN  → party FIREWALLED`;
            logKind = 'heal';
          }
          else if(heroKind === 'PURGE.BAT'){
            // rm -rf /malware/*: instant 999 damage (one-shot) to every living enemy.
            Object.entries(prev).forEach(([id, u])=>{
              if(u.side==='enemy' && u.alive){
                applyDamage(next, id, 999, true, false, source);
              }
            });
            logLine = `>>> LIMIT :: PURGE.BAT :: rm -rf /malware/*  → WIPED`;
          }
          act.limit = 0;  // drain the limit gauge to zero after use
        }

        act.atb = 0;
        act.ready = false;
        if(kind !== 'limit'){
          // Non-limit actions passively charge the limit gauge a small amount.
          act.limit = Math.min(100, act.limit + 16);
        }
        // Merge meta changes back onto whatever next[source] currently is —
        // preserves hp/shield/taunt/defending updates applied to source
        // during this same resolve (self-heal, GUARD.SYS limit, self-shield…).
        next[source] = {
          ...next[source],
          cpu: act.cpu,
          atb: 0,
          ready: false,
          limit: act.limit,
          hopAt: act.hopAt,
        };
        if(logLine) pushLog(logLine, logKind);
        return next;
      });

      // After the hit frame, release the lock and clear the active-hero prompt.
      setTimeout(()=>{
        setActiveAnim(null);
        animLock.current = false;
        setActiveHero(null);
        setMenu('main');
        setPendingAction(null);
        checkBattleEnd();
      }, 280);
    }, 320);  // 320 ms hop animation before resolving effects
  }, [units, pushLog, pushPop, checkBattleEnd]);

  // damage / crit helpers ------------------------------------------------

  // rollDamage — rolls a random value from baseRange (or actor.atk if omitted)
  // and applies crit logic. Returns { amount, crit }.
  // Exposed targets always crit (×1.6); otherwise there's an 8% random-crit
  // chance (×1.7).
  function rollDamage(actor, target, baseRange){
    const range = baseRange || actor.atk;
    let amount = rnd(range[0], range[1]);
    let crit = false;
    if(target && target.exposed){ amount = Math.floor(amount*1.6); crit = true; }
    else if(Math.random() < 0.08){ amount = Math.floor(amount*1.7); crit = true; }
    return { amount, crit };
  }

  // applyDamage — writes damage onto the target unit inside the `next` draft map.
  // Handles shield charge consumption, kills the unit when HP reaches 0, clears
  // the `exposed` flag after it procs, and charges the attacker's limit gauge
  // proportional to the damage dealt (hero attackers only).
  function applyDamage(next, tid, amount, crit, fromEnemy, sourceId){
    const tt = {...next[tid]};
    let dmg = amount;
    if(tt.shield > 0){ dmg = Math.floor(dmg * 0.5); }  // shield halves damage
    tt.hp = Math.max(0, tt.hp - dmg);
    tt.hurtAt = Date.now();
    if(tt.exposed){ tt.exposed = false; }   // expose is a one-shot debuff
    if(tt.shield > 0){ tt.shield = Math.max(0, tt.shield - 1); }
    if(tt.hp <= 0) tt.alive = false;
    next[tid] = tt;
    // Reward limit gauge on hero offense — bigger hits charge faster.
    if(!fromEnemy && sourceId && next[sourceId] && next[sourceId].side === 'hero'){
      const src = {...next[sourceId]};
      src.limit = Math.min(100, src.limit + Math.min(24, 6 + Math.floor(dmg / 6)));
      next[sourceId] = src;
    }
    pushPop(tid, `${dmg} [${hexAddr()}]`, crit ? 'crit' : 'dmg');
  }

  // Menu helpers ---------------------------------------------------------

  // commitMain — processes a selection from the top-level command panel.
  // Routes to target selection, sub-menus, or immediate resolution depending
  // on the command chosen.
  function commitMain(label){
    if(!activeHero) return;
    const heroKind = units[activeHero].kind;
    const heroDef = HEROES_DEF[heroKind];
    if(label === 'EXECUTE'){
      setPendingAction({ kind:'execute', source: activeHero, label });
      setMenu('target'); setTargetSel(0);
    } else if(label === 'SCRIPT'){
      setMenu('script'); setMenuSel(0);
    } else if(label === 'ITEM'){
      setMenu('item'); setMenuSel(0);
    } else if(label === 'GUARD'){
      resolveAction({ kind:'guard', source: activeHero, label });
    } else if(label === 'LIMIT'){
      const u = units[activeHero];
      if(u.limit < 100) return;  // silently reject if gauge not full
      resolveAction({ kind:'limit', source: activeHero, label });
    } else if(label === 'FLEE'){
      resolveAction({ kind:'flee', source: activeHero, label });
    }
  }

  // commitScript — processes a script selection. AoE and AoE-heal scripts
  // resolve immediately without target selection; single-target and buff scripts
  // push to the target submenu.
  function commitScript(script){
    if(units[activeHero].cpu < script.cost) return;  // reject if not enough CPU
    setPendingAction({ kind:'script', source: activeHero, script, cost: script.cost });
    if(script.kind === 'aoe' || script.kind === 'aoehel'){
      // auto-resolve
      resolveAction({ kind:'script', source: activeHero, script, cost: script.cost });
    } else if(script.kind === 'heal' || script.kind === 'buff'){
      setMenu('target'); setTargetSel(0);
    } else {
      setMenu('target'); setTargetSel(0);
    }
  }

  // commitItem — validates the item has remaining stock, then enters target
  // selection mode. The item descriptor is stored in pendingAction for use
  // once the player confirms a target.
  function commitItem(item){
    if(item.qty <= 0) return;
    setPendingAction({ kind:'item', source: activeHero, item });
    setMenu('target'); setTargetSel(0);
  }

  // commitTarget — fires resolveAction with the pending action fused with the
  // selected target's unit id.
  function commitTarget(tid){
    if(!pendingAction) return;
    resolveAction({ ...pendingAction, targetId: tid });
  }

  // back — navigates one level up in the command menu hierarchy (target or
  // sub-menu → main). Clears any pending action that was staged for targeting.
  function back(){
    if(menu === 'target' || menu === 'script' || menu === 'item'){
      setMenu('main'); setMenuSel(0); setPendingAction(null);
    }
  }

  // Keyboard -------------------------------------------------------------

  // Global keydown handler — routes arrow keys and Enter/Space to the correct
  // menu or target pool depending on `phase` and `menu`. Uses `window` so it
  // captures input even when no focusable element is selected.
  useEffectB(()=>{
    function onKey(e){
      if(phase === 'victory' || phase === 'defeat'){
        // Any confirm key dismisses the end-screen and fires onComplete.
        if(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape'){
          if(onComplete){ onComplete({ result: phase, encounter: encState }); }
          else { setStage(stage); /* reset */ }
          e.preventDefault();
        }
        return;
      }
      if(phase === 'boss-intro' || phase === 'intro'){
        // Allow the player to skip the intro cinematic.
        if(e.key === 'Enter' || e.key === ' '){
          setPhase('battle'); e.preventDefault();
        }
        return;
      }
      if(!activeHero) return;
      const heroKind = units[activeHero].kind;
      const heroDef = HEROES_DEF[heroKind];
      if(menu === 'main'){
        const opts = mainOptions(units[activeHero]);
        if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){
          setMenuSel(s => (s+1)%opts.length); e.preventDefault();
        } else if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){
          setMenuSel(s => (s-1+opts.length)%opts.length); e.preventDefault();
        } else if(e.key === 'Enter' || e.key === ' '){
          commitMain(opts[menuSel].label); e.preventDefault();
        }
      } else if(menu === 'script'){
        const list = heroDef.scripts;
        if(e.key === 'ArrowDown'){ setMenuSel(s=>(s+1)%list.length); e.preventDefault(); }
        else if(e.key === 'ArrowUp'){ setMenuSel(s=>(s-1+list.length)%list.length); e.preventDefault(); }
        else if(e.key === 'Enter' || e.key === ' '){ commitScript(list[menuSel]); e.preventDefault(); }
        else if(e.key === 'Escape' || e.key === 'Backspace'){ back(); e.preventDefault(); }
      } else if(menu === 'item'){
        const list = items.filter(i => i.qty > 0);
        if(list.length === 0) { if(e.key==='Escape'){back();} return; }
        if(e.key === 'ArrowDown'){ setMenuSel(s=>(s+1)%list.length); e.preventDefault(); }
        else if(e.key === 'ArrowUp'){ setMenuSel(s=>(s-1+list.length)%list.length); e.preventDefault(); }
        else if(e.key === 'Enter' || e.key === ' '){ commitItem(list[menuSel]); e.preventDefault(); }
        else if(e.key === 'Escape' || e.key === 'Backspace'){ back(); e.preventDefault(); }
      } else if(menu === 'target'){
        // Determine which side of the unit map the pending action targets.
        // Items default to heroes except bombs; scripts default to enemies except
        // heal/buff types; plain execute always targets enemies.
        const heroSide = pendingAction && (pendingAction.kind === 'item'
          ? (pendingAction.item.kind === 'bomb' ? 'enemy' : 'hero')
          : pendingAction.kind === 'script'
            ? (pendingAction.script.kind === 'heal' || pendingAction.script.kind === 'buff' ? 'hero' : 'enemy')
            : 'enemy');
        const pool = Object.entries(units).filter(([id,u]) => u.side === heroSide && u.alive).map(([id])=>id);
        if(pool.length === 0){ back(); return; }
        if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
          setTargetSel(s=>(s-1+pool.length)%pool.length); e.preventDefault();
        } else if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
          setTargetSel(s=>(s+1)%pool.length); e.preventDefault();
        } else if(e.key === 'Enter' || e.key === ' '){
          commitTarget(pool[targetSel]); e.preventDefault();
        } else if(e.key === 'Escape' || e.key === 'Backspace'){
          back(); e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [activeHero, menu, menuSel, targetSel, units, items, pendingAction, phase, stage, encState, onComplete]);

  // Returns the array of top-level command options for the given hero.
  // The LIMIT option includes the current charge percentage and is marked
  // disabled until the gauge reaches 100.
  function mainOptions(hero){
    return [
      { label:'EXECUTE', desc:'Basic click attack — no CPU.' },
      { label:'SCRIPT',  desc:'Run a process from your library.' },
      { label:'ITEM',    desc:'Use a file from your inventory.' },
      { label:'GUARD',   desc:'Raise firewall — halve next hit.' },
      { label:'LIMIT',   desc: hero.limit >= 100 ? `${HEROES_DEF[hero.kind].limitName} — READY` : `Charging... ${hero.limit|0}%`, disabled: hero.limit < 100 },
      { label:'FLEE',    desc:'process.exit(0) — escape attempt.' },
    ];
  }

  // ── Render ───────────────────────────────────────────────────────────

  // Responsive layout — on narrow screens (≤ 760 px) swap to the mobile layout
  // component; on wider screens keep the 1280×800 scaled canvas.
  const shellRef  = useRefB(null);
  const wrapRef   = useRefB(null);
  const stageRef  = useRefB(null);
  const [isMobile, setIsMobile] = useStateB(
    () => typeof window !== 'undefined' && window.innerWidth <= 760
  );
  useEffectB(()=>{
    function fit(){
      const shell = shellRef.current;
      if(!shell) return;
      const W = shell.clientWidth, H = shell.clientHeight;
      if(W<=0 || H<=0) return;
      const mobile = W <= 760;
      // Avoid unnecessary re-renders when the breakpoint hasn't changed.
      setIsMobile(prev => prev !== mobile ? mobile : prev);
      if(!mobile){
        const w = wrapRef.current, s = stageRef.current;
        if(!w || !s) return;
        const k = Math.min(W/1280, H/800);
        const ox = Math.round((W - 1280*k) / 2);
        const oy = Math.round((H - 800*k) / 2);
        s.style.transform = `translate(${ox}px,${oy}px) scale(${k})`;
      }
    }
    fit();
    let ro = null;
    if(window.ResizeObserver && shellRef.current){
      ro = new ResizeObserver(fit); ro.observe(shellRef.current);
    }
    window.addEventListener('resize', fit);
    return ()=>{ ro && ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // Shared callbacks passed to both mobile and desktop layouts.
  const cmdProps = {
    units, activeHero, menu, menuSel, targetSel, pendingAction, items,
    mainOptions,
    onPickMain:     (i)=>setMenuSel(i),
    onCommit:       (label)=>commitMain(label),
    onPickScript:   (i)=>setMenuSel(i),
    onCommitScript: (s)=>commitScript(s),
    onPickItem:     (i)=>setMenuSel(i),
    onCommitItem:   (it)=>commitItem(it),
    onSelectTarget: (tid)=>commitTarget(tid),
    onBack:         back,
  };

  return (
    <div className="b-shell" ref={shellRef}>
      {isMobile ? (
        <MobileBattleLayout
          {...cmdProps}
          phase={phase} encState={encState} log={log} popups={popups} activeAnim={activeAnim}
          onComplete={onComplete} stage={stage} setStage={setStage}/>
      ) : (
        <div className="b-stage-wrap" ref={wrapRef}>
          <div className="b-stage" ref={stageRef}>
            <div className={'b-root ' + (encState.boss ? 'b-boss-mode':'')}>
              <BattleTopbar stage={encState.bg} phase={phase} units={units} boss={encState.boss} tier={encState.tier}/>
              <div className="b-arena">
                <BattleBG stage={encState.bg}/>
                <ArenaUnits units={units} phase={phase}
                  activeHero={activeHero} menu={menu}
                  targetSel={targetSel} pendingAction={pendingAction}
                  activeAnim={activeAnim} popups={popups}/>
              </div>
              <BattleMessage units={units} activeHero={activeHero} menu={menu} pendingAction={pendingAction}
                log={log} phase={phase} stage={encState.bg}/>
              <div className="b-bottom">
                <div className="b-cmdcol">
                  <CommandPanel {...cmdProps}/>
                </div>
                <div className="b-statcol">
                  <PartyHUD units={units} activeHero={activeHero}/>
                </div>
              </div>
              {phase === 'victory' && <VictoryOverlay units={units} stage={encState.bg} boss={encState.boss}
                 onContinue={()=>{
                   if(onComplete) onComplete({ result:'victory', encounter: encState });
                   else setStage(stage);
                 }}/>}
              {phase === 'defeat'  && <DefeatOverlay
                 onContinue={()=>{
                   if(onComplete) onComplete({ result:'defeat', encounter: encState });
                   else setStage(stage);
                 }}/>}
              {phase === 'intro'      && <IntroOverlay stage={encState.bg}/>}
              {phase === 'boss-intro' && <BossIntroOverlay stage={encState.bg} bossKind={encState.enemies[0]}/>}
            </div>
          </div>
          {!encounter && <BattleTweaks stage={stage} setStage={setStage} speed={speed} setSpeed={setSpeed}/>}
        </div>
      )}
    </div>
  );
}

// Export BattleScene and static data tables to window so sibling scripts can
// reference them without a bundler.
Object.assign(window, { BattleScene, HEROES_DEF, ITEMS_DEF, STAGES });
