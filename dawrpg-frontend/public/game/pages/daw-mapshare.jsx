// daw-mapshare.jsx — Community map sharing page for DAW RPG.
//
// Two parts:
//   1. `dawMapStore` — an async CRUD layer for shared mods. Implemented today
//      with `localStorage` so single-device users still see their own
//      publishes; the interface is fully Promise-based so the backend can
//      later be swapped for `fetch()` against a real REST/GraphQL endpoint
//      with zero changes to consumers. See REMOTE_ADAPTER_TEMPLATE at the
//      bottom of this file for what that swap looks like.
//
//   2. `CustomMapsPage` — the Custom Map Selector. Browse community mods,
//      preview them, install + playtest, like, delete your own.

const {
  useState: useStateS, useEffect: useEffectS, useMemo: useMemoS,
  useCallback: useCallbackS, useRef: useRefS,
} = React;

// ── Per-account liked-mods set (local only, per account) ─────────────

// Reads the set of mod IDs the given account has liked from localStorage.
function msGetLiked(accountId){
  try { return new Set(JSON.parse(localStorage.getItem(`daw.liked.${accountId}`) || '[]')); }
  catch(e){ return new Set(); }
}

// Persists the updated liked-IDs set for the given account back to localStorage.
function msSetLiked(accountId, set){
  try { localStorage.setItem(`daw.liked.${accountId}`, JSON.stringify([...set])); }
  catch(e){}
}

// Convert an API mod (+ optional parsed data blob) into the frontend shape.
// Accepts the raw data blob as either a JSON string or an already-parsed object.
function apiToMod(apiMod, data){
  const d = data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};
  return {
    id:          apiMod.id,
    title:       apiMod.title,
    author:      apiMod.authorName || 'ANON',
    intro:       d.intro  || apiMod.introText || '',
    heroes:      d.heroes  || [],
    enemies:     d.enemies || [],
    map:         d.map     || { nodes:[], edges:[] },
    cover:       d.cover   || null,
    version:     parseInt(apiMod.version) || 1,
    authorId:    apiMod.authorId,
    publishedAt: new Date(apiMod.createdAt).getTime(),
    updatedAt:   new Date(apiMod.updatedAt).getTime(),
    plays:       apiMod.playCount   || 0,
    // Likes are stored as an array so `.length` works uniformly across local and API data.
    likes:       new Array(apiMod.ratingCount || 0).fill('__api__'),
  };
}

