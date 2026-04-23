// daw-login.jsx
//
// Full-screen terminal-style login and registration gate for the game.
//
// Exports (via window):
//   LoginScreen       — the main component; handles both login and register flows.
//   DAW_DEFAULT_PARTY — starter hero roster for new accounts.
//   DAW_STARTER_HEROES — alias used by daw-app.jsx when seeding a new save.
//   DAW_DEFAULT_WALLET — starting gold amount for new accounts.
//   DAW_DEFAULT_INV    — starting inventory counts for new accounts.
//
// The component has two UI modes toggled by the 'mode' state:
//   'login'    — username/email + password → calls DAW_API.login().
//   'register' — handle + optional email + password + confirm → calls DAW_API.register().
//
// After a successful API call, runConnect() plays a scripted terminal log animation
// before calling onAuthed() to hand control back to the parent shell.

const { useState: useStateL, useEffect: useEffectL, useRef: useRefL, useCallback: useCallbackL } = React;

// ── Game defaults (used by daw-app.jsx for new saves) ────────────────────

// Default party lineup seeded for every newly registered account.
const DAW_DEFAULT_PARTY   = ['CURSOR.EXE','GUARD.SYS','PURGE.BAT'];

// Full list of heroes available at the start (same as the default party for now).
const DAW_STARTER_HEROES  = ['CURSOR.EXE','GUARD.SYS','PURGE.BAT'];

// Starting gold given to new accounts.
const DAW_DEFAULT_WALLET  = 412;

// Starting inventory: item IDs mapped to initial quantities.
const DAW_DEFAULT_INV     = {
  patch:3, buffer:2, restore:1, rootkit:0,
  firewall:0, defrag:0, exploit:0, antidote:0, jpegofkey:0,
};

// Expose game defaults globally so daw-app.jsx can read them at save-creation time.
Object.assign(window, {
  DAW_DEFAULT_PARTY, DAW_STARTER_HEROES, DAW_DEFAULT_WALLET, DAW_DEFAULT_INV,
});

// ── Status pings that scroll under the form ──────────────────────────────

// STATUS_LINES are shown in the persistent status strip at the bottom of the card.
const STATUS_LINES = [
  ['SERVER', 'sectorware.net'],
  ['STATUS', 'ONLINE'],
  ['PING',   '12ms'],
];

// LOGIN_LOG is the scripted terminal output replayed line-by-line after a successful login.
const LOGIN_LOG = [
  '> opening tcp socket... [ OK ]',
  '> handshake (RSA-4096).. [ OK ]',
  '> auth.challenge........ [ OK ]',
  '> auth.response......... [ OK ]',
  '> hydrating profile..... [ OK ]',
  '> loading party state... [ OK ]',
  '> WELCOME BACK.',
];

// REGISTER_LOG is the scripted terminal output replayed after a successful registration.
const REGISTER_LOG = [
  '> reserving handle...... [ OK ]',
  '> minting /home sector.. [ OK ]',
  '> seeding starter party. [ OK ]',
  '> dispatching patch.dll. [ OK ]',
  '> ACCOUNT CREATED.',
];

