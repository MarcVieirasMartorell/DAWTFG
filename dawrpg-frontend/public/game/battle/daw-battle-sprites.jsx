// daw-battle-sprites.jsx
//
// Pure data file: pixel art sprite grids for every hero and enemy in the game,
// plus the BSprite renderer component and the ENEMY_KINDS catalog.
//
// Each sprite is a 2D character grid stored as an array of strings (rows).
// The renderer maps each character to a fill color supplied by the caller:
//   '#' = body color (main fill)
//   'r' = rim / highlight (lighter edge)
//   'k' = dark shadow (darker edge or recess)
//   'a' = accent color (costume detail, weapon, glow)
//   'e' = eye / glow pixel (special contrast color)
//   'w' = white (hard-coded #fff, rarely used)
//   '.' = transparent (skipped — no rect emitted)
//
// All sprites are normalised to 16 wide x 18 tall for consistent layout
// in the battle scene.  Original design dimensions are noted in each comment.

// ── HEROES (battle pose, facing left toward enemies) ──────────────────

// CURSOR.EXE — the pointer hero with a click-arm as its weapon.
// The top rows form the classic arrow-cursor silhouette (accent 'a').
// The lower rows draw a boxy terminal-window body with open interior.
const B_CURSOR = [
  '..aa............',
  '..aka...........',
  '..akka..........',
  '..akkka.........',
  '..akkkka........',
  '..akkkkka.......',
  '..akkkakka......',
  '..akkkkkkka.....',
  '..akakkakkka....',
  '..akkkaakka.....',
  '..akkkkkka......',
  '..akkkaakka.....',
  '..akka..akaa....',
  '...aa....a..a...',
  '.......aaa..aa..',
  '......a......a..',
  '......a......a..',
  '....aaa.....aa..',
];

// GUARD.SYS — shield-up tank; the widest hero silhouette.
// The central block of '#' and 'r' rows forms the raised shield face.
// The 'aa'/'aaa' flanking columns on rows 5-11 are the pauldron/arm extensions.
const B_GUARD = [
  '......####......',
  '.....######.....',
  '....#e#e#e##....',
  'k...#e#e#e##...k',
  'kkk.########.kkk',
  'kaakkkkkkkkkkaak',
  'kraaaaakaaaaaaak',
  'kraaaaakaaaaaakk',
  'krkaaaakaaakaaak',
  'kaaaaaakaakaaaak',
  'kaaaaaakaaaaaaak',
  '##aakaakaaaaaa##',
  '##aaaaakaaaaak##',
  '##kaaaakaakaak##',
  '...kaaakaaaak...',
  '....kaakaaak....',
  '....#kakaak#....',
  '...###kkkk###...',
];

// PURGE.BAT — hooded sysadmin caster with a long staff.
// Rows 0-6 form the cowl/hood (accent 'a' outline, body '#' face).
// Row 4 uses 'e' for the narrow eye-slit glowing beneath the hood.
// Rows 7-16 are the robe/body; the right column of 'a' + '#' forms the staff.
const B_PURGE = [
  '................',
  '................',
  '.........r......',
  '........rr......',
  '.......r##r.....',
  '.......r#er.....',
  '......r####r....',
  '......r#e##r....',
  '.e...r#e####r...',
  'eee..r####e#r...',
  '.e..rrrrrrrrrr..',
  '.a....kekekk....',
  '.a....######....',
  '.aa####rrrr##...',
  '..arrrrrrrrr#...',
  '..a###rrrrrr#...',
  '..a..#r###rr#...',
  '..a.###...###...',
];

// PING.DLL — lightweight scout unit with a signal antenna and radar eyes.
// Rows 0-2 show two curved antenna arcs (accent 'a') radiating outward.
// Row 3 is the antenna base; rows 7-8 are the wide head with 'e' eye pixels.
const B_PING = [
  '................',
  '................',
  '................',
  '....####........',
  '...#rrr##.......',
  '...#reer#.......',
  '...#rerr#aaa....',
  '...#rrrkr#a.....',
  '...#rrkkrr#...a.',
  '...#rrrrkr##..aa',
  '....#rrkkrrr###.',
  '....#rrrrrrrr##.',
  '.....#rrrrr###..',
  '......#####.....',
  '......#...#.....',
  '......a...a.....',
  '......a...a.....',
  '.....aa..aa.....',
];