// dawMapStore — async CRUD layer that fronts the DAW_API for mod operations.
// All methods return Promises, making the switch to a remote backend transparent.
const dawMapStore = {
  _account: null,

  // Stores the active account so methods that require authentication can read it.
  setCurrentAccount(acct){ this._account = acct; },

  // Fetches the first 100 mods from the API, then applies optional text search
  // and sort order client-side before returning the filtered array.
  async list({ q='', sort='new', followingIds=null } = {}){
    const res = await DAW_API.listMods(1, 100);
    let arr = (res.items || []).map(m => apiToMod(m));
    if(q){
      const ql = q.toLowerCase();
      arr = arr.filter(m =>
        (m.title||'').toLowerCase().includes(ql) ||
        (m.author||'').toLowerCase().includes(ql));
    }
    if(sort === 'new')      arr = [...arr].sort((a,b) => b.updatedAt - a.updatedAt);
    if(sort === 'plays')    arr = [...arr].sort((a,b) => b.plays - a.plays);
    if(sort === 'likes')    arr = [...arr].sort((a,b) => b.likes.length - a.likes.length);
    // "following" sort floats mods by followed authors to the top, then sorts by recency.
    if(sort === 'following' && followingIds){
      arr = [...arr].sort((a,b)=>{
        const af = followingIds.has(a.authorId) ? 1 : 0;
        const bf = followingIds.has(b.authorId) ? 1 : 0;
        return bf - af || b.updatedAt - a.updatedAt;
      });
    }
    return arr;
  },

  // Fetches a single mod by ID and converts it to the frontend shape (includes data blob).
  async get(id){
    const apiMod = await DAW_API.getMod(id);
    if(!apiMod) return null;
    return apiToMod(apiMod, apiMod.data);
  },

  // Creates or updates a published mod. Passes publishedId to update an existing entry;
  // omit it (or pass null) to create a new one. Requires a logged-in account.
  async publish(project, { author='ANON', publishedId=null } = {}){
    const acct = this._account;
    if(!acct) throw new Error('Not logged in');
    // Bundle map content into a single JSON blob stored on the mod record.
    const dataBlob = JSON.stringify({
      intro:   project.intro   || '',
      heroes:  project.heroes  || [],
      enemies: project.enemies || [],
      map:     project.map     || { nodes:[], edges:[] },
      cover:   project.cover   || null,
    });
    const payload = {
      title:       (project.title || 'UNTITLED MOD').slice(0, 128),
      description: '',
      introText:   (project.intro || '').slice(0, 600),
      version:     '1.0',
      isPublished: true,
      data:        dataBlob,
    };
    if(publishedId){
      // Update path: patch the existing record then re-fetch to get the canonical shape.
      await DAW_API.updateMod(publishedId, acct.id, payload);
      const updated = await DAW_API.getMod(publishedId);
      return apiToMod(updated, updated.data);
    } else {
      // Create path: POST then immediately GET so the returned mod has server-assigned fields.
      const created = await DAW_API.createMod(acct.id, payload);
      const fresh   = await DAW_API.getMod(created.id);
      return apiToMod(fresh, fresh.data);
    }
  },

  // Deletes the mod with the given ID; silently no-ops if there is no logged-in account.
  async delete(id){
    const acct = this._account;
    if(!acct) return;
    await DAW_API.deleteMod(id, acct.id);
  },

  // Increments the play counter for a mod; errors are swallowed so they never block gameplay.
  async recordPlay(id){
    await DAW_API.recordPlay(id).catch(()=>{});
  },

  // Toggles the like state for a mod and persists it to localStorage.
  // If the account is logged in and the user is liking (not un-liking), also sends a
  // 5-star rating to the API. Returns a patched mod object so the UI can update immediately.
  async toggleLike(id){
    const acct = this._account;
    const liked = msGetLiked(acct ? acct.id : 'anon');
    const had = liked.has(id);
    if(had){
      liked.delete(id);
    } else {
      liked.add(id);
      if(acct){
        await DAW_API.rateMod(id, acct.id, 5).catch(()=>{});
      }
    }
    msSetLiked(acct ? acct.id : 'anon', liked);
    // Return a patched mod object so the UI can update its likes count.
    const mod = await this.get(id).catch(()=>null);
    if(!mod) return null;
    // delta is +1 when liking, -1 when un-liking; clamp to 0 to avoid negative arrays.
    const delta = had ? -1 : 1;
    return { ...mod, likes: new Array(Math.max(0, mod.likes.length + delta)).fill('__api__') };
  },

  // Returns true if the logged-in account is the author of the given mod.
  isOwner(mod){
    return !!mod && !!this._account && mod.authorId === this._account.id;
  },

  // Returns true if the current account (or anonymous user) has liked the given mod.
  isLiked(mod){
    if(!mod) return false;
    const acct = this._account;
    return msGetLiked(acct ? acct.id : 'anon').has(mod.id);
  },
};

