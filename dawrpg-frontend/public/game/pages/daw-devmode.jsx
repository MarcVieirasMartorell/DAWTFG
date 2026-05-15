// daw-devmode.jsx — Custom game studio: sprite editor, hero/enemy stats,
// node-graph map editor, intro dialogue, and playtest launcher.
//
// This file is the entire Dev Mode system. It lets players build custom "mods"
// (heroes, enemies, maps, intro text) stored in localStorage and optionally
// published to the shared dawMapStore. The top-level entry point is DevModePage,
// which routes between MyModsList (draft browser) and DevModeEditor (the
// per-draft tabbed studio). Sprites are stored as arrays of glyph strings;
// palette colours are injected at render time by the shared BSprite SVG component.
//
// Key sections (in order):
//   1. Unlock gate & limits
//   2. Sprite helpers & palettes
//   3. Default project / blank entity factories
//   4. Ability & attack templates
//   5. Storage (localStorage load/save/migrate)
//   6. injectProject — writes custom data into the live game globals
//   7. DvSpriteSvg — small sprite preview
//   8. SpriteEditor — pixel-art canvas component
//   9. HeroAbilitiesForm / EnemyAttacksForm — skill/move editors
//  10. HeroStatsBlocks / EnemyStatsBlocks — stat field groups
//  11. MapEditor — SVG node-graph editor
//  12. ListEditor — generic left-list / right-editor scaffold
//  13. InfoTab — mod metadata & intro text editor
//  14. DevModeEditor — tabbed studio shell (wraps all editor tabs)
//  15. MyModsList — draft browser / landing screen
//  16. DevModePage — top-level router and draft state manager

const {
  useState: useStateD, useEffect: useEffectD, useMemo: useMemoD,
  useCallback: useCallbackD, useRef: useRefD,
} = React;

// ── Unlock gate ────────────────────────────────────────────────────────
// Flip to false once dev mode should require all three world bosses cleared.
const DEVMODE_FORCE_UNLOCK = true;
// Returns true when the player has earned access to Dev Mode.
// Currently forced open via DEVMODE_FORCE_UNLOCK; real check requires all three world-boss clears.
function isDevModeUnlocked(clears){
  if(DEVMODE_FORCE_UNLOCK) return true;
  const c = clears || [];
  return c.includes('w1:boss') && c.includes('w2:boss') && c.includes('w3:boss');
}

// ── Limits ─────────────────────────────────────────────────────────────
// Hard caps that keep custom mods within the engine's supported range.
const DV_PARTY_SIZE = 3;
const DV_MAX_HEROES  = 3;
const DV_MAX_ENEMIES = 8;
const DV_MAX_NODES   = 12;

// ── Sprite helpers ─────────────────────────────────────────────────────
// Sprite dimensions (pixels). Each sprite is SPR_H rows of SPR_W glyph characters.
const SPR_W = 16, SPR_H = 18;
// Ordered palette slot names used throughout the editor.
const PAL_KEYS = ['body','rim','dark','acc','eye'];
// Maps each palette slot / tool name to its single-character glyph stored in the sprite grid.
const TOOL_GLYPH = { transparent:'.', body:'#', rim:'r', dark:'k', acc:'a', eye:'e' };
// Reverse lookup: glyph character → palette slot/tool name, built from TOOL_GLYPH.
const GLYPH_TO_TOOL = Object.fromEntries(Object.entries(TOOL_GLYPH).map(([k,v])=>[v,k]));

// Returns a blank sprite — all pixels set to the transparent glyph '.'.
function emptySprite(){
  return Array.from({length:SPR_H}, ()=> '.'.repeat(SPR_W));
}
// Returns a new sprite array with glyph written at row r, column c, leaving all other rows unchanged.
function setSpriteCell(sprite, r, c, glyph){
  const next = sprite.slice();
  const row = next[r];
  next[r] = row.substring(0, c) + glyph + row.substring(c+1);
  return next;
}

// 5 starter palettes — name + 5 colors body/rim/dark/acc/eye
const DV_PALETTES = [
  { name:'CURSOR',  body:'#3a3a18', rim:'#d4f4a3', dark:'#020806', acc:'#fefae0', eye:'#fefae0' },
  { name:'GUARD',   body:'#3a5a8a', rim:'#9bc4ff', dark:'#0a1a3a', acc:'#fefae0', eye:'#ffdc4a' },
  { name:'PURGE',   body:'#5a1a3a', rim:'#ff6ec7', dark:'#1a0a1a', acc:'#ffdc4a', eye:'#fefae0' },
  { name:'WORM',    body:'#5a3a18', rim:'#d4a373', dark:'#1a0a00', acc:'#9a1a1a', eye:'#ffdc4a' },
  { name:'GHOUL',   body:'#9bc4ff', rim:'#e6f1ff', dark:'#13294a', acc:'#ff6ec7', eye:'#3a1a4a' },
  { name:'SLIME',   body:'#b07840', rim:'#fff1cf', dark:'#3a200a', acc:'#9a3a3a', eye:'#1a0a00' },
];

// Default placeholder sprite — a generic 16x18 humanoid silhouette.
const DEFAULT_HERO_SPRITE = [
  '....######......',
  '...########.....',
  '..##aaaaaa##....',
  '..#aakaakaa#....',
  '..#aaeeaaeaa....',
  '..##aaaaaa##....',
  '...########.....',
  '....######......',
  '...##aaaa##.....',
  '..##aaaaaa##....',
  '.##aaaaaaaa##...',
  '.#aaa####aaa#...',
  '.##aa####aa##...',
  '..#a######a#....',
  '...########.....',
  '....##rr##......',
  '....##..##......',
  '....##..##......',
];

// Default placeholder sprite — a 16x18 monster silhouette used for new enemies.
const DEFAULT_ENEMY_SPRITE = [
  '..##########....',
  '.############...',
  '##aa########aa##',
  '#aa##########aa#',
  '#a#eee####eee#a#',
  '#a#eee####eee#a#',
  '##aa########aa##',
  '###############.',
  '#k#k#k##k#k#k#..',
  '#k#k#k##k#k#k#..',
  '#a##############',
  '#a#rrrrrrrrrr#a#',
  '##aa########aa##',
  '.############...',
  '..##########....',
  '................',
  '................',
  '................',
];

// ── Default project ───────────────────────────────────────────────────
// Builds a fully-populated default project with sample heroes, enemies, and map.
function makeDefaultProject(){
  return {
    cover: null,
    title: 'MY DAW MOD',
    author: 'USER',
    intro: 'WELCOME TO MY MOD.\nThe system is compromised.\nOnly you can clean it.\n\n> PRESS ⏎ TO BEGIN',
    heroes: [
      makeBlankHero('A', 'CTRL.SH', 0),
      makeBlankHero('B', 'ALT.DLL', 1),
      makeBlankHero('C', 'TAB.EXE', 2),
    ],
    enemies: [
      makeBlankEnemy('A', 'BUGGED.PROC', 3),
      makeBlankEnemy('B', 'ZOMBIE.JOB', 5),
    ],
    map: {
      nodes: [
        { id:'start',  x:120, y:240, type:'save',  label:'/HOME',           sub:'AUTO-SAVE POINT' },
        { id:'n1',     x:300, y:200, type:'fight', label:'1-1  FIRST BUG',   sub:'TRIVIAL ENCOUNTER', encounter:{ enemies:['CUSTOM.E.A','CUSTOM.E.A'], bg:'POPUP MOOR', tier:1 } },
        { id:'n2',     x:500, y:240, type:'fight', label:'1-2  DEEPER',      sub:'TWO BUGS', encounter:{ enemies:['CUSTOM.E.A','CUSTOM.E.B'], bg:'COOKIE WOODS', tier:1 } },
        { id:'boss',   x:730, y:240, type:'boss',  label:'BOSS',             sub:'THE BIG ONE', encounter:{ enemies:['CUSTOM.E.B'], bg:'CORE CHAMBER', tier:2, boss:true } },
      ],
      edges: [['start','n1'],['n1','n2'],['n2','boss']],
    },
  };
}

// Creates a blank hero with the given id suffix, display name, and palette index.
function makeBlankHero(suffix, name, palIdx){
  const p = DV_PALETTES[palIdx % DV_PALETTES.length];
  return {
    id: `CUSTOM.${suffix}`,
    name: name,
    sprite: DEFAULT_HERO_SPRITE.slice(),
    palette: { body:p.body, rim:p.rim, dark:p.dark, acc:p.acc, eye:p.eye },
    role:    'CUSTOM',
    bio:     'A custom user-built hero.',
    hpMax:   200,
    cpuMax:  70,
    spd:     1.0,
    atk:     [20, 32],
    limitName: 'CUSTOM.LIMIT',
    limitDesc: 'Custom limit break.',
    abilities: defaultHeroAbilities(),
  };
}
// Creates a blank enemy with the given id suffix, display name, and palette index.
function makeBlankEnemy(suffix, name, palIdx){
  const p = DV_PALETTES[palIdx % DV_PALETTES.length];
  return {
    id: `CUSTOM.E.${suffix}`,
    name: name,
    sprite: DEFAULT_ENEMY_SPRITE.slice(),
    palette: { body:p.body, rim:p.rim, dark:p.dark, acc:p.acc, eye:p.eye },
    hp:    80,
    dmg:   [10, 16],
    spd:   1.0,
    xp:    20,
    attacks: defaultEnemyAttacks(),
  };
}

// ── Ability templates ─────────────────────────────────────────────────
// Metadata for each supported hero ability kind: the key used internally,
// the label shown in the editor, and which numeric field ('dmg'|'heal'|'extra') the kind requires.
const HERO_ABILITY_KINDS = [
  { k:'single', label:'SINGLE-TGT DMG', needs:'dmg' },
  { k:'aoe',    label:'AOE DAMAGE',     needs:'dmg' },
  { k:'heal',   label:'HEAL ALLY',      needs:'heal' },
  { k:'aoehel', label:'PARTY HEAL',     needs:'heal' },
  { k:'buff',   label:'BUFF ALLY',      needs:'extra' },
  { k:'debuff', label:'DEBUFF ENEMY',   needs:'extra' },
];
// Status-effect strings that can be attached to a hero ability; empty string means none.
const HERO_ABILITY_EXTRAS = ['', 'knockback','expose','shield','taunt','silence','freeze','haste'];

// Metadata for each supported enemy move kind.
const ENEMY_ATTACK_KINDS = [
  { k:'single', label:'SINGLE-TGT DMG', needs:'dmg' },
  { k:'aoe',    label:'AOE DAMAGE',     needs:'dmg' },
  { k:'heal',   label:'HEAL ALLY',      needs:'heal' },
  { k:'shield', label:'SHIELD SELF',    needs:'none' },
  { k:'buff',   label:'HASTE SELF',     needs:'none' },
];

// Returns the two starter abilities every new hero receives.
function defaultHeroAbilities(){
  return [
    { id:'atk',   label:'execute()',      cost:0,  kind:'single', dmg:[18, 28], extra:'',     desc:'Basic single-target strike.' },
    { id:'heavy', label:'force.attack()', cost:12, kind:'single', dmg:[28, 42], extra:'expose', desc:'Heavy hit; marks target.' },
  ];
}
// Returns the single default attack every new enemy receives.
function defaultEnemyAttacks(){
  return [{ id:'bite', name:'BITE', kind:'single', dmg:[10,16] }];
}

// Builds a new hero ability object using the kind at position idx (cycles through all kinds).
function newHeroAbility(idx){
  const k = HERO_ABILITY_KINDS[idx % HERO_ABILITY_KINDS.length];
  const a = {
    id: 'sk' + Math.random().toString(36).slice(2,7),
    label: 'new_skill()',
    cost: 6,
    kind: k.k,
    extra: '',
    desc: 'Edit me.',
  };
  // Add the numeric range field that the chosen kind requires.
  if(k.needs === 'dmg')  a.dmg = [12, 20];
  if(k.needs === 'heal') a.heal = [30, 50];
  return a;
}
// Builds a new enemy attack object with a random id and default single-target damage.
function newEnemyAttack(){
  return { id:'ax'+Math.random().toString(36).slice(2,5), name:'NEW ATTACK', kind:'single', dmg:[10,16] };
}


