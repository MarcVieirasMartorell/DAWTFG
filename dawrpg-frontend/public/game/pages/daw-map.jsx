// daw-map.jsx — Mario-style world map: nodes (fights) connected by paths.
// Save nodes are now checkpoint nodes: the player must complete a mandatory
// dialogue (with speaker portrait + typewriter text) and receive item rewards
// before the path beyond is unlocked. onClearNode(nodeId, worldId, reward) is
// called on the parent so it can persist the clear and grant items.
// Supports multiple worlds. Each world is a self-contained graph of nodes/edges
// with the same id namespace (start, n1..n5, shop, mid, save2, boss).
//
// Architecture overview:
//   WORLDS            — static data array defining all three sectors (Desktop, Kernel, Cloud),
//                       their node coordinates in a 1000×420 SVG viewBox, encounter payloads,
//                       and the edge list that describes which nodes connect to which.
//   buildAdj          — converts the flat edge list into an adjacency map for O(1) neighbour lookup.
//   pickDirectional   — selects the best neighbour in a given arrow-key direction using dot-product scoring.
//   NodeIcon          — SVG pixel-art icon that changes shape and colour based on node type/state.
//   clearsForWorld    — decodes a flat "w1:n2" cleared-node list into a per-world Set.
//   TutorialOverlay   — multi-page combat briefing shown once before the player's first battle.
//   WorldMap          — main world-map component: SVG graph, player token, info panel, overlays,
//                       keyboard navigation, and all state management for the current world.
//
// WorldMap is exported to window so the page shell can mount it without a module bundler.

const { useState: useStateM, useEffect: useEffectM, useRef: useRefM, useMemo: useMemoM, useCallback: useCallbackM } = React;

// ── Checkpoint dialogue components ──────────────────────────────────────

// Renders the speaker portrait for a checkpoint dialogue page.
// Accepts speakerImage: { type:'image', dataUrl } | null.
// Falls back to a box showing the first letter of the speaker name.
function CheckpointPortrait({ image, name, size=80 }){
  const boxStyle = {
    width:size, height:size, flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    border:'2px solid var(--fg-dim)',
    background:'var(--bg-1)', overflow:'hidden',
  };
  if(image?.type === 'image' && image.dataUrl){
    return (
      <div className="chkpt-portrait-box" style={{width:size,height:size}}>
        <img src={image.dataUrl} alt={name||''} />
      </div>
    );
  }
  return (
    <div className="chkpt-portrait-box" style={{width:size,height:size}}>
      <span style={{fontFamily:"'Press Start 2P',monospace",
        fontSize:Math.floor(size/3.5), color:'var(--fg-dim)'}}>
        {(name||'?').slice(0,1)}
      </span>
    </div>
  );
}

