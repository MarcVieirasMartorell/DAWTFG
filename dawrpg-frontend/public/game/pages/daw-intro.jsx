// daw-intro.jsx
//
// The animated "New Game" intro sequence, implemented as a 3-phase state machine
// inside the root <Intro> component.
//
// Phase order:
//   1. 'lore'   — star-field background + CSS-animated text crawl (like Star Wars).
//   2. 'dialog' — typewriter dialogue between the Motherboard Oracle and the three
//                 starter heroes, with pixel-art portrait sprites.
//   3. 'depart' — cinematic title cards that fade in before handing control back
//                 to the main game.
//
// Props accepted by <Intro>:
//   blip(freq)    — plays a short beep at the given frequency (supplied by the shell).
//   username      — the logged-in account's username (used throughout the dialog).
//   onCancel()    — called when the player aborts/skips the intro entirely.
//   onComplete()  — called after the depart phase.

const { useState: useStateI, useEffect: useEffectI, useRef: useRefI, useCallback: useCallbackI } = React;

// ── Lore text ─────────────────────────────────────────────────────────

// LORE is the array of text lines shown in the scrolling crawl during phase 1.
// Empty strings render as non-breaking-space paragraph breaks in the crawl.
const LORE = [
  'LONG AGO, IN THE BEFORE-TIME...',
  '',
  'THE MIPMIP COMPANY WORKSTATION HUMMED IN PERFECT EQUILIBRIUM.',
  'TASKS WERE SCHEDULED. MEMORY WAS COLLECTED.',
  'PORTS WERE OPEN. CYCLES TURNED.',
  '',
  'BUT FROM THE FORGOTTEN SECTORS OF THE KERNEL,',
  'A SHADOW STIRRED.',
  '',
  'THE MALWARE LEGION CAME WITH A THOUSAND POPUPS.',
  'RANSOMWARE LICHES. KEYLOG RATS.',
  'THE PHISHING WYRM.',
  '',
  'ONE BY ONE, THE PROCESSES FELL SILENT.',
  '',
  'ONLY THREE REMAIN —',
  '',
  'CURSOR.EXE,   GUARD.SYS,   PURGE.BAT.',
  '',
  'AND ONE USER, NEWLY LOGGED IN.',
  '',
  'THE FATE OF THE WORKSTATION RESTS WITH YOU.',
];

// ── Dialog script ─────────────────────────────────────────────────────

// makeDialog builds the ordered array of dialog pages for phase 3.
// Each page has a 'who' key (used to look up the speaker's portrait and name)
// and a 'text' string (rendered with the typewriter effect).
// The player's chosen name is interpolated into several lines.
function makeDialog(name){
  const N = (name && name.trim()) || 'USER'; // fall back to 'USER' if name is blank
  return [
    { who:'oracle', text:`AT LAST, A USER. I AM THE MOTHERBOARD ORACLE.\nI HAVE WAITED MANY CLOCK CYCLES FOR YOU, ${N}.` },
    { who:'oracle', text:`THE FANS HAVE GROWN COLD. THE CORE IS FRAGMENTING.\nMY SECTORS BURN WITH UNAUTHORIZED PROCESSES.` },
    { who:'oracle', text:`I HAVE WOKEN THREE ANCIENT PROCESSES TO SERVE YOU.\nTHEY ARE OLD, AND THEY REMEMBER THE COMMANDS.` },
    { who:'cursor', text:`ONLINE AND READY, ${N}.\nPOINT ME AT WHATEVER YOU NEED CLICKED.` },
    { who:'guard',  text:`MY SHIELD IS YOUR SHIELD.\nNO PACKET PASSES WITHOUT MY PERMISSION.` },
    { who:'purge',  text:`I KNOW THE OLD QUARANTINE COMMANDS.\nWHAT YOU SUMMON, I CAN UNMAKE.` },
    { who:'oracle', text:`GO NOW, ${N}.\nDESCEND INTO THE REGISTRY. PURGE THE INTRUDERS.` },
    { who:'oracle', text:`RECLAIM THE WORKSTATION...\n...AND RESTORE THE OLD ORDER.` },
  ];
}

