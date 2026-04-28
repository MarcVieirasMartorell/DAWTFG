// daw-battle-bg.jsx — Battle arena backgrounds per stage.
// Exposes window.BattleBG — a React component that renders a full-bleed SVG
// background behind the combatants during a battle scene. The base layer
// (sky gradient, stars, ground/grid floor) is shared across all stages;
// a stage-specific sub-component is conditionally rendered in the middle layer.
// Each stage sub-component is a named function component defined in this file.

// Root battle background component. Renders a 1280×460 SVG that fills its container.
// stage — string key identifying the current battle location (e.g. 'POPUP MOOR').
function BattleBG({ stage }){
  const W = 1280, H = 460;

  // Generate 70 star positions deterministically from the stage name's length as a seed.
  // Using stage.length (rather than Math.random) keeps the field stable across re-renders
  // without needing a stored seed, while still varying slightly per stage.
  const stars = React.useMemo(()=>{
    const s=[]; let r=stage.length;
    // LCG pseudo-random number generator — same algorithm used in daw-graphics.jsx.
    const rnd = ()=>{ r=(r*9301+49297)%233280; return r/233280; };
    for(let i=0;i<70;i++){
      s.push({x: Math.floor(rnd()*W), y: Math.floor(rnd()*180), // confined to upper sky
              size: rnd()>0.85?3:2, // ~15 % of stars are 3 px; the rest are 2 px
              d: rnd()*2});          // animation-delay for staggered twinkle
    }
    return s;
  },[stage]); // recompute only when the stage changes

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{position:'absolute', inset:0, width:'100%', height:'100%', display:'block'}}>

      {/* Sky: three stepped colour bands give a gradient effect without CSS gradients */}
      <rect x="0" y="0"   width={W} height={H}   fill="var(--bg-0)"/>
      <rect x="0" y="120" width={W} height={H-120} fill="var(--bg-1)"/>
      <rect x="0" y="240" width={W} height={H-240} fill="var(--bg-2)"/>

      {/* Stars with per-star opacity variation and staggered twinkle animation */}
      {stars.map((s,i)=>(
        <rect key={i} x={s.x} y={s.y} width={s.size} height={s.size}
          fill="var(--cream)" opacity={0.55 + (i%3)*0.15} // three opacity tiers (0.55/0.70/0.85)
          style={{animation:`twinkle 2.4s steps(2) infinite`, animationDelay:`${s.d}s`}}/>
      ))}

      {/* Stage-specific mid-ground layer — only one renders at a time */}
      {stage === 'POPUP MOOR' && <PopupMoor W={W} H={H}/>}
      {stage === 'COOKIE WOODS' && <CookieWoods W={W} H={H}/>}
      {stage === 'TEMP CAVES' && <TempCaves W={W} H={H}/>}
      {stage === 'PROXY PASS' && <ProxyPass W={W} H={H}/>}
      {stage === 'SECTOR FALLS' && <SectorFalls W={W} H={H}/>}
      {stage === 'CORE CHAMBER' && <CoreChamber W={W} H={H}/>}

      {/* Ground floor: solid base band */}
      <rect x="0" y={H-90} width={W} height="90" fill="var(--bg-1)"/>
      {/* Top edge of the floor — a darker 4 px border to separate it from the sky */}
      <rect x="0" y={H-90} width={W} height="4" fill="var(--bg-2)"/>
      {/* 24 alternating dither squares just inside the top edge simulate tile seam detail */}
      {Array.from({length:24}).map((_,i)=>(
        <rect key={i} x={i*56} y={H-86} width={28} height={2}
          fill="var(--bg-2)" opacity=".6"/>
      ))}

      {/* Perspective grid on the floor — horizontal lines fade out toward the bottom */}
      {Array.from({length:6}).map((_,i)=>(
        <rect key={'r'+i} x="0" y={H-90 + i*15} width={W} height="1"
          fill="var(--fg-dim)" opacity={0.35 - i*0.05}/> // opacity decreases with distance
      ))}
      {/* Vertical vanishing lines converge toward the centre bottom for a 1-point perspective */}
      {Array.from({length:14}).map((_,i)=>(
        <line key={'v'+i}
          x1={W/2 + (i-7)*180} y1={H-90}   // spread out at the horizon
          x2={W/2 + (i-7)*22}  y2={H}       // converge near the centre at screen bottom
          stroke="var(--fg-dim)" strokeWidth="1" opacity=".35"/>
      ))}
    </svg>
  );
}