// CheckpointDialog — full-screen overlay shown when entering a save node.
// The player must read all dialogue pages and confirm the reward before the
// node is cleared and the path beyond unlocks.
// Props:
//   node     — the save node object (must have dialogue[] and reward[])
//   blip     — sound callback(freq)
//   replay   — when true, the dialogue is optional (ESC closes without clearing)
//   onClear(reward) — called when the player confirms; parent marks the node cleared
//   onCancel — called when replay=true and the player presses ESC
function CheckpointDialog({ node, blip, replay=false, onClear, onCancel }){
  const pages  = node.dialogue || [];
  const reward = node.reward   || [];

  const [pi,          setPi]          = useStateM(0);
  const [typed,       setTyped]       = useStateM('');
  const [full,        setFull]        = useStateM(false);
  const [rewardPhase, setRewardPhase] = useStateM(pages.length === 0);
  const fullRef         = useRefM(false);
  const cancelTypingRef = useRefM(false);
  const piRef           = useRefM(0);

  useEffectM(() => { piRef.current = pi; }, [pi]);

  const page = pages[pi] || null;

  useEffectM(() => {
    if(rewardPhase || !page) return;
    setTyped(''); setFull(false); fullRef.current = false; cancelTypingRef.current = false;
    const text = page.text || '';
    let i = 0;
    function tick(){
      if(cancelTypingRef.current) return;
      if(i <= text.length){
        setTyped(text.slice(0, i));
        if(i % 3 === 0) blip && blip(860 + (Math.random()*60|0));
        i++;
        setTimeout(tick, 22);
      } else {
        setFull(true); fullRef.current = true;
      }
    }
    setTimeout(tick, 60);
    return () => { cancelTypingRef.current = true; };
  }, [pi, page, rewardPhase, blip]);

  useEffectM(() => {
    function onKey(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        if(rewardPhase){ onClear(reward); return; }
        if(!fullRef.current){
          cancelTypingRef.current = true;
          setTyped(page?.text || ''); setFull(true); fullRef.current = true;
          blip && blip(720);
        } else {
          blip && blip(960);
          const next = piRef.current + 1;
          if(next < pages.length) setPi(next);
          else setRewardPhase(true);
        }
      } else if(e.key === 'Escape' && replay){
        blip && blip(360); onCancel && onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pi, pages, page, rewardPhase, replay, blip, reward, onClear, onCancel]);

  function handleClick(){
    if(rewardPhase){ onClear(reward); return; }
    if(!fullRef.current){
      cancelTypingRef.current = true;
      setTyped(page?.text || ''); setFull(true); fullRef.current = true;
      blip && blip(720);
    } else {
      blip && blip(960);
      const next = piRef.current + 1;
      if(next < pages.length) setPi(next);
      else setRewardPhase(true);
    }
  }

  return (
    <div className="chkpt-overlay">
      <div className="chkpt-dialog">
        <div className="chkpt-header">
          <span>▣ {node.label || 'CHECKPOINT'}</span>
          <span style={{display:'flex',gap:14,alignItems:'center'}}>
            {!rewardPhase && pages.length > 1 &&
              <span style={{color:'var(--fg-dim)',fontSize:7}}>{pi+1} / {pages.length}</span>}
            {replay &&
              <span style={{color:'var(--fg-dim)',fontSize:7,
                fontFamily:"'VT323',monospace",letterSpacing:'.04em'}}>
                ESC — CLOSE
              </span>}
          </span>
        </div>

        {!rewardPhase && page && (
          <>
            <div className="chkpt-body" onClick={handleClick}>
              <div className="chkpt-portrait-col">
                <CheckpointPortrait image={page.speakerImage} name={page.speakerName} size={80} />
                {page.speakerName &&
                  <div className="chkpt-portrait-name">{page.speakerName}</div>}
              </div>
              <div className="chkpt-text-col">
                <div className="chkpt-text">
                  {typed.split('\n').map((ln,i) => <div key={i}>{ln || ' '}</div>)}
                </div>
              </div>
            </div>
            <div className="chkpt-footer">
              <span><b>TAP</b> / <b>⏎</b> ADVANCE</span>
              <span className={'chkpt-next '+(full?'on':'')}>▼</span>
            </div>
          </>
        )}

        {rewardPhase && (
          <div className="chkpt-reward-phase">
            <div className="chkpt-reward-title">▣ CHECKPOINT SECURED</div>
            {reward.length > 0 ? (
              <>
                <div className="chkpt-reward-note">ITEMS RECEIVED:</div>
                <div className="chkpt-reward-list">
                  {reward.map((r,i) => (
                    <div key={i} className="chkpt-reward-item">
                      <span>{r.itemId || '?'}</span>
                      <span className="qty">×{r.qty || 1}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="chkpt-reward-note">PATH AHEAD IS NOW UNLOCKED.</div>
            )}
            <button className="chkpt-continue-btn" onClick={() => onClear(reward)}>
              CONTINUE ▶
            </button>
            {replay &&
              <div style={{fontFamily:"'VT323',monospace",fontSize:14,
                color:'var(--fg-dim)',letterSpacing:'.04em',marginTop:2}}>
                (replay — items already granted)
              </div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── WORLDS ──────────────────────────────────────────────────────────────
// Coordinates in viewBox space (0..1000 wide, 0..420 tall). Each world has
// the same structural shape so progression feels familiar.
const WORLDS = [
  {
    id: 'w1',
    name: 'SECTOR 1 / DESKTOP',
    sub:  'system drive · workstation surface',
    nodes: [
      { id:'start',  x:70,   y:300, type:'save',  label:'/HOME',                   sub:'AUTO-SAVE POINT',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'SECTOR 1: DESKTOP.\nTHREE HOSTILE PROCESSES CONFIRMED.\nTHE SYSTEM IS COUNTING ON YOU.' },
          ],
          reward:[] },
      { id:'n1',     x:170,  y:280, type:'fight', label:'1-1  POPUP MOOR',         sub:'POPUP.IMP x3',
          encounter:{ bg:'POPUP MOOR',   enemies:['POPUP.IMP','POPUP.IMP','POPUP.IMP'],                  tier:1 } },
      { id:'n2',     x:270,  y:240, type:'fight', label:'1-2  COOKIE WOODS',       sub:'TRACKER.SLIME x4',
          encounter:{ bg:'COOKIE WOODS', enemies:['TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME'], tier:2 } },
      { id:'shop',   x:340,  y:140, type:'shop',  label:'REGISTRY MARKET',         sub:'BUY/SELL DRIVERS' },
      { id:'n3',     x:380,  y:300, type:'fight', label:'1-3  TEMP CAVES',         sub:'CACHE.GHOUL x2 + POPUP.IMP',
          encounter:{ bg:'TEMP CAVES',   enemies:['CACHE.GHOUL','CACHE.GHOUL','POPUP.IMP'],              tier:2 } },
      { id:'mid',    x:490,  y:240, type:'mini',  label:'MINIBOSS  KEYLOG.RAT',    sub:'WATCHES YOUR INPUT',
          encounter:{ bg:'TEMP CAVES',   enemies:['KEYLOG.RAT','POPUP.IMP','POPUP.IMP'],                 tier:3 } },
      { id:'n4',     x:600,  y:160, type:'fight', label:'1-4  PROXY PASS',         sub:'PHISH.WYRM x1 + slimes',
          encounter:{ bg:'PROXY PASS',   enemies:['PHISH.WYRM','TRACKER.SLIME','TRACKER.SLIME'],         tier:3 } },
      { id:'n5',     x:620,  y:330, type:'fight', label:'1-5  SECTOR FALLS',       sub:'RANSOM.LARVA x3',
          encounter:{ bg:'SECTOR FALLS', enemies:['RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA'],         tier:4 } },
      { id:'save2',  x:730,  y:240, type:'save',  label:'/SAVE',                   sub:'SAFE SECTOR',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'TROJAN.WORM AWAITS BEYOND.\nIT HAS CORRUPTED EVERY SECTOR IT TOUCHED.\nSTEEL YOUR PROCESSES.' },
            { speakerName:'CURSOR', speakerImage:null, text:'WE HAVE COME FAR, DEFENDER.\nONE TARGET REMAINS.\nPOINT ME AT IT.' },
          ],
          reward:[{ itemId:'patch', qty:2 }, { itemId:'buffer', qty:1 }] },
      { id:'boss',   x:880,  y:240, type:'boss',  label:'BOSS  TROJAN.WORM',       sub:'CORRUPTS ALL SECTORS',
          encounter:{ bg:'CORE CHAMBER', enemies:['TROJAN.WORM'],                                        tier:4, boss:true } },
    ],
    edges: [
      ['start','n1'], ['n1','n2'], ['n2','shop'], ['n2','n3'],
      ['n3','mid'],  ['shop','mid'], ['mid','n4'], ['mid','n5'],
      ['n4','save2'],['n5','save2'], ['save2','boss'],
    ],
  },
  {
    id: 'w2',
    name: 'SECTOR 2 / KERNEL',
    sub:  'ring-0 · kernel space — they fight back',
    nodes: [
      { id:'start',  x:70,   y:240, type:'save',  label:'/MNT/KERNEL',             sub:'CHECKPOINT — ring 0 entry',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'RING 0. KERNEL SPACE.\nONLY THE MOST HARDENED PROCESSES SURVIVE HERE.\nPROCEED WITH CAUTION.' },
          ],
          reward:[{ itemId:'buffer', qty:1 }] },
      { id:'n1',     x:180,  y:260, type:'fight', label:'2-1  /VAR/LOG',           sub:'PHISH.WYRM x1 + slimes',
          encounter:{ bg:'PROXY PASS',   enemies:['PHISH.WYRM','TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME'], tier:3 } },
      { id:'n2',     x:290,  y:160, type:'fight', label:'2-2  PROC TABLE',         sub:'CACHE.GHOUL x4',
          encounter:{ bg:'TEMP CAVES',   enemies:['CACHE.GHOUL','CACHE.GHOUL','CACHE.GHOUL','CACHE.GHOUL'], tier:3 } },
      { id:'shop',   x:380,  y:330, type:'shop',  label:'REGISTRY MARKET',         sub:'KERNEL DRIVERS' },
      { id:'n3',     x:430,  y:180, type:'fight', label:'2-3  IRQ FIELDS',         sub:'KEYLOG.RAT x2 + popups',
          encounter:{ bg:'COOKIE WOODS', enemies:['KEYLOG.RAT','KEYLOG.RAT','POPUP.IMP','POPUP.IMP'], tier:4 } },
      { id:'mid',    x:540,  y:240, type:'mini',  label:'MINIBOSS  PHISH.WYRM',    sub:'EVOLVED — sysadmin lure',
          encounter:{ bg:'PROXY PASS',   enemies:['PHISH.WYRM','PHISH.WYRM','TRACKER.SLIME'], tier:4 } },
      { id:'n4',     x:650,  y:140, type:'fight', label:'2-4  ENCRYPTED LAKE',     sub:'RANSOM.LARVA x4',
          encounter:{ bg:'SECTOR FALLS', enemies:['RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA'], tier:4 } },
      { id:'n5',     x:660,  y:330, type:'fight', label:'2-5  GHOST POOL',         sub:'CACHE.GHOUL x3 + ransom',
          encounter:{ bg:'TEMP CAVES',   enemies:['CACHE.GHOUL','CACHE.GHOUL','CACHE.GHOUL','RANSOM.LARVA'], tier:5 } },
      { id:'save2',  x:770,  y:240, type:'save',  label:'/SAVE',                   sub:'SAFE — pre-fault snapshot',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'TROJAN.WORM v2. KERNEL-MODE INFILTRATOR.\nIT HAS REWRITTEN ITS OWN SIGNATURES.\nDO NOT HESITATE.' },
            { speakerName:'GUARD',  speakerImage:null, text:'MY SHIELD HOLDS.\nBUT WE WILL NEED MORE THAN DEFENSE\nTO BRING THIS ONE DOWN.' },
          ],
          reward:[{ itemId:'patch', qty:2 }, { itemId:'restore', qty:1 }] },
      { id:'boss',   x:900,  y:240, type:'boss',  label:'BOSS  TROJAN.WORM v2',    sub:'KERNEL-MODE INFILTRATOR',
          encounter:{ bg:'CORE CHAMBER', enemies:['TROJAN.WORM'], tier:5, boss:true } },
    ],
    edges: [
      ['start','n1'], ['n1','n2'], ['n1','shop'], ['n2','n3'],
      ['shop','n3'],  ['n3','mid'], ['mid','n4'], ['mid','n5'],
      ['n4','save2'], ['n5','save2'], ['save2','boss'],
    ],
  },
  {
    id: 'w3',
    name: 'SECTOR 3 / CLOUD',
    sub:  'distributed · load-balanced infestation',
    nodes: [
      { id:'start',  x:70,   y:260, type:'save',  label:'/AVAIL-ZONE-A',           sub:'CHECKPOINT — region us-east',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'THE CLOUD SECTOR. DISTRIBUTED INFESTATION.\nNO SINGLE PROCESS HOLDS THE ANSWER.\nEVERY NODE MUST BE CLEANSED.' },
          ],
          reward:[{ itemId:'defrag', qty:1 }] },
      { id:'n1',     x:180,  y:160, type:'fight', label:'3-1  EDGE NODE',          sub:'KEYLOG.RAT x3',
          encounter:{ bg:'PROXY PASS',   enemies:['KEYLOG.RAT','KEYLOG.RAT','KEYLOG.RAT'], tier:5 } },
      { id:'n2',     x:200,  y:340, type:'fight', label:'3-2  BLOB STORE',         sub:'TRACKER.SLIME x5',
          encounter:{ bg:'COOKIE WOODS', enemies:['TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME','TRACKER.SLIME'], tier:5 } },
      { id:'shop',   x:330,  y:240, type:'shop',  label:'REGISTRY MARKET',         sub:'PREMIUM DRIVERS' },
      { id:'n3',     x:440,  y:140, type:'fight', label:'3-3  LOAD BALANCER',      sub:'PHISH.WYRM x2 + ghouls',
          encounter:{ bg:'PROXY PASS',   enemies:['PHISH.WYRM','PHISH.WYRM','CACHE.GHOUL','CACHE.GHOUL'], tier:5 } },
      { id:'mid',    x:520,  y:300, type:'mini',  label:'MINIBOSS  RANSOM.HIVE',   sub:'COLONY of RANSOM.LARVA',
          encounter:{ bg:'SECTOR FALLS', enemies:['RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA','RANSOM.LARVA'], tier:6 } },
      { id:'n4',     x:640,  y:160, type:'fight', label:'3-4  SHARD GRAVEYARD',    sub:'CACHE.GHOUL x4 + phish',
          encounter:{ bg:'TEMP CAVES',   enemies:['CACHE.GHOUL','CACHE.GHOUL','CACHE.GHOUL','CACHE.GHOUL','PHISH.WYRM'], tier:6 } },
      { id:'n5',     x:660,  y:340, type:'fight', label:'3-5  ENCRYPT STORM',      sub:'RANSOM x2 + KEYLOG x2',
          encounter:{ bg:'SECTOR FALLS', enemies:['RANSOM.LARVA','RANSOM.LARVA','KEYLOG.RAT','KEYLOG.RAT'], tier:7 } },
      { id:'save2',  x:780,  y:240, type:'save',  label:'/SAVE',                   sub:'LAST CHECKPOINT',
          dialogue:[
            { speakerName:'ORACLE', speakerImage:null, text:'TROJAN.MULTI. THE SHARDED ROOT WORM.\nITS FRAGMENTS SPAN EVERY AVAILABILITY ZONE.\nYOU MUST SEVER THEM ALL AT ONCE.' },
            { speakerName:'PURGE',  speakerImage:null, text:'I KNOW THE QUARANTINE SEQUENCE.\nWHEN YOU GIVE THE SIGNAL —\nWE UNMAKE IT.' },
          ],
          reward:[{ itemId:'patch', qty:3 }, { itemId:'restore', qty:1 }] },
      { id:'boss',   x:910,  y:240, type:'boss',  label:'BOSS  TROJAN.MULTI',      sub:'SHARDED ROOT WORM',
          encounter:{ bg:'CORE CHAMBER', enemies:['TROJAN.WORM'], tier:6, boss:true } },
    ],
    edges: [
      ['start','n1'], ['start','n2'], ['n1','shop'], ['n2','shop'],
      ['shop','n3'],  ['shop','mid'], ['n3','mid'],   ['mid','n4'],
      ['mid','n5'],   ['n4','save2'], ['n5','save2'], ['save2','boss'],
    ],
  },
];