// ── Storage ────────────────────────────────────────────────────────────
const DV_STORAGE_KEY = 'daw.devmode.v1';                        // legacy single-draft
const dvDraftsKey = (uid) => `daw.devmode.drafts.v2.${uid}`;   // per-account drafts

// Backfills abilities/attacks for projects saved before those fields existed.
function migrateProject(p){
  return {
    ...p,
    heroes:  (p.heroes  || []).map(h => ({ ...h, abilities: Array.isArray(h.abilities) && h.abilities.length ? h.abilities : defaultHeroAbilities() })),
    enemies: (p.enemies || []).map(e => ({ ...e, attacks:   Array.isArray(e.attacks)   && e.attacks.length   ? e.attacks   : defaultEnemyAttacks() })),
  };
}

// Generates a unique draft id using timestamp + random suffix.
function newDraftId(){
  return 'dr_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}

// Normalizes a raw draft object: fills missing fields from makeDefaultProject, runs
// migrateProject for old saves, and ensures draftId/publishedId/updatedAt/cover exist.
function ensureDraftShape(p){
  const d = makeDefaultProject();
  const merged = migrateProject({
    title:  p.title  || d.title,
    author: p.author || d.author,
    intro:  typeof p.intro === 'string' ? p.intro : d.intro,
    heroes: Array.isArray(p.heroes)  && p.heroes.length  ? p.heroes  : d.heroes,
    enemies: Array.isArray(p.enemies) && p.enemies.length ? p.enemies : d.enemies,
    map:    p.map && Array.isArray(p.map.nodes) ? p.map : d.map,
  });
  return {
    draftId:     p.draftId     || newDraftId(),
    publishedId: p.publishedId || null,
    updatedAt:   p.updatedAt   || Date.now(),
    cover:       p.cover       || null,
    ...merged,
  };
}

// One-time migration: copies the oldest single-draft format (daw.devmode.v1) into the
// per-uid key so saves from before multi-user support survive a login event.
// The intermediate unscoped key 'daw.devmode.drafts.v2' is intentionally NOT migrated
// here because it was shared across all users and copying it would give every new user
// the same data — a privacy leak.
function migrateLegacyDevProject(uid){
  if(!uid) return;
  const key = dvDraftsKey(uid);
  try {
    if(localStorage.getItem(key)) return;
    const oldRaw = localStorage.getItem(DV_STORAGE_KEY);
    if(!oldRaw) return;
    const old = JSON.parse(oldRaw);
    if(!old || typeof old !== 'object') return;
    localStorage.setItem(key, JSON.stringify({ drafts: [ensureDraftShape(old)] }));
  } catch(e){}
}

// Loads and normalises all drafts for the given uid from localStorage, running
// legacy migration if needed; returns an empty array when nothing is saved.
function loadDevDrafts(uid){
  if(!uid) return []; // no uid → return empty; prevents cross-user data leaks
  migrateLegacyDevProject(uid);
  try {
    const raw = localStorage.getItem(dvDraftsKey(uid));
    if(!raw) return [];
    const obj = JSON.parse(raw);
    if(!obj || !Array.isArray(obj.drafts)) return [];
    return obj.drafts.map(ensureDraftShape);
  } catch(e){ return []; }
}

// Serialises the drafts array to localStorage under the per-uid key; silently ignores write errors.
function saveDevDrafts(arr, uid){
  if(!uid) return; // no uid → don't write to a shared/undefined key
  try { localStorage.setItem(dvDraftsKey(uid), JSON.stringify({ drafts: arr })); }
  catch(e){}
}

// Legacy single-project accessor — returns the first draft for backward compatibility.
function loadDevProject(uid){ return loadDevDrafts(uid)[0] || makeDefaultProject(); }
// Legacy single-project writer — upserts proj into the drafts list by draftId,
// or replaces slot 0 when no id is present.
function saveDevProject(proj, uid){
  const drafts = loadDevDrafts(uid);
  const id = proj.draftId;
  if(id){
    const idx = drafts.findIndex(d => d.draftId === id);
    if(idx >= 0) drafts[idx] = ensureDraftShape({ ...proj, updatedAt: Date.now() });
    else          drafts.unshift(ensureDraftShape({ ...proj, updatedAt: Date.now() }));
  } else {
    drafts[0] = ensureDraftShape({ ...proj, updatedAt: Date.now() });
  }
  saveDevDrafts(drafts, uid);
}

// Writes all custom heroes, enemies, and a dev world into the shared game globals
// (HEROES_DEF, ENEMY_KINDS, WORLDS) so the live battle and map engines can use
// them without modification. Returns the injected world id, or null if globals are missing.
function injectProject(proj){
  const HDEF = window.HEROES_DEF;
  const ENK  = window.ENEMY_KINDS;
  const WS   = window.WORLDS;
  if(!HDEF || !ENK || !WS) return null;

  // Heroes — convert mod hero objects to the format expected by HEROES_DEF.
  proj.heroes.forEach(h => {
    const abilities = (h.abilities && h.abilities.length ? h.abilities : defaultHeroAbilities());
    HDEF[h.id] = {
      sprite: h.sprite,
      body: h.palette.body, rim: h.palette.rim, dark: h.palette.dark,
      acc: h.palette.acc,  eye: h.palette.eye,
      hpMax: h.hpMax, cpuMax: h.cpuMax, spd: h.spd,
      atk: h.atk.slice(),
      limitName: h.limitName, limitDesc: h.limitDesc,
      role: h.role, bio: h.bio,
      // Map each ability to the engine's 'scripts' format, coercing all numeric fields.
      scripts: abilities.map(a => {
        const out = {
          id: a.id, label: a.label, cost: +a.cost || 0, kind: a.kind,
          desc: a.desc || '',
        };
        if(a.dmg)  out.dmg  = [+a.dmg[0]||0,  +a.dmg[1]||0];
        if(a.heal) out.heal = [+a.heal[0]||0, +a.heal[1]||0];
        if(a.extra) out.extra = a.extra;
        return out;
      }),
    };
  });

  // Enemies — convert mod enemy objects to the format expected by ENEMY_KINDS.
  proj.enemies.forEach(e => {
    const attacks = (e.attacks && e.attacks.length ? e.attacks : defaultEnemyAttacks());
    ENK[e.id] = {
      grid: e.sprite,
      hp: e.hp, dmg: e.dmg.slice(), spd: e.spd, xp: e.xp,
      body: e.palette.body, rim: e.palette.rim, dark: e.palette.dark,
      acc: e.palette.acc,  eye: e.palette.eye,
      attacks: attacks.map(a => {
        const out = {
          // Enforce upper-case name capped at 18 chars to match the battle log renderer.
          name: (a.name || 'ATTACK').toString().toUpperCase().slice(0,18),
          kind: a.kind || 'single',
        };
        if(a.dmg)  out.dmg  = [+a.dmg[0]||0,  +a.dmg[1]||0];
        if(a.heal) out.heal = [+a.heal[0]||0, +a.heal[1]||0];
        return out;
      }),
    };
  });

  // World — replace an existing dev world entry or append a new one to WORLDS.
  const DEV_WORLD_ID = 'wDEV';
  const existing = WS.findIndex(w => w.id === DEV_WORLD_ID);
  const devWorld = {
    id: DEV_WORLD_ID,
    name: `DEV / ${proj.title.toUpperCase()}`,
    sub:  'custom · authored by USER',
    nodes: proj.map.nodes.map(n => ({...n})),
    edges: proj.map.edges.map(e => e.slice()),
  };
  if(existing >= 0) WS[existing] = devWorld;
  else WS.push(devWorld);
  // Keep the WORLD_BY_ID index in sync if it exists.
  if(window.WORLD_BY_ID) window.WORLD_BY_ID[DEV_WORLD_ID] = devWorld;
  return DEV_WORLD_ID;
}

// ── Sprite renderer (small standalone preview) ─────────────────────────
// Renders a read-only SVG preview of a sprite at the given pixel scale using the
// shared BSprite component; returns null if BSprite is not yet loaded.
function DvSpriteSvg({ sprite, palette, scale=2 }){
  const BS = window.BSprite;
  if(!BS) return null;
  return (
    <svg width={SPR_W*scale} height={SPR_H*scale}
      viewBox={`0 0 ${SPR_W*scale} ${SPR_H*scale}`} shapeRendering="crispEdges">
      <BS grid={sprite} scale={scale} x={0} y={0}
        body={palette.body} rim={palette.rim} dark={palette.dark}
        acc={palette.acc}   eye={palette.eye} />
    </svg>
  );
}

// ── Sprite editor ──────────────────────────────────────────────────────
// Interactive 16×18 pixel-art editor. Supports drag-to-paint, per-slot colour
// pickers, a clear-canvas action, and a fill-all action. Calls onSprite with
// the updated glyph-string array and onPalette with the updated colour map.
function SpriteEditor({ sprite, palette, onSprite, onPalette, cols=SPR_W, rows=SPR_H }){
  const [tool, setTool] = useStateD('body');
  const paintingRef = useRefD(false);     // true while the mouse button is held down
  const lastCellRef = useRefD(null);      // tracks the last painted cell to skip redundant paints
  const spriteRef = useRefD(sprite);      // keeps a mutable ref so event handlers always see the latest sprite
  // Keep spriteRef current whenever the sprite prop changes.
  useEffectD(() => { spriteRef.current = sprite; }, [sprite]);

  // Register global mouseup/mouseleave listeners to stop painting when the
  // cursor is released outside the canvas element.
  useEffectD(() => {
    function up(){ paintingRef.current = false; lastCellRef.current = null; }
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseleave', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mouseleave', up);
    };
  }, []);

  // Writes the active tool's glyph into cell (r, c), skipping if the cell
  // hasn't changed or was already the last cell painted in this drag stroke.
  function paintCell(r, c){
    const key = r+','+c;
    if(lastCellRef.current === key) return;
    lastCellRef.current = key;
    const glyph = TOOL_GLYPH[tool];
    const cur = spriteRef.current;
    if(cur[r][c] === glyph) return;
    const next = setSpriteCell(cur, r, c, glyph);
    spriteRef.current = next;
    onSprite(next);
  }

  // Build the flat list of cell <span> elements row by row, inserting <br> after each row.
  const cells = [];
  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const g = sprite[r][c];
      const colorKey = GLYPH_TO_TOOL[g];
      // Transparent pixels render with no background so the canvas background shows through.
      const bg = colorKey === 'transparent' ? 'transparent'
              : palette[colorKey] || palette.body;
      cells.push(
        <span key={r+'-'+c} className="dv-spr-cell"
          style={{ background:bg }}
          onMouseDown={(e)=>{ e.preventDefault(); paintingRef.current = true; lastCellRef.current = null; paintCell(r,c); }}
          onMouseEnter={()=>{ if(paintingRef.current) paintCell(r,c); }} />
      );
    }
    cells.push(<br key={'br-'+r} />);
  }

  return (
    <div className="dv-spr">
      {/* Tool row — color tools are combined swatch+picker */}
      <div className="dv-spr-tools">
        <button key="transparent"
          className={'dv-spr-tool transparent ' + (tool==='transparent'?'sel':'')}
          onClick={()=>setTool('transparent')}>
          <span className="chip"></span>
          <span>ERASE</span>
        </button>
        {[
          { k:'body',  label:'BODY' },
          { k:'rim',   label:'RIM' },
          { k:'dark',  label:'DARK' },
          { k:'acc',   label:'ACCENT' },
          { k:'eye',   label:'EYE' },
        ].map(t => (
          // Each colour tool is a <label> wrapping a hidden <input type="color"> so clicking
          // the swatch selects the tool while clicking the colour area opens the OS colour picker.
          <label key={t.k}
            className={'dv-spr-tool ' + (tool===t.k?'sel':'')}
            style={{ position:'relative', cursor:'pointer' }}
            title={t.label + ' — click to select, click color to change'}>
            <span className="chip" style={{ background: palette[t.k], pointerEvents:'none' }}></span>
            <span style={{ pointerEvents:'none' }}>{t.label}</span>
            <input type="color" value={palette[t.k]}
              onClick={()=>setTool(t.k)}
              onChange={(e)=>onPalette({...palette, [t.k]: e.target.value})}
              style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%',
                       cursor:'pointer', padding:0, border:'none' }} />
          </label>
        ))}
      </div>

      {/* Canvas actions */}
      <div className="dv-spr-canvas-actions">
        <button className="dv-btn ghost"
          onClick={()=>{
            if(confirm('Clear the whole canvas? This cannot be undone.')){
              onSprite(Array.from({length: rows}, ()=> '.'.repeat(cols)));
            }
          }}
          title="wipe all pixels (Cmd/Ctrl+Backspace)">
          ✕ CLEAR CANVAS
        </button>
        <button className="dv-btn ghost"
          onClick={()=>{
            // Fill every pixel with the active tool's glyph.
            const g = TOOL_GLYPH[tool];
            const full = Array.from({length: rows}, ()=> g.repeat(cols));
            onSprite(full);
          }}
          title="fill every pixel with the active color">
          ▣ FILL ALL
        </button>
        <span style={{ flex:1 }}></span>
        <span style={{ fontFamily:"'VT323',monospace", fontSize:13,
          color:'rgba(254,250,224,.55)', letterSpacing:'.04em', alignSelf:'center' }}>
          drag to paint · click color button to change hue
        </span>
      </div>

      {/* Grid */}
      <div className="dv-spr-canvas" onContextMenu={(e)=>e.preventDefault()}>
        {cells}
      </div>

    </div>
  );
}