// Mid-ground layer for the 'POPUP MOOR' stage.
// Renders seven floating popup-window silhouettes at varying depths across the horizon.
// W, H — viewBox dimensions passed from BattleBG for positional reference.
function PopupMoor({W,H}){
  // Scattered floating popup-window silhouettes in the distance
  const rects = [];
  // Each tuple: [x, y, width, height] of a popup window in viewBox units.
  const ws = [
    [80,160,90,60], [240,200,70,46], [420,170,110,70], [640,210,80,52],
    [820,180,100,64], [1020,200,90,58], [1160,190,76,50],
  ];
  ws.forEach(([x,y,w,h],i)=>{
    rects.push(<g key={i} opacity=".55">
      <rect x={x} y={y} width={w} height={h} fill="var(--bg-2)"/>    {/* window body */}
      <rect x={x} y={y} width={w} height={8} fill="var(--fg-dim)"/>  {/* title bar */}
      <rect x={x+w-12} y={y+2} width={4} height={4} fill="var(--hl)"/> {/* close button dot */}
    </g>);
  });
  return <g>{rects}</g>;
}

// Mid-ground layer for the 'COOKIE WOODS' stage.
// Renders six vertical columns of stacked circles that resemble cookie-stack tree trunks.
// W, H — viewBox dimensions passed from BattleBG (unused but kept for API consistency).
function CookieWoods({W,H}){
  // Tall thin "tree trunks" made of stacked cookies
  const trunks = [120,300,500,720,940,1140]; // x positions of each trunk
  return (<g>
    {trunks.map((tx,ti)=>(
      <g key={ti} opacity=".6">
        {/* 8 circles stacked vertically; alternate left/right nudge (±2 px) for a wobbly feel */}
        {Array.from({length:8}).map((_,k)=>(
          <circle key={k} cx={tx + (k%2?2:-2)} cy={210 + k*16}
            r="10" fill="var(--bg-2)"/>
        ))}
      </g>
    ))}
  </g>);
}

// Mid-ground layer for the 'TEMP CAVES' stage.
// Renders an overall dark overlay, stalactites hanging from above, and stalagmites rising from the floor.
// W, H — viewBox dimensions passed from BattleBG for floor alignment.
function TempCaves({W,H}){
  // Cave entrance: dark arch, stalactites
  return (<g>
    {/* Dark overlay tints the whole scene to sell the underground atmosphere */}
    <rect x="0" y="0" width={W} height={H} fill="var(--bg-0)" opacity=".4"/>
    {/* 18 stalactites hanging from y=120 — tip length varies by index mod 3 */}
    {Array.from({length:18}).map((_,i)=>(
      <polygon key={i}
        points={`${i*80},120 ${i*80+20},120 ${i*80+10},${160+(i%3)*20}`}
        fill="var(--bg-0)"/>
    ))}
    {/* 14 stalagmites rising from the floor — height varies by index mod 3 */}
    {Array.from({length:14}).map((_,i)=>(
      <polygon key={'b'+i}
        points={`${50+i*100},${H-90} ${70+i*100},${H-90} ${60+i*100},${H-90-(20+(i%3)*8)}`}
        fill="var(--bg-2)"/>
    ))}
  </g>);
}