// Quick lookup map from world ID string to world data object.
const WORLD_BY_ID = Object.fromEntries(WORLDS.map(w => [w.id, w]));

// Converts a world's node list and edge list into two data structures used for navigation:
//   byId — map from node ID → node object for O(1) lookups by ID.
//   adj  — adjacency list map from node ID → array of connected node IDs (bidirectional).
function buildAdj(nodes, edges){
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const adj = {};
  nodes.forEach(n => adj[n.id] = []);
  // Each edge [u, v] is undirected: push v into u's list and u into v's list.
  edges.forEach(([u,v])=>{ adj[u].push(v); adj[v].push(u); });
  return { byId, adj };
}

// Choose neighbor in a directional preference
// Selects the best neighbour node to move to when the player presses an arrow key.
// Scores each neighbour by the dot product of its direction vector with (dx, dy),
// so the node most aligned with the intended direction wins.
// Returns null (and plays a bump sound in the caller) if no neighbour scores > 0.2.
function pickDirectional(curId, dx, dy, byId, adj){
  const cur = byId[curId];
  const cands = (adj[curId] || []).map(id => byId[id]);
  if(cands.length === 0) return null;
  let best = null, bestScore = -Infinity;
  cands.forEach(c=>{
    const ddx = c.x - cur.x, ddy = c.y - cur.y;
    // Normalise the direction vector to unit length before computing the dot product.
    const len = Math.hypot(ddx, ddy) || 1;
    const score = (ddx/len)*dx + (ddy/len)*dy;
    if(score > bestScore){ bestScore = score; best = c; }
  });
  // Require at least a mild alignment (> 0.2) so orthogonal neighbours aren't selected.
  return bestScore > 0.2 ? best.id : null;
}

