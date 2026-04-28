// daw-graphics.jsx
// Pixel scene: starfield, rising CPU-disc sun, file-stack hill, three hero silhouettes.
// All rendered as SVG with shape-rendering:crispEdges for chunky NES feel.
// Exposes window.Scene — a React component mounted on the title screen.
// Depends on window.BSprite and window.HEROES_DEF being loaded before first render.

const PX = 4; // base pixel size in the scene viewBox units

// Names of the three starter heroes shown on the title screen.
// Must match the keys defined in HEROES_DEF inside daw-battle.jsx.
// BSprite and HEROES_DEF are accessed at render time, after all scripts have loaded.
const SCENE_HEROES = ['CURSOR.EXE', 'GUARD.SYS', 'PURGE.BAT'];

// Renders the pixel-art hill that forms the ground of the title screen.
// Built from stepped rectangles, folder-tab "rocks", and scattered binary digits.
// y     — the viewBox Y coordinate of the hill's uppermost edge.
// color — fill colour for the main hill body (CSS variable string).
// dark  — fill colour for shadows, folder tabs, and decorative details.
function Hill({y, color, dark}){
  // y = top of hill in viewBox
  const rects = [];

  // Four horizontal bands create a stepped silhouette from wide base to narrow peak.
  const steps = [
    [0, y+10, 880, 80],     // base — widest band, sits at the bottom
    [60, y+4, 760, 8],      // mid — slightly narrower and higher
    [180, y, 540, 8],       // upper plateau — where the scene horizon sits
    [280, y-6, 320, 6],     // small bump — raised area beneath the three heroes
  ];
  steps.forEach(([sx,sy,sw,sh],i)=>{
    // The first (base) band uses the dark colour; higher bands use the lighter body colour.
    rects.push(<rect key={'s'+i} x={sx} y={sy} width={sw} height={sh}
      fill={i===0?dark:color} />);
  });

  // Six folder-tab silhouettes scattered across the hill act as decorative "rocks".
  // Each folder is drawn as: a narrow tab on top, a body rectangle, and a highlight stripe.
  const folders = [
    [40,y+20,28,16],[110,y+14,32,18],[700,y+18,30,16],
    [820,y+22,24,14],[230,y+10,22,12],[640,y+6,26,14],
  ];
  folders.forEach(([fx,fy,fw,fh],i)=>{
    rects.push(<g key={'f'+i}>
      <rect x={fx} y={fy-3} width={fw*0.4} height={3} fill={dark}/>  {/* folder tab */}
      <rect x={fx} y={fy} width={fw} height={fh} fill={dark}/>        {/* folder body */}
      <rect x={fx+2} y={fy+2} width={fw-4} height={2} fill={color}/> {/* highlight line */}
    </g>);
  });

  // 14 small 4×4 squares evenly spaced across the hill represent scattered binary digits.
  const bits = '01010110100110';
  for(let i=0;i<14;i++){
    rects.push(<rect key={'b'+i} x={70+i*54} y={y+30+(i%3)*8}
      width={4} height={4} fill={dark} opacity=".7"/>);
  }
  return <g>{rects}</g>;
}

// Renders the stylised "CPU-disc" sun that appears above the hill on the title screen.
// Composed of concentric circles, cross-shaped halo rays, and 12 protruding pin lines
// arranged radially to mimic an IC chip.
// cx    — horizontal centre of the sun in viewBox units.
// cy    — vertical centre of the sun in viewBox units.
// color — fill for the sun body rings (CSS variable string).
// hot   — fill for the bright inner core circle.
// ring  — fill for the alternating outer rings and halo rays.
function Sun({cx, cy, color, hot, ring}){
  return (
    <g className="sun">
      {/* halo rays — four rotated pairs of rectangles forming an 8-point cross */}
      {[0,45,90,135].map(a=>(
        <g key={a} transform={`rotate(${a} ${cx} ${cy})`}>
          {/* Each rotation adds rays above, below, left, and right of centre */}
          <rect x={cx-2} y={cy-72} width={4} height={20} fill={ring} opacity=".55"/>
          <rect x={cx-2} y={cy+52} width={4} height={20} fill={ring} opacity=".55"/>
          <rect x={cx-72} y={cy-2} width={20} height={4} fill={ring} opacity=".55"/>
          <rect x={cx+52} y={cy-2} width={20} height={4} fill={ring} opacity=".55"/>
        </g>
      ))}
      {/* Concentric circles alternate between ring and color to create a disc pattern */}
      <circle cx={cx} cy={cy} r={48} fill={ring} />   {/* outer ring */}
      <circle cx={cx} cy={cy} r={42} fill={color} />  {/* body band */}
      <circle cx={cx} cy={cy} r={32} fill={ring} />   {/* inner ring */}
      <circle cx={cx} cy={cy} r={26} fill={color} />  {/* inner body band */}
      <circle cx={cx} cy={cy} r={14} fill={hot} />    {/* hot core */}
      {/* 12 CPU-pin lines evenly distributed around the outer edge of the disc */}
      {Array.from({length:12}).map((_,i)=>{
        // Compute the angle for each pin in radians, then project two radii to get endpoints.
        const a = (i/12)*Math.PI*2;
        const r1 = 48, r2 = 56; // inner and outer radius of each pin line
        const x1 = cx + Math.cos(a)*r1, y1 = cy + Math.sin(a)*r1;
        const x2 = cx + Math.cos(a)*r2, y2 = cy + Math.sin(a)*r2;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={ring} strokeWidth="3" />;
      })}
    </g>
  );
}