// Mid-ground layer for the 'PROXY PASS' stage.
// Renders two large mountain silhouettes flanking a central gap, each topped with a
// router-antenna detail (mast, crossbar, blinking tip).
// W, H — viewBox dimensions passed from BattleBG for floor alignment.
function ProxyPass({W,H}){
  // Mountain pass: two big mountain silhouettes flanking center
  return (<g>
    {/* Left mountain: irregular polygon rising from the left edge toward centre */}
    <polygon points={`0,${H-90} 0,240 220,140 420,260 600,${H-90}`}
      fill="var(--bg-2)"/>
    {/* Right mountain: mirrors left, rising from the right edge */}
    <polygon points={`680,${H-90} 820,200 980,120 1180,220 ${W},${H-90}`}
      fill="var(--bg-2)"/>
    {/* router antennas */}
    {/* Left antenna mast + crossbar + blinking tip */}
    <rect x="316" y="100" width="4" height="40" fill="var(--bg-2)"/>
    <rect x="310" y="108" width="16" height="3" fill="var(--bg-2)"/>
    <rect x="316" y="92"  width="2" height="6" fill="var(--hl)"/>
    {/* Right antenna mast + crossbar + blinking tip */}
    <rect x="892" y="84" width="4" height="48" fill="var(--bg-2)"/>
    <rect x="886" y="92" width="16" height="3" fill="var(--bg-2)"/>
    <rect x="892" y="76" width="2" height="6" fill="var(--hl)"/>
  </g>);
}

// Mid-ground layer for the 'SECTOR FALLS' stage.
// Renders 60 falling data-stream stripes and 24 scattered binary text labels
// to evoke a cascading waterfall of digital data.
// W, H — viewBox dimensions passed from BattleBG (H used for stripe height).
function SectorFalls({W,H}){
  // Vertical "data waterfall" stripes
  return (<g>
    {/* Thin vertical bars represent falling data columns; height and opacity vary per bar */}
    {Array.from({length:60}).map((_,i)=>(
      <rect key={i} x={i*22} y={120}
        width="2" height={H-90-120 + (i%4)*8} // height cycles through 4 offsets for variation
        fill="var(--fg-dim)" opacity={0.18 + (i%5)*0.05}/> // opacity cycles through 5 levels
    ))}
    {/* Binary text labels ('01' / '10') scattered at pseudo-random positions */}
    {Array.from({length:24}).map((_,i)=>(
      <text key={'t'+i} x={20 + i*54} y={150 + (i%5)*30} // y varies across 5 rows
        fontFamily="'VT323',monospace" fontSize="14"
        fill="var(--fg)" opacity=".4">{i%2?'01':'10'}</text> // alternate label per column
    ))}
  </g>);
}

// Mid-ground layer for the 'CORE CHAMBER' stage (boss room).
// Renders concentric circuit rings at the centre and four heat-pipe pillars
// near the screen edges to suggest a massive server core.
// W, H — viewBox dimensions passed from BattleBG for centring the ring group.
function CoreChamber({W,H}){
  // Boss chamber: big circuit ring + heat-pipe pillars
  return (<g>
    {/* Three concentric rings centred on the scene; innermost ring uses accent colour */}
    <g transform={`translate(${W/2} 220)`} opacity=".7">
      <circle cx="0" cy="0" r="160" fill="none" stroke="var(--bg-2)" strokeWidth="4"/>
      <circle cx="0" cy="0" r="120" fill="none" stroke="var(--bg-2)" strokeWidth="3"
        strokeDasharray="6 4"/> {/* dashed ring gives a circuit-trace look */}
      <circle cx="0" cy="0" r="80"  fill="none" stroke="var(--hl)" strokeWidth="2" opacity=".6"/>
    </g>
    {/* Four vertical pillars at x = 120, 280, 1000, 1160 — symmetric pairs left and right */}
    {[120, 280, 1000, 1160].map((x,i)=>(
      <g key={i}>
        <rect x={x-8} y={120} width={16} height={H-210} fill="var(--bg-2)"/>  {/* pillar shaft */}
        <rect x={x-14} y={120} width={28} height={6} fill="var(--bg-2)"/>     {/* cap plate */}
        <rect x={x-4} y={132} width={8} height={4} fill="var(--hl)" opacity=".7"/> {/* glowing vent */}
      </g>
    ))}
  </g>);
}

// Register BattleBG globally so the battle module can render it without module imports.
Object.assign(window, { BattleBG });