// ROOT.SH — superuser; wears a $-crown and heavy shoulder armour.
// Rows 0-2 form the three crown prongs (accent 'a' pixels).
// Rows 8-12 are the broad pauldron blocks flanking the torso.
const B_ROOT = [
  '.......aa.......',
  '.....r.aa.r.....',
  '.....aaaaaa.....',
  '.....######.....',
  '....##e##e##....',
  '....##e##e##....',
  '....#k####k#....',
  '....##kkkk##....',
  '..aa.######.aa..',
  '.aa##########aa.',
  '.aa##rr##rr##aa.',
  '.aa##r####r##aa.',
  '..aa########aa..',
  '....##....##....',
  '....##....##....',
  '....rr....rr....',
  '....rr....rr....',
  '...rrr....rrr...',
];

// INDEX.LOG — archivist hero clutching a large ledger/scroll.
// The head (rows 0-5) has double 'e' pupils for a wide-eyed bookkeeper look.
// Rows 8-12 show arms wrapping a rectangular book (solid accent 'a' rectangle).
const B_INDEX = [
  '................',
  '................',
  '................',
  '.....rrrrrrr....',
  '....r######r....',
  '....ree#ee#r....',
  '....r#######r...',
  '....r#rrr##rr...',
  '....rr###rrr....',
  '.....rrrraaar...',
  '......rrrrrar...',
  '......rkkkraar..',
  '......rkk##aar..',
  '......rkkkraar..',
  '......rrrrraaar.',
  '.......raaaaaar.',
  '.......raaaaaar.',
  '.......rrrrrrrr.',
];

// ── ENEMIES (facing right toward heroes) — all normalised to 16w x 18h ──

// POPUP.IMP — an angry browser dialog box come to life.
// Top 2 and bottom 2 rows are transparent padding to reach 18 rows.
// Rows 2-15 draw a window frame ('#') with title bar ('a' highlight),
// two eye sockets (rows 7-9), and a row of fang keys ('k') at the bottom.
const E_POPUP = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...#........#...',
  '...##......##...',
  '....########....',
  '#...#kkkkkk#....',
  '##..#kekkke#....',
  '#...#keekee#....',
  '#...#kkkkkk#....',
  '############....',
  '....#......#....',
  '....#......#....',
  '...#.#....#.#...',
  '................',
  '................',
];

// TRACKER.SLIME — a cookie-tracker blob; rounded shape with chip highlights.
// 3 rows of transparent padding top and bottom to centre the 12-row body.
// 'r' pixels scattered across the surface mimic chocolate-chip reflections.
const E_SLIME = [
  '................',
  '................',
  '................',
  '....########....',
  '..###k####k###..',
  '.########k####k.',
  '.####r####r####.',
  '.#k##rr##rr####.',
  '.##############.',
  '.###rrrrrrrr#k#.',
  '.#k#r######r###.',
  '..####k##k####..',
  '...####k#####...',
  '....########....',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
];

// CACHE.GHOUL — a wispy ghost made from cached/corrupted file fragments.
// The body tapers into ragged tendrils at the bottom (alternating '#' and '.').
// 'e' eye pixels glow inside hollow sockets framed by '#' brows.
const E_GHOUL = [
  '..#.............',
  '.....######...#.',
  '....########..#.',
  '#..###e##e###...',
  '#..###e##e#.#...',
  '#..########.#...',
  '...###########..',
  '...#.#r##r###...',
  '...###rrrr###...',
  '...#.########...',
  '...#..####..#...',
  '...##.###..##...',
  '...##########...',
  '...#k#k#k#k#...',
  '...#.#.#.#.#...',
  '...#...#...#...',
  '.#...#..........',
  '.#.........#....',
];

// KEYLOG.RAT — a surveillance rat carrying keyboard key caps on its back.
// Two 'a'-bordered key caps (rows 2-4, left and right) sit atop the body.
// 'k' and '#' pixels on the lower-right form the thick hairless tail.
const E_KEYLOG = [
  '................',
  '.aa......aa.....',
  'ae#a....a#ea....',
  'a#ea....ae#a....',
  'ae#a....a#ea....',
  '.aa##aa##aa.....',
  '..########......',
  '.####aa####aaaa.',
  '.###aeaa###aaaa.',
  '.###aeea#kk#####',
  '.####aa####kkkk#',
  '..########...a.a',
  '...######.......',
  '...#....#.......',
  '...#....#.......',
  '..###..###......',
  '...#....#.......',
  '................',
];