// Node icon — small pixel symbol per type
// Renders an SVG icon group for a map node. The outer square fills with a colour based on
// the node's state (cleared, current, reachable, or dim). An animated halo ring is added
// for the current node (spinning dashes) and for reachable nodes (pulsing ring).
// The inner pixel art differs per node type: sword for fight, triangle for miniboss,
// skull for boss, $ for shop, and a floppy-disk shape for save points.
function NodeIcon({ type, cleared, current, reachable }){
  const fill = cleared ? 'var(--fg-bright)'
             : current ? 'var(--cream)'
             : reachable ? 'var(--hl)'
             : 'var(--fg-dim)';
  const dark = 'var(--bg-0)';
  // Outer square shared by all node types.
  const common = (
    <rect x={-13} y={-13} width={26} height={26}
      fill={fill} stroke={dark} strokeWidth="2"/>
  );
  let inner = null;
  if(type === 'fight'){
    inner = (<g>
      <rect x={-6} y={-6} width={12} height={12} fill={dark}/>
      <rect x={-3} y={-9} width={6} height={3} fill={dark}/>
    </g>);
  } else if(type === 'mini'){
    inner = (<g>
      <polygon points="-8,5 0,-9 8,5" fill={dark}/>
      <rect x={-2} y={-1} width={4} height={4} fill={fill}/>
    </g>);
  } else if(type === 'boss'){
    inner = (<g>
      <rect x={-9} y={-9} width={18} height={18} fill={dark}/>
      <rect x={-5} y={-5} width={3} height={3} fill={fill}/>
      <rect x={2}  y={-5} width={3} height={3} fill={fill}/>
      <rect x={-5} y={2}  width={10} height={2} fill={fill}/>
    </g>);
  } else if(type === 'shop'){
    inner = (<g>
      <text x={0} y={5} fontFamily="'Press Start 2P', monospace"
        fontSize="14" textAnchor="middle" fill={dark}>$</text>
    </g>);
  } else if(type === 'save'){
    inner = (<g>
      <rect x={-7} y={-7} width={14} height={14} fill={dark}/>
      <rect x={-4} y={-7} width={8} height={4} fill={fill}/>
      <rect x={-3} y={1}  width={6} height={5} fill={fill}/>
    </g>);
  }
  return (<g>
    {/* Spinning dashed halo marks the node the player is currently standing on. */}
    {current && <circle cx={0} cy={0} r={20}
      fill="none" stroke="var(--cream)" strokeWidth="2"
      strokeDasharray="3 3"
      style={{animation:'spinhalo 6s linear infinite'}}/>}
    {/* Pulsing halo marks nodes adjacent to the player that can be traveled to. */}
    {reachable && !current && <circle cx={0} cy={0} r={18}
      fill="none" stroke="var(--hl)" strokeWidth="1.5"
      style={{animation:'pulsehalo 1.4s ease-out infinite'}}/>}
    {common}
    {inner}
  </g>);
}

// Decode a flat string list ["w1:n1","w2:mid",...] into a per-world Set.
// Handles legacy entries (no colon prefix) by assigning them to world 'w1'.
// Returns a Set of bare node IDs that belong to the given worldId.
function clearsForWorld(externalClears, worldId){
  const s = new Set();
  if(!externalClears) return s;
  const prefix = worldId + ':';
  externalClears.forEach(c => {
    if(typeof c !== 'string') return;
    if(c.indexOf(':') === -1){
      // Legacy: treat as world 1
      if(worldId === 'w1') s.add(c);
    } else if(c.startsWith(prefix)){
      // Strip the "w1:" prefix to get the bare node ID.
      s.add(c.slice(prefix.length));
    }
  });
  return s;
}

// ── TUTORIAL OVERLAY ────────────────────────────────────────────────────

