// daw-shop.jsx — Registry Market: buy/sell driver-files.
//
// Renders the in-game shop screen (ShopScreen) with three tabs:
//   BUY    — purchase consumable items from a fixed catalog using wallet BIT.
//   SELL   — sell back any owned items at half price (each item's `sell` field).
//   HEROES — permanently unlock purchasable hero drivers.
//
// All state is mirrored locally for instant UI feedback; the authoritative
// values live in the parent and are propagated via `onBuy`, `onSell`,
// `onAdjustWallet`, and `onUnlockHero` callbacks.

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS, useCallback: useCallbackS } = React;

// Catalog. Items follow the same shape as ITEMS_DEF in daw-battle.jsx but with
// extra fields (price, sell, stock, kind label, glyph, blurb, stat lines).
const SHOP_CATALOG = [
  { id:'patch',     label:'patch.dll',          glyph:'+',
    kindLabel:'HEAL',  kindCls:'heal',
    price: 60,  sell: 30,  stock: 12,
    desc:'A signed patch file. Apply to one ally to restore 80 INTEGRITY.',
    stats:[['EFFECT','+80 INTG'],['TARGET','1 ally'],['SLOT','consumable']] },
  { id:'buffer',    label:'buffer.zip',         glyph:'~',
    kindLabel:'CPU',   kindCls:'buff',
    price: 80,  sell: 40,  stock: 8,
    desc:'Compressed scratch space. Restores 40 CPU% to one ally.',
    stats:[['EFFECT','+40 CPU'],['TARGET','1 ally'],['SLOT','consumable']] },
  { id:'restore',   label:'restore_point.bak',  glyph:'R',
    kindLabel:'REVIVE', kindCls:'rev',
    price: 240, sell:120,  stock: 3,
    desc:'A pre-fault snapshot. Revive a faulted ally at 120 INTEGRITY.',
    stats:[['EFFECT','REVIVE'],['ON-REVIVE','120 INTG'],['SLOT','consumable']] },
  { id:'rootkit',   label:'~/root.kit',         glyph:'!',
    kindLabel:'BOMB',  kindCls:'dmg',
    price: 180, sell: 90,  stock: 5,
    desc:'Inverted exploit. Deploy at one foe — 140 raw damage, ignores defenses.',
    stats:[['DAMAGE','140'],['IGNORES','DEF / SHIELD'],['SLOT','consumable']] },
  { id:'firewall',  label:'firewall.cfg',       glyph:'#',
    kindLabel:'BUFF',  kindCls:'buff',
    price: 110, sell: 55,  stock: 6,
    desc:'Persistent rule-set. Grants an ally FIREWALL (-50% dmg) for 3 rounds.',
    stats:[['EFFECT','FIREWALL'],['DURATION','3 rounds'],['SLOT','consumable']] },
  { id:'defrag',    label:'defrag_tonic',       glyph:'%',
    kindLabel:'HEAL',  kindCls:'heal',
    price: 200, sell:100,  stock: 4,
    desc:'A full sector defrag. Heal the entire party for 60 INTEGRITY + clear silences.',
    stats:[['EFFECT','+60 INTG party'],['CURES','SILENCE'],['SLOT','consumable']] },
  { id:'exploit',   label:'exploit.bin',        glyph:'X',
    kindLabel:'BOMB',  kindCls:'dmg',
    price: 320, sell:160,  stock: 2,
    desc:'Zero-day in a tarball. AoE 90 damage + EXPOSE all enemies for 1 round.',
    stats:[['DAMAGE','90 AoE'],['EFFECT','EXPOSED'],['SLOT','consumable']] },
  { id:'antidote',  label:'antidote.sh',        glyph:'A',
    kindLabel:'CURE',  kindCls:'heal',
    price: 90,  sell: 45,  stock: 7,
    desc:'Shell script that strips all debuffs from one ally.',
    stats:[['EFFECT','CLEAR DEBUFFS'],['TARGET','1 ally'],['SLOT','consumable']] },
  { id:'jpegofkey', label:'kernel.key.jpg',     glyph:'K',
    kindLabel:'KEY',   kindCls:'key',
    price: 999, sell:500,  stock: 1,
    desc:'A mislabeled image file containing a kernel symbol. Required to enter the CORE CHAMBER. Rumor only — the shopkeeper denies stocking it.',
    stats:[['UNLOCKS','CORE'],['TYPE','quest'],['SLOT','keyitem']] },
];