// PHISH.WYRM — a coiling serpent with a fishhook accent; mid-tier boss.
// Rows 0-2 show a small hooked tip (accent 'a') at top-left, the hook barb.
// Rows 3-10 form the serpent head and upper body with 'r'/'k' scale stripes.
// Rows 11-17 are the coiled lower body tapering to the tail.
const E_PHISH = [
  '.aaa............',
  'aaaa............',
  '.aa.............',
  '..aa....####....',
  '..a#####rrrrr#..',
  '..#rrrrr####ee..',
  '.#r#kkkkk#####..',
  '#r#k....k###rrr#',
  '##k......kkkrkkk',
  '#k..........r...',
  '##..............',
  '##..............',
  '#r#...........r.',
  '##r#.........rr.',
  'k##r#.......##..',
  '.kk#r#.....##k..',
  '...k#r#####kk...',
  '....kkkkkkk.....',
];

// RANSOM.LARVA — a ransomware cocoon sealed with an 'a'-colored padlock.
// The outer shell (rows 1-15) is a rounded '#' egg shape.
// Rows 3-5 form the padlock shackle (accent 'a' arch); rows 6-13 the lock body.
// The keyhole inside the lock body is marked with 'k' pixels.
const E_RANSOM = [
  '.....a....a.....',
  '.....######.....',
  '....#a####a#....',
  '...##aa##aa##...',
  '...##########...',
  '...####aa####...',
  '...##########...',
  '...####aa####...',
  '.aa###aaaa###aa.',
  '...##aaaaaa##...',
  '.aa##a####a##aa.',
  '...##a#kk#a##...',
  '...##a####a##...',
  '...##aaaaaa##...',
  '...##########...',
  '....########....',
  '.....######.....',
  '................',
];

// TROJAN.WORM — multi-segment boss worm; the largest enemy in the game.
// Rows 0-7 form the head section with double 'ee' eyes and a gaping mouth.
// Alternating 'rrrr...' and 'kkkk...' stripes across the body simulate
// the worm's segmented exoskeleton.  No transparent padding — fills all 18 rows.
const E_TROJAN = [
  'aaaaa...rr..aaaa',
  '#a.......r....a#',
  '##aaaa...r.aaa##',
  '###aa...rr..a###',
  '#####a..r..a####',
  '###e##a.r.aa####',
  'rreerr#ara#rrrrr',
  '#eee####a#######',
  '################',
  'kkkkkkkkkkkkkkkk',
  '######rrrrrr####',
  '################',
  '################',
  'rrrrrrrrrrrrrrrr',
  '################',
  '################',
  'kkkkkkkkkkkkkkkk',
  '################',
];

// ── Sprite renderer ───────────────────────────────────────────────────

// BSprite renders a single pixel-art sprite grid as a group of SVG <rect> elements.
// Caller provides per-token fill colors; transparent '.' cells are skipped entirely.
// x/y offset and scale (pixels per cell) allow precise placement inside a shared SVG.
function BSprite({ grid, x=0, y=0, scale=4, body, rim, dark, acc, eye, white, className, style }){
  const rows = grid.length, cols = grid[0].length;
  const rects = [];
  for(let r=0; r<rows; r++){
    const row = grid[r];
    for(let c=0; c<cols; c++){
      const ch = row[c];
      if(ch === '.') continue; // transparent — emit nothing
      // Map the character token to the corresponding caller-supplied color.
      const f = ch === '#' ? body
              : ch === 'r' ? (rim||body)
              : ch === 'k' ? (dark||body)
              : ch === 'a' ? (acc||body)
              : ch === 'e' ? (eye||rim||body)
              : ch === 'w' ? (white||'#fff')
              : body;
      rects.push(<rect key={r+'-'+c}
        x={x + c*scale} y={y + r*scale}
        width={scale} height={scale} fill={f} />);
    }
  }
  // Wrap all rects in a <g> so callers can apply transforms or CSS to the whole sprite.
  return <g className={className} style={style}>{rects}</g>;
}

// bspriteSize returns the pixel width and height a grid will occupy at the given scale.
// Useful for computing layout offsets without rendering the sprite first.
function bspriteSize(grid, scale=4){
  return { w: grid[0].length*scale, h: grid.length*scale };
}