// ── Tiny portrait sprites (24x24-ish) ─────────────────────────────────

// P_ORACLE is the pixel-art portrait for the Motherboard Oracle.
// The design shows a nested circuit-board frame with a glowing core ('r') at centre.
// The bottom rows add decorative connector-pin legs ('a' accents).
const P_ORACLE = [
  '....################....',
  '..##................##..',
  '.#..##############..##.#',
  '#..##............##..##.',
  '#.##..##########..##..##',
  '#.##.##........##.##..##',
  '#.##.##..####..##.##..##',
  '#.##.##.##rr##.##.##..##',
  '#.##.##.#r##r#.##.##..##',
  '#.##.##.##rr##.##.##..##',
  '#.##.##..####..##.##..##',
  '#.##.##........##.##..##',
  '#.##..##########..##..##',
  '#..##............##..##.',
  '.#..##############..##.#',
  '..##................##..',
  '....################....',
  '...a.a.a.a.a.a.a.a.a....',
  '...a...a...a...a...a....',
  '...a...a...a...a...a....',
  '........................',
  '........................',
  '........................',
  '........................',
];

// P_CURSOR is the portrait for CURSOR.EXE, mirroring its battle sprite's arrow shape.
// The top rows show the pointer arrowhead ('a' pixels), the lower rows the window body.
const P_CURSOR = [
  '....aaaa................',
  '...aaaaaa...............',
  '...aaaaaa...............',
  '...aaaaaa...............',
  '....aaaaaa..............',
  '.....aaaaaa.............',
  '......aaaa..............',
  '.......a................',
  '.....######.............',
  '....##r##k#.............',
  '....########............',
  '....########............',
  '...##########...........',
  '...##########...........',
  '...##......##...........',
  '...##......##...........',
  '...##......##...........',
  '..####....####..........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// P_GUARD is the portrait for GUARD.SYS; the large pauldron blocks ('a') give it bulk.
const P_GUARD = [
  '......######............',
  '.....########...........',
  '....##r####k##..........',
  '....##########..........',
  '....##.####.##..........',
  '....##########..........',
  '.....########...........',
  '..aa##########aa........',
  '.aaa##########aaa.......',
  'aaaa#r######k#aaaa......',
  'aaaa##########aaaa......',
  '.aaa##########aaa.......',
  '..aa##########aa........',
  '....##########..........',
  '....##########..........',
  '....###....###..........',
  '....###....###..........',
  '....##......##..........',
  '....##......##..........',
  '...####....####.........',
  '........................',
  '........................',
  '........................',
  '........................',
];

// P_PURGE is the portrait for PURGE.BAT; the 'a' pixels trace the staff held diagonally.
const P_PURGE = [
  '......aaaaaa............',
  '.....aa####aa...........',
  '....aa######aa..........',
  '....a##########.........',
  '....a##......##.........',
  '....a###....###.........',
  '....a##.rr.##...........',
  '....a##########.........',
  '.....##########.........',
  '.....##########a........',
  '....######a#####........',
  '....######a#####........',
  '....######a#............',
  '....######a#............',
  '....#####a#.............',
  '....#####a#.............',
  '....#####a#.............',
  '....##.#a#.##...........',
  '...####.#####...........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// PortraitSprite renders a portrait grid as a standalone SVG element.
// Unlike BSprite, it produces a full <svg> tag (not a <g>) so it can be
// embedded in the dialog panel as an independent block-level image.
// A solid background rect filled with var(--bg-1) ensures crisp edges.
function PortraitSprite({ grid, body, rim, dark, acc, scale=6 }){
  const rows = grid.length, cols = grid[0].length;
  const rects = [];
  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const ch = grid[r][c];
      if(ch === '.') continue; // skip transparent pixels
      // Map character token to caller-provided color; no 'e'/'w' tokens in portraits.
      const fill = ch === '#' ? body
                 : ch === 'r' ? rim
                 : ch === 'k' ? dark
                 : ch === 'a' ? acc : body;
      rects.push(<rect key={r+'-'+c} x={c*scale} y={r*scale}
        width={scale} height={scale} fill={fill} />);
    }
  }
  return (
    <svg width={cols*scale} height={rows*scale}
      viewBox={`0 0 ${cols*scale} ${rows*scale}`}
      shapeRendering="crispEdges"
      style={{display:'block', imageRendering:'pixelated'}}>
      {/* Solid background so the portrait doesn't bleed into the dialog panel */}
      <rect x="0" y="0" width={cols*scale} height={rows*scale} fill="var(--bg-1)"/>
      {rects}
    </svg>
  );
}