// Multi-page tutorial overlay shown the first time the player enters the first combat node.
// Accepts arrow keys, Enter/Space (advance), and Escape (skip) for navigation.
// Calls onDone when the player finishes or skips; the caller then stores the flag in
// localStorage ('daw.tutorial.done') so the tutorial never shows again.
function TutorialOverlay({ onDone, blip }) {
  // Static tutorial page data — each page has a title, icon, and body text block.
  const PAGES = [
    {
      title: '// SYSTEM BOOT',
      icon: '⚑',
      body: 'WELCOME, DEFENDER.\n\nMalicious processes have infiltrated SECTOR 1: DESKTOP.\nYour mission: eliminate them before they corrupt the workstation.\n\nThis briefing covers combat protocols.',
    },
    {
      title: '// BITS  [$]',
      icon: '$',
      body: 'BITS are the digital currency of sectorware.net.\n\n• Earned by winning battles\n• Spent at REGISTRY MARKET\n• Buy new heroes and restore items\n• Your wallet is shown in the HUD above the map',
    },
    {
      title: '// HEROES',
      icon: '▣',
      body: 'Your PARTY holds 3 heroes at a time. Each has:\n\n  INTEGRITY — hit points (0 = defeated)\n  CPU — energy for executing scripts\n  SCRIPTS — unique executable abilities\n\nManage your roster in PROFILE → PARTY / HEROES.',
    },
    {
      title: '// ATB BATTLE SYSTEM',
      icon: '►',
      body: 'Battles use an ACTIVE TIME BATTLE system.\n\n• Each fighter has an ATB gauge that fills in real time\n• When a hero\'s ATB is full, choose an action\n• ATTACK (free) or run a SCRIPT (costs CPU)\n• Enemies act automatically when their ATB fills',
    },
    {
      title: '// SCRIPTS',
      icon: '>',
      body: 'Scripts are executable abilities unique to each hero.\n\n• Range from basic strikes to powerful commands\n• Cost CPU to run — higher power = higher cost\n• CPU regenerates slowly each combat round\n• Some scripts heal, some buff, some deal heavy damage',
    },
    {
      title: '// WIN & LOSE CONDITIONS',
      icon: '★',
      body: 'VICTORY:\nEliminate all hostile processes.\nEarn BITS and mark the node cleared.\n\nDEFEAT:\nIf your entire party reaches 0 INTEGRITY,\nthe battle is lost and you return to the map.',
    },
    {
      title: '// FIRST CONTACT',
      icon: '⚔',
      body: 'TARGET: POPUP.IMP × 3\n\nLow-tier adware processes — weak but fast.\nUse basic attacks to build CPU,\nthen unleash scripts for maximum damage.\n\nGood luck, DEFENDER. MIPMIP Company is counting on you.',
    },
  ];

  const [page, setPage] = useStateM(0);
  const isLast = page === PAGES.length - 1;
  const cur = PAGES[page];

  // Register a keydown listener (capture phase, highest priority) for page navigation.
  // Reattached whenever page or isLast changes so the closure captures the latest values.
  useEffectM(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
        // Last page: close the tutorial; any other page: advance forward.
        if (isLast) { blip && blip(960); onDone(); }
        else { setPage(p => p + 1); blip && blip(540); }
        e.preventDefault(); e.stopPropagation();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (page > 0) { setPage(p => p - 1); blip && blip(540); }
        e.preventDefault(); e.stopPropagation();
      } else if (e.key === 'Escape') {
        // Escape skips the entire tutorial immediately.
        blip && blip(960); onDone();
        e.preventDefault(); e.stopPropagation();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [page, isLast, blip, onDone]);

  return (
    <div className="overlay" style={{zIndex:90}}
      // Clicking the backdrop (not the dialog) also closes the tutorial.
      onClick={(e) => { if (e.target === e.currentTarget) { blip && blip(960); onDone(); } }}>
      <div className="dialog" style={{maxWidth:580, textAlign:'left'}}>
        {/* Page counter header */}
        <div style={{
          fontFamily:"'Press Start 2P',monospace", fontSize:9,
          color:'var(--hl)', letterSpacing:'.22em', marginBottom:10, textAlign:'center',
        }}>
          ▣ COMBAT BRIEFING — {page + 1} / {PAGES.length}
        </div>
        {/* Page title with icon */}
        <div style={{
          fontFamily:"'VT323',monospace", fontSize:24,
          color:'var(--fg-bright)', letterSpacing:'.1em',
          marginBottom:12, textAlign:'center',
          textShadow:'0 0 8px rgba(212,244,163,.4)',
        }}>
          {cur.icon} {cur.title}
        </div>
        {/* Page body rendered as pre-formatted text to preserve newlines. */}
        <pre style={{
          margin:0, fontFamily:"'VT323',monospace", fontSize:19,
          color:'var(--cream)', letterSpacing:'.03em', lineHeight:1.5,
          whiteSpace:'pre-wrap', wordBreak:'break-word',
          background:'rgba(0,0,0,.4)', padding:'14px 16px',
          border:'1px dashed var(--bg-2)',
          minHeight:140,
        }}>{cur.body}</pre>

        {/* Dot/pip progress indicators — current page is wider and brighter. */}
        <div style={{display:'flex', justifyContent:'center', gap:6, margin:'14px 0 10px'}}>
          {PAGES.map((_, i) => (
            <div key={i} style={{
              width: i === page ? 12 : 8, height: 8,
              background: i === page ? 'var(--fg-bright)'
                        : i < page  ? 'rgba(212,244,163,.4)'
                        : 'var(--bg-2)',
              transition:'all .15s',
            }} />
          ))}
        </div>

        {/* Navigation buttons — BACK is invisible on the first page via opacity. */}
        <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
          <button style={{opacity: page > 0 ? 1 : 0, pointerEvents: page > 0 ? 'auto' : 'none'}}
            onClick={() => { setPage(p => p - 1); blip && blip(540); }}>
            ← BACK
          </button>
          {/* Primary action button: "NEXT →" on intermediate pages, "ENGAGE ⚔" on the last. */}
          <button className="sel" autoFocus
            onClick={() => { if (isLast) { blip && blip(960); onDone(); } else { setPage(p => p + 1); blip && blip(540); } }}>
            {isLast ? 'ENGAGE ⚔' : 'NEXT →'}
          </button>
        </div>
        {/* Keyboard hint changes on the last page to reflect the different action. */}
        <div style={{
          marginTop:10, fontFamily:"'VT323',monospace", fontSize:14,
          color:'var(--fg-dim)', letterSpacing:'.04em', textAlign:'center',
        }}>
          {isLast ? 'press ⏎ to engage · ESC to skip' : 'press → or ⏎ to advance · ESC to skip'}
        </div>
      </div>
    </div>
  );
}