// Randomised shopkeeper dialogue lines shown after each action.
const KEEPER_BUY = [
  '"freshly compiled, just for you."',
  '"i don\'t ask where my stock comes from."',
  '"that one bricked the last guy. enjoy."',
  '"buyer beware. all sales final."',
  '"signed by yours truly. *cough*"',
];
const KEEPER_SELL = [
  '"i\'ll quarantine it in the back, sure."',
  '"half price for used. take it or leave."',
  '"these are getting harder to fence."',
  '"another one for the archive."',
];
const KEEPER_NOPE = [
  '"come back when your wallet stops echoing."',
  '"insufficient funds. don\'t embarrass me."',
  '"sorry friend, no IOUs."',
];

// Hero unlocks available at the Registry Market.
// Currently just PING.DLL — ROOT.SH (mini-boss reward) and INDEX.LOG (boss reward)
// are unlocked via clearing the corresponding map nodes, NOT here.
const SHOP_HEROES = [
  { id:'PING.DLL', price: 650,
    desc:'Network probe. Fast, exposes weak ports, scrambles enemy timing. Cheap on CPU.',
    blurb:'"signed driver. used to be a security tool. now it just pings."',
    stats:[['ROLE','SCOUT'],['INTG','160'],['CPU','70'],['SPD','1.5']] },
];