// ── Author follow mini-overlay ────────────────────────────────────────
// Modal overlay that lets the player follow or unfollow another user's account.
// Shows "THIS IS YOU" if the author is the logged-in user, and "LOG IN TO FOLLOW"
// when the player is browsing anonymously.
function AuthorFollowOverlay({ author, authorId, account, followingIds, onFollow, onUnfollow, onClose, blip }) {
  const isMe = account && account.id === authorId;
  const isFollowing = followingIds.has(authorId);
  const [busy, setBusy] = useStateS(false);

  // Sends the follow/unfollow API call, then fires the parent callback and closes the modal.
  async function toggle() {
    if (busy || isMe || !account) return;
    setBusy(true);
    blip && blip(720);
    try {
      if (isFollowing) { await DAW_API.unfollow(account.id, authorId); onUnfollow(authorId); }
      else             { await DAW_API.follow(account.id, authorId);   onFollow(authorId); }
    } catch(e) { }
    setBusy(false);
    onClose();
  }

  // All styles are defined inline so this overlay remains self-contained.
  const S = {
    overlay: {position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.6)'},
    box: {background:'var(--jrpg-blue)',border:'4px solid var(--cream)',
          boxShadow:'0 0 0 2px var(--bg-0),0 0 0 6px var(--cream)',
          padding:24, textAlign:'center', fontFamily:"'Press Start 2P',monospace", color:'var(--cream)',
          minWidth:280},
    title: {fontSize:9, letterSpacing:'.18em', color:'var(--fg-dim)', marginBottom:8},
    name: {fontSize:13, letterSpacing:'.1em', color:'var(--fg-bright)', marginBottom:20},
    // Helper that returns button styles; primary variant gets a highlighted border and bg tint.
    btn: (primary) => ({
      appearance:'none', background: primary ? 'rgba(212,244,163,.15)' : 'transparent',
      border:`2px solid ${primary ? 'var(--fg-bright)' : 'var(--fg-dim)'}`,
      color: primary ? 'var(--fg-bright)' : 'var(--cream)',
      fontFamily:"'Press Start 2P',monospace", fontSize:9, letterSpacing:'.1em',
      padding:'8px 14px', cursor:'pointer', margin:'0 4px',
    }),
    row: {display:'flex', justifyContent:'center', gap:8},
  };

  return (
    // Clicking the semi-transparent backdrop (not the box) also closes the overlay.
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget){blip&&blip(360);onClose();}}}>
      <div style={S.box}>
        <div style={S.title}>▣ AUTHOR</div>
        <div style={S.name}>{author}</div>
        {isMe && <div style={{fontFamily:"'VT323',monospace",fontSize:18,color:'var(--fg-dim)'}}>THIS IS YOU</div>}
        {!isMe && !account && <div style={{fontFamily:"'VT323',monospace",fontSize:18,color:'var(--fg-dim)'}}>LOG IN TO FOLLOW</div>}
        {!isMe && account && (
          <div style={S.row}>
            <button style={S.btn(!isFollowing)} onClick={toggle} disabled={busy}>
              {busy ? '...' : isFollowing ? '✓ UNFOLLOW' : '+ FOLLOW'}
            </button>
            <button style={S.btn(false)} onClick={()=>{blip&&blip(360);onClose();}}>CANCEL</button>
          </div>
        )}
        {(isMe || !account) && (
          <button style={{...S.btn(false), marginTop:12}} onClick={()=>{blip&&blip(360);onClose();}}>CLOSE</button>
        )}
      </div>
    </div>
  );
}