// ── Hero abilities editor ─────────────────────────────────────────────
// Renders a list of editable ability rows for a hero (up to 6), with controls for
// label, kind, CPU cost, damage/heal range, status effect, and description.
function HeroAbilitiesForm({ abilities, onChange }){
  // Merges a partial update into ability at index i and propagates the full array.
  function setAt(i, patch){
    onChange(abilities.map((a, j) => j === i ? { ...a, ...patch } : a));
  }
  // Changes an ability's kind, ensuring the required numeric field exists and
  // stripping fields that are no longer relevant for the new kind.
  function changeKind(i, newKind){
    const meta = HERO_ABILITY_KINDS.find(k => k.k === newKind);
    const cur = abilities[i];
    const next = { ...cur, kind: newKind };
    // ensure required fields exist
    if(meta.needs === 'dmg'  && !next.dmg)  next.dmg  = [12, 20];
    if(meta.needs === 'heal' && !next.heal) next.heal = [30, 50];
    // strip irrelevant fields so injected scripts stay tidy
    if(meta.needs !== 'dmg')  delete next.dmg;
    if(meta.needs !== 'heal') delete next.heal;
    onChange(abilities.map((a, j) => j === i ? next : a));
  }
  // Appends a new ability unless the 6-ability cap has been reached.
  function add(){
    if(abilities.length >= 6) return;
    onChange([...abilities, newHeroAbility(abilities.length)]);
  }
  // Removes the ability at index i.
  function del(i){
    onChange(abilities.filter((_, j) => j !== i));
  }

  return (
    <div className="dv-stat-block">
      <div className="head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>ABILITIES &nbsp;<span style={{ color:'rgba(254,250,224,.5)' }}>{abilities.length}/6</span></span>
        <button className="dv-btn ghost"
          disabled={abilities.length >= 6}
          onClick={add}>+ ADD ABILITY</button>
      </div>
      {abilities.length === 0 && (
        <div style={{ fontFamily:"'VT323',monospace", fontSize:14,
          color:'rgba(254,250,224,.55)', padding:'6px 0' }}>
          no abilities — click + ADD ABILITY. battle UI needs at least one.
        </div>
      )}
      {abilities.map((a, i) => {
        const meta = HERO_ABILITY_KINDS.find(k => k.k === a.kind) || HERO_ABILITY_KINDS[0];
        return (
          <div key={a.id || i} className="dv-abi">
            <div className="dv-abi-head">
              <span className="dv-abi-num">[{i+1}]</span>
              <input className="dv-input" style={{ flex:'1 1 200px' }}
                value={a.label} placeholder="label e.g. ping(target)"
                onChange={(e)=>setAt(i, { label:e.target.value.slice(0,28) })} />
              <button className="dv-btn danger"
                style={{ padding:'4px 8px', fontSize:9 }}
                onClick={()=>del(i)}>✕</button>
            </div>
            <div className="dv-row">
              <div className="dv-col" style={{ flex:'1 1 160px' }}>
                <label className="dv-label">KIND</label>
                <select className="dv-select" value={a.kind}
                  onChange={(e)=>changeKind(i, e.target.value)}>
                  {HERO_ABILITY_KINDS.map(k => (
                    <option key={k.k} value={k.k}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div className="dv-col">
                <label className="dv-label">CPU COST</label>
                <input className="dv-input dv-num" type="number" min={0} max={60}
                  value={a.cost} onChange={(e)=>setAt(i, { cost:+e.target.value||0 })} />
              </div>
              {meta.needs === 'dmg' && (
                <>
                  <div className="dv-col">
                    <label className="dv-label">DMG MIN</label>
                    <input className="dv-input dv-num" type="number" min={0} max={200}
                      value={a.dmg?.[0] ?? 0}
                      onChange={(e)=>setAt(i, { dmg:[+e.target.value||0, a.dmg?.[1]||0] })} />
                  </div>
                  <div className="dv-col">
                    <label className="dv-label">DMG MAX</label>
                    <input className="dv-input dv-num" type="number" min={0} max={300}
                      value={a.dmg?.[1] ?? 0}
                      onChange={(e)=>setAt(i, { dmg:[a.dmg?.[0]||0, +e.target.value||0] })} />
                  </div>
                </>
              )}
              {meta.needs === 'heal' && (
                <>
                  <div className="dv-col">
                    <label className="dv-label">HEAL MIN</label>
                    <input className="dv-input dv-num" type="number" min={0} max={300}
                      value={a.heal?.[0] ?? 0}
                      onChange={(e)=>setAt(i, { heal:[+e.target.value||0, a.heal?.[1]||0] })} />
                  </div>
                  <div className="dv-col">
                    <label className="dv-label">HEAL MAX</label>
                    <input className="dv-input dv-num" type="number" min={0} max={400}
                      value={a.heal?.[1] ?? 0}
                      onChange={(e)=>setAt(i, { heal:[a.heal?.[0]||0, +e.target.value||0] })} />
                  </div>
                </>
              )}
              <div className="dv-col" style={{ flex:'1 1 140px' }}>
                <label className="dv-label">STATUS FX</label>
                <select className="dv-select" value={a.extra || ''}
                  onChange={(e)=>setAt(i, { extra:e.target.value })}>
                  {HERO_ABILITY_EXTRAS.map(x => (
                    <option key={x || '_none'} value={x}>{x ? x.toUpperCase() : '— NONE —'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dv-col">
              <label className="dv-label">DESCRIPTION</label>
              <input className="dv-input" value={a.desc || ''}
                placeholder="Short tooltip shown in battle menu"
                onChange={(e)=>setAt(i, { desc:e.target.value.slice(0, 80) })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Enemy attacks editor ──────────────────────────────────────────────
// Renders a list of editable move rows for an enemy (up to 5). The engine picks
// one move at random each enemy turn, so order does not matter.
function EnemyAttacksForm({ attacks, onChange }){
  // Merges a partial update into attack at index i and propagates the full array.
  function setAt(i, patch){
    onChange(attacks.map((a, j) => j === i ? { ...a, ...patch } : a));
  }
  // Changes a move's kind, adding or removing the dmg/heal fields as required.
  function changeKind(i, newKind){
    const meta = ENEMY_ATTACK_KINDS.find(k => k.k === newKind) || ENEMY_ATTACK_KINDS[0];
    const cur = attacks[i];
    const next = { ...cur, kind: newKind };
    if(meta.needs === 'dmg'  && !next.dmg)  next.dmg  = [10, 16];
    if(meta.needs === 'heal' && !next.heal) next.heal = [30, 50];
    if(meta.needs !== 'dmg')  delete next.dmg;
    if(meta.needs !== 'heal') delete next.heal;
    onChange(attacks.map((a, j) => j === i ? next : a));
  }
  return (
    <div className="dv-stat-block">
      <div className="head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>MOVES &nbsp;<span style={{ color:'rgba(254,250,224,.5)' }}>{attacks.length}/5</span></span>
        <button className="dv-btn ghost"
          disabled={attacks.length >= 5}
          onClick={()=>onChange([...attacks, newEnemyAttack()])}>+ ADD MOVE</button>
      </div>
      <div style={{ fontFamily:"'VT323',monospace", fontSize:13,
        color:'rgba(254,250,224,.5)', padding:'2px 0 6px', letterSpacing:'.02em' }}>
          One is picked at random each enemy turn. Names appear in the battle log.
      </div>
      {attacks.length === 0 && (
        <div style={{ fontFamily:"'VT323',monospace", fontSize:14,
          color:'rgba(254,250,224,.55)', padding:'6px 0' }}>
          no moves — defaults to a generic BITE.
        </div>
      )}
      {attacks.map((a, i) => {
        const meta = ENEMY_ATTACK_KINDS.find(k => k.k === a.kind) || ENEMY_ATTACK_KINDS[0];
        return (
          <div key={a.id || i} className="dv-abi">
            <div className="dv-abi-head">
              <span className="dv-abi-num">[{i+1}]</span>
              <input className="dv-input" style={{ flex:'1 1 200px' }}
                value={a.name} placeholder="ATTACK NAME"
                onChange={(e)=>setAt(i, { name:e.target.value.toUpperCase().slice(0,18) })} />
              <button className="dv-btn danger" style={{ padding:'4px 8px', fontSize:9 }}
                onClick={()=>onChange(attacks.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div className="dv-row">
              <div className="dv-col" style={{ flex:'1 1 180px' }}>
                <label className="dv-label">KIND</label>
                <select className="dv-select" value={a.kind || 'single'}
                  onChange={(e)=>changeKind(i, e.target.value)}>
                  {ENEMY_ATTACK_KINDS.map(k => (
                    <option key={k.k} value={k.k}>{k.label}</option>
                  ))}
                </select>
              </div>
              {meta.needs === 'dmg' && (
                <>
                  <div className="dv-col">
                    <label className="dv-label">DMG MIN</label>
                    <input className="dv-input dv-num" type="number" min={0} max={200}
                      value={a.dmg?.[0] ?? 0}
                      onChange={(e)=>setAt(i, { dmg:[+e.target.value||0, a.dmg?.[1]||0] })} />
                  </div>
                  <div className="dv-col">
                    <label className="dv-label">DMG MAX</label>
                    <input className="dv-input dv-num" type="number" min={0} max={300}
                      value={a.dmg?.[1] ?? 0}
                      onChange={(e)=>setAt(i, { dmg:[a.dmg?.[0]||0, +e.target.value||0] })} />
                  </div>
                </>
              )}
              {meta.needs === 'heal' && (
                <>
                  <div className="dv-col">
                    <label className="dv-label">HEAL MIN</label>
                    <input className="dv-input dv-num" type="number" min={0} max={300}
                      value={a.heal?.[0] ?? 0}
                      onChange={(e)=>setAt(i, { heal:[+e.target.value||0, a.heal?.[1]||0] })} />
                  </div>
                  <div className="dv-col">
                    <label className="dv-label">HEAL MAX</label>
                    <input className="dv-input dv-num" type="number" min={0} max={400}
                      value={a.heal?.[1] ?? 0}
                      onChange={(e)=>setAt(i, { heal:[a.heal?.[0]||0, +e.target.value||0] })} />
                  </div>
                </>
              )}
              {meta.needs === 'none' && (
                // Fixed-behaviour moves show a static description instead of numeric fields.
                <div style={{ fontFamily:"'VT323',monospace", fontSize:13,
                  color:'rgba(254,250,224,.5)', alignSelf:'center', flex:'1 1 auto' }}>
                  {a.kind === 'shield' ? 'Raises a 2-hit firewall around self.' :
                   a.kind === 'buff'   ? 'Priority boost — next action lands sooner.' : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hero stats form ───────────────────────────────────────────────────
// Renders the Identity, Stats, and Limit Break stat-block sections for a hero,
// propagating changes via onChange with the full updated hero object.
function HeroStatsBlocks({ hero, onChange }){
  // Convenience helper that merges a single key/value change into the hero object.
  const set = (k, v) => onChange({ ...hero, [k]: v });
  return (
    <>
      <div className="dv-stat-block">
        <div className="head">IDENTITY</div>
        <div className="dv-col">
          <label className="dv-label">NAME (UPPER)</label>
          <input className="dv-input" value={hero.name}
            onChange={(e)=>set('name', e.target.value.toUpperCase().slice(0,18))} />
        </div>
        <div className="dv-col">
          <label className="dv-label">ROLE</label>
          <input className="dv-input" value={hero.role}
            onChange={(e)=>set('role', e.target.value.toUpperCase().slice(0,16))} />
        </div>
        <div className="dv-col">
          <label className="dv-label">BIO</label>
          <textarea className="dv-textarea" value={hero.bio} rows={2}
            onChange={(e)=>set('bio', e.target.value.slice(0,160))} />
        </div>
      </div>
      <div className="dv-stat-block">
        <div className="head">STATS</div>
        <div className="dv-row">
          <div className="dv-col">
            <label className="dv-label">HP MAX</label>
            <input className="dv-input dv-num" type="number" value={hero.hpMax} min={50} max={600}
              onChange={(e)=>set('hpMax', +e.target.value || 0)} />
          </div>
          <div className="dv-col">
            <label className="dv-label">CPU MAX</label>
            <input className="dv-input dv-num" type="number" value={hero.cpuMax} min={20} max={120}
              onChange={(e)=>set('cpuMax', +e.target.value || 0)} />
          </div>
          <div className="dv-col">
            <label className="dv-label">SPEED</label>
            <input className="dv-input dv-num" type="number" value={hero.spd} min={0.5} max={2} step={0.05}
              onChange={(e)=>set('spd', +e.target.value || 1)} />
          </div>
        </div>
        <div className="dv-row">
          <div className="dv-col">
            <label className="dv-label">ATK MIN</label>
            <input className="dv-input dv-num" type="number" value={hero.atk[0]} min={1} max={120}
              onChange={(e)=>set('atk', [+e.target.value||0, hero.atk[1]])} />
          </div>
          <div className="dv-col">
            <label className="dv-label">ATK MAX</label>
            <input className="dv-input dv-num" type="number" value={hero.atk[1]} min={1} max={160}
              onChange={(e)=>set('atk', [hero.atk[0], +e.target.value||0])} />
          </div>
        </div>
      </div>
      <div className="dv-stat-block">
        <div className="head">LIMIT BREAK</div>
        <div className="dv-col">
          <label className="dv-label">NAME</label>
          <input className="dv-input" value={hero.limitName}
            onChange={(e)=>set('limitName', e.target.value.slice(0,24))} />
        </div>
        <div className="dv-col">
          <label className="dv-label">DESCRIPTION</label>
          <input className="dv-input" value={hero.limitDesc}
            onChange={(e)=>set('limitDesc', e.target.value.slice(0,48))} />
        </div>
      </div>
    </>
  );
}

// ── Enemy stats form ──────────────────────────────────────────────────
// Renders the Identity and Combat stat-block sections for an enemy,
// propagating changes via onChange with the full updated enemy object.
function EnemyStatsBlocks({ enemy, onChange }){
  // Convenience helper that merges a single key/value change into the enemy object.
  const set = (k, v) => onChange({ ...enemy, [k]: v });
  return (
    <>
      <div className="dv-stat-block">
        <div className="head">IDENTITY</div>
        <div className="dv-col">
          <label className="dv-label">NAME (UPPER)</label>
          <input className="dv-input" value={enemy.name}
            onChange={(e)=>set('name', e.target.value.toUpperCase().slice(0,18))} />
        </div>
      </div>
      <div className="dv-stat-block">
        <div className="head">COMBAT</div>
        <div className="dv-row">
          <div className="dv-col">
            <label className="dv-label">HP</label>
            <input className="dv-input dv-num" type="number" value={enemy.hp} min={20} max={500}
              onChange={(e)=>set('hp', +e.target.value || 0)} />
          </div>
          <div className="dv-col">
            <label className="dv-label">SPEED</label>
            <input className="dv-input dv-num" type="number" value={enemy.spd} min={0.4} max={2} step={0.05}
              onChange={(e)=>set('spd', +e.target.value || 1)} />
          </div>
          <div className="dv-col">
            <label className="dv-label">XP DROP</label>
            <input className="dv-input dv-num" type="number" value={enemy.xp} min={1} max={500}
              onChange={(e)=>set('xp', +e.target.value || 0)} />
          </div>
        </div>
        <div className="dv-row">
          <div className="dv-col">
            <label className="dv-label">DMG MIN</label>
            <input className="dv-input dv-num" type="number" value={enemy.dmg[0]} min={1} max={100}
              onChange={(e)=>set('dmg', [+e.target.value||0, enemy.dmg[1]])} />
          </div>
          <div className="dv-col">
            <label className="dv-label">DMG MAX</label>
            <input className="dv-input dv-num" type="number" value={enemy.dmg[1]} min={1} max={140}
              onChange={(e)=>set('dmg', [enemy.dmg[0], +e.target.value||0])} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Checkpoint node editor ─────────────────────────────────────────────
// Item catalog entries available as checkpoint rewards (mirrors SHOP_CATALOG).
const CHKPT_ITEMS = [
  { id:'patch',    label:'patch.dll (+80 INTG)' },
  { id:'buffer',   label:'buffer.zip (+40 CPU)' },
  { id:'restore',  label:'restore_point.bak (REVIVE)' },
  { id:'rootkit',  label:'~/root.kit (140 DMG BOMB)' },
  { id:'firewall', label:'firewall.cfg (FIREWALL 3rnd)' },
  { id:'defrag',   label:'defrag_tonic (PARTY HEAL)' },
  { id:'exploit',  label:'exploit.bin (AoE 90+EXPOSE)' },
  { id:'antidote', label:'antidote.sh (CLEAR DEBUFFS)' },
];

// Inline editor for a single checkpoint dialogue entry.
// Shows speaker name, image picker (opens AvatarEditorModal), and text.
function CheckpointEntryEditor({ entry, idx, onChange, onRemove }){
  const [imgOpen, setImgOpen] = useStateD(false);
  const AEM = window.AvatarEditorModal;
  const AD  = window.AvatarDisplay;

  return (
    <div className="dv-chkpt-entry">
      {imgOpen && AEM && (
        <AEM
          accountId={null}
          current={entry.speakerImage}
          onSave={(av) => { onChange({ ...entry, speakerImage: av }); setImgOpen(false); }}
          onClose={() => setImgOpen(false)}
        />
      )}
      <div className="dv-chkpt-entry-head">
        <span className="dv-chkpt-idx">#{idx + 1}</span>
        <button className="dv-btn danger dv-chkpt-rm" onClick={onRemove} title="remove entry">✕</button>
      </div>
      <div className="dv-chkpt-entry-body">
        {/* Portrait picker */}
        <div className="dv-chkpt-portrait-col">
          <div className="dv-chkpt-portrait-wrap" onClick={() => setImgOpen(true)} title="click to set image">
            {entry.speakerImage && AD
              ? <AD avatar={entry.speakerImage} size={56} />
              : <span className="dv-chkpt-portrait-ph">{(entry.speakerName||'?').slice(0,1)}</span>}
          </div>
          <button className="dv-btn dv-chkpt-img-btn" onClick={() => setImgOpen(true)}>
            {entry.speakerImage ? '✎ IMG' : '+ IMG'}
          </button>
          {entry.speakerImage &&
            <button className="dv-btn danger dv-chkpt-img-btn"
              onClick={() => onChange({ ...entry, speakerImage: null })}>
              ✕
            </button>}
        </div>
        {/* Text fields */}
        <div className="dv-chkpt-fields">
          <div className="dv-col">
            <label className="dv-label">SPEAKER NAME</label>
            <input className="dv-input" value={entry.speakerName || ''}
              placeholder="e.g. ORACLE"
              onChange={e => onChange({ ...entry, speakerName: e.target.value.toUpperCase().slice(0,20) })} />
          </div>
          <div className="dv-col" style={{ flex:'1 1 auto' }}>
            <label className="dv-label">DIALOGUE TEXT</label>
            <textarea className="dv-textarea dv-chkpt-textarea"
              value={entry.text || ''}
              rows={3}
              placeholder="ENTER DIALOGUE HERE.\nUSE NEWLINES FOR LINE BREAKS."
              onChange={e => onChange({ ...entry, text: e.target.value.slice(0,400) })} />
            <div className="dv-desc">{(entry.text||'').length} / 400</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full checkpoint node editor: dialogue list + reward list.
// Rendered inline inside the MapEditor's right panel when type==='save'.
function CheckpointNodeEditor({ node, updateSelected }){
  const dialogue = node.dialogue || [];
  const reward   = node.reward   || [];

  function setDialogue(d){ updateSelected({ dialogue: d }); }
  function setReward(r)  { updateSelected({ reward:   r }); }

  function addEntry(){
    setDialogue([...dialogue, { speakerName:'', speakerImage:null, text:'' }]);
  }
  function removeEntry(i){
    setDialogue(dialogue.filter((_,j) => j !== i));
  }
  function changeEntry(i, next){
    setDialogue(dialogue.map((e,j) => j === i ? next : e));
  }

  function addReward(){
    setReward([...reward, { itemId:'patch', qty:1 }]);
  }
  function removeReward(i){
    setReward(reward.filter((_,j) => j !== i));
  }
  function changeReward(i, patch){
    setReward(reward.map((r,j) => j === i ? { ...r, ...patch } : r));
  }

  return (
    <div className="dv-chkpt-editor">
      {/* Dialogue section */}
      <div className="dv-stat-block">
        <div className="dv-chkpt-section-head">
          <div className="head">DIALOGUE</div>
          <button className="dv-btn primary" onClick={addEntry}
            disabled={dialogue.length >= 8} title="add dialogue entry">
            + ENTRY
          </button>
        </div>
        {dialogue.length === 0 &&
          <div className="dv-chkpt-empty">No dialogue — player will skip straight to reward.</div>}
        {dialogue.map((entry, i) => (
          <CheckpointEntryEditor
            key={i} idx={i} entry={entry}
            onChange={next => changeEntry(i, next)}
            onRemove={() => removeEntry(i)}
          />
        ))}
      </div>

      {/* Reward section */}
      <div className="dv-stat-block">
        <div className="dv-chkpt-section-head">
          <div className="head">REWARD ITEMS</div>
          <button className="dv-btn primary" onClick={addReward}
            disabled={reward.length >= 6} title="add reward item">
            + ITEM
          </button>
        </div>
        {reward.length === 0 &&
          <div className="dv-chkpt-empty">No items — path just unlocks after dialogue.</div>}
        {reward.map((r, i) => (
          <div key={i} className="dv-chkpt-reward-row">
            <select className="dv-select dv-chkpt-item-select"
              value={r.itemId || 'patch'}
              onChange={e => changeReward(i, { itemId: e.target.value })}>
              {CHKPT_ITEMS.map(it => (
                <option key={it.id} value={it.id}>{it.label}</option>
              ))}
            </select>
            <div className="dv-chkpt-qty-wrap">
              <label className="dv-label" style={{fontSize:8}}>QTY</label>
              <input type="number" className="dv-input dv-chkpt-qty"
                min={1} max={9} value={r.qty || 1}
                onChange={e => changeReward(i, { qty: Math.max(1, Math.min(9, +e.target.value||1)) })} />
            </div>
            <button className="dv-btn danger" onClick={() => removeReward(i)} title="remove">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Map editor ────────────────────────────────────────────────────────
// SVG viewbox dimensions for the node-graph canvas.
const MAP_VB_W = 1000, MAP_VB_H = 420;
// Node type definitions: internal key, fill colour for the circle, and the glyph shown inside.
const MAP_NODE_TYPES = [
  { k:'fight', fill:'#7a3a3a', glyph:'⚔' },
  { k:'mini',  fill:'#5a3a8a', glyph:'☠' },
  { k:'boss',  fill:'#8a1a1a', glyph:'☣' },
  { k:'save',  fill:'#3a6a3a', glyph:'⚑' },
  { k:'shop',  fill:'#3a4a8a', glyph:'$' },
];
// Quick lookup maps built from MAP_NODE_TYPES for O(1) access by key.
const NODE_FILL  = Object.fromEntries(MAP_NODE_TYPES.map(t => [t.k, t.fill]));
const NODE_GLYPH = Object.fromEntries(MAP_NODE_TYPES.map(t => [t.k, t.glyph]));

// Returns the lowest unused 'n{i}' id string for a new node (e.g. 'n3' if n1 and n2 exist).
function nextNodeId(nodes){
  let i = 1;
  while(nodes.some(n => n.id === 'n'+i)) i++;
  return 'n'+i;
}

// Interactive SVG node-graph editor. Supports four toolbar modes:
//   move  — click to select a node, drag to reposition it
//   add   — click empty canvas to create a new fight node
//   edge  — click two nodes in sequence to toggle an edge between them
//   erase — click a node to delete it and all its connected edges
// The selected node's properties are shown in a right-side panel where the user
// can edit label, type, subtitle, and (for combat nodes) the enemy encounter list.
function MapEditor({ map, enemies, onMap, onToast }){
  const [mode, setMode] = useStateD('move'); // 'move'|'add'|'edge'|'erase'
  const [sel, setSel] = useStateD(null);      // selected node id
  const [edgeFrom, setEdgeFrom] = useStateD(null); // first node clicked in edge mode
  const [isDragging, setIsDragging] = useStateD(false);
  const draggingRef = useRefD(null); // { id } of the node currently being dragged
  const svgRef = useRefD(null);
  const mapRef = useRefD(map);
  const onMapRef = useRefD(onMap);
  useEffectD(() => { mapRef.current = map; }, [map]);
  useEffectD(() => { onMapRef.current = onMap; }, [onMap]);

  // Resolved node object for the currently selected id.
  const selNode = sel ? map.nodes.find(n => n.id === sel) : null;

  // Converts a mouse event's page coordinates to SVG viewbox coordinates,
  // clamped to keep nodes 40px away from every edge of the canvas.
  function svgPoint(e){
    const svg = svgRef.current;
    if(!svg) return { x:0, y:0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * MAP_VB_W;
    const y = ((e.clientY - rect.top)  / rect.height) * MAP_VB_H;
    return { x: Math.max(40, Math.min(MAP_VB_W-40, x)),
             y: Math.max(40, Math.min(MAP_VB_H-40, y)) };
  }

  // Handles clicks on the SVG background (not on a node).
  // In 'add' mode this creates a new node at the click position; otherwise deselects.
  function onCanvasClick(e){
    if(e.target !== svgRef.current) return;
    if(mode === 'add'){
      if(map.nodes.length >= DV_MAX_NODES){ onToast && onToast('MAX NODES REACHED'); return; }
      const p = svgPoint(e);
      const id = nextNodeId(map.nodes);
      const node = { id, x:Math.round(p.x), y:Math.round(p.y), type:'fight',
        label: id.toUpperCase(), sub:'', encounter:{ enemies:[], bg:'POPUP MOOR', tier:1 } };
      onMap({ ...map, nodes: [...map.nodes, node] });
      setSel(id);
    } else {
      setSel(null);
    }
  }

  // Handles mousedown on a node circle. Behaviour varies by active mode:
  //   erase — deletes the node and all edges that reference it (start node is protected)
  //   edge  — on first click stores the source node; on second click toggles the edge
  //   move/add — selects the node and begins a drag
  function onNodeMouseDown(e, n){
    e.preventDefault();
    e.stopPropagation();
    if(mode === 'erase'){
      if(n.id === 'start'){ onToast && onToast('CANNOT DELETE START'); return; }
      onMap({
        ...map,
        nodes: map.nodes.filter(x => x.id !== n.id),
        edges: map.edges.filter(([a,b]) => a !== n.id && b !== n.id),
      });
      if(sel === n.id) setSel(null);
      return;
    }
    if(mode === 'edge'){
      if(!edgeFrom){ setEdgeFrom(n.id); setSel(n.id); return; }
      if(edgeFrom === n.id){ setEdgeFrom(null); return; }
      const exists = map.edges.some(([a,b]) => (a===edgeFrom&&b===n.id) || (a===n.id&&b===edgeFrom));
      if(!exists){
        onMap({ ...map, edges: [...map.edges, [edgeFrom, n.id]] });
      } else {
        // toggle off — clicking the same pair of nodes removes the existing edge
        onMap({ ...map, edges: map.edges.filter(([a,b]) => !((a===edgeFrom&&b===n.id)||(a===n.id&&b===edgeFrom))) });
      }
      setEdgeFrom(null);
      return;
    }
    // 'move' or 'add' → select + drag
    setSel(n.id);
    draggingRef.current = { id: n.id };
    setIsDragging(true);
  }

  // Global mousemove/mouseup listeners that drive node dragging.
  // Attached to window so drags continue even if the cursor leaves the SVG element.
  // mapRef/onMapRef keep the handlers current without needing to re-subscribe on every map change.
  useEffectD(() => {
    function move(e){
      if(!draggingRef.current) return;
      const p = svgPoint(e);
      const id = draggingRef.current.id;
      const cur = mapRef.current;
      onMapRef.current({
        ...cur,
        nodes: cur.nodes.map(n => n.id === id ? { ...n, x: Math.round(p.x), y: Math.round(p.y) } : n),
      });
    }
    function up(){ draggingRef.current = null; setIsDragging(false); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Merges patch into the currently selected node and propagates the updated map.
  function updateSelected(patch){
    if(!sel) return;
    onMap({ ...map, nodes: map.nodes.map(n => n.id === sel ? { ...n, ...patch } : n) });
  }
  // Merges patch into the encounter object of the selected node, creating defaults if absent.
  function updateEncounter(patch){
    if(!selNode) return;
    const enc = { ...(selNode.encounter || { enemies:[], bg:'POPUP MOOR', tier:1 }), ...patch };
    updateSelected({ encounter: enc });
  }

  return (
    <div className="dv-map-wrap">
      <div className="dv-card dv-map-canvas-card">
        <div className="dv-leg">▣ NODE GRAPH</div>
        <div className="dv-map-toolbar">
          {[
            { k:'move',  label:'MOVE' },
            { k:'add',   label:'+ NODE' },
            { k:'edge',  label:'+ EDGE' },
            { k:'erase', label:'✕ DELETE' },
          ].map(m => (
            <button key={m.k}
              className={'dv-map-mode ' + (mode===m.k?'sel':'')}
              onClick={()=>{ setMode(m.k); setEdgeFrom(null); }}>
              {m.label}
            </button>
          ))}
          <span style={{ flex:1 }}></span>
          <span style={{ fontFamily:"'VT323',monospace", fontSize:14, color:'rgba(254,250,224,.65)',
            letterSpacing:'.04em', alignSelf:'center' }}>
            {mode === 'move'  && '> CLICK NODE TO SELECT · DRAG TO MOVE'}
            {mode === 'add'   && '> CLICK EMPTY SPACE TO ADD A NODE'}
            {mode === 'edge'  && (edgeFrom ? `> EDGE FROM ${edgeFrom} — CLICK NEXT NODE` : '> CLICK FIRST NODE')}
            {mode === 'erase' && '> CLICK NODE TO DELETE'}
          </span>
        </div>
        <svg ref={svgRef} className={'dv-map-svg mode-'+mode+(isDragging?' dragging':'')}
          viewBox={`0 0 ${MAP_VB_W} ${MAP_VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={onCanvasClick}>
          {/* Faint grid lines drawn at 40px intervals to aid node placement. */}
          {Array.from({length: Math.ceil(MAP_VB_W/40)}).map((_,i)=>
            <line key={'gx'+i} x1={i*40} y1={0} x2={i*40} y2={MAP_VB_H}
              stroke="rgba(254,250,224,.05)" strokeWidth={1}/>)}
          {Array.from({length: Math.ceil(MAP_VB_H/40)}).map((_,i)=>
            <line key={'gy'+i} x1={0} y1={i*40} x2={MAP_VB_W} y2={i*40}
              stroke="rgba(254,250,224,.05)" strokeWidth={1}/>)}

          {/* edges */}
          {map.edges.map(([a,b], i) => {
            const A = map.nodes.find(n => n.id === a);
            const B = map.nodes.find(n => n.id === b);
            if(!A || !B) return null;
            return <line key={'e'+i} className="dv-map-edge"
              x1={A.x} y1={A.y} x2={B.x} y2={B.y} />;
          })}

          {/* nodes */}
          {map.nodes.map(n => {
            const fill = NODE_FILL[n.type] || '#3a3a3a';
            const glyph = NODE_GLYPH[n.type] || '?';
            const isSel = sel === n.id;
            return (
              <g key={n.id} className={'dv-map-node ' + (isSel?'sel':'')}
                onMouseDown={(e)=>onNodeMouseDown(e, n)}>
                <circle className="node-bg" cx={n.x} cy={n.y} r={26}
                  fill={fill} stroke="#fefae0" strokeWidth={2} />
                <text x={n.x} y={n.y+8} textAnchor="middle"
                  fontFamily="'Press Start 2P',monospace" fontSize={18} fill="#fefae0">
                  {glyph}
                </text>
                <text x={n.x} y={n.y+50} textAnchor="middle"
                  fontFamily="'VT323',monospace" fontSize={16} fill="#fefae0"
                  style={{ pointerEvents:'none' }}>
                  {n.id.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right side panel — shows properties of the selected node */}
      <div className="dv-card dv-map-side">
        <div className="dv-leg">▣ NODE</div>
        <div className="body">
          {!selNode && <div className="empty">SELECT A NODE OR CLICK<br />[+ NODE] TO START.</div>}
          {selNode && (
            <>
              <div className="dv-stat-block">
                <div className="head">{selNode.id.toUpperCase()}</div>
                <div className="dv-col">
                  <label className="dv-label">TYPE</label>
                  <select className="dv-select" value={selNode.type}
                    onChange={(e)=>updateSelected({ type:e.target.value })}>
                    {MAP_NODE_TYPES.map(t => <option key={t.k} value={t.k}>{t.k.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="dv-col">
                  <label className="dv-label">LABEL</label>
                  <input className="dv-input" value={selNode.label}
                    onChange={(e)=>updateSelected({ label:e.target.value.toUpperCase().slice(0,28) })} />
                </div>
                <div className="dv-col">
                  <label className="dv-label">SUBTITLE</label>
                  <input className="dv-input" value={selNode.sub || ''}
                    onChange={(e)=>updateSelected({ sub:e.target.value.slice(0,40) })} />
                </div>
              </div>
              {/* Checkpoint editor — only shown for save node type */}
              {selNode.type === 'save' && (
                <CheckpointNodeEditor node={selNode} updateSelected={updateSelected} />
              )}
              {/* Encounter editor — only shown for combat node types */}
              {(selNode.type === 'fight' || selNode.type === 'mini' || selNode.type === 'boss') && (
                <div className="dv-stat-block">
                  <div className="head">ENCOUNTER</div>
                  <label className="dv-label">ENEMIES IN BATTLE</label>
                  <div className="dv-enc-chips">
                    {(selNode.encounter?.enemies || []).length === 0 &&
                      <span style={{ fontFamily:"'VT323',monospace", fontSize:13,
                        color:'rgba(254,250,224,.5)' }}>(no enemies — add below)</span>}
                    {(selNode.encounter?.enemies || []).map((eid, i) => {
                      const en = enemies.find(x => x.id === eid);
                      const name = en ? en.name : eid;
                      return (
                        // Each chip is a button; clicking it removes that enemy slot from the encounter.
                        <button key={i} className="dv-enc-chip"
                          title="click to remove"
                          onClick={()=>{
                            const cur = selNode.encounter?.enemies || [];
                            updateEncounter({ enemies: cur.filter((_,j)=>j!==i) });
                          }}>
                          {name} ✕
                        </button>
                      );
                    })}
                  </div>
                  <label className="dv-label" style={{ marginTop:4 }}>ADD ENEMY</label>
                  <div className="dv-enc-add">
                    {enemies.length === 0 &&
                      <span style={{ fontFamily:"'VT323',monospace", fontSize:13,
                        color:'rgba(254,250,224,.5)' }}>create enemies first in the ENEMIES tab</span>}
                    {enemies.map(en => (
                      // Each button appends that enemy to this node's encounter list (max 5 slots).
                      <button key={en.id} className="dv-btn ghost"
                        disabled={(selNode.encounter?.enemies || []).length >= 5}
                        onClick={()=>{
                          const cur = selNode.encounter?.enemies || [];
                          updateEncounter({ enemies:[...cur, en.id] });
                        }}>
                        + {en.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="dv-row" style={{ marginTop:'auto', justifyContent:'flex-end' }}>
                {/* The start node cannot be deleted as it anchors the player's spawn position. */}
                <button className="dv-btn danger" disabled={selNode.id === 'start'}
                  onClick={()=>{
                    if(selNode.id === 'start') return;
                    onMap({
                      ...map,
                      nodes: map.nodes.filter(x => x.id !== selNode.id),
                      edges: map.edges.filter(([a,b]) => a !== selNode.id && b !== selNode.id),
                    });
                    setSel(null);
                  }}>
                  DELETE NODE
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List+Editor scaffold for heroes / enemies ─────────────────────────
// Generic two-panel component: a scrollable item list on the left and a detail
// editor on the right. The caller provides renderEditor to produce the right panel.
// On mobile (isMobile=true) uses a two-stage flow: list → full-screen editor.
function ListEditor({ kind, items, sel, setSel, onAdd, onDelete, onChange, renderEditor, max, isMobile }){
  const [mobileStage, setMobileStage] = useStateD('list'); // 'list' | 'editor' — mobile only

  function selectItem(id){
    setSel(id);
    if(isMobile) setMobileStage('editor');
  }

  // ── Mobile: entity list ──
  if(isMobile && mobileStage === 'list'){
    return (
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0, overflowY:'auto'}}>
        <div style={{
          padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'1px solid rgba(254,250,224,.1)', flexShrink:0, background:'rgba(0,0,0,.2)',
        }}>
          <div style={{fontFamily:"'VT323',monospace", fontSize:15, color:'rgba(254,250,224,.7)'}}>
            {items.length} / {max}
          </div>
          <button className="dv-btn primary" disabled={items.length >= max} onClick={onAdd}>+ NEW</button>
        </div>
        {items.length === 0 &&
          <div className="dv-edit-empty">no {kind.toLowerCase()} yet — click + NEW to add one</div>}
        {items.map((it) => (
          <div key={it.id}
            className={'dv-list-row ' + (sel === it.id ? 'sel' : '')}
            onClick={()=>selectItem(it.id)}>
            <div className="sw">
              <DvSpriteSvg sprite={it.sprite} palette={it.palette} scale={2} />
            </div>
            <div style={{ flex:'1 1 auto', minWidth:0 }}>
              <div className="nm">{it.name}</div>
              <div className="sub">{it.id}</div>
            </div>
            <button className="x" title="delete"
              onClick={(e)=>{ e.stopPropagation(); onDelete(it.id); }}>✕</button>
          </div>
        ))}
      </div>
    );
  }

  // ── Mobile: full-screen editor ──
  if(isMobile && mobileStage === 'editor'){
    const item = sel ? items.find(x => x.id === sel) : null;
    return (
      <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
          borderBottom:'2px solid var(--bg-2)', flexShrink:0, background:'rgba(0,0,0,.2)',
        }}>
          <button className="dv-btn" onClick={()=>{ setMobileStage('list'); setSel(null); }}>← LIST</button>
          {item && (
            <span style={{
              fontFamily:"'VT323',monospace", fontSize:16, color:'var(--fg-bright)',
              letterSpacing:'.04em', overflow:'hidden', textOverflow:'ellipsis',
              whiteSpace:'nowrap', flex:'1 1 auto',
            }}>
              {item.name}
            </span>
          )}
        </div>
        <div style={{flex:1, overflowY:'auto', padding:14}}>
          {!item && <div className="dv-edit-empty">SELECT AN ITEM FROM THE LIST.</div>}
          {item && renderEditor(item, (next)=>onChange(next))}
        </div>
      </div>
    );
  }

  // ── Desktop: original two-panel layout ──
  return (
    <div className="dv-split">
      <div className="dv-card dv-list-card">
        <div className="dv-leg">▣ {kind.toUpperCase()}</div>
        <div className="dv-row" style={{ justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:"'VT323',monospace", fontSize:15,
            color:'rgba(254,250,224,.7)' }}>
            {items.length} / {max}
          </div>
          <button className="dv-btn primary"
            disabled={items.length >= max}
            onClick={onAdd}>+ NEW</button>
        </div>
        <div className="dv-list">
          {items.length === 0 &&
            <div className="dv-edit-empty">no {kind.toLowerCase()} yet — click + NEW to add one</div>}
          {items.map((it) => (
            <div key={it.id}
              className={'dv-list-row ' + (sel === it.id ? 'sel' : '')}
              onClick={()=>setSel(it.id)}>
              <div className="sw">
                <DvSpriteSvg sprite={it.sprite} palette={it.palette} scale={2} />
              </div>
              <div style={{ flex:'1 1 auto', minWidth:0 }}>
                <div className="nm">{it.name}</div>
                <div className="sub">{it.id}</div>
              </div>
              <button className="x" title="delete"
                onClick={(e)=>{ e.stopPropagation(); onDelete(it.id); }}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="dv-card dv-editor">
        {!sel && <div className="dv-edit-empty">SELECT A {kind.toUpperCase().slice(0,-1)} ON THE LEFT,<br />OR CLICK [+ NEW] TO START.</div>}
        {sel && renderEditor(items.find(x => x.id === sel), (next)=>onChange(next))}
      </div>
    </div>
  );
}

// ── INFO tab ──────────────────────────────────────────────────────────
// Renders the mod metadata panel (title, cover image, intro text) alongside
// a read-only content summary and ready-check error list.
function InfoTab({ project, setProject, stats, blip }){
  const [coverOpen, setCoverOpen] = useStateD(false);
  return (
    <div className="dv-info-grid">
      {/* AvatarEditorModal is opened when the user clicks the cover image slot */}
      {coverOpen && (
        <AvatarEditorModal
          accountId={null}
          current={project.cover}
          onSave={(av)=>{ setProject({ ...project, cover: av }); setCoverOpen(false); blip&&blip(960); }}
          onClose={()=>{ setCoverOpen(false); blip&&blip(360); }}
          blip={blip}
        />
      )}
      <div className="dv-card" style={{ padding:18 }}>
        <div className="dv-leg">▣ MOD INFO</div>
        <div className="dv-title">METADATA &amp; INTRO TEXT</div>
        <div className="dv-col" style={{ marginBottom:14 }}>
          <label className="dv-label">COVER IMAGE</label>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Cover preview — shows the first character of the title when no cover is set */}
            <div style={{ cursor:'pointer', border:'2px solid rgba(254,250,224,.3)',
                          width:64, height:72, display:'flex', alignItems:'center',
                          justifyContent:'center', background:'rgba(0,0,0,.2)', flexShrink:0 }}
                 onClick={()=>setCoverOpen(true)}>
              {project.cover
                ? <AvatarDisplay avatar={project.cover} size={64} />
                : <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:22,
                                  color:'var(--cream)', userSelect:'none' }}>
                    {(project.title||'?').slice(0,1)}
                  </span>
              }
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <button className="dv-btn" onClick={()=>{ setCoverOpen(true); blip&&blip(540); }}>✎ EDIT</button>
              {project.cover && (
                <button className="dv-btn danger"
                  onClick={()=>{ setProject({ ...project, cover:null }); blip&&blip(360); }}>
                  ✕ CLEAR
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="dv-col" style={{ marginBottom:14 }}>
          <label className="dv-label">MOD TITLE</label>
          <input className="dv-input" value={project.title}
            onChange={(e)=>setProject({ ...project, title:e.target.value.slice(0,40) })} />
        </div>
        <div className="dv-col" style={{ flex:'1 1 auto', minHeight:0 }}>
          <label className="dv-label">NEW-GAME INTRO DIALOGUE</label>
          <textarea className="dv-textarea" value={project.intro} rows={8}
            style={{ flex:'1 1 auto', minHeight:160 }}
            onChange={(e)=>setProject({ ...project, intro:e.target.value.slice(0, 600) })} />
          <div className="dv-desc" style={{ marginTop:6 }}>
            Shown once at the start of a new playtest run. {project.intro.length} / 600 chars.
          </div>
        </div>
      </div>
      <div className="dv-card" style={{ padding:18 }}>
        <div className="dv-leg">▣ CONTENT SUMMARY</div>
        <div className="dv-title">WHAT YOU'VE BUILT</div>
        <div className="dv-desc" style={{ marginBottom:12 }}>
          A quick at-a-glance audit of your mod. Hit <b>RUN MOD</b> in the tab bar
          to load your custom world into the engine and playtest it.
        </div>
        <div className="dv-stat-grid">
          <div className="dv-stat"><span>HEROES</span><b className={'v '+(stats.heroes>0?'ok':'warn')}>{stats.heroes} / {DV_MAX_HEROES}</b></div>
          <div className="dv-stat"><span>ENEMIES</span><b className={'v '+(stats.enemies>0?'ok':'warn')}>{stats.enemies} / {DV_MAX_ENEMIES}</b></div>
          <div className="dv-stat"><span>MAP NODES</span><b className={'v '+(stats.nodes>1?'ok':'warn')}>{stats.nodes} / {DV_MAX_NODES}</b></div>
          <div className="dv-stat"><span>FIGHTS</span><b className="v">{stats.fights}</b></div>
          <div className="dv-stat"><span>EDGES</span><b className="v">{stats.edges}</b></div>
          <div className="dv-stat"><span>HAS BOSS</span><b className={'v '+(stats.hasBoss?'ok':'warn')}>{stats.hasBoss?'YES':'NO'}</b></div>
        </div>
        <div className="dv-title" style={{ marginTop:18 }}>READY-CHECK</div>
        {/* Displays a pre-formatted list of validation errors, or a success message. */}
        <div className="dv-pre">
{stats.errors.length === 0
  ? '> ALL SYSTEMS NOMINAL.\n> click RUN MOD to playtest.'
  : stats.errors.map(e => '! ' + e).join('\n')}
        </div>
      </div>
    </div>
  );
}

// ── Editor (the actual studio: info/heroes/enemies/map tabs) ────────────
// Tabbed editor shell for a single draft. Manages the project state, auto-saves
// on every change via onChangeDraft, and provides keyboard shortcuts for tabs,
// playtest launch (F5), and back navigation (Escape).
function DevModeEditor({ blip, onBackToList, onPlaytest, initialDraft, onChangeDraft }){
  const [project, setProject] = useStateD(() => initialDraft);
  const [tab, setTab] = useStateD('info');
  const [heroSel, setHeroSel] = useStateD(null);
  const [enemySel, setEnemySel] = useStateD(null);
  const [toast, setToast] = useStateD(null);
  const isMobile = window.innerWidth <= 760;

  // Propagate every project change up to the parent so it can persist the draft.
  useEffectD(() => {
    onChangeDraft && onChangeDraft({ ...project, updatedAt: Date.now() });
  }, [project]);

  // Displays a temporary toast message that auto-dismisses after 1.6 seconds.
  function showToast(t){
    setToast(t);
    setTimeout(()=>setToast(null), 1600);
  }

  // Derived validation stats recomputed whenever project changes.
  // Produces error strings for every constraint the engine requires to run the mod.
  const stats = useMemoD(() => {
    const errors = [];
    if(project.heroes.length !== DV_PARTY_SIZE) errors.push(`PARTY MUST HAVE EXACTLY ${DV_PARTY_SIZE} HEROES (you have ${project.heroes.length})`);
    if(project.enemies.length === 0) errors.push('AT LEAST ONE ENEMY REQUIRED');
    if(project.map.nodes.length < 2) errors.push('MAP MUST HAVE AT LEAST 2 NODES');
    const hasStart = project.map.nodes.some(n => n.type === 'save' && n.id === 'start');
    if(!hasStart) errors.push("MAP MUST HAVE A 'start' NODE (type=save)");
    // Check every combat node: must have at least one enemy, and all referenced enemy ids must exist.
    project.map.nodes.forEach(n => {
      if(n.type === 'fight' || n.type === 'mini' || n.type === 'boss'){
        const list = n.encounter?.enemies || [];
        if(list.length === 0) errors.push(`NODE ${n.id.toUpperCase()} HAS NO ENEMIES`);
        list.forEach(eid => {
          if(!project.enemies.find(x => x.id === eid)) errors.push(`NODE ${n.id.toUpperCase()} REFERENCES MISSING ENEMY ${eid}`);
        });
      }
    });
    return {
      heroes: project.heroes.length,
      enemies: project.enemies.length,
      nodes: project.map.nodes.length,
      edges: project.map.edges.length,
      fights: project.map.nodes.filter(n => n.type === 'fight' || n.type === 'mini' || n.type === 'boss').length,
      hasBoss: project.map.nodes.some(n => n.type === 'boss'),
      errors,
    };
  }, [project]);

  // Hero / enemy editor handlers

  // Adds a new blank hero with the next available letter suffix, then selects it.
  function addHero(){
    if(project.heroes.length >= DV_MAX_HEROES) return;
    const used = new Set(project.heroes.map(h => h.id));
    let i = 0;
    // Find the first uppercase letter suffix not already taken.
    let suffix = String.fromCharCode(65 + i);
    while(used.has(`CUSTOM.${suffix}`)){ i++; suffix = String.fromCharCode(65 + i); }
    const nh = makeBlankHero(suffix, `CUSTOM.${suffix}`, project.heroes.length);
    setProject({ ...project, heroes: [...project.heroes, nh] });
    setHeroSel(nh.id);
    blip && blip(720);
  }
  // Removes the hero with the given id and clears the selection if it was selected.
  function delHero(id){
    setProject({ ...project, heroes: project.heroes.filter(h => h.id !== id) });
    if(heroSel === id) setHeroSel(null);
    blip && blip(360);
  }
  // Replaces the hero whose id matches nextHero.id with the updated object.
  function updateHero(nextHero){
    setProject({ ...project, heroes: project.heroes.map(h => h.id === nextHero.id ? nextHero : h) });
  }

  // Adds a new blank enemy with the next available letter suffix, then selects it.
  function addEnemy(){
    if(project.enemies.length >= DV_MAX_ENEMIES) return;
    const used = new Set(project.enemies.map(e => e.id));
    let i = 0;
    let suffix = String.fromCharCode(65 + i);
    while(used.has(`CUSTOM.E.${suffix}`)){ i++; suffix = String.fromCharCode(65 + i); }
    const ne = makeBlankEnemy(suffix, `CUSTOM.E.${suffix}`, project.enemies.length + 3);
    setProject({ ...project, enemies: [...project.enemies, ne] });
    setEnemySel(ne.id);
    blip && blip(720);
  }
  // Removes the enemy with the given id and scrubs its id from every map node's encounter list.
  function delEnemy(id){
    setProject(p => ({
      ...p,
      enemies: p.enemies.filter(e => e.id !== id),
      map: {
        ...p.map,
        // Remove deleted enemy id from every node's encounter.enemies array.
        nodes: p.map.nodes.map(n => n.encounter && n.encounter.enemies
          ? { ...n, encounter: { ...n.encounter, enemies: n.encounter.enemies.filter(x => x !== id) } } : n),
      },
    }));
    if(enemySel === id) setEnemySel(null);
    blip && blip(360);
  }
  // Replaces the enemy whose id matches nextE.id with the updated object.
  function updateEnemy(nextE){
    setProject({ ...project, enemies: project.enemies.map(e => e.id === nextE.id ? nextE : e) });
  }

  // Keyboard shortcuts: 1–4 switch tabs, F5 launches playtest, Escape returns to the mod list.
  // The handler is skipped when focus is inside a text input to avoid capturing typed characters.
  useEffectD(() => {
    function onKey(e){
      if(e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if(e.key === '1'){ setTab('info'); blip && blip(540); }
      else if(e.key === '2'){ setTab('heroes'); blip && blip(540); }
      else if(e.key === '3'){ setTab('enemies'); blip && blip(540); }
      else if(e.key === '4'){ setTab('map'); blip && blip(540); }
      else if(e.key === 'F5'){ launchPlaytest(); e.preventDefault(); }
      else if(e.key === 'Escape'){ onBackToList && onBackToList(); e.preventDefault(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blip, onBackToList, project]);

  // Injects the project into the game globals and triggers the playtest callback,
  // but only if all ready-check validations pass.
  function launchPlaytest(){
    if(stats.errors.length > 0){
      showToast('FIX READY-CHECK ERRORS FIRST');
      blip && blip(220);
      return;
    }
    blip && blip(960);
    onPlaytest && onPlaytest(project);
  }

  return (
    <div className="dv-shell">
      <div className="dv-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onBackToList && onBackToList(); }}
          title="back to MY MODS (ESC)">
          ← MY MODS
        </button>
        <span className="dv-bc">
          <span className="blk"></span>
          DEV MODE / {project.title.toUpperCase()}
        </span>
        {/* Live stat HUD — hidden on mobile to save space */}
        {!isMobile && (
          <div className="dv-hud">
            <span><b>HEROES</b><span className={stats.heroes>0?'ok':'warn'}>{stats.heroes}/{DV_MAX_HEROES}</span></span>
            <span><b>ENEMIES</b><span className={stats.enemies>0?'ok':'warn'}>{stats.enemies}/{DV_MAX_ENEMIES}</span></span>
            <span><b>NODES</b><span className={stats.nodes>1?'ok':'warn'}>{stats.nodes}/{DV_MAX_NODES}</span></span>
            <span><b>STATE</b><span className={stats.errors.length===0?'ok':'warn'}>
              {stats.errors.length===0?'READY':'INCOMPLETE'}
            </span></span>
          </div>
        )}
      </div>

      <div className="dv-tabs">
        <button className={'dv-tab ' + (tab==='info'?'active':'')} onClick={()=>{ setTab('info'); blip && blip(720); }}>
          {!isMobile && <span className="k">[1]</span>}INFO
        </button>
        <button className={'dv-tab ' + (tab==='heroes'?'active':'')} onClick={()=>{ setTab('heroes'); blip && blip(720); }}>
          {!isMobile && <span className="k">[2]</span>}HEROES <span className="badge">{project.heroes.length}</span>
        </button>
        <button className={'dv-tab ' + (tab==='enemies'?'active':'')} onClick={()=>{ setTab('enemies'); blip && blip(720); }}>
          {!isMobile && <span className="k">[3]</span>}ENEMIES <span className="badge">{project.enemies.length}</span>
        </button>
        <button className={'dv-tab ' + (tab==='map'?'active':'')} onClick={()=>{ setTab('map'); blip && blip(720); }}>
          {!isMobile && <span className="k">[4]</span>}MAP <span className="badge">{project.map.nodes.length}</span>
        </button>
        <button className="dv-tab run" onClick={launchPlaytest}
          title={stats.errors.length===0 ? 'launch playtest' : 'fix ready-check errors first'}>
          {!isMobile && <span className="k">▶</span>}RUN
        </button>
      </div>

      <div className="dv-stage">
        {tab === 'info' && <InfoTab project={project} setProject={setProject} stats={stats} blip={blip} />}
        {tab === 'heroes' && (
          // Heroes tab: ListEditor wired to hero state; renderEditor composes SpriteEditor +
          // HeroAbilitiesForm + HeroStatsBlocks for the selected hero.
          <ListEditor kind="HEROES" items={project.heroes} sel={heroSel} setSel={setHeroSel}
            onAdd={addHero} onDelete={delHero} max={DV_MAX_HEROES}
            onChange={updateHero} isMobile={isMobile}
            renderEditor={(it, change) => (
              <>
                <SpriteEditor
                  sprite={it.sprite} palette={it.palette}
                  onSprite={(s)=>change({ ...it, sprite:s })}
                  onPalette={(p)=>change({ ...it, palette:p })} />
                <div className="dv-stats">
                  <HeroAbilitiesForm
                    abilities={it.abilities || defaultHeroAbilities()}
                    onChange={(arr)=>change({ ...it, abilities:arr })} />
                  <HeroStatsBlocks hero={it} onChange={change} />
                </div>
              </>
            )} />
        )}
        {tab === 'enemies' && (
          // Enemies tab: same scaffold as heroes but wired to enemy state and enemy-specific forms.
          <ListEditor kind="ENEMIES" items={project.enemies} sel={enemySel} setSel={setEnemySel}
            onAdd={addEnemy} onDelete={delEnemy} max={DV_MAX_ENEMIES}
            onChange={updateEnemy} isMobile={isMobile}
            renderEditor={(it, change) => (
              <>
                <SpriteEditor
                  sprite={it.sprite} palette={it.palette}
                  onSprite={(s)=>change({ ...it, sprite:s })}
                  onPalette={(p)=>change({ ...it, palette:p })} />
                <div className="dv-stats">
                  <EnemyAttacksForm
                    attacks={it.attacks || defaultEnemyAttacks()}
                    onChange={(arr)=>change({ ...it, attacks:arr })} />
                  <EnemyStatsBlocks enemy={it} onChange={change} />
                </div>
              </>
            )} />
        )}
        {tab === 'map' && (
          <MapEditor map={project.map}
            enemies={project.enemies}
            onMap={(m)=>setProject({ ...project, map:m })}
            onToast={showToast} />
        )}
        {toast && <div className="dv-toast">{toast}</div>}
      </div>

      {!isMobile && (
        <div className="dv-foot">
          <div>
            <b>1</b>/<b>2</b>/<b>3</b>/<b>4</b> SWITCH TAB &middot;
            {' '}<b>F5</b> RUN MOD &middot;
            {' '}<b>ESC</b> BACK TO MY MODS
          </div>
          <div>devmode.v2 &middot; saved locally</div>
        </div>
      )}
    </div>
  );
}

// ── MY MODS list (landing screen when entering Dev Mode) ──────────────
// Displays all local drafts as cards with edit, playtest, publish, unpublish, and delete actions.
// Keyboard: ↑/↓ (or j/k) navigate, Enter opens the selected draft, N creates a new one, Escape exits.
function MyModsList({ blip, onExit, drafts, onNewDraft, onEditDraft, onDeleteDraft,
                     onPublishDraft, onUnpublishDraft, onPlaytestDraft, busyId }){
  const [sel, setSel] = useStateD(drafts[0]?.draftId || null);
  const isMobile = window.innerWidth <= 760;

  // If the selected draft is deleted externally, fall back to the first available draft.
  useEffectD(() => {
    if(sel && !drafts.find(d => d.draftId === sel)) setSel(drafts[0]?.draftId || null);
  }, [drafts, sel]);

  // Keyboard navigation: arrow keys / j,k move selection; Enter opens; N creates; Escape exits.
  useEffectD(() => {
    function onKey(e){
      if(e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if(e.key === 'Escape'){ onExit && onExit(); e.preventDefault(); return; }
      if(!drafts.length) return;
      const idx = drafts.findIndex(d => d.draftId === sel);
      if(e.key === 'ArrowDown' || e.key === 'j'){
        const ni = Math.min(drafts.length - 1, idx + 1);
        setSel(drafts[ni].draftId); blip && blip(540); e.preventDefault();
      } else if(e.key === 'ArrowUp' || e.key === 'k'){
        const ni = Math.max(0, idx - 1);
        setSel(drafts[ni].draftId); blip && blip(540); e.preventDefault();
      } else if(e.key === 'Enter'){
        const cur = drafts.find(d => d.draftId === sel);
        if(cur) onEditDraft(cur);
        e.preventDefault();
      } else if(e.key === 'n' || e.key === 'N'){
        onNewDraft && onNewDraft();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drafts, sel, onExit, onEditDraft, onNewDraft]);

  return (
    <div className="dv-shell">
      <div className="dv-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onExit && onExit(); }}
          title="back to menu (ESC)">← MENU</button>
        <span className="dv-bc">
          <span className="blk"></span>
          DEV MODE / MY MODS &nbsp;·&nbsp; {drafts.length} draft{drafts.length===1?'':'s'}
        </span>
        {!isMobile && (
          <div className="dv-hud">
            <span><b>PUBLISHED</b><span className="ok">{drafts.filter(d=>d.publishedId).length}</span></span>
            <span><b>DRAFTS</b><span>{drafts.filter(d=>!d.publishedId).length}</span></span>
          </div>
        )}
      </div>

      <div className="mm-toolbar">
        <button className="dv-btn primary"
          onClick={()=>{ blip && blip(720); onNewDraft && onNewDraft(); }}>
          + NEW MOD
        </button>
        <div style={{ flex:1 }}></div>
        {!isMobile && (
          <span style={{ fontFamily:"'VT323',monospace", fontSize:14,
            color:'rgba(254,250,224,.65)', letterSpacing:'.04em' }}>
            ↑↓ select · ⏎ open · N new · ESC back
          </span>
        )}
      </div>

      <div className="mm-stage">
        {drafts.length === 0 && (
          <div className="mm-empty">
            <div className="mm-empty-h">NO MODS YET</div>
            <div className="mm-empty-sub">
              Click <b>+ NEW MOD</b> above to start building your first custom DAW world.
              <br />Each mod gets its own sprites, abilities, enemies, and map.
            </div>
          </div>
        )}
        {drafts.length > 0 && (
          <div className="mm-grid">
            {drafts.map(d => {
              const isSel = sel === d.draftId;
              const isPub = !!d.publishedId;
              const busy = busyId === d.draftId; // true while a publish/unpublish request is in-flight
              const stats = {
                heroes: d.heroes?.length || 0,
                enemies: d.enemies?.length || 0,
                nodes: d.map?.nodes?.length || 0,
              };
              return (
                // Single-click selects; double-click opens the editor.
                <div key={d.draftId}
                  className={'mm-card ' + (isSel?'sel ':'') + (isPub?'pub':'')}
                  onClick={()=>{ setSel(d.draftId); blip && blip(540); }}
                  onDoubleClick={()=>onEditDraft(d)}>
                  <div className="mm-card-head">
                    {/* Cover image slot: shows AvatarDisplay when a cover exists, or a
                        deterministic gradient placeholder derived from the draft id. */}
                    <div className="mm-card-glyph"
                      style={{ background: d.cover ? 'transparent' : mmHashColor(d.draftId),
                               padding: d.cover ? 0 : undefined, overflow:'hidden' }}>
                      {d.cover
                        ? <AvatarDisplay avatar={d.cover} size={54} />
                        : (d.title || '?').slice(0,1)
                      }
                    </div>
                    <div className="mm-card-meta">
                      <div className="mm-card-title">{d.title || 'UNTITLED'}</div>
                    </div>
                    <div className={'mm-card-status ' + (isPub?'live':'draft')}>
                      {isPub ? '● LIVE' : '○ DRAFT'}
                    </div>
                  </div>

                  <div className="mm-card-stats">
                    <span><b>{stats.heroes}</b> heroes</span>
                    <span><b>{stats.enemies}</b> enemies</span>
                    <span><b>{stats.nodes}</b> nodes</span>
                    <span className="mm-card-time">edited {mmFmtTime(d.updatedAt)}</span>
                  </div>

                  {/* Action buttons — stopPropagation prevents the card's onClick from firing */}
                  <div className="mm-card-actions" onClick={(e)=>e.stopPropagation()}>
                    <button className="dv-btn primary"
                      onClick={()=>onEditDraft(d)}>
                      ✎ EDIT
                    </button>
                    <button className="dv-btn"
                      onClick={()=>onPlaytestDraft(d)}
                      title="quick playtest without leaving this screen">
                      ▶ PLAYTEST
                    </button>
                    {!isPub && (
                      <button className="dv-btn"
                        disabled={busy}
                        onClick={()=>onPublishDraft(d)}>
                        {busy ? '· · ·' : '↑ PUBLISH'}
                      </button>
                    )}
                    {isPub && (
                      <button className="dv-btn"
                        disabled={busy}
                        onClick={()=>onPublishDraft(d)}
                        title="push your latest edits to the published version">
                        {busy ? '· · ·' : '↻ UPDATE PUBLISHED'}
                      </button>
                    )}
                    {isPub && (
                      <button className="dv-btn danger"
                        disabled={busy}
                        onClick={()=>onUnpublishDraft(d)}>
                        ↓ UNPUBLISH
                      </button>
                    )}
                    <button className="dv-btn danger"
                      onClick={()=>onDeleteDraft(d)}
                      title="permanently delete this draft">
                      ✕ DELETE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="dv-foot">
          <div>
            <b>↑↓</b> SELECT &middot;
            {' '}<b>⏎</b> EDIT &middot;
            {' '}<b>N</b> NEW MOD &middot;
            {' '}<b>ESC</b> BACK TO MENU
          </div>
          <div>devmode.v2 &middot; drafts saved locally · publishes go through <code>dawMapStore</code></div>
        </div>
      )}
    </div>
  );
}

// helpers for mm cards
// Generates a deterministic CSS gradient background colour from a string seed (the draft id).
// Uses a simple polynomial hash to derive a hue value, then offsets it 40° for the second stop.
function mmHashColor(seed){
  let h = 0;
  for(let i=0; i<seed.length; i++){ h = (h*31 + seed.charCodeAt(i)) | 0; }
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue} 38% 24%), hsl(${(hue+40)%360} 42% 18%))`;
}
// Formats a Unix timestamp as a human-readable relative time string (e.g. "5m ago", "2h ago").
function mmFmtTime(t){
  if(!t) return '—';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if(m < 1)  return 'just now';
  if(m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if(h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── Top-level wrapper: routes between MY MODS list and the editor ──────
// Owns the full drafts array in state, persists it to localStorage on every change,
// and handles async publish/unpublish via window.dawMapStore. Renders either
// MyModsList (when no draft is open) or DevModeEditor (when editing a specific draft).
function DevModePage({ blip, onExit, onPlaytest, account }){
  const uid = account?.id;
  const [drafts, setDrafts] = useStateD(() => loadDevDrafts(uid));
  const [editing, setEditing] = useStateD(null); // draftId currently open in the editor, or null
  const [busyId, setBusyId] = useStateD(null);   // draftId with an in-flight publish request
  const [confirm, setConfirm] = useStateD(null); // { msg, onYes } for the confirmation dialog
  const [toast, setToast] = useStateD(null);
  const showToast = (t)=>{ setToast(t); setTimeout(()=>setToast(null), 1600); };

  // Keep dawMapStore in sync with the current account so publish works.
  useEffectD(() => { window.dawMapStore && window.dawMapStore.setCurrentAccount(account || null); }, [account]);

  // Reload drafts when account changes (different user logged in).
  useEffectD(() => { setDrafts(loadDevDrafts(uid)); }, [uid]);

  // Persist the full drafts array to localStorage whenever it changes.
  useEffectD(() => { saveDevDrafts(drafts, uid); }, [drafts, uid]);

  // Creates a new blank draft, prepends it to the list, and opens it in the editor.
  function newDraft(){
    const d = ensureDraftShape(makeDefaultProject());
    d.title = `MY MOD ${drafts.length + 1}`;
    setDrafts(arr => [d, ...arr]);
    setEditing(d.draftId);
    blip && blip(960);
  }

  // Merges partial updates into the matching draft in the array (used by DevModeEditor on every change).
  function updateDraft(next){
    setDrafts(arr => arr.map(d => d.draftId === next.draftId ? { ...d, ...next } : d));
  }

  // Shows a confirmation dialog; on confirm, optionally removes the published copy via
  // dawMapStore then removes the draft from the local array.
  function deleteDraft(d){
    setConfirm({
      msg: `DELETE "${d.title}"?\n${d.publishedId ? 'It is currently published — that copy will be removed too.\n' : ''}This cannot be undone.`,
      onYes: async ()=>{
        if(d.publishedId && window.dawMapStore){
          try { await window.dawMapStore.delete(d.publishedId); } catch(e){}
        }
        setDrafts(arr => arr.filter(x => x.draftId !== d.draftId));
        setConfirm(null);
        showToast('DRAFT DELETED');
        blip && blip(360);
      },
    });
  }

  // Publishes (or updates) a draft via dawMapStore and stores the returned publishedId.
  // Sets busyId for the duration of the async request to disable action buttons.
  async function publishDraft(d){
    if(!window.dawMapStore){ showToast('PUBLISH OFFLINE'); return; }
    setBusyId(d.draftId);
    try {
      const published = await window.dawMapStore.publish(d, {
        author: d.author || 'ANON',
        publishedId: d.publishedId || null,
      });
      setDrafts(arr => arr.map(x => x.draftId === d.draftId
        ? { ...x, publishedId: published.id } : x));
      showToast(d.publishedId ? 'PUBLISHED VERSION UPDATED' : 'MOD PUBLISHED');
      blip && blip(960);
    } catch(e){
      showToast('PUBLISH FAILED');
      console.warn(e);
    } finally {
      setBusyId(null);
    }
  }

  // Shows a confirmation dialog; on confirm, deletes the published copy from dawMapStore
  // and clears publishedId on the local draft (the draft itself is not deleted).
  function unpublishDraft(d){
    if(!d.publishedId) return;
    setConfirm({
      msg: `UNPUBLISH "${d.title}"?\nIt will disappear from the CUSTOM MAPS exchange.\nYour local draft is unaffected.`,
      onYes: async ()=>{
        setBusyId(d.draftId);
        try {
          if(window.dawMapStore) await window.dawMapStore.delete(d.publishedId);
          setDrafts(arr => arr.map(x => x.draftId === d.draftId
            ? { ...x, publishedId: null } : x));
          showToast('UNPUBLISHED');
          blip && blip(540);
        } catch(e){
          showToast('UNPUBLISH FAILED');
        } finally {
          setBusyId(null);
          setConfirm(null);
        }
      },
    });
  }

  // Resolve the full draft object for whichever draftId is currently being edited.
  const editingDraft = editing ? drafts.find(d => d.draftId === editing) : null;

  // Route: show the editor when a draft is open, otherwise show the list.
  if(editingDraft){
    return (
      <DevModeEditor blip={blip}
        initialDraft={editingDraft}
        onChangeDraft={updateDraft}
        onPlaytest={onPlaytest}
        onBackToList={()=>{ setEditing(null); blip && blip(360); }} />
    );
  }

  return (
    <>
      <MyModsList blip={blip}
        drafts={drafts}
        busyId={busyId}
        onExit={onExit}
        onNewDraft={newDraft}
        onEditDraft={(d)=>{ setEditing(d.draftId); blip && blip(960); }}
        onPlaytestDraft={(d)=>{ blip && blip(960); onPlaytest && onPlaytest(d); }}
        onDeleteDraft={deleteDraft}
        onPublishDraft={publishDraft}
        onUnpublishDraft={unpublishDraft} />
      {toast && <div className="dv-toast" style={{ zIndex:60 }}>{toast}</div>}
      {/* Confirmation dialog for destructive actions (delete/unpublish) */}
      {confirm && (
        <div className="overlay" style={{ zIndex:80 }}
          onClick={(e)=>{ if(e.target===e.currentTarget){ blip && blip(360); setConfirm(null); } }}>
          <div className="dialog">
            <h3>▣ CONFIRM</h3>
            <p style={{whiteSpace:'pre-wrap'}}>{confirm.msg}</p>
            <div className="row">
              <button className="sel"
                onClick={confirm.onYes}>YES</button>
              <button onClick={()=>{ blip && blip(360); setConfirm(null); }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Expose key components and utilities on window so the main game shell can
// mount DevModePage and call injectProject / storage helpers directly.
Object.assign(window, { DevModePage, DevModeEditor, MyModsList, injectProject, isDevModeUnlocked, DEVMODE_FORCE_UNLOCK, loadDevProject, saveDevProject, loadDevDrafts, saveDevDrafts });