// LoginScreen is the top-level component for the auth gate.
// Props:
//   blip(freq) — plays a short beep at the given Hz (passed down from the shell).
//   onAuthed(account, kind) — called once authentication/registration succeeds;
//                             'kind' is 'login' or 'created'.
function LoginScreen({ blip, onAuthed }){
  const [mode, setMode]   = useStateL('login');   // 'login' | 'register' — controls which form fields are shown
  const [user, setUser]   = useStateL('');         // handle or email field value
  const [email, setEmail] = useStateL('');         // optional email field (register only)
  const [pass, setPass]   = useStateL('');         // password field value
  const [pass2, setPass2] = useStateL('');         // confirm password field (register only)
  const [focus, setFocus] = useStateL('user');     // which logical field has keyboard focus
  const [phase, setPhase] = useStateL('idle');     // 'idle' | 'connecting' — hides form during API call
  const [logLines, setLogLines] = useStateL([]);   // lines shown in the connecting terminal log
  const [error, setError] = useStateL('');         // inline validation or API error message

  // Refs for imperative DOM focus management on the actual <input> elements.
  const userRef  = useRefL(null);
  const emailRef = useRefL(null);
  const passRef  = useRefL(null);
  const pass2Ref = useRefL(null);

  // Auto-focus the username field as soon as the component mounts.
  useEffectL(()=>{
    setTimeout(()=>{ userRef.current && userRef.current.focus(); }, 50);
  }, []);

  // Clear the error message whenever the player edits any field or switches modes,
  // so stale errors don't linger after the user has already corrected the input.
  useEffectL(()=>{ if(error) setError(''); }, [user, email, pass, pass2, mode]);

  // submit() validates all fields client-side, then calls the appropriate DAW_API method.
  // On failure it shows an error; on success it delegates to runConnect().
  const submit = useCallbackL(()=>{
    const raw = (user || '').trim();
    // Registration requires an uppercase handle; login accepts email addresses as-is.
    const u = (mode === 'register') ? raw.toUpperCase() : raw;
    if(!u){ setError('HANDLE / EMAIL REQUIRED'); blip && blip(220); return; }
    if(mode === 'register' && u.length < 3){ setError('HANDLE TOO SHORT (MIN 3)'); blip && blip(220); return; }
    if(!pass){ setError('PASSWORD REQUIRED'); blip && blip(220); return; }
    if(pass.length < 6){ setError('PASSWORD TOO SHORT (MIN 6)'); blip && blip(220); return; }

    if(mode === 'register'){
      if(pass !== pass2){ setError('PASSWORDS DO NOT MATCH'); blip && blip(220); return; }
      const emailTrim = email.trim();
      // Only validate email format if the player actually typed something in that field.
      if(emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)){
        setError('INVALID EMAIL FORMAT'); blip && blip(220); return;
      }
      setPhase('connecting');
      setLogLines(['> reserving handle on sectorware.net...']);
      blip && blip(960);
      DAW_API.register(u, emailTrim || null, pass)
        .then(result => runConnect(result, REGISTER_LOG, 'created'))
        .catch(err => {
          setPhase('idle');
          setLogLines([]);
          // 409 Conflict means the handle is already taken; anything else is a server error.
          setError(err.status === 409 ? 'HANDLE ALREADY REGISTERED' : 'SERVER OFFLINE — TRY AGAIN');
          blip && blip(220);
        });
      return;
    }

    // LOGIN path: send credentials and replay the login log on success.
    setPhase('connecting');
    setLogLines(['> opening tcp socket to sectorware.net...']);
    blip && blip(960);
    DAW_API.login(u, pass)
      .then(result => runConnect(result, LOGIN_LOG, 'login'))
      .catch(err => {
        setPhase('idle');
        setLogLines([]);
        // 401 Unauthorized means wrong credentials; anything else is a server/network error.
        setError(err.status === 401 ? 'AUTH FAILED — BAD HANDLE OR PASSWORD' : 'SERVER OFFLINE — TRY AGAIN');
        blip && blip(220);
      });
  }, [user, email, pass, pass2, mode, blip]);

  // runConnect replays a scripted terminal log line-by-line with randomised delays
  // to simulate a real connection handshake, then calls onAuthed when the log finishes.
  function runConnect(account, lines, kind){
    setPhase('connecting');
    setLogLines([]);
    blip && blip(960);
    let i = 0;
    function next(){
      if(i >= lines.length){
        // Brief pause after the final log line before handing off to the parent.
        setTimeout(()=>{ onAuthed && onAuthed(account, kind); }, 600);
        return;
      }
      setLogLines(L => [...L, lines[i]]); // append one line at a time
      i++;
      setTimeout(next, 200 + Math.random()*120); // jitter delay to look organic
    }
    next();
  }

  // Global keyboard handler: Tab cycles through fields; Enter advances or submits.
  // Does nothing while an API call is in flight ('connecting' phase).
  useEffectL(()=>{
    function onKey(e){
      if(phase === 'connecting') return; // ignore input while waiting for API
      if(e.key === 'Tab'){
        e.preventDefault();
        // Build the tab order dynamically based on the current mode.
        const order = mode==='register'
          ? ['user','email','pass','pass2','submit','swap']
          : ['user','pass','submit','swap'];
        const i = order.indexOf(focus);
        // Shift+Tab moves backwards; plain Tab moves forwards; both wrap around.
        const next = order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length];
        setFocus(next);
        // Imperatively focus the matching DOM input, or blur for virtual fields.
        if(next === 'user')  userRef.current && userRef.current.focus();
        else if(next === 'email') emailRef.current && emailRef.current.focus();
        else if(next === 'pass')  passRef.current && passRef.current.focus();
        else if(next === 'pass2') pass2Ref.current && pass2Ref.current.focus();
        else { document.activeElement && document.activeElement.blur && document.activeElement.blur(); }
        blip && blip(540);
        return;
      }
      if(e.key === 'Enter'){
        // Enter on each field moves focus to the next logical field.
        if(focus === 'user'){
          if(mode === 'register'){ setFocus('email'); emailRef.current && emailRef.current.focus(); }
          else { setFocus('pass'); passRef.current && passRef.current.focus(); }
          blip && blip(540); e.preventDefault(); return;
        }
        if(focus === 'email'){
          setFocus('pass'); passRef.current && passRef.current.focus();
          blip && blip(540); e.preventDefault(); return;
        }
        if(focus === 'pass'){
          if(mode === 'register'){
            setFocus('pass2'); pass2Ref.current && pass2Ref.current.focus();
            blip && blip(540); e.preventDefault(); return;
          }
          submit(); e.preventDefault(); return; // login: Enter on password submits directly
        }
        if(focus === 'pass2' || focus === 'submit'){
          submit(); e.preventDefault(); return;
        }
        if(focus === 'swap'){
          // Enter on the swap button toggles the mode just like clicking it.
          setMode(m => m==='login' ? 'register' : 'login');
          blip && blip(540); e.preventDefault(); return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [focus, phase, mode, submit, blip]);

  const isRegister = mode === 'register'; // convenience flag used throughout JSX

  return (
    <div className="daw-shell">
      {/* Top bar: shows the current URL-style path (/login or /register) and version */}
      <div className="lg-topbar">
        <div>
          <span className="lg-online"/>MIPMIP COMPANY &nbsp;
          <span className="lg-host">/{isRegister ? 'register' : 'login'}</span>
        </div>
        <div>v1.04 &middot; auth.kernel</div>
      </div>

      <div className="lg-stage">
        {/* Left column: branding, flavour text, and news marquee */}
        <div className="lg-left">
          <div className="lg-logo">D A W</div>
          <div className="lg-tag">DEFENDING&middot;A&middot;WORKSTATION</div>
          <div className="lg-blurb">
            {isRegister ? (
              <>Provision a fresh <b>/HOME</b> sector. Each handle gets <b>one save</b> —
                progress, party, and clears all sync to your kernel under that name.
                Starter trio: <b>CURSOR.EXE</b>, <b>GUARD.SYS</b>, <b>PURGE.BAT</b>.</>
            ) : (
              <>Sign in to access your save. Each handle has <b>one save slot</b> —
                we sync your party, inventory and clears to the leaderboard under
                this name. New here? Switch to <b>REGISTER</b>.</>
            )}
          </div>
          {/* Scrolling news ticker with game tips and patch notes */}
          <div className="lg-marquee">
            <b>&gt; daily ops note:</b>{' '}
            sector 1 reporting heightened PHISH.WYRM activity.{' '}
            Recommend bringing GUARD.SYS or ROOT.SH for backup heals.
            <br/><b>&gt; new in v1.04:</b>{' '}
            heroes unlocked via Registry Market and post-boss drops.
          </div>
        </div>

        {/* Right column: the auth card with form fields or connecting log */}
        <div className="lg-right">
          <div className="lg-card">
            {/* Card legend: changes to 'PROVISIONING' / 'AUTHENTICATING' during API call */}
            <div className="lg-card-legend">
              {phase === 'connecting'
                ? (isRegister ? 'PROVISIONING' : 'AUTHENTICATING')
                : (isRegister ? 'REGISTER' : 'LOG IN')}
            </div>
            <h3>{isRegister ? 'CLAIM A HANDLE' : 'ESTABLISH CONNECTION'}</h3>
            <div className="lg-card-sub">
              {isRegister
                ? 'reserve your name. one handle = one save.'
                : 'your kernel will challenge for credentials.'}
            </div>

            {/* Form fields are hidden while the API call is in progress */}
            {phase !== 'connecting' && (<>
              {/* Username / handle field — register mode restricts to A-Z 0-9 _ . - */}
              <div className="lg-field">
                <div className="lg-field-label">{isRegister ? 'HANDLE' : 'HANDLE / EMAIL'}</div>
                <div className={'lg-field-wrap ' + (focus==='user'?'focus':'')}
                  onClick={()=>{ setFocus('user'); userRef.current && userRef.current.focus(); }}>
                  <span className="lg-chev">&gt;</span>
                  {isRegister ? (
                    // Register: strip disallowed characters on every keystroke and force uppercase.
                    <input ref={userRef} value={user}
                      onChange={(e)=>setUser(e.target.value.replace(/[^A-Za-z0-9_.-]/g,'').slice(0,16).toUpperCase())}
                      onFocus={()=>setFocus('user')}
                      placeholder="enter handle"
                      spellCheck={false} autoCapitalize="characters"
                      maxLength={16}/>
                  ) : (
                    // Login: accept anything (email addresses use many characters).
                    <input ref={userRef} value={user}
                      onChange={(e)=>setUser(e.target.value.slice(0,255))}
                      onFocus={()=>setFocus('user')}
                      placeholder="handle or email"
                      spellCheck={false} autoCapitalize="none"
                      maxLength={255}/>
                  )}
                  <span className="lg-caret"/>
                </div>
              </div>

              {/* Optional email field — only shown during registration */}
              {isRegister && (
                <div className="lg-field">
                  <div className="lg-field-label">EMAIL <span style={{color:'rgba(254,250,224,.45)',fontSize:'0.85em'}}>(OPTIONAL)</span></div>
                  <div className={'lg-field-wrap ' + (focus==='email'?'focus':'')}
                    onClick={()=>{ setFocus('email'); emailRef.current && emailRef.current.focus(); }}>
                    <span className="lg-chev">&gt;</span>
                    <input ref={emailRef} type="email" value={email}
                      onChange={(e)=>setEmail(e.target.value.slice(0,255))}
                      onFocus={()=>setFocus('email')}
                      placeholder="user@domain.net"
                      maxLength={255} spellCheck={false} autoCapitalize="none"/>
                    <span className="lg-caret"/>
                  </div>
                </div>
              )}

              {/* Password field — always shown */}
              <div className="lg-field">
                <div className="lg-field-label">PASSWORD</div>
                <div className={'lg-field-wrap ' + (focus==='pass'?'focus':'')}
                  onClick={()=>{ setFocus('pass'); passRef.current && passRef.current.focus(); }}>
                  <span className="lg-chev">&gt;</span>
                  <input ref={passRef} type="password" value={pass}
                    onChange={(e)=>setPass(e.target.value.slice(0,32))}
                    onFocus={()=>setFocus('pass')}
                    placeholder="********"
                    maxLength={32}/>
                  <span className="lg-caret"/>
                </div>
              </div>

              {/* Confirm password field — only shown during registration */}
              {isRegister && (
                <div className="lg-field">
                  <div className="lg-field-label">CONFIRM</div>
                  <div className={'lg-field-wrap ' + (focus==='pass2'?'focus':'')}
                    onClick={()=>{ setFocus('pass2'); pass2Ref.current && pass2Ref.current.focus(); }}>
                    <span className="lg-chev">&gt;</span>
                    <input ref={pass2Ref} type="password" value={pass2}
                      onChange={(e)=>setPass2(e.target.value.slice(0,32))}
                      onFocus={()=>setFocus('pass2')}
                      placeholder="********"
                      maxLength={32}/>
                    <span className="lg-caret"/>
                  </div>
                </div>
              )}

              {/* Inline error banner — only rendered when error is non-empty */}
              {error && (
                <div className="lg-err">
                  <span className="arr">!</span>{error}
                </div>
              )}

              <div className="lg-buttons">
                {/* Primary submit button; gains 'sel' class when keyboard focus is on it */}
                <button className={'lg-btn lg-btn-primary ' + (focus==='submit'?'sel':'')}
                  onMouseEnter={()=>{ setFocus('submit'); blip && blip(540); }}
                  onClick={submit}>
                  {isRegister ? '> CREATE ACCOUNT' : '> CONNECT'}
                </button>
                {/* Mode toggle button: switches between login and register */}
                <button className={'lg-btn ' + (focus==='swap'?'sel':'')}
                  onMouseEnter={()=>{ setFocus('swap'); blip && blip(540); }}
                  onClick={()=>{ setMode(m => m==='login'?'register':'login'); blip && blip(540); }}>
                  {isRegister ? 'BACK TO LOG IN' : 'REGISTER →'}
                </button>
              </div>

              {/* Small contextual hint line below the buttons */}
              <div className="lg-side">
                <span>{isRegister
                  ? 'one handle / one save / leaderboard-ready'
                  : 'no account? > register'}</span>
                <span>node /us-east</span>
              </div>
            </>)}

            {/* Terminal log panel replaces the form fields while the API call runs.
                The last line gets the 'ok' class once it matches the final log entry,
                triggering a visual confirmation colour change. */}
            {phase === 'connecting' && (
              <div className="lg-connecting">
                {logLines.map((l,i)=>{
                  const targetLen = isRegister ? REGISTER_LOG.length : LOGIN_LOG.length;
                  return (
                    <span key={i} className={'ln ' + (i === logLines.length-1 && i === targetLen-1 ? 'ok':'')}>
                      {l}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Persistent status strip at the bottom of the card — always visible */}
            <div className="lg-status-strip">
              {STATUS_LINES.map(([k,v])=>(
                <span key={k}><b>{k}</b>{v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: keyboard shortcut reminder and copyright line */}
      <div className="lg-foot">
        <div>
          <b>TAB</b> next field &middot; <b>⏎</b> {isRegister?'CREATE':'CONNECT'}
        </div>
        <div>© 2026 MIPMIP COMPANY</div>
      </div>
    </div>
  );
}

// Expose LoginScreen globally so daw-app.jsx can mount it without a bundler.
Object.assign(window, { LoginScreen });