// ── Custom Map Selector page ──────────────────────────────────────────
// Main browse-and-play page. Shows a filterable, sortable mod list on the left
// and a detail panel on the right. Handles keyboard navigation (↑↓ select,
// Enter play, ESC back) and integrates with dawMapStore for all data ops.
function CustomMapsPage({ blip, onExit, onPlay, account }){
  // Keep dawMapStore aware of the current account so like/publish/delete checks work.
  useEffectS(()=>{ dawMapStore.setCurrentAccount(account || null); }, [account]);

  // Ref-based cache for cover images so re-fetching the list doesn't wipe loaded covers.
  const coverCache = useRefS({});
  const [mods, setMods] = useStateS([]);
  const [loading, setLoading] = useStateS(true);
  const [sort, setSort] = useStateS('new');
  const [q, setQ] = useStateS('');
  const [selId, setSelId] = useStateS(null);
  const [toast, setToast] = useStateS(null);
  const [followingIds, setFollowingIds] = useStateS(new Set());
  const [followBusy, setFollowBusy] = useStateS(null); // authorId being toggled, or null
  const [authorOverlay, setAuthorOverlay] = useStateS(null); // {author, authorId}

  // Load following IDs for the "following" sort and author follow buttons
  useEffectS(()=>{
    if(!account) { setFollowingIds(new Set()); return; }
    DAW_API.getFollowingIds(account.id)
      .then(ids => setFollowingIds(new Set(Array.isArray(ids) ? ids : [])))
      .catch(()=>{});
  }, [account?.id]);

  // Displays a transient status message for 1.8 seconds then clears it.
  function showToast(t){
    setToast(t);
    setTimeout(()=>setToast(null), 1800);
  }

  // Fetches the mod list from the store (applying current sort + search query),
  // then merges any covers already cached in coverCache to avoid re-fetching them.
  async function refresh(){
    setLoading(true);
    const arr = await dawMapStore.list({ q, sort, followingIds });
    const cache = coverCache.current;
    setMods(arr.map(m => cache[m.id] !== undefined ? { ...m, cover: cache[m.id] } : m));
    setLoading(false);
    // Reset selection to the first item if the currently selected mod no longer appears.
    if(arr.length && !arr.find(m => m.id === selId)) setSelId(arr[0].id);
    // Prefetch covers for all mods not yet cached so thumbnails appear without needing selection.
    arr.forEach(m => {
      if (cache[m.id] !== undefined) return;
      dawMapStore.get(m.id).then(full => {
        if (!full) return;
        cache[full.id] = full.cover ?? null;
        setMods(prev => prev.map(x => x.id === full.id ? { ...x, cover: full.cover } : x));
      }).catch(() => {});
    });
  }

  // Re-fetch whenever sort or following set changes (immediate).
  useEffectS(() => { refresh(); /* eslint-disable-next-line */ }, [sort, followingIds]);

  // Re-fetch when the search query changes, but debounce 200 ms to avoid a request per keystroke.
  useEffectS(() => {
    const t = setTimeout(refresh, 200);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [q]);

  // Derived: the full mod object that matches the current selection ID.
  const selected = useMemoS(() => mods.find(m => m.id === selId) || null, [mods, selId]);

  // Fetch full mod data (includes cover) when selection changes; cache so refreshes don't wipe it.
  useEffectS(() => {
    if (!selId) return;
    if (coverCache.current[selId] !== undefined) return; // already fetched
    let cancelled = false;
    dawMapStore.get(selId).then(full => {
      if (cancelled || !full) return;
      // Store in the ref so subsequent list refreshes can restore the cover without a round-trip.
      coverCache.current[full.id] = full.cover;
      setMods(arr => arr.map(m => m.id === full.id ? { ...m, cover: full.cover } : m));
    }).catch(() => {});
    // Cleanup flag prevents state updates if the component unmounts mid-fetch.
    return () => { cancelled = true; };
  }, [selId]);

  // Toggles follow state for an author; updates followingIds in-place so the UI is instant.
  async function handleFollowToggle(authorId, authorName){
    if(!account || !authorId || account.id === authorId || followBusy) return;
    setFollowBusy(authorId);
    blip && blip(720);
    const wasFollowing = followingIds.has(authorId);
    try {
      if(wasFollowing){
        await DAW_API.unfollow(account.id, authorId);
        setFollowingIds(s => { const n = new Set(s); n.delete(authorId); return n; });
        showToast(`UNFOLLOWED ${authorName || authorId}`);
      } else {
        await DAW_API.follow(account.id, authorId);
        setFollowingIds(s => new Set([...s, authorId]));
        showToast(`NOW FOLLOWING ${authorName || authorId}`);
      }
    } catch(e){ showToast('ACTION FAILED'); }
    setFollowBusy(null);
  }

  // Toggles like state for a mod and updates the local list entry with the patched object.
  async function handleLike(mod){
    const next = await dawMapStore.toggleLike(mod.id);
    if(next){
      setMods(arr => arr.map(m => m.id === next.id ? next : m));
      blip && blip(720);
    }
  }

  // Records a play event then loads the full mod data before handing it to the play engine,
  // because list items do not carry the map/heroes/enemies data blob.
  async function handlePlay(mod){
    blip && blip(960);
    await dawMapStore.recordPlay(mod.id);
    // List items don't carry the data blob (map/heroes/enemies).
    // Fetch the full mod before handing off to the play engine.
    try {
      const full = await dawMapStore.get(mod.id);
      // Fall back to the partial list item if the full fetch returns an empty map.
      onPlay && onPlay(full && full.map && full.map.nodes.length ? full : mod);
    } catch(e) {
      onPlay && onPlay(mod);
    }
  }

  // Key handling
  useEffectS(() => {
    function onKey(e){
      // Ignore keypresses that originate inside text input elements.
      if(e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if(e.key === 'Escape'){ onExit && onExit(); e.preventDefault(); return; }
      if(!mods.length) return;
      const idx = mods.findIndex(m => m.id === selId);
      // Arrow keys and vim j/k navigate the mod list; Enter plays the selected mod.
      if(e.key === 'ArrowDown' || e.key === 'j'){
        const ni = Math.min(mods.length - 1, idx + 1);
        setSelId(mods[ni].id); blip && blip(540); e.preventDefault();
      } else if(e.key === 'ArrowUp' || e.key === 'k'){
        const ni = Math.max(0, idx - 1);
        setSelId(mods[ni].id); blip && blip(540); e.preventDefault();
      } else if(e.key === 'Enter'){
        if(selected) handlePlay(selected);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    /* eslint-disable-next-line */
  }, [mods, selId, selected, onExit]);

  return (
    <div className="cm-shell">
      <div className="cm-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onExit && onExit(); }}
          title="back to menu (ESC)">← MENU</button>
        <span className="cm-bc">
          <span className="cm-blk"></span>
          CUSTOM MAPS / COMMUNITY EXCHANGE
        </span>
        <div className="cm-hud">
          <span><b>MODS</b><span className="ok">{mods.length}</span></span>
          <span><b>YOU</b><span>{account ? account.username : 'ANON'}</span></span>
        </div>
      </div>

      <div className="cm-toolbar">
        <input className="cm-search" placeholder="SEARCH BY TITLE OR AUTHOR..."
          value={q} onChange={(e)=>setQ(e.target.value)} />
        <div className="cm-sorts">
          {[['new','NEW'],['plays','MOST PLAYED'],['likes','TOP LIKED'],['following','FOLLOWING']].map(([k,l]) => (
            <button key={k}
              className={'cm-sort ' + (sort===k?'sel':'')}
              title={k==='following' ? 'Show mods by people you follow first' : undefined}
              onClick={()=>{ setSort(k); blip && blip(540); }}>
              {l}
            </button>
          ))}
        </div>
        <div className="cm-publish-hint" title="Publishing now lives in DEV MODE → MY MODS">
          ↑ Publish &amp; unpublish from <b>DEV MODE → MY MODS</b>
        </div>
      </div>

      <div className="cm-stage">
        <div className="cm-list-card">
          <div className="cm-leg">▣ LIBRARY</div>
          <div className="cm-list">
            {loading && <div className="cm-empty">. . . loading from server . . .</div>}
            {!loading && mods.length === 0 && (
              <div className="cm-empty">
                <div style={{ fontSize:13, marginBottom:8 }}>NO MODS FOUND</div>
                <div style={{ fontFamily:"'VT323',monospace", fontSize:15,
                  color:'var(--fg-dim)' }}>
                  Be the first — build one in DEV MODE then click PUBLISH.
                </div>
              </div>
            )}
            {!loading && mods.map(m => {
              const isOwner = dawMapStore.isOwner(m);
              const liked = dawMapStore.isLiked(m);
              return (
                <div key={m.id}
                  className={'cm-row ' + (selId===m.id?'sel':'')}
                  onClick={()=>{ setSelId(m.id); blip && blip(540); }}>
                  {/* Cover: uses AvatarDisplay if a cover exists, otherwise a colour derived from the mod ID */}
                  <div className="cm-row-glyph"
                    style={{ background: m.cover ? 'transparent' : hashColor(m.id),
                             padding: m.cover ? 0 : undefined, overflow:'hidden' }}>
                    {m.cover
                      ? <AvatarDisplay avatar={m.cover} size={40} />
                      : (m.title || '?').slice(0, 1)}
                  </div>
                  <div className="cm-row-main">
                    <div className="cm-row-title">
                      {m.title}
                      {isOwner && <span className="cm-tag own">MINE</span>}
                      {!isOwner && followingIds.has(m.authorId) &&
                        <span className="cm-tag following">FOLLOWING</span>}
                    </div>
                    <div className="cm-row-sub">
                      by {m.author} · {m.map?.nodes?.length || 0} nodes · {m.enemies?.length || 0} enemies
                    </div>
                  </div>
                  <div className="cm-row-meta">
                    <span title="plays">▶ {m.plays || 0}</span>
                    {/* "liked" class highlights the heart when this account has liked the mod */}
                    <span className={liked?'liked':''} title="likes">♥ {(m.likes||[]).length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cm-detail-card">
          <div className="cm-leg">▣ DETAILS</div>
          {!selected && (
            <div className="cm-empty" style={{ margin:'auto' }}>
              SELECT A MOD ON THE LEFT
            </div>
          )}
          {selected && (
            <div className="cm-detail">
              <div className="cm-detail-head">
                <div className="cm-detail-cover"
                  style={{ background: selected.cover ? 'transparent' : hashColor(selected.id),
                           padding: selected.cover ? 0 : undefined, overflow:'hidden' }}>
                  {selected.cover
                    ? <AvatarDisplay avatar={selected.cover} size={72} />
                    : (selected.title || '?').slice(0, 2)}
                </div>
                <div className="cm-detail-meta">
                  <div className="cm-detail-title">{selected.title}</div>
                  <div className="cm-detail-author">
                    by{' '}
                    {/* Clicking the author name opens the follow/unfollow overlay */}
                    <span
                      style={{cursor:'pointer', borderBottom:'1px solid var(--fg-dim)',
                              color: followingIds.has(selected.authorId) ? 'var(--fg-bright)' : 'inherit'}}
                      title={`Click to follow/unfollow ${selected.author}`}
                      onClick={()=>{ blip&&blip(540); setAuthorOverlay({author:selected.author, authorId:selected.authorId}); }}>
                      {selected.author}
                      {/* Checkmark badge shown when the player already follows this author */}
                      {followingIds.has(selected.authorId) && <span style={{fontSize:'0.8em', marginLeft:4, color:'var(--fg-bright)'}}>✓</span>}
                    </span>
                  </div>
                  <div className="cm-detail-times">
                    PUBLISHED {fmtTime(selected.publishedAt)}
                    {/* Only show UPDATED timestamp when it differs from the publish date */}
                    {selected.updatedAt && selected.updatedAt !== selected.publishedAt
                      && ` · UPDATED ${fmtTime(selected.updatedAt)}`}
                  </div>
                </div>
              </div>

              {/* Quick-stat row: node count, fight count (derived from node types), roster sizes, social counts */}
              <div className="cm-detail-stats">
                <div className="cm-stat"><span>NODES</span><b>{selected.map?.nodes?.length || 0}</b></div>
                <div className="cm-stat"><span>FIGHTS</span><b>{(selected.map?.nodes||[]).filter(n=>n.type==='fight'||n.type==='mini'||n.type==='boss').length}</b></div>
                <div className="cm-stat"><span>HEROES</span><b>{selected.heroes?.length || 0}</b></div>
                <div className="cm-stat"><span>ENEMIES</span><b>{selected.enemies?.length || 0}</b></div>
                <div className="cm-stat"><span>PLAYS</span><b>{selected.plays || 0}</b></div>
                <div className="cm-stat"><span>LIKES</span><b>{(selected.likes||[]).length}</b></div>
              </div>

              <div className="cm-detail-intro-leg">▶ INTRO</div>
              {/* \n escape sequences in intro text are expanded to real newlines for display */}
              <pre className="cm-detail-intro">
                {(selected.intro || '> (no intro)').replace(/\\n/g,'\n')}
              </pre>

              <div className="cm-detail-actions">
                <button className="dv-btn primary"
                  onClick={()=>handlePlay(selected)}>
                  ▶ INSTALL &amp; PLAY
                </button>
                <button className="dv-btn"
                  onClick={()=>handleLike(selected)}>
                  {dawMapStore.isLiked(selected) ? '♥ LIKED' : '♡ LIKE'}
                </button>
                {/* Follow button — only shown when logged in and viewing someone else's mod */}
                {account && !dawMapStore.isOwner(selected) && (
                  <button
                    className={'dv-btn' + (followingIds.has(selected.authorId) ? ' active' : '')}
                    disabled={followBusy === selected.authorId}
                    onClick={()=>handleFollowToggle(selected.authorId, selected.author)}
                    title={followingIds.has(selected.authorId)
                      ? `Unfollow ${selected.author}`
                      : `Follow ${selected.author} to see their mods first`}>
                    {followBusy === selected.authorId
                      ? '· · ·'
                      : followingIds.has(selected.authorId)
                        ? '✓ FOLLOWING'
                        : '+ FOLLOW'}
                  </button>
                )}
                {dawMapStore.isOwner(selected) && (
                  <span className="cm-owner-hint">
                    Yours — manage from <b>DEV MODE → MY MODS</b>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="cm-foot">
        <div>
          <b>↑↓</b> SELECT &middot; <b>⏎</b> INSTALL &amp; PLAY &middot; <b>ESC</b> BACK
        </div>
        <div>
          local store · ready for remote sync via <code>dawMapStore.*</code>
        </div>
      </div>
      {toast && <div className="cm-toast">{toast}</div>}

      {/* Author overlay mounts only when a row's author name has been clicked */}
      {authorOverlay && (
        <AuthorFollowOverlay
          author={authorOverlay.author}
          authorId={authorOverlay.authorId}
          account={account}
          followingIds={followingIds}
          onFollow={id => { setFollowingIds(s => new Set([...s, id])); showToast(`NOW FOLLOWING ${authorOverlay.author}`); }}
          onUnfollow={id => { setFollowingIds(s => { const n=new Set(s); n.delete(id); return n; }); showToast(`UNFOLLOWED ${authorOverlay.author}`); }}
          onClose={() => setAuthorOverlay(null)}
          blip={blip}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

// Derives a deterministic CSS gradient from a string ID so mods without a
// cover image still get a visually distinct colour block.
function hashColor(seed){
  let h = 0;
  // Simple polynomial rolling hash (base 31) on char codes, kept in 32-bit int range.
  for(let i=0; i<seed.length; i++){ h = (h*31 + seed.charCodeAt(i)) | 0; }
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue} 38% 24%), hsl(${(hue+40)%360} 42% 18%))`;
}

// Converts a Unix-millisecond timestamp to a human-readable relative string
// (e.g. "3m ago", "2h ago", "4d ago") or falls back to an ISO date after 7 days.
function fmtTime(t){
  if(!t) return '—';
  const d = new Date(t);
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if(m < 1)   return 'just now';
  if(m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if(h < 24)  return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if(dd < 7)  return `${dd}d ago`;
  return d.toISOString().slice(0,10);
}

// ── Remote adapter template (for when you wire a real DB) ─────────────
//
// To swap from localStorage to a remote backend, replace the body of each
// dawMapStore method with a fetch() call. The public shape stays identical
// so no consumer (CustomMapsPage, daw-app, etc) needs to change.
//
//   const API = '/api/maps';
//   list:   ({q,sort}) => fetch(`${API}?q=${q}&sort=${sort}`).then(r => r.json()),
//   get:    (id)       => fetch(`${API}/${id}`).then(r => r.json()),
//   publish:(p, opts)  => fetch(`${API}/${opts.publishedId || ''}`, {
//                            method: opts.publishedId ? 'PUT' : 'POST',
//                            headers: {'Content-Type':'application/json'},
//                            body: JSON.stringify({...p, author: opts.author}),
//                         }).then(r => r.json()),
//   delete: (id)       => fetch(`${API}/${id}`, { method:'DELETE' }),
//   recordPlay:(id)    => fetch(`${API}/${id}/play`, { method:'POST' }),
//   toggleLike:(id)    => fetch(`${API}/${id}/like`, { method:'POST' }).then(r=>r.json()),
//
// Authentication is the only piece missing — once the user has a real account
// token, replace `msUserKey()` with `account.id` and pass it via Authorization
// headers. Local-only behavior continues to work as a graceful offline mode.

// Expose both the page component and the data store globally for use by daw-app.jsx.
Object.assign(window, { CustomMapsPage, dawMapStore });