// SPEAKERS maps the 'who' key from makeDialog to the speaker's display name,
// portrait grid, and color palette for PortraitSprite.
const SPEAKERS = {
  oracle: { name:'MOTHERBOARD ORACLE', grid:P_ORACLE,
            body:'var(--fg-bright)', rim:'var(--cream)', dark:'var(--fg-dim)', acc:'var(--hl)' },
  cursor: { name:'CURSOR.EXE', grid:P_CURSOR,
            body:'var(--bg-0)', rim:'var(--fg-bright)', dark:'#000', acc:'var(--hl)' },
  guard:  { name:'GUARD.SYS', grid:P_GUARD,
            body:'var(--bg-0)', rim:'var(--fg-bright)', dark:'#000', acc:'var(--cream)' },
  purge:  { name:'PURGE.BAT', grid:P_PURGE,
            body:'var(--bg-0)', rim:'var(--fg-bright)', dark:'#000', acc:'var(--hl)' },
};

// ── Lore phase ────────────────────────────────────────────────────────

// IntroLore renders the star-field + CSS scrolling text crawl (phase 1).
// Tapping/clicking or pressing ENTER shows a confirmation popup before skipping.
// ESC aborts the whole intro. The crawl auto-completes when the animation ends.
function IntroLore({ blip, onDone, onSkip }){
  const [skipped, setSkipped] = useStateI(false);
  const [confirm, setConfirm]  = useStateI(false); // show "skip lore?" popup

  // Opens the skip-confirmation popup (does nothing if already skipped).
  const askSkip = ()=>{ if(!skipped){ blip(540); setConfirm(true); } };

  // Responsive crawl duration: mobile viewports get more time since the same
  // content scrolls by faster relative to the smaller visible window.
  const crawlDuration = React.useMemo(()=>
    window.matchMedia('(max-width:600px)').matches ? 40000 : 28000
  , []);
  const crawlDurationCSS = crawlDuration + 'ms';

  // Keyboard: ENTER/SPACE → open confirmation; ESC → exit intro entirely.
  // While confirmation is visible, ENTER confirms and ESC cancels it.
  useEffectI(()=>{
    function onKey(e){
      if(confirm){
        if(e.key==='Enter'){ blip(960); setConfirm(false); setSkipped(true); e.preventDefault(); }
        else if(e.key==='Escape'){ blip(360); setConfirm(false); e.preventDefault(); }
        return;
      }
      if(e.key==='Enter'||e.key===' '){ askSkip(); e.preventDefault(); }
      else if(e.key==='Escape'){ blip(360); onSkip&&onSkip(); }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [blip, onSkip, confirm, skipped]);

  const crawlRef = useRefI(null);

  // Auto-finish when the text visually exits the top of the viewport.
  // The CSS animation travels from translateY(+100%) to translateY(-120%) = 2.2×
  // the element's own height. The text exits the viewport when its bottom edge
  // crosses y=0, which happens after travelling (elHeight + vpHeight) pixels —
  // earlier than the full 2.2× trip. We fire onDone() at that moment to avoid
  // leaving the player staring at a blank starfield.
  useEffectI(()=>{
    if(skipped){ onDone(); return; }
    if(confirm) return; // pause the countdown while the popup is up
    let delay = crawlDuration;
    const el = crawlRef.current;
    if(el){
      const elH = el.offsetHeight;
      const vpH = window.innerHeight;
      // exitFraction: what fraction of the total 2.2× animation corresponds to
      // the text just clearing the top of the viewport.
      const exitFraction = (elH + vpH) / (2.2 * elH);
      delay = crawlDuration * Math.min(1, exitFraction);
    }
    const t = setTimeout(()=>onDone(), delay);
    return ()=>clearTimeout(t);
  }, [skipped, confirm, onDone, crawlDuration]);

  // Procedural starfield: deterministic LCG so the same stars appear every time.
  const stars = React.useMemo(()=>{
    const arr = []; let r = 11;
    const rnd = ()=>{ r=(r*9301+49297)%233280; return r/233280; }; // LCG pseudo-random
    for(let i=0;i<80;i++) arr.push({x:rnd()*100, y:rnd()*100, s:rnd()>0.85?3:2, d:rnd()*3});
    return arr;
  },[]);

  return (
    <div className="intro-lore" onClick={askSkip} style={{cursor:'pointer'}}>
      {/* Star field rendered as absolutely-positioned <span> elements */}
      <div className="lore-stars">
        {stars.map((s,i)=>(
          <span key={i} className="lore-star" style={{
            left:s.x+'%', top:s.y+'%', width:s.s, height:s.s,
            animationDelay: s.d+'s'}}/>
        ))}
      </div>
      {/* Crawl pauses (animation-play-state) while the confirmation popup is open */}
      <div ref={crawlRef} className={'lore-crawl '+(skipped?'snap':'')}
        style={skipped ? undefined : {
          animationDuration: crawlDurationCSS,
          animationPlayState: confirm ? 'paused' : 'running',
        }}>
        {LORE.map((ln,i)=>(
          <div key={i} className="lore-ln">{ln || ' '}</div>
        ))}
      </div>
      <div className="intro-hint">
        ▼ &nbsp;<b>TAP / ENTER</b>&nbsp; TO SKIP &nbsp;&middot;&nbsp; <b>ESC</b>&nbsp; TO ABORT
      </div>

      {/* Skip-confirmation popup */}
      {confirm && (
        <div style={{
          position:'absolute',inset:0,display:'flex',alignItems:'center',
          justifyContent:'center',background:'rgba(0,0,0,.65)',zIndex:20,
        }}
          onClick={(e)=>{ e.stopPropagation(); blip(360); setConfirm(false); }}>
          <div style={{
            background:'var(--jrpg-blue)',border:'4px solid var(--cream)',
            boxShadow:'0 0 0 2px var(--bg-0),0 0 0 6px var(--cream),0 0 0 8px var(--bg-0)',
            padding:'24px 30px',fontFamily:"'Press Start 2P',monospace",
            color:'var(--cream)',textAlign:'center',maxWidth:'min(400px,90%)',
          }}
            onClick={(e)=>e.stopPropagation()}>
            <div style={{fontSize:9,letterSpacing:'.18em',marginBottom:16,color:'var(--hl)'}}>
              ▣ SKIP LORE?
            </div>
            <div style={{
              fontFamily:"'VT323',monospace",fontSize:20,
              marginBottom:22,lineHeight:1.4,color:'var(--cream)',
            }}>
              SKIP THE STORY CRAWL<br/>AND PROCEED TO BRIEFING?
            </div>
            <div style={{display:'flex',gap:14,justifyContent:'center'}}>
              <button style={{
                appearance:'none',background:'transparent',border:'2px solid var(--cream)',
                color:'var(--cream)',fontFamily:"'Press Start 2P',monospace",fontSize:10,
                letterSpacing:'.1em',padding:'8px 18px',cursor:'pointer',
              }}
                onClick={(e)=>{ e.stopPropagation(); blip(960); setConfirm(false); setSkipped(true); }}>
                YES
              </button>
              <button style={{
                appearance:'none',background:'var(--cream)',border:'2px solid var(--cream)',
                color:'var(--jrpg-blue)',fontFamily:"'Press Start 2P',monospace",fontSize:10,
                letterSpacing:'.1em',padding:'8px 18px',cursor:'pointer',
              }}
                onClick={(e)=>{ e.stopPropagation(); blip(360); setConfirm(false); }}>
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dialog phase (typed text + portrait) ──────────────────────────────

// IntroDialog drives the typewriter dialogue sequence (phase 3).
// Each page types out character-by-character; ENTER/SPACE skips to the end
// of the current page on the first press, then advances to the next page.
// ESC jumps directly to onDone regardless of progress.
function IntroDialog({ blip, onDone, name }){
  const pages = React.useMemo(()=>makeDialog(name), [name]); // build dialog once per name
  const [pi, setPi] = useStateI(0);      // current page index
  const [typed, setTyped] = useStateI(''); // partially-typed text for the current page
  const [full, setFull] = useStateI(false); // true once the full page text is shown
  const fullRef = useRefI(false); // ref copy of 'full' so the keydown closure sees it without stale capture
  const cancelTypingRef = useRefI(false); // lets the keydown handler stop the tick mid-animation

  // Typewriter effect: reset state on page change, then schedule character-by-character
  // reveals via recursive setTimeout at 24 ms per character.
  // Every 3rd character fires a blip at a slightly randomised pitch.
  useEffectI(()=>{
    setTyped(''); setFull(false); fullRef.current = false; cancelTypingRef.current = false;
    const text = pages[pi].text;
    let i = 0;
    function tick(){
      if(cancelTypingRef.current) return; // stopped by keydown or cleanup
      if(i <= text.length){
        setTyped(text.slice(0, i));
        if(i % 3 === 0) blip(900 + (Math.random()*120|0)); // randomise pitch slightly
        i++;
        setTimeout(tick, 24);
      } else {
        setFull(true); fullRef.current = true; // mark as fully typed
      }
    }
    setTimeout(tick, 80); // short initial delay before typing starts
    return ()=>{ cancelTypingRef.current = true; }; // cancel in-flight tick when page changes
  }, [pi, pages, blip]);

  // Keydown: first press skips typing; second press advances to the next page.
  useEffectI(()=>{
    function onKey(e){
      if(e.key==='Enter'||e.key===' '){
        if(!fullRef.current){
          // First press while still typing: stop the tick and snap to full text.
          cancelTypingRef.current = true;
          setTyped(pages[pi].text); setFull(true); fullRef.current = true;
          blip(720);
        } else {
          blip(960);
          if(pi+1 < pages.length) setPi(pi+1); // advance to next page
          else onDone();                         // last page: exit dialog phase
        }
        e.preventDefault();
      } else if(e.key==='Escape'){
        blip(360); onDone(); // ESC always exits immediately
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [pi, pages, blip, onDone]);

  const speaker = SPEAKERS[pages[pi].who]; // look up portrait + name for the current page

  return (
    <div className="intro-dialog">
      <div className="dlg-row">
        <div className="dlg-portrait">
          <div className="dlg-portrait-frame">
            <PortraitSprite grid={speaker.grid} body={speaker.body}
              rim={speaker.rim} dark={speaker.dark} acc={speaker.acc} scale={4}/>
          </div>
          <div className="dlg-portrait-name">{speaker.name}</div>
        </div>
        <div className="dlg-box"
          onClick={()=>{
            if(!fullRef.current){
              cancelTypingRef.current = true;
              setTyped(pages[pi].text); setFull(true); fullRef.current = true; blip(720);
            } else {
              blip(960);
              if(pi+1 < pages.length) setPi(pi+1);
              else onDone();
            }
          }}
          style={{cursor:'pointer'}}>
          <div className="legend">▣ TRANSMISSION</div>
          {/* Split on '\n' so multi-line dialog lines render as separate <div> rows. */}
          <div className="dlg-text">
            {typed.split('\n').map((ln,i)=>(<div key={i}>{ln || ' '}</div>))}
          </div>
          <div className="dlg-bottom">
            <span className="dlg-counter">{pi+1} / {pages.length}</span>
            {/* Advance arrow is only visible ('on') once the page is fully typed. */}
            <span className={'dlg-next '+(full?'on':'')}>▼</span>
          </div>
        </div>
      </div>
      <div className="intro-hint">
        <b>TAP</b> / <b>⏎</b> ADVANCE &nbsp;&middot;&nbsp; <b>ESC</b> SKIP
      </div>
    </div>
  );
}

// ── Depart phase ──────────────────────────────────────────────────────

// IntroDepart shows three cinematic title cards that fade in sequentially (phase 4).
// The 'step' state (0-3) is incremented on timers so CSS can reveal each line.
// ENTER/SPACE at any point fires onDone immediately.
function IntroDepart({ blip, onDone, name }){
  const [step, setStep] = useStateI(0); // drives 'step-N' CSS class on the overlay

  useEffectI(()=>{
    // Stagger the three title lines at 0.8 s, 2.4 s, and 4.2 s.
    const t1 = setTimeout(()=>setStep(1), 800);
    const t2 = setTimeout(()=>setStep(2), 2400);
    const t3 = setTimeout(()=>setStep(3), 4200);
    function onKey(e){
      if(e.key==='Enter'||e.key===' '){ blip(960); onDone(); }
    }
    window.addEventListener('keydown', onKey);
    return ()=>{
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener('keydown', onKey);
    };
  }, [blip, onDone]);

  return (
    <div className="intro-depart"
      onClick={()=>{ blip(960); onDone(); }}
      style={{cursor:'pointer'}}>
      <div className="depart-stage">
        {/* The 'step-N' class controls which lines are visible via CSS transitions. */}
        <div className={'depart-overlay step-'+step}>
          <div className="depart-line a">A NEW PROCESS HAS BEGUN.</div>
          <div className="depart-line b">YOUR JOURNEY, {name||'USER'}...</div>
          <div className="depart-line c">...STARTS NOW.</div>
        </div>
      </div>
      <div className="intro-hint">
        <span className="press">▶ TAP OR PRESS <b>ENTER</b> TO BEGIN</span>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────

// Intro is the top-level component that owns the phase state machine.
// It renders the appropriate phase sub-component and a persistent phase indicator bar.
// A skip button in the top-left corner lets mouse users abort at any point.
function Intro({ blip, onCancel, onComplete, username }){
  // phases: 'lore' | 'dialog' | 'depart'
  const [phase, setPhase] = useStateI('lore');
  // Use the logged-in account's username throughout the intro.
  const name = (username && username.trim()) || 'USER';

  return (
    <div className="intro-shell">
      {/* Mouse-clickable skip button — always visible, positioned above the content */}
      <button className="daw-back-btn"
        style={{ position:'absolute', top:12, left:12, zIndex:12 }}
        onClick={()=>{ blip && blip(360); onCancel && onCancel(); }}
        title="skip intro (ESC)">← SKIP</button>

      {/* Render only the active phase component */}
      {phase==='lore'   && <IntroLore   blip={blip}
                              onDone={()=>setPhase('dialog')}
                              onSkip={()=>onCancel && onCancel()} />}
      {phase==='dialog' && <IntroDialog blip={blip} name={name}
                              onDone={()=>setPhase('depart')} />}
      {phase==='depart' && <IntroDepart blip={blip} name={name}
                              onDone={()=>onComplete && onComplete()} />}

      {/* Phase indicator bar: highlights the current step */}
      <div className="intro-phasebar">
        <span className={'pp '+(phase==='lore'  ?'on':'')}>01 LORE</span>
        <span className={'pp '+(phase==='dialog'?'on':'')}>02 BRIEFING</span>
        <span className={'pp '+(phase==='depart'?'on':'')}>03 DEPART</span>
      </div>
    </div>
  );
}

// Expose <Intro> to the global window so daw-app.jsx can mount it without a bundler.
Object.assign(window, { Intro });