// Root title-screen scene component. Composes all visual layers in z-order:
// sky gradient → stars → sun → distant antennas → hill → hero sprites → foreground strip.
// Renders into a 880×240 viewBox (wide cinematic strip) with crispEdges for pixel art.
function Scene({ showHeroes = true }){
  // viewBox is 880x240 — plenty of room for a wide cinematic strip
  const W=880, H=240;

  // Generate 60 star positions once using a deterministic LCG so the field is
  // always the same (no random jitter on re-renders) and needs no external seed file.
  const stars = React.useMemo(()=>{
    const s=[]; const seed = 7;
    let r = seed;
    // Linear congruential generator: produces a repeatable pseudo-random sequence.
    const rnd = ()=>{ r=(r*9301+49297)%233280; return r/233280; };
    for(let i=0;i<60;i++){
      s.push({x:Math.floor(rnd()*W), y:Math.floor(rnd()*120), // confined to upper sky half
              size: rnd()>0.85?3:2, // most stars are 2 px; ~15 % are larger 3 px
              d: rnd()*2});          // animation-delay offset so they don't all twinkle in sync
    }
    return s;
  },[]); // empty deps array: recomputed only on mount, never on re-render

  // Sprite sizing: each sprite is 16 columns × 18 rows of pixels at 4× scale.
  const SCALE = 4;
  const SPR_W = 16 * SCALE; // 64 viewBox units wide per hero sprite
  const SPR_H = 18 * SCALE; // 72 viewBox units tall per hero sprite
  const GAP   = 8;           // gap between adjacent hero sprites

  const heroBaseY = 195; // y coordinate where hero feet touch the hill
  const spriteY   = heroBaseY - SPR_H; // top-left y so sprite bottoms align at heroBaseY

  // Calculate x positions that centre the three sprites as a group.
  const groupW = SCENE_HEROES.length * SPR_W + (SCENE_HEROES.length - 1) * GAP;
  const startX = Math.round((W - groupW) / 2);
  const heroXs  = SCENE_HEROES.map((_,i) => startX + i * (SPR_W + GAP));

  return (
    <svg className="scene" viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      {/* sky gradient: three stepped colour bands from top to bottom */}
      <rect x="0" y="0" width={W} height={H} fill="var(--bg-0)"/>
      <rect x="0" y="60" width={W} height={H-60} fill="var(--bg-1)"/>
      <rect x="0" y="110" width={W} height={H-110} fill="var(--bg-2)"/>

      {/* Stars scattered across the upper 120 px of the sky */}
      {stars.map((s,i)=>(
        <rect key={i} className="star" x={s.x} y={s.y}
          width={s.size} height={s.size} fill="var(--cream)"
          style={{animationDelay: s.d+'s'}}/> // staggered twinkle via CSS animation
      ))}

      {/* CPU-disc sun centred horizontally, placed behind the hill */}
      <Sun cx={W/2} cy={70} color="var(--hl)" hot="var(--cream)" ring="var(--fg-bright)"/>

      {/* Two distant tower/antenna silhouettes (left and right) for depth */}
      <g fill="var(--bg-2)">
        {/* Left antenna */}
        <rect x="80" y="100" width="6" height="40"/>
        <rect x="74" y="106" width="18" height="4"/>
        <rect x="78" y="96" width="2" height="6" fill="var(--hl)"/> {/* blinking tip */}
        {/* Right antenna */}
        <rect x="780" y="92" width="8" height="48"/>
        <rect x="772" y="100" width="24" height="4"/>
        <rect x="784" y="86" width="2" height="8" fill="var(--hl)"/> {/* blinking tip */}
      </g>

      {/* File-folder hill that the heroes stand on */}
      <Hill y={195} color="var(--bg-2)" dark="var(--bg-1)"/>

      {/* Heroes — live HEROES_DEF sprites (picks up admin palette + sprite overrides) */}
      {showHeroes && SCENE_HEROES.map((name, i) => {
        // Skip rendering if HEROES_DEF hasn't loaded yet or the key is missing.
        const def = window.HEROES_DEF?.[name];
        if(!def) return null;
        return (
          // BSprite renders a pixel-art character using the hero's colour palette and grid.
          <BSprite key={name}
            className={`hero-${i+1}`} // CSS class used to add idle animation per hero slot
            grid={def.sprite}
            x={heroXs[i]} y={spriteY}
            scale={SCALE}
            body={def.body} rim={def.rim} dark={def.dark} acc={def.acc} eye={def.eye}/>
        );
      })}

      {/* Thin foreground ground strip at the very bottom to anchor the scene */}
      <rect x="0" y={H-12} width={W} height="12" fill="var(--bg-0)"/>
    </svg>
  );
}

// Register Scene globally so the title-screen bootstrap can mount it without module imports.
Object.assign(window, { Scene });