// Main world-map component. Manages all navigation state for one world at a time.
// Props:
//   blip            — callback(freq) to play a UI sound effect.
//   playerName      — display name shown in the HUD.
//   onExit          — called when the player presses ESC to return to the main menu.
//   onEngage        — called with encounter data when the player starts a battle.
//   onShop          — called with node data when the player enters a shop.
//   externalClears  — flat array of "worldId:nodeId" strings from the save system.
//   active          — whether this map is the active/focused page (enables keyboard input).
//   wallet          — player's current BITS balance shown in the HUD.
//   worldId         — which world is currently displayed (default 'w1').
//   worldsUnlocked  — array of world IDs the player has access to.
//   onSwitchWorld   — called with a new worldId when the player changes sectors.
function WorldMap({ blip, playerName, onExit, onEngage, onShop, onClearNode,
                    externalClears, active=true, wallet=0,
                    worldId='w1', worldsUnlocked=['w1'], onSwitchWorld }){
  const world = WORLD_BY_ID[worldId] || WORLDS[0];
  // Build adjacency data once per world; recalculates only when the world changes.
  const { byId, adj } = useMemoM(()=> buildAdj(world.nodes, world.edges), [world]);

  const startNode = world.nodes[0]?.id ?? 'start';
  const [cur, setCur] = useStateM(startNode);                  // ID of the node the player is on
  // Initialise cleared set from the start node plus any externally persisted clears.
  const [cleared, setCleared] = useStateM(()=> new Set([startNode, ...clearsForWorld(externalClears, world.id)]));
  const [moving, setMoving] = useStateM(null);                 // animation state {from, to, t} or null
  const [overlay, setOverlay] = useStateM(null);               // currently shown dialog overlay or null
  const [overlaySel, setOverlaySel] = useStateM(0);            // selected button index in the overlay
  const [tutorial, setTutorial] = useStateM(false);            // whether the tutorial overlay is visible
  const tutorialLaunchRef = useRefM(null);                     // stores the deferred battle launch fn while tutorial plays
  const movingRef = useRefM(null);                             // mirror of moving state accessible inside rAF callbacks
  const [zoom, setZoom] = useStateM(1);                        // map zoom level (1–2.5)
  const [checkpointNode, setCheckpointNode] = useStateM(null); // { node, replay } while checkpoint dialogue is open
  const zoomRef = useRefM(1);                                  // ref mirror so touch handlers read current zoom without stale closure
  const touchRef = useRefM({});                                // stores pinch-start state {dist, base}
  const svgOuterRef = useRefM(null);                           // ref to the scrollable SVG wrapper element

  // Total cleared nodes across all worlds (excluding start nodes), used for the HUD "SECTORS" counter.
  const totalClears = useMemoM(() => {
    if (!externalClears) return 0;
    return externalClears.filter(c => typeof c === 'string' && !c.endsWith(':start')).length;
  }, [externalClears]);

  // Reset internal state when worldId changes
  // Resets cursor position, cleared set, and any open overlays whenever the player switches worlds.
  useEffectM(()=>{
    const first = world.nodes[0]?.id ?? 'start';
    setCur(first);
    setCleared(new Set([first, ...clearsForWorld(externalClears, world.id)]));
    setMoving(null);
    setOverlay(null);
  }, [worldId]);

  // Merge in external clears for THIS world
  // Syncs externally persisted cleared nodes into local state without discarding
  // anything already in the local set; always ensures 'start' remains cleared.
  useEffectM(()=>{
    if(!externalClears) return;
    const wantSet = clearsForWorld(externalClears, world.id);
    setCleared(prev => {
      const ns = new Set(prev);
      let changed = false;
      wantSet.forEach(id => { if(!ns.has(id)){ ns.add(id); changed = true; } });
      // Always keep 'start' present
      if(!ns.has('start')){ ns.add('start'); changed = true; }
      // Return the previous reference unchanged if nothing was added (avoids re-renders).
      return changed ? ns : prev;
    });
  }, [externalClears, world.id]);

  // Derive the set of nodes the player can travel to from any cleared node, excluding
  // the current position (so the current node doesn't get the reachable highlight).
  const reachable = useMemoM(()=>{
    const r = new Set();
    cleared.forEach(c => (adj[c] || []).forEach(n => r.add(n)));
    r.delete(cur);
    return r;
  }, [cleared, cur, adj]);

  // Animates the player token from the current node to targetId over 600 ms using rAF.
  // Guards against double-moves, non-adjacent targets, and locked (unreachable) targets.
  // Shops are auto-cleared on landing because they have no combat gate.
  const moveTo = useCallbackM((targetId)=>{
    if(moving) return;                                          // ignore while already moving
    if(checkpointNode) return;                                  // checkpoint dialogue owns input
    if(targetId === cur) return;                               // already there
    if(!(adj[cur] || []).includes(targetId)) return;           // not a neighbour
    if(!cleared.has(targetId) && !reachable.has(targetId)) return; // path locked
    blip(720);
    const m = { from: cur, to: targetId, t: 0 };
    movingRef.current = m;
    setMoving(m);
    const start = performance.now();
    const dur = 600;
    // rAF loop: linearly interpolates t from 0 → 1 over 600 ms.
    function step(now){
      const t = Math.min(1, (now-start)/dur);
      const updated = { ...m, t };
      movingRef.current = updated;
      setMoving(updated);
      if(t < 1) requestAnimationFrame(step);
      else {
        setMoving(null);
        movingRef.current = null;
        setCur(targetId);
        blip(900);
        // Shops have no combat — landing on one auto-clears it so the path ahead opens.
        if(byId[targetId]?.type === 'shop'){
          setCleared(s => { const ns = new Set(s); ns.add(targetId); return ns; });
        }
      }
    }
    requestAnimationFrame(step);
  }, [cur, cleared, reachable, moving, blip, adj, byId]);

  // Handles pressing Enter / clicking on the current node to trigger its action:
  //   fight/mini/boss → engage overlay (or replay if already cleared), with tutorial gate for 1-1.
  //   shop            → shop overlay.
  //   save            → marks the node cleared and shows a save confirmation overlay.
  const enterNode = useCallbackM((id)=>{
    const n = byId[id];
    if(!n) return;
    if(n.type === 'fight' || n.type === 'mini' || n.type === 'boss'){
      const launchBattle = ()=>{
        setOverlay(null);
        blip(960);
        if(onEngage){
          onEngage({ nodeId: id, node: n, encounter: n.encounter, worldId: world.id });
        } else {
          // Fallback when no external battle handler is wired: mark the node cleared locally.
          setCleared(s => { const ns = new Set(s); ns.add(id); return ns; });
        }
      };
      // Show tutorial the first time the player enters 1-1
      // Defer the battle launch via a ref so it fires after the tutorial closes.
      if (world.id === 'w1' && id === 'n1' && !cleared.has(id) && !localStorage.getItem('daw.tutorial.done')) {
        tutorialLaunchRef.current = launchBattle;
        setTutorial(true);
        setOverlaySel(0);
        return;
      }

      if(cleared.has(id)){
        // Node already beaten — offer replay or leave.
        setOverlay({ kind:'cleared', node:n,
          choices:['REPLAY','LEAVE'],
          actions:[
            launchBattle,
            ()=>{ setOverlay(null); blip(360); },
          ] });
      } else {
        // Fresh encounter — offer engage or retreat.
        setOverlay({ kind:'engage', node:n,
          choices:[ n.type==='boss' ? 'CONFRONT' : 'ENGAGE', 'RETREAT'],
          actions:[
            launchBattle,
            ()=>{ setOverlay(null); blip(360); },
          ] });
      }
    } else if(n.type === 'shop'){
      setOverlay({ kind:'shop', node:n,
        choices:['BROWSE','LEAVE'],
        actions:[
          ()=>{
            setOverlay(null);
            blip(960);
            if(onShop) onShop({ nodeId: id, node: n });
          },
          ()=>{ setOverlay(null); blip(360); },
        ] });
    } else if(n.type === 'save'){
      const isCleared = cleared.has(id);
      const hasDialogue = (n.dialogue || []).length > 0 || (n.reward || []).length > 0;
      if(!isCleared && hasDialogue){
        // First visit with dialogue: open mandatory checkpoint dialogue.
        setCheckpointNode({ node: n, replay: false });
      } else if(!isCleared){
        // No dialogue — clear silently and keep path moving.
        setCleared(s => { const ns = new Set(s); ns.add(id); return ns; });
        if(onClearNode) onClearNode(id, world.id, []);
      } else {
        // Already cleared — replay dialogue (optional, ESC-able).
        setCheckpointNode({ node: n, replay: true });
      }
      return; // skip setOverlaySel below
    }
    setOverlaySel(0);
  }, [cleared, blip, onEngage, onShop, onClearNode, byId, world.id]);

  // Keyboard
  // Unified keydown handler that routes inputs based on whether an overlay is open or not.
  // When an overlay is open: arrow keys cycle choices, Enter confirms, Escape dismisses.
  // When the map is focused: arrow keys call pickDirectional/moveTo, Enter calls enterNode,
  // Tab cycles between unlocked worlds, Escape exits to the main menu.
  useEffectM(()=>{
    if(!active) return;
    function onKey(e){
      if(checkpointNode) return; // CheckpointDialog owns all keyboard input
      if(overlay){
        const n = overlay.choices.length;
        if(e.key==='ArrowDown'||e.key==='ArrowRight'){ setOverlaySel(s=>(s+1)%n); blip(540); e.preventDefault(); }
        else if(e.key==='ArrowUp'||e.key==='ArrowLeft'){ setOverlaySel(s=>(s-1+n)%n); blip(540); e.preventDefault(); }
        else if(e.key==='Enter'||e.key===' '){
          overlay.actions[overlaySel](); e.preventDefault();
        } else if(e.key==='Escape'){ blip(360); setOverlay(null); e.preventDefault(); }
        return;
      }
      if(moving) return; // ignore navigation while the player token is animating
      if(e.key==='Escape'){ blip(360); onExit&&onExit(); return; }
      if(e.key==='Enter'||e.key===' '){ enterNode(cur); e.preventDefault(); return; }
      // Tab to cycle worlds (only unlocked ones)
      // Shift+Tab cycles backwards through the unlocked world list.
      if(e.key === 'Tab' && worldsUnlocked.length > 1){
        e.preventDefault();
        const i = worldsUnlocked.indexOf(world.id);
        const nextId = worldsUnlocked[(i + (e.shiftKey ? -1 : 1) + worldsUnlocked.length) % worldsUnlocked.length];
        if(nextId !== world.id && onSwitchWorld){ blip(720); onSwitchWorld(nextId); }
        return;
      }
      let dx=0, dy=0;
      if(e.key==='ArrowLeft') dx=-1;
      else if(e.key==='ArrowRight') dx=1;
      else if(e.key==='ArrowUp') dy=-1;
      else if(e.key==='ArrowDown') dy=1;
      else return;
      const target = pickDirectional(cur, dx, dy, byId, adj);
      // Play a lower-pitch blip if the arrow key had no valid target in that direction.
      if(target) moveTo(target);
      else blip(220);
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [cur, moving, overlay, overlaySel, checkpointNode, enterNode, moveTo, blip, onExit, active, byId, adj, world.id, worldsUnlocked, onSwitchWorld]);

  // Keep zoomRef in sync so pinch handler always reads the latest zoom value.
  useEffectM(()=>{ zoomRef.current = zoom; }, [zoom]);

  // Pinch-to-zoom: registered imperatively so touchmove can call preventDefault
  // (React registers touch handlers as passive by default, which blocks preventDefault).
  useEffectM(()=>{
    const el = svgOuterRef.current;
    if(!el) return;
    const onStart = (e)=>{
      if(e.touches.length === 2){
        touchRef.current = {
          dist: Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY),
          base: zoomRef.current,
        };
      }
    };
    const onMove = (e)=>{
      if(e.touches.length < 2 || !touchRef.current.dist) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      setZoom(Math.min(2.5, Math.max(1, touchRef.current.base * (d / touchRef.current.dist))));
    };
    const onEnd = ()=>{ touchRef.current = {}; };
    el.addEventListener('touchstart', onStart);
    el.addEventListener('touchmove', onMove, {passive:false});
    el.addEventListener('touchend', onEnd);
    return ()=>{
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Player position
  if(!byId[cur]) return null; // guard: world has no nodes yet (empty custom map)
  // During animation, linearly interpolate the player token's x/y between the two nodes.
  let px = byId[cur].x, py = byId[cur].y;
  if(moving){
    const a = byId[moving.from], b = byId[moving.to];
    if(a && b){
      px = a.x + (b.x-a.x) * moving.t;
      py = a.y + (b.y-a.y) * moving.t;
    }
  }

  const curNode = byId[cur];

  return (
    <div className="map-shell">
      {/* Top bar: back button, breadcrumb path, and player HUD stats. */}
      <div className="map-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onExit && onExit(); }}
          title="back to menu (ESC)">← MENU</button>
        {/* Breadcrumb shows "/<world-name>/<node-label>" as a fake filesystem path. */}
        <span className="map-bc">/{world.name.replace(/\s+/g,'-')}/{curNode.label.replace(/\s+/g,'-')}</span>
        <div className="map-hud">
          <span><b>USR</b> {playerName}</span>
          <span><b>BITS</b> {wallet}</span>
          <span><b>SECTORS</b> {totalClears}</span>
        </div>
      </div>

      {/* World switcher */}
      {/* Renders one button per world; locked worlds show '???' and a lock icon. */}
      <div className="map-worlds">
        {WORLDS.map((w, i)=>{
          const locked   = !worldsUnlocked.includes(w.id);
          const isActive = w.id === world.id;
          return (
            <button key={w.id}
              className={'map-world-btn '+(isActive?'active ':'')+(locked?'locked':'')}
              disabled={locked}
              onClick={()=>{ if(!locked && !isActive && onSwitchWorld){ blip&&blip(720); onSwitchWorld(w.id);} }}
              title={locked ? 'Locked — clear previous boss to unlock' : w.sub}>
              <span className="num">{i+1}</span>
              <span className="nm">{locked ? '???' : w.name}</span>
              {locked && <span className="lk">🔒</span>}
              {isActive && <span className="dot">▣</span>}
            </button>
          );
        })}
        <span className="map-worlds-hint">↹ TAB cycles worlds</span>
      </div>

      <div className="map-stage">
        <div className="map-svg-wrap">
        <div className="map-svg-outer" ref={svgOuterRef}>
        <div className="map-svg-inner" style={{width:(zoom*100)+'%'}}>
        <svg className="map-svg" viewBox="0 0 1000 420"
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="crispEdges">
          <defs>
            {/* PCB-grid background pattern: dark base with faint horizontal/vertical lines and dots. */}
            <pattern id="pcb" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <rect width="40" height="40" fill="var(--bg-0)"/>
              <rect width="40" height="1" y="0" fill="var(--bg-2)" opacity=".55"/>
              <rect width="1" height="40" x="0" fill="var(--bg-2)" opacity=".55"/>
              <circle cx="20" cy="20" r="1" fill="var(--fg-dim)" opacity=".4"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="1000" height="420" fill="url(#pcb)"/>
          {/* Two nested ellipses give a subtle vignette "screen" feel behind the node graph. */}
          <ellipse cx="500" cy="240" rx="480" ry="170"
            fill="var(--bg-1)" opacity=".7"/>
          <ellipse cx="500" cy="240" rx="440" ry="140"
            fill="var(--bg-2)" opacity=".5"/>

          {/* Edges */}
          {/* Dashed lines connecting nodes; brighter and more opaque once either endpoint is cleared. */}
          {world.edges.map(([u,v],i)=>{
            const a = byId[u], b = byId[v];
            // An edge "opens" (lights up) as soon as either endpoint is cleared.
            const isOpen = cleared.has(u) || cleared.has(v);
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isOpen ? 'var(--cream)' : 'var(--fg-dim)'}
                strokeWidth="3" strokeDasharray="6 6"
                opacity={isOpen ? 0.9 : 0.45}/>
            );
          })}

          {/* Nodes */}
          {/* Each node is a clickable <g> that calls moveTo if the player is not already there,
              or enterNode if they are already standing on it. */}
          {world.nodes.map(n => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}
              style={{cursor:'pointer'}}
              onClick={()=>{
                if(n.id === cur) enterNode(n.id);
                // Only allow click-to-move when the node is adjacent and reachable.
                else if((adj[cur]||[]).includes(n.id) && (cleared.has(n.id) || reachable.has(n.id))) moveTo(n.id);
                else blip(220); // bump sound for an inaccessible node click
              }}
              onMouseEnter={()=>blip(540)}>
              <NodeIcon type={n.type}
                cleared={cleared.has(n.id) && n.id !== cur}
                current={n.id === cur}
                reachable={reachable.has(n.id)} />
              {/* Node label: only the portion before the first double-space is rendered to keep it short. */}
              <text x={0} y={28} fontFamily="'Press Start 2P', monospace"
                fontSize="6" textAnchor="middle" fill="var(--cream)"
                style={{paintOrder:'stroke'}} stroke="var(--bg-0)" strokeWidth="2">
                {n.label.split(/\s{2,}/)[0]}
              </text>
            </g>
          ))}

          {/* Player sprite */}
          {/* A simple pixel-art character token; position is interpolated during moveTo animation. */}
          <g transform={`translate(${px},${py-24})`}>
            <rect x={-1} y={-12} width={5} height={5} fill="var(--hl)"/>
            <rect x={0}  y={-7}  width={5} height={5} fill="var(--hl)"/>
            <rect x={1}  y={-2}  width={5} height={5} fill="var(--hl)"/>
            <rect x={2}  y={3}   width={4} height={4} fill="var(--hl)"/>
            <rect x={-3} y={6}   width={10} height={6} fill="var(--cream)"/>
            <rect x={-2} y={12}  width={3} height={5} fill="var(--cream)"/>
            <rect x={3}  y={12}  width={3} height={5} fill="var(--cream)"/>
          </g>
        </svg>
        </div>{/* /map-svg-inner */}
        </div>{/* /map-svg-outer */}
        <div className="map-zoom-controls">
          <button className="map-zoom-btn"
            onClick={()=>setZoom(z=>Math.min(2.5,Math.round((z+0.5)*10)/10))}
            title="zoom in">+</button>
          <button className="map-zoom-btn"
            onClick={()=>setZoom(z=>Math.max(1,Math.round((z-0.5)*10)/10))}
            title="zoom out">−</button>
        </div>
        </div>{/* /map-svg-wrap */}

        {/* Info panel */}
        {/* Sidebar showing details about the node the player is currently standing on. */}
        <div className="map-info">
          <div className="legend">▣ {curNode.label}</div>
          <div className="map-info-row">
            <span className="lbl">WORLD</span>
            <span>{world.name}</span>
          </div>
          <div className="map-info-row">
            <span className="lbl">TYPE</span>
            {/* Human-readable type label mapped from the node's internal type string. */}
            <span>{ {fight:'COMBAT', mini:'MINIBOSS', boss:'BOSS', shop:'MARKET', save:'SAVE'}[curNode.type] }</span>
          </div>
          <div className="map-info-row">
            <span className="lbl">INFO</span>
            <span>{curNode.sub}</span>
          </div>
          <div className="map-info-row">
            <span className="lbl">STATE</span>
            {/* Shop and save nodes are always shown as SAFE; combat nodes show CLEARED or HOSTILE. */}
            <span style={{color: cleared.has(cur) && curNode.type!=='save' ? 'var(--fg-bright)' : 'var(--hl)'}}>
              { (curNode.type==='shop'||curNode.type==='save') ? 'SAFE' :
                cleared.has(cur) ? 'CLEARED' : 'HOSTILE' }
            </span>
          </div>
          <div className="map-info-hint">
            <b>↑↓←→</b> TRAVEL &nbsp;<b>⏎</b> ENTER &nbsp;<b>↹</b> WORLD &nbsp;<b>ESC</b> EXIT
          </div>
        </div>
      </div>

      {/* Progress bar at the bottom of the map shell. */}
      {/* Width is (cleared nodes - 1) / (total nodes - 1) because 'start' is pre-cleared and excluded. */}
      <div className="map-foot">
        <div className="map-progress">
          <span>{world.name} PROGRESS</span>
          <div className="bar">
            <div className="fill" style={{width: ((cleared.size-1) / (world.nodes.length-1) * 100) + '%'}}></div>
          </div>
          <span>{cleared.size-1} / {world.nodes.length-1}</span>
        </div>
      </div>

      {/* Tutorial overlay — rendered on top of everything when visible. */}
      {/* On completion, saves the "done" flag to localStorage and fires the deferred battle launch. */}
      {tutorial && (
        <TutorialOverlay blip={blip} onDone={()=>{
          localStorage.setItem('daw.tutorial.done', '1');
          setTutorial(false);
          const fn = tutorialLaunchRef.current;
          tutorialLaunchRef.current = null;
          if (fn) fn();
        }} />
      )}

      {/* Checkpoint dialogue — rendered above the map, blocks all other input. */}
      {checkpointNode && (
        <CheckpointDialog
          node={checkpointNode.node}
          blip={blip}
          replay={checkpointNode.replay}
          onClear={(reward) => {
            const nodeId = checkpointNode.node.id;
            setCheckpointNode(null);
            if(!checkpointNode.replay){
              setCleared(s => { const ns = new Set(s); ns.add(nodeId); return ns; });
              if(onClearNode) onClearNode(nodeId, world.id, reward);
            }
          }}
          onCancel={() => setCheckpointNode(null)}
        />
      )}

      {/* Encounter / shop / save overlay dialog. */}
      {/* Clicking the semi-transparent backdrop (not the dialog card) dismisses the overlay. */}
      {overlay && (
        <div className="overlay" onClick={(e)=>{ if(e.target===e.currentTarget){ blip(360); setOverlay(null); } }}>
          <div className="dialog">
            <h3>▣ {overlay.kind === 'engage' ? 'ENCOUNTER'
                  : overlay.kind === 'cleared' ? 'CLEARED SECTOR'
                  : 'REGISTRY MARKET'}</h3>
            {/* Flavour text varies by overlay kind and node type (boss gets extra threat text). */}
            <p style={{whiteSpace:'pre-wrap'}}>
              {overlay.kind === 'engage' && (overlay.node.type === 'boss'
                ? `${overlay.node.label}\n\n⚠ ROOT-LEVEL THREAT DETECTED.\n${world.sub.toUpperCase()}.\n\nFOES: ${overlay.node.sub}\nTIER: ${overlay.node.encounter?.tier || 1}\n\nCONFRONT?`
                : `${overlay.node.label}\n\nFOES: ${overlay.node.sub}\nTIER: ${overlay.node.encounter?.tier || 1}\n\nWILL YOU ENGAGE?`)}
              {overlay.kind === 'cleared' &&
                `THIS SECTOR HAS BEEN PURGED.\nYOU MAY REPLAY FOR XP, OR MOVE ON.`}
              {overlay.kind === 'shop' &&
                `STORED PROCEDURES, REGISTRY KEYS,\nAND OFF-BRAND PATCHES FOR SALE.`}
              {overlay.kind === 'save' &&
                `WRITE PROGRESS TO /SAVE.DAT?\nA STABLE CHECKPOINT.`}
            </p>
            {/* Render one button per choice; hovering highlights it and plays a blip. */}
            <div className="row" style={{flexWrap:'wrap'}}>
              {overlay.choices.map((c,i)=>(
                <button key={i}
                  className={i===overlaySel?'sel':''}
                  onMouseEnter={()=>{ if(i!==overlaySel){ setOverlaySel(i); blip(540);} }}
                  onClick={()=>overlay.actions[i]()}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Expose WorldMap and the world data structures to the global window so the page
// shell script can mount the component without a module bundler.
Object.assign(window, { WorldMap, WORLDS, WORLD_BY_ID });