// ShopScreen — top-level shop component.
// Manages local mirrors of wallet, inventory, and stock so purchases/sales
// reflect instantly; propagates the deltas to the parent via callbacks.
function ShopScreen({ blip, playerName='USER', wallet=412, inventory,
                     unlockedHeroes=[],
                     onBuy, onSell, onAdjustWallet, onUnlockHero, onExit }){
  // Local fallback state — used when the host passes static data.
  // The host is the source of truth; we mirror locally so the UI updates
  // immediately on buy/sell and propagate the new totals up.
  const [walletL, setWalletL] = useStateS(wallet);
  // Seed inventory with zeros for every catalog item, then overlay the prop values.
  const [invL, setInvL] = useStateS(()=> Object.assign({
    patch:3, buffer:2, restore:1, rootkit:0, firewall:0, defrag:0, exploit:0, antidote:0, jpegofkey:0
  }, inventory||{}));

  // Keep local mirrors in sync when the parent updates its authoritative values.
  useEffectS(()=>setWalletL(wallet), [wallet]);
  useEffectS(()=>{ if(inventory) setInvL(prev => Object.assign({...prev}, inventory)); }, [inventory]);

  const isMobile = window.innerWidth <= 760;
  const [tab, setTab] = useStateS('buy'); // 'buy' | 'sell' | 'heroes'
  const [mobileStage, setMobileStage] = useStateS('list'); // 'list' | 'detail' — mobile only
  const [sel, setSel] = useStateS(SHOP_CATALOG[0].id);
  const [heroSel, setHeroSel] = useStateS(SHOP_HEROES[0] ? SHOP_HEROES[0].id : null);
  const [qty, setQty] = useStateS(1);
  const [keeper, setKeeper] = useStateS(KEEPER_BUY[0]);
  const [toast, setToast] = useStateS(null);
  // Stock is tracked locally so buys/sells adjust displayed stock without a reload.
  const [stockL, setStockL] = useStateS(()=>Object.fromEntries(SHOP_CATALOG.map(i=>[i.id, i.stock])));

  // Reset quantity to 1 whenever the selected item or active tab changes.
  useEffectS(()=>{ setQty(1); }, [sel, tab]);

  // Auto-clear the toast after 1.7 seconds.
  useEffectS(()=>{
    if(!toast) return;
    const t = setTimeout(()=>setToast(null), 1700);
    return ()=>clearTimeout(t);
  }, [toast]);

  // Build list for current tab. In SELL tab we list only items the user owns.
  const visible = useMemoS(()=>{
    if(tab === 'buy') return SHOP_CATALOG;
    return SHOP_CATALOG.filter(i => (invL[i.id]||0) > 0);
  }, [tab, invL]);

  // Make sure sel stays valid when the list changes
  useEffectS(()=>{
    if(!visible.find(i=>i.id===sel)){
      setSel(visible.length ? visible[0].id : null);
    }
  }, [visible, sel]);

  // Derived values for the currently selected item.
  const cur = useMemoS(()=> SHOP_CATALOG.find(i=>i.id===sel), [sel]);
  const owned = cur ? (invL[cur.id]||0) : 0;
  const stockNow = cur ? (stockL[cur.id]||0) : 0;
  // Unit price differs between buy and sell tabs.
  const unitPrice = cur ? (tab==='buy' ? cur.price : cur.sell) : 0;
  const total = unitPrice * qty;

  // Maximum purchasable quantity, capped by wallet size, available stock, and a hard limit of 99.
  const maxQty = useMemoS(()=>{
    if(!cur) return 1;
    if(tab === 'buy'){
      const byCoin = unitPrice > 0 ? Math.floor(walletL / unitPrice) : 1;
      return Math.max(1, Math.min(stockNow || 0, byCoin || 0, 99));
    } else {
      return Math.max(1, Math.min(owned || 0, 99));
    }
  }, [cur, tab, unitPrice, walletL, stockNow, owned]);

  // canAct gates the buy/sell button and keyboard confirm.
  const canAct = useMemoS(()=>{
    if(!cur) return false;
    if(tab === 'buy') return total <= walletL && qty <= stockNow && stockNow > 0;
    return qty <= owned && owned > 0;
  }, [cur, tab, total, walletL, qty, stockNow, owned]);

  // Processes a purchase: deducts BIT, increases inventory, decreases stock, fires callbacks.
  function applyBuy(){
    if(!cur || !canAct) {
      setKeeper(KEEPER_NOPE[Math.floor(Math.random()*KEEPER_NOPE.length)]);
      setToast({kind:'bad', text:'INSUFFICIENT FUNDS'});
      blip && blip(220);
      return;
    }
    setWalletL(w => w - total);
    setInvL(I => ({...I, [cur.id]: (I[cur.id]||0) + qty}));
    setStockL(S => ({...S, [cur.id]: (S[cur.id]||0) - qty}));
    setKeeper(KEEPER_BUY[Math.floor(Math.random()*KEEPER_BUY.length)]);
    setToast({kind:'ok', text:`+${qty} ${cur.label}`});
    blip && blip(960);
    onBuy && onBuy(cur, qty, total);
    onAdjustWallet && onAdjustWallet(-total);
  }

  // Processes a sale: refunds BIT, decreases inventory, restocks shop, fires callbacks.
  function applySell(){
    if(!cur || !canAct){
      setToast({kind:'bad', text:'NOTHING TO SELL'});
      blip && blip(220);
      return;
    }
    setWalletL(w => w + total);
    setInvL(I => ({...I, [cur.id]: (I[cur.id]||0) - qty}));
    setStockL(S => ({...S, [cur.id]: (S[cur.id]||0) + qty}));
    setKeeper(KEEPER_SELL[Math.floor(Math.random()*KEEPER_SELL.length)]);
    setToast({kind:'ok', text:`+${total} BIT`});
    blip && blip(960);
    onSell && onSell(cur, qty, total);
    onAdjustWallet && onAdjustWallet(total);
  }

  // Keyboard nav
  useEffectS(()=>{
    function onKey(e){
      // Ignore keys typed into text inputs.
      if(e.target && /input|textarea/i.test(e.target.tagName)) return;
      if(e.key === 'Escape'){ onExit && onExit(); e.preventDefault(); return; }
      if(e.key === '1'){ setTab('buy'); blip && blip(540); return; }
      if(e.key === '2'){ setTab('sell'); blip && blip(540); return; }
      if(e.key === '3'){ setTab('heroes'); blip && blip(540); return; }

      // HEROES tab: arrow keys navigate the hero grid; Enter/Space purchases the selected hero.
      if(tab === 'heroes'){
        const hi = SHOP_HEROES.findIndex(h=>h.id===heroSel);
        if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){
          const n = SHOP_HEROES[(hi+1)%SHOP_HEROES.length]; if(n){ setHeroSel(n.id); blip && blip(540);} e.preventDefault(); return;
        } else if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){
          const n = SHOP_HEROES[(hi-1+SHOP_HEROES.length)%SHOP_HEROES.length]; if(n){ setHeroSel(n.id); blip && blip(540);} e.preventDefault(); return;
        } else if(e.key === 'Enter' || e.key === ' '){
          const cur = SHOP_HEROES.find(h=>h.id===heroSel);
          if(cur && !unlockedHeroes.includes(cur.id) && walletL >= cur.price){
            setWalletL(w => w - cur.price);
            onAdjustWallet && onAdjustWallet(-cur.price);
            onUnlockHero && onUnlockHero(cur.id);
            setKeeper(`"a fresh signed driver. welcome ${cur.id} to the team."`);
            setToast({kind:'ok', text:`+ ${cur.id} UNLOCKED`});
            blip && blip(960);
          } else if(cur){
            setToast({kind:'bad', text: unlockedHeroes.includes(cur.id)?'ALREADY UNLOCKED':'INSUFFICIENT FUNDS'});
            blip && blip(220);
          }
          e.preventDefault(); return;
        }
        return;
      }

      // BUY / SELL tabs: ↑↓ navigate the item list, ←→ adjust quantity, Enter/Space confirm.
      const idx = visible.findIndex(i=>i.id===sel);
      if(e.key === 'ArrowDown'){
        // Wraps around the list.
        const n = visible[(idx+1)%visible.length]; if(n){ setSel(n.id); blip && blip(540);} e.preventDefault();
      } else if(e.key === 'ArrowUp'){
        const n = visible[(idx-1+visible.length)%visible.length]; if(n){ setSel(n.id); blip && blip(540);} e.preventDefault();
      } else if(e.key === 'ArrowRight'){
        setQty(q => Math.min(maxQty, q+1)); blip && blip(540); e.preventDefault();
      } else if(e.key === 'ArrowLeft'){
        setQty(q => Math.max(1, q-1)); blip && blip(540); e.preventDefault();
      } else if(e.key === 'Enter' || e.key === ' '){
        if(tab === 'buy') applyBuy(); else applySell();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [visible, sel, qty, maxQty, tab, canAct, total, walletL, heroSel, unlockedHeroes, blip, onAdjustWallet, onUnlockHero]);

  return (
    <div className="sh-shell">
      <div className="sh-topbar">
        <button className="daw-back-btn"
          onClick={()=>{ blip && blip(360); onExit && onExit(); }}
          title="exit shop (ESC)">← EXIT</button>
        <span className="sh-bc">/SECTOR-1/REGISTRY_MARKET</span>
        <div className="sh-hud">
          <span><b>USR</b> {playerName}</span>
          <span><b>NODE</b> us-east</span>
          <span className="sh-wallet">$ {walletL} BIT</span>
        </div>
      </div>

      {/* Tab bar — also serves as the keyboard shortcut reference ([1]/[2]/[3]) */}
      <div className="sh-mode">
        <button className={tab==='buy'?'active':''} onClick={()=>{setTab('buy'); setMobileStage('list'); blip&&blip(720);}}>
          {!isMobile && <span style={{color:'var(--hl)',marginRight:8,fontSize:9}}>[1]</span>}BUY
        </button>
        <button className={tab==='sell'?'active':''} onClick={()=>{setTab('sell'); setMobileStage('list'); blip&&blip(720);}}>
          {!isMobile && <span style={{color:'var(--hl)',marginRight:8,fontSize:9}}>[2]</span>}SELL
        </button>
        <button className={tab==='heroes'?'active':''} onClick={()=>{setTab('heroes'); setMobileStage('list'); blip&&blip(720);}}>
          {!isMobile && <span style={{color:'var(--hl)',marginRight:8,fontSize:9}}>[3]</span>}HEROES
        </button>
      </div>

      <div className="sh-stage">
        {tab !== 'heroes' && (<>
        {/* LIST — hidden on mobile when viewing detail */}
        {(!isMobile || mobileStage === 'list') && (
        <div className="sh-list-wrap">
          <div className="sh-legend">▣ {tab==='buy' ? 'CATALOG' : 'OWNED'}</div>
          {!isMobile && (
            <div className="sh-list-header">
              <span>ICON</span>
              <span>NAME</span>
              <span style={{textAlign:'center'}}>KIND</span>
              <span style={{textAlign:'center'}}>{tab==='buy'?'STOCK':'QTY'}</span>
              <span style={{textAlign:'center'}}>OWNED</span>
              <span style={{textAlign:'right'}}>{tab==='buy'?'PRICE':'OFFER'}</span>
            </div>
          )}
          {isMobile && (
            <div className="sh-list-header sh-list-header-m">
              <span>ICON</span>
              <span>NAME</span>
              <span style={{textAlign:'right'}}>{tab==='buy'?'PRICE':'OFFER'}</span>
            </div>
          )}
          <div className="sh-list">
            {visible.length === 0 && (
              <div style={{margin:'auto',padding:24,textAlign:'center',
                fontFamily:"'VT323',monospace",fontSize:18,
                color:'rgba(254,250,224,.55)'}}>
                You don't have anything to sell.
              </div>
            )}
            {visible.map(it=>{
              const stock = stockL[it.id]||0;
              const own = invL[it.id]||0;
              const price = tab==='buy' ? it.price : it.sell;
              const outOfStock = tab==='buy' && stock <= 0;
              const tooPoor = tab==='buy' && walletL < price;
              return (
                <div key={it.id}
                  className={'sh-row '+(isMobile?'sh-row-m ':'')+(sel===it.id?'sel ':'')+((outOfStock||tooPoor)?'unaff':'')}
                  onClick={()=>{ setSel(it.id); blip && blip(540); if(isMobile) setMobileStage('detail'); }}
                  onMouseEnter={()=>{ if(!isMobile && sel!==it.id){ setSel(it.id); blip && blip(540);} }}>
                  <div className="sh-cell-icon">{it.glyph}</div>
                  <div className="sh-cell-name">
                    {it.label}
                    <span className="sub">{it.desc.split('.')[0]}.</span>
                  </div>
                  {!isMobile && <div className={'sh-cell-kind '+it.kindCls}>{it.kindLabel}</div>}
                  {!isMobile && (
                    <div className={'sh-cell-stock '+(tab==='buy' ? (stock<=0?'out':stock<3?'low':'') : '')}>
                      {tab==='buy' ? (stock<=0?'OUT':`x${stock}`) : `x${own}`}
                    </div>
                  )}
                  {!isMobile && <div className="sh-cell-owned"><b>OWN</b>{own}</div>}
                  <div className="sh-cell-price">{price}<span className="unit"> BIT</span></div>
                </div>
              );
            })}
          </div>
          <div className="sh-keeper">
            <span className="who">KEEPER</span>{keeper}
          </div>
        </div>
        )}

        {/* DETAIL — hidden on mobile when viewing list */}
        {(!isMobile || mobileStage === 'detail') && (
        <div className="sh-detail-wrap">
          {isMobile && (
            <button className="daw-back-btn" style={{marginBottom:12}}
              onClick={()=>setMobileStage('list')}>← LIST</button>
          )}
          <div className="sh-legend">▣ DETAIL</div>
          {cur ? (
            <div className="sh-detail">
              <div className="sh-detail-head">
                <div className="sh-detail-icon">{cur.glyph}</div>
                <div className="sh-detail-meta">
                  <div className="sh-detail-name">{cur.label}</div>
                  <div className="sh-detail-kind">{cur.kindLabel} &middot; consumable</div>
                  <div className="sh-detail-price">{unitPrice}<span className="unit">BIT each</span></div>
                </div>
              </div>
              <div className="sh-detail-desc">{cur.desc}</div>
              <div className="sh-detail-stats">
                {cur.stats.map(([k,v],i)=>(
                  <div key={i} className="sh-detail-stat"><span>{k}</span><b>{v}</b></div>
                ))}
              </div>
              <div className="sh-qty">
                <span className="sh-qty-lbl">QTY</span>
                <button className="sh-qty-btn"
                  onClick={()=>{ setQty(q=>Math.max(1, q-1)); blip && blip(540); }}
                  disabled={qty<=1}>−</button>
                <div className="sh-qty-val">x {qty}</div>
                <button className="sh-qty-btn"
                  onClick={()=>{ setQty(q=>Math.min(maxQty, q+1)); blip && blip(540); }}
                  disabled={qty>=maxQty}>+</button>
                <div className="sh-qty-total">
                  <span className="lbl">TOTAL</span>{total} BIT
                </div>
              </div>
              <div className="sh-actions">
                <button className="sh-act primary"
                  disabled={!canAct}
                  onClick={()=> tab==='buy' ? applyBuy() : applySell()}>
                  {tab==='buy' ? `> BUY x${qty}` : `> SELL x${qty}`}
                </button>
                <button className="sh-act"
                  onClick={()=>setQty(maxQty)}>MAX</button>
              </div>
            </div>
          ) : (
            <div style={{margin:'auto',padding:24,textAlign:'center',
              fontFamily:"'VT323',monospace",fontSize:18,
              color:'rgba(254,250,224,.55)'}}>
              No item selected.
            </div>
          )}
        </div>
        )}

        {/* INVENTORY rail — desktop only */}
        {!isMobile && (
        <div className="sh-inv-wrap">
          <div className="sh-legend">▣ INVENTORY</div>
          <div className="sh-inv">
            {SHOP_CATALOG.map(it=>{
              const q = invL[it.id] || 0;
              return (
                <div key={it.id} className={'sh-inv-row '+(q<=0?'empty':'')}>
                  <div className="sh-inv-icon">{it.glyph}</div>
                  <span className="sh-inv-name">{it.label}</span>
                  <span className="sh-inv-qty">x{q}</span>
                </div>
              );
            })}
          </div>
          <div className="sh-inv-total">
            <span>SLOTS USED</span>
            <b>{SHOP_CATALOG.filter(i=>(invL[i.id]||0)>0).length} / 9</b>
          </div>
        </div>
        )}
        </>)}

        {/* HEROES tab: delegates to HeroesPanel with a purchase callback */}
        {tab === 'heroes' && (
          <HeroesPanel blip={blip} wallet={walletL}
            unlockedHeroes={unlockedHeroes}
            heroSel={heroSel} setHeroSel={setHeroSel}
            isMobile={isMobile}
            onPurchase={(hero)=>{
              // Guard: already owned or not enough BIT — show error and bail.
              if(unlockedHeroes.includes(hero.id)) return;
              if(walletL < hero.price){
                setKeeper(KEEPER_NOPE[Math.floor(Math.random()*KEEPER_NOPE.length)]);
                setToast({kind:'bad', text:'INSUFFICIENT FUNDS'});
                blip && blip(220);
                return;
              }
              setWalletL(w => w - hero.price);
              onAdjustWallet && onAdjustWallet(-hero.price);
              onUnlockHero && onUnlockHero(hero.id);
              setKeeper(`"a fresh signed driver. welcome ${hero.id} to the team."`);
              setToast({kind:'ok', text:`+ ${hero.id} UNLOCKED`});
              blip && blip(960);
            }} />
        )}
      </div>

      {!isMobile && (
        <div className="sh-foot">
          <div>
            <b>1</b>/<b>2</b>/<b>3</b> BUY/SELL/HEROES &middot; <b>↑↓</b> SELECT &middot;
            {' '}<b>←→</b> QTY &middot; <b>⏎</b> CONFIRM &middot; <b>ESC</b> LEAVE
          </div>
          <div>shop.sectorware.net / signed-driver-market</div>
        </div>
      )}

      {toast && (
        <div className={'sh-toast '+toast.kind}>
          <span className="arr">▶</span>{toast.text}
        </div>
      )}
    </div>
  );
}

// Expose ShopScreen and catalog data globally for use by daw-app.jsx.
Object.assign(window, { ShopScreen, SHOP_CATALOG, SHOP_HEROES });

// ── HEROES tab ────────────────────────────────────────────────────────────
// Renders the hero roster grid (purchasable + locked placeholders) on the left
// and a detail panel on the right for the selected hero. Fetches the hero sprite
// definition from the global HEROES_DEF object if available.
function HeroesPanel({ blip, wallet, unlockedHeroes, heroSel, setHeroSel, onPurchase, isMobile }){
  const [mobileStage, setMobileStage] = useStateS('list'); // 'list' | 'detail' — mobile only
  const cur = SHOP_HEROES.find(h => h.id === heroSel) || SHOP_HEROES[0];
  const d = (window.HEROES_DEF && cur) ? window.HEROES_DEF[cur.id] : null;
  const owned = cur ? unlockedHeroes.includes(cur.id) : false;
  const tooPoor = cur ? wallet < cur.price : true;

  const heroListContent = (
    <>
      <div style={{
        fontFamily:"'VT323',monospace",fontSize:16,color:'rgba(254,250,224,.7)',
        padding:'6px 10px 10px',letterSpacing:'.02em',
        borderBottom:'1px dashed rgba(254,250,224,.2)'
      }}>
        Signed-driver heroes for sale. Permanent unlock — assign via{' '}
        <b style={{color:'var(--cream)'}}>PARTY / HEROES</b>.{' '}
        Other heroes are won by clearing the mini-boss and final boss.
      </div>
      <div className="sh-hero-grid">
        {SHOP_HEROES.map(h=>{
          const def = window.HEROES_DEF ? window.HEROES_DEF[h.id] : null;
          const have = unlockedHeroes.includes(h.id);
          const poor = wallet < h.price;
          return (
            <div key={h.id}
              className={'sh-hero-card '+(heroSel===h.id?'sel ':'')+(have?'owned ':'')+(poor && !have?'unaff':'')}
              onClick={()=>{ setHeroSel(h.id); blip && blip(540); if(isMobile) setMobileStage('detail'); }}
              onMouseEnter={()=>{ if(!isMobile && heroSel!==h.id){ setHeroSel(h.id); blip && blip(540);} }}>
              <div className="sh-hero-spr">
                {def ? (
                  <svg width="84" height="96" viewBox="0 0 84 96" shapeRendering="crispEdges">
                    <BSprite grid={def.sprite} scale={5} x={0} y={0}
                      body={def.body} rim={def.rim} dark={def.dark} acc={def.acc} eye={def.eye}/>
                  </svg>
                ) : <span style={{fontSize:24,color:'var(--cream)'}}>?</span>}
              </div>
              <div className="sh-hero-name">{h.id}</div>
              <div className="sh-hero-role">{def ? (def.role || '—') : '—'}</div>
              <div className="sh-hero-price">
                {have ? <span className="have">▣ UNLOCKED</span>
                      : <><span>{h.price}</span><span className="unit"> BIT</span></>}
              </div>
            </div>
          );
        })}
        <div className="sh-hero-card locked">
          <div className="sh-hero-spr"><span style={{fontSize:34,color:'rgba(254,250,224,.35)'}}>?</span></div>
          <div className="sh-hero-name">??? </div>
          <div className="sh-hero-role">CLEAR THE MINI-BOSS</div>
          <div className="sh-hero-price"><span className="locked-tag">LOCKED</span></div>
        </div>
        <div className="sh-hero-card locked">
          <div className="sh-hero-spr"><span style={{fontSize:34,color:'rgba(254,250,224,.35)'}}>?</span></div>
          <div className="sh-hero-name">??? </div>
          <div className="sh-hero-role">CLEAR THE FINAL BOSS</div>
          <div className="sh-hero-price"><span className="locked-tag">LOCKED</span></div>
        </div>
      </div>
    </>
  );

  const heroDetailContent = (
    <>
      <div className="sh-legend">▣ DETAIL</div>
      {cur && d ? (
        <div className="sh-detail">
          <div className="sh-detail-head" style={{gap:14}}>
            <div className="sh-hero-detail-spr">
              <svg width="112" height="128" viewBox="0 0 112 128" shapeRendering="crispEdges">
                <BSprite grid={d.sprite} scale={6} x={4} y={4}
                  body={d.body} rim={d.rim} dark={d.dark} acc={d.acc} eye={d.eye}/>
              </svg>
            </div>
            <div className="sh-detail-meta">
              <div className="sh-detail-name">{cur.id}</div>
              <div className="sh-detail-kind">{d.role || '—'} &middot; signed driver</div>
              <div className="sh-detail-price">
                {owned ? <span style={{color:'var(--fg-bright)'}}>▣ UNLOCKED</span>
                       : <>{cur.price}<span className="unit">BIT</span></>}
              </div>
            </div>
          </div>
          <div className="sh-detail-desc">{cur.desc}</div>
          <div className="sh-detail-stats">
            {cur.stats.map(([k,v],i)=>(
              <div key={i} className="sh-detail-stat"><span>{k}</span><b>{v}</b></div>
            ))}
            <div className="sh-detail-stat"><span>LIMIT</span><b>{d.limitName}</b></div>
          </div>
          <div style={{
            fontFamily:"'VT323',monospace",fontSize:15,
            color:'rgba(254,250,224,.65)',
            padding:'8px 10px',
            background:'rgba(0,0,0,.3)',
            border:'1px dashed rgba(254,250,224,.2)',
            letterSpacing:'.02em',lineHeight:1.35
          }}>
            <b style={{color:'var(--hl)',fontFamily:"'Press Start 2P',monospace",fontSize:9,letterSpacing:'.12em'}}>KEEPER &middot;</b>{' '}
            {cur.blurb}
          </div>
          <div className="sh-actions" style={{marginTop:'auto'}}>
            <button className="sh-act primary"
              disabled={owned || tooPoor}
              onClick={()=>onPurchase(cur)}>
              {owned ? '▣ ALREADY UNLOCKED'
                     : tooPoor ? `NEED ${cur.price - wallet} BIT`
                     : `> UNLOCK FOR ${cur.price} BIT`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{margin:'auto',padding:24,textAlign:'center',
          fontFamily:"'VT323',monospace",fontSize:18,
          color:'rgba(254,250,224,.55)'}}>
          No hero selected.
        </div>
      )}
    </>
  );

  // ── Mobile: list view ──
  if(isMobile && mobileStage === 'list'){
    return (
      <div className="sh-list-wrap" style={{flex:'1 1 auto'}}>
        <div className="sh-legend">▣ HERO ROSTER</div>
        {heroListContent}
      </div>
    );
  }

  // ── Mobile: detail view ──
  if(isMobile && mobileStage === 'detail'){
    return (
      <div className="sh-detail-wrap" style={{flex:'1 1 auto'}}>
        <button className="daw-back-btn" style={{marginBottom:12}}
          onClick={()=>setMobileStage('list')}>← LIST</button>
        {heroDetailContent}
      </div>
    );
  }

  // ── Desktop: two-panel side by side ──
  return (
    <>
    <div className="sh-list-wrap" style={{flex:'1 1 0'}}>
      <div className="sh-legend">▣ HERO ROSTER</div>
      {heroListContent}
    </div>
    <div className="sh-detail-wrap" style={{flex:'0 0 380px'}}>
      {heroDetailContent}
    </div>
    </>
  );
}

// Expose HeroesPanel globally so it can be unit-tested or mounted independently.
Object.assign(window, { HeroesPanel });