// ── Catalog wired to map / bestiary names ─────────────────────────────

// ENEMY_KINDS maps the canonical enemy name string (as used in map data and the bestiary)
// to its sprite grid, base combat stats, and themed color palette.
// hp = max hit points, dmg = [min, max] damage per attack, spd = attack speed multiplier,
// xp = experience awarded on defeat, and body/rim/dark/acc/eye = BSprite color tokens.
const ENEMY_KINDS = {
  'POPUP.IMP':     { grid: E_POPUP,  hp:  72, dmg: [12, 20], spd: 1.4,  xp: 12,  body:'#c96969', rim:'#fefae0', dark:'#591818', acc:'#d39b3c', eye:'#d26c2d',
    attacks: [{ id:'ax1sp', name:'UNSKIPPABLE.AD()', kind:'single', dmg:[12,20] }] },
  'TRACKER.SLIME': { grid: E_SLIME,  hp:  95, dmg: [14, 20], spd: 1.0,  xp: 18,  body:'#b07840', rim:'#fff1cf', dark:'#3a200a', acc:'#9a3a3a', eye:'#1a0a00',
    attacks: [{ id:'ax0od', name:'FORCED.COOKIES()', kind:'single', dmg:[14,20] }] },
  'CACHE.GHOUL':   { grid: E_GHOUL,  hp: 115, dmg: [16, 24], spd: 0.9,  xp: 22,  body:'#9bc4ff', rim:'#e6f1ff', dark:'#13294a', acc:'#ff6ec7', eye:'#3a1a4a',
    attacks: [{ id:'axgjd', name:'PHANTOM.PAIN()', kind:'single', dmg:[16,24] }, { id:'axl2i', name:'LAG.BOMB()', kind:'aoe', dmg:[8,14] }] },
  'KEYLOG.RAT':    { grid: E_KEYLOG, hp: 210, dmg: [20, 32], spd: 1.3,  xp: 60,  body:'#7a6a55', rim:'#cfb38a', dark:'#1a120a', acc:'#fefae0', eye:'#ff3a3a',
    attacks: [{ id:'axuj2', name:'KEY.STAB()', kind:'single', dmg:[20,32] }, { id:'axxju', name:'STEAL.YOUR.PWORD()', kind:'aoe', dmg:[12,18] }, { id:'axbsl', name:'CONSUME.KEY()', kind:'heal', heal:[30,50] }] },
  'PHISH.WYRM':    { grid: E_PHISH,  hp: 175, dmg: [22, 34], spd: 0.85, xp: 80,  body:'#3a8a5b', rim:'#a5e58a', dark:'#0a2a18', acc:'#d4a373', eye:'#ffdc4a',
    attacks: [{ id:'ax988', name:'TAIL.WHIP()', kind:'single', dmg:[22,34] }, { id:'axxq8', name:'TAIL.SWEEP()', kind:'aoe', dmg:[10,18] }, { id:'ax6le', name:'SCALE.COAT()', kind:'shield' }] },
  'RANSOM.LARVA':  { grid: E_RANSOM, hp: 130, dmg: [16, 26], spd: 1.0,  xp: 44,  body:'#7a4a8a', rim:'#d4a3e5', dark:'#1a0a2a', acc:'#ffdc4a', eye:'#1a0a00',
    attacks: [{ id:'axd4o', name:'SMOL.BITE()', kind:'single', dmg:[16,26] }, { id:'axcgh', name:'HARDEN()', kind:'shield' }, { id:'axdpt', name:'HIVE.MIND()', kind:'heal', heal:[30,50] }] },
  'TROJAN.WORM':   { grid: E_TROJAN, hp: 380, dmg: [18, 30], spd: 0.60, xp: 400, body:'#563c20', rim:'#d4a373', dark:'#1a0a00', acc:'#9a1a1a', eye:'#ffdc4a',
    attacks: [{ id:'axd0p', name:'ENGULF()', kind:'aoe', dmg:[10,18] }, { id:'ax8lx', name:'HARDEN.V2()', kind:'buff' }, { id:'axy9k', name:'CHOMP()', kind:'single', dmg:[18,28] }] },
};

// Expose everything needed by the battle scene and bestiary to the global window object.
Object.assign(window, {
  BSprite, bspriteSize,
  B_CURSOR, B_GUARD, B_PURGE, B_PING, B_ROOT, B_INDEX,
  ENEMY_KINDS,
});
