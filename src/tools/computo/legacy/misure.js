// Computo legacy — modulo misure.js (STEP 2 split). Le funzioni chiamate si
// importano da index.js (barrel), lo stato da stato.js. Import circolari sicuri:
// i nomi si usano solo nei corpi funzione (live-binding ESM).
import { S } from './stato.js'
import { spostaElemento } from '../../../shared/ordine-computo'
import { impostaCampo, formulaPerSchermo, risolviVediVoce, vociCheRichiamano, misureATesto, testoAMisure, copiaRighe, spostaRiga, vociConMisure } from '../../../shared/compositore/misure-edit'
import { misureTabellaHtml } from '../../../shared/compositore/misure-tabella'
import { FASE_PROGETTO, rigaDettaglioHtml } from '../../../shared/griglia'
import { parseXpwe, xpweToVoci } from '../../../shared/xpwe/xpwe'
import { rowByKey } from './computo-overlay.js'
import {
  MIS_OPEN, cartImpCellHtml, cartPatchTotals, cartQtyCellHtml, cartRows, elencoKeyOf, esc, fmt,
  parseNum, refreshCartOverlayIfOpen, removeFromCart, setQtyManual, updateCartInfo, collectExportRows, rowKey
} from './index.js'

function misAddRiga(key){
  const idx=misMutAddRiga(key);
  misRerenderPanel(key, `[data-mis-input="${idx}:descrizione"]`);
  updateCartInfo();
}

function misCell(r,key){
  const q=S.qty[elencoKeyOf(r)]; // la misura vive sulla COPIA nell'Elenco Prezzi
  const val=q?String(q.qty).replace('.',','):'';
  const src=q
    ? (q.source==='manual'
        ? `<span class="mis-src man" title="Quantità inserita manualmente">✎</span>`
        : `<span class="mis-src imp" title="Quantità importata da una distinta">⇪</span>`)
    : '';
  return `<input class="qty-in" type="text" inputmode="decimal" value="${esc(val)}" placeholder="—"
            onclick="event.stopPropagation()" ondblclick="event.stopPropagation()"
            onchange="setQtyManual('${esc(key)}',this.value,'${esc(r.um||'')}')"
            title="Quantità per le Misurazioni (Invio per confermare)">${src}`;
}

function misDropRigheVuote(key){
  const q=S.qty[key]; if(!q||!q.misurazioni) return;
  q.misurazioni=q.misurazioni.filter(m=>(m.descrizione||'').trim()||m.l1!=null||m.l2!=null||m.h!=null||m.n!=null);
  if(!q.misurazioni.length) delete q.misurazioni;
  else q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  if(!(q.qty>0) && !(q.misurazioni&&q.misurazioni.length)) delete S.qty[key];
}

function misKeydown(ev, key, idx, campo){
  const mod=ev.ctrlKey||ev.metaKey;
  if(ev.key==='Enter'){
    ev.preventDefault();
    ev.target.blur(); // fa scattare l'onchange (misSetCampo) prima di muovere il focus
    const q=S.qty[key], n=(q&&q.misurazioni)?q.misurazioni.length:0;
    if(idx>=n-1) misAddRiga(key);
    else {
      const panel=misPanelRowEl(key);
      const inp=panel&&panel.querySelector(`[data-mis-input="${idx+1}:${campo}"]`);
      if(inp){ inp.focus(); if(inp.select) inp.select(); }
    }
  } else if(ev.key==='Escape'){
    ev.preventDefault(); ev.stopPropagation();
    if(MIS_OPEN.has(key)) misToggle(key);
    const tr=misVoceRowEl(key);
    const btn=tr&&tr.querySelector('[data-cell="mis"] button');
    if(btn) btn.focus();
  } else if(mod && (ev.key==='d'||ev.key==='D')){
    ev.preventDefault(); ev.target.blur(); misDuplicaRiga(key, idx, campo);
  } else if(ev.altKey && (ev.key==='ArrowUp'||ev.key==='ArrowDown')){
    ev.preventDefault(); ev.target.blur(); misSpostaRiga(key, idx, ev.key==='ArrowUp'?-1:1, campo);
  } else if(mod && ev.key==='Delete'){
    ev.preventDefault(); misRemoveRiga(key, idx);
  } else if(ev.key==='ArrowDown' || ev.key==='ArrowUp'){
    if(campo==='descrizione' && !mod) return; // nel testo le frecce restano libere solo con Ctrl
    const panel=misPanelRowEl(key);
    const inp=panel&&panel.querySelector(`[data-mis-input="${idx+(ev.key==='ArrowDown'?1:-1)}:${campo}"]`);
    if(inp){ ev.preventDefault(); ev.target.blur(); inp.focus(); if(inp.select) inp.select(); }
  }
}

function misMutAddRiga(key){
  const q=S.qty[key]||{ qty:0, um:'', source:'manual' };
  q.misurazioni=q.misurazioni||[];
  q.misurazioni.push({ descrizione:'', l1:null, l2:null, h:null, n:null, quantita:0 });
  S.qty[key]=q;
  MIS_OPEN.add(key);
  return q.misurazioni.length-1;
}

function _misCampoVal(m,campo){
  const fo=m&&m.formule&&m.formule[campo];
  return fo?formulaPerSchermo(fo):(m&&m[campo]!=null?String(m[campo]).replace('.',','):'');
}
function _misCampoMostra(m,campo){ return m&&m[campo]!=null?String(+(+m[campo]).toFixed(4)).replace('.',','):''; }

// Unità di misura della voce: quella salvata con la quantità, altrimenti quella
// dell'articolo (voce composta o riga del prezzario).
export function umVoce(key){
  const q=S.qty[key]; if(q&&q.um) return q.um;
  const it=S.custom.get(key); if(it&&it.um) return it.um;
  try{ const r=rowByKey(key); return (r&&r.um)||''; }catch(e){ return ''; }
}


function misPanelHtml(key){
  if(!MIS_OPEN.has(key)) return '';
  const ek=key.replace(/'/g,"\\'"); // stessa cautela di removeFromCart: chiavi con apostrofi negli onclick
  const q=S.qty[key]||{};
  const righe=q.misurazioni||[];
  const sel=MIS_SEL.get(key)||new Set();
  const nSel=sel.size;
  const appunti=_misAppunti&&_misAppunti.righe.length;
  const extra=`${nSel?`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="event.stopPropagation();misEliminaSel('${ek}')">Elimina (${nSel})</button>`:''}`
    +`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="event.stopPropagation();misDaAltroComputo('${ek}')" title="Copia le misure di una voce da un file XPWE o da un progetto Quadra">Da altro computo…</button>`;
  // UNICA tabella delle misure della suite (shared/compositore/misure-tabella):
  // la stessa che monta il Libretto delle misure della Contabilità.
  const corpo=misureTabellaHtml({
    righe,
    um:umVoce(key),
    titolo:'Computo metrico (par.ug. × L1 × L2 × H)',
    totale:'Totale',
    selezione:sel,
    etichettaVediVoce:(k)=>etichettaVV(k),
    fmt:(n)=>fmt(n),
    extra,
    azioni:{
      set:(i,c)=>`misSetCampo('${ek}',${i},'${c}',this.value)`,
      tasti:(i,c)=>`misKeydown(event,'${ek}',${i},'${c}')`,
      incollaQui:(i)=>`misPaste(event,'${ek}',${i})`,
      fuoco:(i,c)=>`misFocusCampo(this,'${ek}',${i},'${c}')`,
      sfuoco:(i,c)=>`misBlurCampo(this,'${ek}',${i},'${c}')`,
      duplica:(i)=>`event.stopPropagation();misDuplicaRiga('${ek}',${i})`,
      elimina:(i)=>`misRemoveRiga('${ek}',${i})`,
      aggiungi:`misAddRiga('${ek}')`,
      copia:`event.stopPropagation();misCopia('${ek}')`,
      incolla:`event.stopPropagation();misIncolla('${ek}')`,
      vediVoce:(i)=>`event.stopPropagation();misVediVoceApri(this,'${ek}',${i})`,
      seleziona:(i)=>`event.stopPropagation();misSelToggle('${ek}',${i},event)`,
      trascina:{
        inizio:(i)=>`misDragStart(event,'${ek}',${i})`,
        fine:'misDragEnd()',
        sopra:'misDragOver(event,this)',
        esce:'misDragLeave(this)',
        rilascia:(i)=>`misDrop(event,'${ek}',${i},this)`,
      },
    },
  });
  void appunti;
  // riga di dettaglio della griglia condivisa: a tutta larghezza, qualunque sia la fase
  return rigaDettaglioHtml(FASE_PROGETTO,{ classe:'mis-panel-row', attributi:`data-mis-key="${esc(key)}"`, contenuto:corpo });
}

function etichettaVV(k){ const v=_misVoci().find(x=>x.key===k); return v?`vedi voce n. ${v.n} — ${v.codice}`:'vedi voce (non più nel computo)'; }

function misPanelRowEl(key){
  for(const el of document.querySelectorAll('.mis-panel-row')) if(el.dataset.misKey===key) return el;
  return null;
}

function misPatchDom(key){
  const q=S.qty[key]||{};
  const righe=q.misurazioni||[];
  const panel=misPanelRowEl(key);
  if(panel){
    panel.querySelectorAll('[data-mis-qt]').forEach((cell,i)=>{ if(righe[i]){ cell.textContent=fmt(righe[i].quantita||0); cell.style.color=(righe[i].quantita||0)<0?'var(--danger)':''; } });
    const tot=panel.querySelector('[data-mis-tot]');
    if(tot) tot.textContent=fmt(window.sommaMisurazioni?window.sommaMisurazioni(righe):0);
  }
  const tr=misVoceRowEl(key);
  if(tr){
    const custom=S.custom.get(key);
    const qtyCell=tr.querySelector('[data-cell="qty"]');
    // il campo della quantità non si riscrive mai sotto il cursore; il resto sì
    // (la cella passa da campo a «misurata» quando arriva la prima misura)
    if(qtyCell && !qtyCell.contains(document.activeElement)) qtyCell.innerHTML=cartQtyCellHtml(key);
    const impCell=tr.querySelector('[data-cell="imp"]');
    if(impCell){
      const prezzo=custom?(custom.prezzo||0):((cartRows().get(key)||{}).prezzo||0);
      impCell.innerHTML=cartImpCellHtml(prezzo,q);
    }
    const misWrap=tr.querySelector('[data-cell="mis"]');
    if(misWrap) misWrap.innerHTML=misToggleBtn(key);
  }
  cartPatchTotals();
}

function misRemoveRiga(key, idx){
  const q=S.qty[key]; if(!q||!q.misurazioni) return;
  q.misurazioni.splice(idx,1);
  q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  if(!q.misurazioni.length) delete q.misurazioni;
  if(!(q.qty>0) && !(q.misurazioni&&q.misurazioni.length)) delete S.qty[key];
  MIS_SEL.delete(key);
  misRerenderPanel(key); misDopoModifica(key);
}

function misRerenderPanel(key, focusSel){
  if(!document.getElementById('cart-ov-tbody')){ refreshCartOverlayIfOpen(); return; }
  const old=misPanelRowEl(key);
  const html=misPanelHtml(key);
  if(old){ if(html) old.outerHTML=html; else old.remove(); }
  else if(html){
    const tr=misVoceRowEl(key);
    if(!tr){ refreshCartOverlayIfOpen(); return; }
    tr.insertAdjacentHTML('afterend', html);
  }
  misPatchDom(key);
  if(focusSel){
    const panel=misPanelRowEl(key);
    const inp=panel&&panel.querySelector(focusSel);
    if(inp){ inp.focus(); if(inp.select) inp.select(); }
  }
}

function misSetCampo(key, idx, campo, value){
  const q=S.qty[key]; if(!q||!q.misurazioni||!q.misurazioni[idx]) return;
  const riga=q.misurazioni[idx];
  if(campo==='descrizione') riga.descrizione=value;
  else {
    const esito=impostaCampo(riga, campo, value);
    if(esito.errore){ window.toast?.(`«${value}» non è un numero né una formula valida`,'warn'); misRerenderPanel(key); return; }
  }
  q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  misPatchDom(key);               // patch mirato: niente rebuild, il focus resta dov'è
  misDopoModifica(key);
}

// Nel campo si vede il RISULTATO; entrando si vede (e si corregge) la FORMULA.
function misFocusCampo(el,key,idx,campo){
  const m=((S.qty[key]||{}).misurazioni||[])[idx];
  const v=_misCampoVal(m,campo);
  if(el.value!==v) el.value=v;
  el.dataset.orig=v;
  el.select();
}
function misBlurCampo(el,key,idx,campo){
  const m=((S.qty[key]||{}).misurazioni||[])[idx];
  if(el.value===el.dataset.orig || el.value===_misCampoVal(m,campo)) el.value=_misCampoMostra(m,campo);
}

// Dopo ogni modifica: «vedi voce» aggiornati e righe ridisegnate dove serve.
function misDopoModifica(key){
  const cambiate=risolviVediVoce(S.qty);
  misPatchDom(key);
  for(const k of cambiate) if(k!==key){ if(MIS_OPEN.has(k)) misRerenderPanel(k); else misPatchDom(k); }
  updateCartInfo();
}

// ── Strumenti sulle righe ──────────────────────────────────────────────────
const MIS_SEL=new Map();      // key → Set di indici selezionati
let _misUltimaSel=null;
let _misAppunti=null;         // { righe } copiate (anche fra voci diverse)

function misSelToggle(key,idx,ev){
  const s=MIS_SEL.get(key)||new Set();
  if(ev&&ev.shiftKey&&_misUltimaSel&&_misUltimaSel.key===key){
    const [a,b]=[Math.min(_misUltimaSel.idx,idx),Math.max(_misUltimaSel.idx,idx)];
    for(let i=a;i<=b;i++) s.add(i);
  } else if(s.has(idx)) s.delete(idx); else s.add(idx);
  _misUltimaSel={ key, idx };
  MIS_SEL.set(key,s); misRerenderPanel(key);
}
function _misSelezionate(key){
  const righe=((S.qty[key]||{}).misurazioni)||[];
  const s=MIS_SEL.get(key);
  return s&&s.size?[...s].sort((a,b)=>a-b).map(i=>righe[i]).filter(Boolean):righe;
}
function misCopia(key){
  const righe=copiaRighe(_misSelezionate(key)).map(r=>{ const x={...r}; delete x.vediVoce; return x; });
  if(!righe.length){ window.toast?.('Nessuna riga da copiare','warn'); return; }
  _misAppunti={ righe };
  try{ navigator.clipboard&&navigator.clipboard.writeText(misureATesto(righe)); }catch(e){}
  window.toast?.(`${righe.length} rig${righe.length===1?'a copiata':'he copiate'}: «Incolla» in un'altra voce o in Excel`,'ok');
  for(const k of MIS_OPEN) misRerenderPanel(k);
}
function _misInserisci(key, righe, dopoIdx){
  if(!righe.length) return;
  const q=S.qty[key]||{ qty:0, um:'', source:'manual' };
  q.misurazioni=q.misurazioni||[];
  // la riga vuota appena creata e lasciata vuota viene sostituita
  const vuota=m=>!(m.descrizione||'').trim()&&m.l1==null&&m.l2==null&&m.h==null&&m.n==null;
  let at=dopoIdx==null?q.misurazioni.length:dopoIdx+1;
  if(dopoIdx!=null&&q.misurazioni[dopoIdx]&&vuota(q.misurazioni[dopoIdx])){ q.misurazioni.splice(dopoIdx,1); at=dopoIdx; }
  else if(dopoIdx==null) q.misurazioni=q.misurazioni.filter(m=>!vuota(m)), at=q.misurazioni.length;
  q.misurazioni.splice(at,0,...copiaRighe(righe));
  q.qty=window.sommaMisurazioni(q.misurazioni); q.source='manual';
  S.qty[key]=q; MIS_OPEN.add(key); MIS_SEL.delete(key);
  misRerenderPanel(key); misDopoModifica(key);
}
async function misIncolla(key){
  let righe=_misAppunti?copiaRighe(_misAppunti.righe):[];
  if(!righe.length){
    try{ righe=testoAMisure(await navigator.clipboard.readText()); }catch(e){ righe=[]; }
  }
  if(!righe.length){ window.toast?.('Niente da incollare: copia prima delle righe (anche da Excel)','warn'); return; }
  _misInserisci(key, righe, null);
  window.toast?.(`${righe.length} rig${righe.length===1?'a incollata':'he incollate'}`,'ok');
}
// Incolla da Excel direttamente in un campo: più righe o più colonne → righe di misura.
function misPaste(ev,key,idx){
  const t=(ev.clipboardData||window.clipboardData)?.getData('text')||'';
  if(!/[\t\n]/.test(t.trim())) return; // un valore solo: incolla normale nel campo
  const righe=testoAMisure(t);
  if(!righe.length) return;
  ev.preventDefault();
  _misInserisci(key, righe, idx);
  window.toast?.(`${righe.length} rig${righe.length===1?'a incollata':'he incollate'} da appunti`,'ok');
}
function misEliminaSel(key){
  const q=S.qty[key]; const s=MIS_SEL.get(key); if(!q||!q.misurazioni||!s||!s.size) return;
  q.misurazioni=q.misurazioni.filter((_,i)=>!s.has(i));
  MIS_SEL.delete(key);
  _misRicalcola(key); if(!q.misurazioni) q.qty=0;
  misRerenderPanel(key); misDopoModifica(key);
}
function misDuplicaRiga(key,idx,campo){
  const q=S.qty[key]; if(!q||!q.misurazioni||!q.misurazioni[idx]) return;
  q.misurazioni.splice(idx+1,0,copiaRighe([q.misurazioni[idx]])[0]);
  q.qty=window.sommaMisurazioni(q.misurazioni); MIS_SEL.delete(key);
  misRerenderPanel(key, `[data-mis-input="${idx+1}:${campo||'descrizione'}"]`); misDopoModifica(key);
}
function misSpostaRiga(key,idx,delta,campo){
  const q=S.qty[key]; if(!q||!q.misurazioni) return;
  const j=spostaRiga(q.misurazioni, idx, delta); if(j===idx) return;
  MIS_SEL.delete(key);
  misRerenderPanel(key, `[data-mis-input="${j}:${campo||'descrizione'}"]`); updateCartInfo();
}

// ── VEDI VOCE ──────────────────────────────────────────────────────────────
function _misVoci(){
  try{
    const perChiave=new Map(collectExportRows().map(r=>[r._key||rowKey(r), r]));
    // numerazione = ordine a schermo (lo stesso della stampa)
    const ordine=typeof window.chiaviOrdinate==='function'?window.chiaviOrdinate().filter(k=>perChiave.has(k)):[...perChiave.keys()];
    for(const k of perChiave.keys()) if(!ordine.includes(k)) ordine.push(k);
    return ordine.map((k,i)=>{ const r=perChiave.get(k); return { key:k, n:i+1, codice:r.codice||'', desc:r.desc_short||r.declaratoria||'', qty:((S.qty[k]||{}).qty)||0, um:r.um||'' }; });
  } catch(e){ return []; }
}
function misVediVoceChiudi(){ document.getElementById('mis-vv-pop')?.remove(); }
function misVediVoceApri(btn,key,idx){
  misVediVoceChiudi();
  const m=((S.qty[key]||{}).misurazioni||[])[idx]; if(!m) return;
  const voci=_misVoci().filter(v=>v.key!==key);
  const ek=key.replace(/'/g,"\\'");
  const pop=document.createElement('div');
  pop.id='mis-vv-pop';
  const r=btn.getBoundingClientRect();
  pop.style.cssText=`position:fixed;z-index:9999;top:${Math.min(r.bottom+4,window.innerHeight-330)}px;left:${Math.max(8,r.right-420)}px;width:420px;max-height:320px;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:11px`;
  const lista=(f)=>voci.filter(v=>!f||(v.codice+' '+v.desc+' '+v.n).toLowerCase().includes(f.toLowerCase())).slice(0,200).map(v=>
    `<div class="mis-vv-item" onclick="misVediVoceScegli('${ek}',${idx},'${v.key.replace(/'/g,"\\'")}')" style="padding:4px 8px;cursor:pointer;display:flex;gap:6px;border-bottom:1px solid var(--border)${m.vediVoce===v.key?';background:var(--surface2);font-weight:600':''}">
      <span style="color:var(--text3);min-width:26px">${v.n}</span><span style="font-family:var(--mono);min-width:90px">${esc(v.codice)}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.desc)}</span><span style="font-family:var(--mono)">${fmt(v.qty)} ${esc(v.um)}</span></div>`).join('')||'<div style="padding:8px;color:var(--text3)">Nessuna voce</div>';
  pop.innerHTML=`<div style="padding:6px 8px;display:flex;gap:6px;align-items:center;border-bottom:1px solid var(--border)"><b style="white-space:nowrap">Vedi voce</b>
      <input id="mis-vv-q" type="text" placeholder="cerca n., codice o descrizione…" style="flex:1;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)">
      ${m.vediVoce?`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="misVediVoceScegli('${ek}',${idx},'')">Togli</button>`:''}
      <button class="ehb-icon-btn" onclick="misVediVoceChiudi()" title="Chiudi">✕</button></div>
    <div id="mis-vv-list" style="overflow:auto">${lista('')}</div>`;
  pop.addEventListener('click',e=>e.stopPropagation());
  document.body.appendChild(pop);
  const q=pop.querySelector('#mis-vv-q');
  q.addEventListener('input',()=>{ pop.querySelector('#mis-vv-list').innerHTML=lista(q.value); });
  q.addEventListener('keydown',e=>{ if(e.key==='Escape') misVediVoceChiudi(); if(e.key==='Enter'){ const it=pop.querySelector('.mis-vv-item'); if(it) it.click(); } });
  q.focus();
  setTimeout(()=>document.addEventListener('click',misVediVoceChiudi,{ once:true }),0);
}
function misVediVoceScegli(key,idx,rif){
  misVediVoceChiudi();
  const q=S.qty[key]; const m=q&&q.misurazioni&&q.misurazioni[idx]; if(!m) return;
  if(rif){ m.vediVoce=rif; if(m.formule){ delete m.formule.l1; if(!Object.keys(m.formule).length) delete m.formule; } }
  else { delete m.vediVoce; }
  risolviVediVoce(S.qty);
  q.qty=window.sommaMisurazioni(q.misurazioni);
  misRerenderPanel(key); misDopoModifica(key);
}

// ── MISURE DA UN ALTRO COMPUTO (XPWE o progetto Quadra) ───────────
function misDaAltroComputo(key){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.xpwe,.quadra,.ehub,.xml,.json';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    let voci;
    try{ voci=vociConMisure(await f.text(), xml=>xpweToVoci(parseXpwe(xml))); }
    catch(e){ window.toast?.('File non leggibile: '+((e&&e.message)||e),'warn'); return; }
    if(!voci.length){ window.toast?.('Nel file non ci sono voci con righe di misura','warn'); return; }
    _misSceltaVoce(key, f.name, voci);
  };
  inp.click();
}
function _misSceltaVoce(key, nome, voci){
  document.getElementById('mis-altro-ov')?.remove();
  const ov=document.createElement('div');
  ov.id='mis-altro-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
  const codiceQui=((S.custom.get(key)||cartRows().get(key)||{}).codice||'').trim();
  const lista=(f)=>voci.map((v,i)=>({ v,i })).filter(({v})=>!f||(v.codice+' '+v.descrizione).toLowerCase().includes(f.toLowerCase())).map(({v,i})=>
    `<label style="display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid var(--border);cursor:pointer;align-items:flex-start${codiceQui&&v.codice.trim()===codiceQui?';background:var(--surface2)':''}">
      <input type="checkbox" data-i="${i}" style="margin-top:2px"><span style="font-family:var(--mono);min-width:100px">${esc(v.codice)}</span>
      <span style="flex:1">${esc(v.descrizione.slice(0,140))}<br><span style="color:var(--text3)">${v.misurazioni.length} righe · ${fmt(v.qty)} ${esc(v.um)}${codiceQui&&v.codice.trim()===codiceQui?' · stesso codice':''}</span></span></label>`).join('');
  ov.innerHTML=`<div style="background:var(--surface);color:var(--text);border-radius:10px;width:min(720px,94vw);max-height:80vh;display:flex;flex-direction:column;font-size:11.5px;box-shadow:0 12px 32px rgba(0,0,0,.25)">
    <div style="padding:10px 12px;border-bottom:1px solid var(--border)"><b>Copia misure da «${esc(nome)}»</b><div style="color:var(--text3);margin-top:2px">Spunta una o più voci: le loro righe di misura si aggiungono in fondo a questa voce.</div>
      <input id="mis-altro-q" type="text" placeholder="cerca codice o descrizione…" style="margin-top:6px;width:100%;font-size:11.5px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)"></div>
    <div id="mis-altro-list" style="overflow:auto;flex:1">${lista(codiceQui)}</div>
    <div style="padding:8px 12px;display:flex;justify-content:flex-end;gap:6px;border-top:1px solid var(--border)">
      <button class="ehb-btn ehb-btn--ghost" id="mis-altro-annulla">Annulla</button><button class="ehb-btn" id="mis-altro-ok">Copia le misure</button></div></div>`;
  document.body.appendChild(ov);
  const q=ov.querySelector('#mis-altro-q'); q.value=codiceQui;
  q.addEventListener('input',()=>{ ov.querySelector('#mis-altro-list').innerHTML=lista(q.value); });
  const chiudi=()=>ov.remove();
  ov.querySelector('#mis-altro-annulla').onclick=chiudi;
  ov.addEventListener('click',e=>{ if(e.target===ov) chiudi(); });
  ov.querySelector('#mis-altro-ok').onclick=()=>{
    const scelte=[...ov.querySelectorAll('input[type=checkbox]:checked')].map(c=>voci[+c.dataset.i]);
    if(!scelte.length){ window.toast?.('Spunta almeno una voce','warn'); return; }
    const righe=scelte.flatMap(v=>v.misurazioni);
    chiudi();
    _misInserisci(key, righe, null);
    window.toast?.(`${righe.length} righe di misura copiate da ${scelte.length} voc${scelte.length===1?'e':'i'}`,'ok');
  };
  q.focus();
}

function misToggle(key){
  if(MIS_OPEN.has(key)){
    MIS_OPEN.delete(key);
    misDropRigheVuote(key); // la riga auto-creata lasciata vuota non deve restare
    misRerenderPanel(key);
    updateCartInfo();
  } else {
    MIS_OPEN.add(key);
    const q=S.qty[key];
    if(!(q&&q.misurazioni&&q.misurazioni.length)){
      // pannello pronto da compilare al primo clic: prima riga già creata e a fuoco
      misMutAddRiga(key);
      misRerenderPanel(key, '[data-mis-input="0:descrizione"]');
      updateCartInfo();
    } else {
      // righe già presenti: focus sull'ultima, pronti a continuare/correggere
      misRerenderPanel(key, `[data-mis-input="${q.misurazioni.length-1}:descrizione"]`);
    }
  }
}

function misToggleBtn(key){
  const open=MIS_OPEN.has(key);
  const q=S.qty[key];
  const n=(q&&q.misurazioni)?q.misurazioni.length:0;
  const ek=key.replace(/'/g,"\\'");
  const label=n>0?`Misure (${n})`:'Misure';
  return `<button onclick="event.stopPropagation();misToggle('${ek}')" title="${open?'Chiudi':'Apri'} il computo metrico (righe di misura L1×L2×H×N)"
    style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent-text);display:inline-flex;align-items:center;gap:3px;padding:2px 0;margin-top:3px;font-weight:600">
    <span style="display:inline-block;transition:transform .15s;transform:rotate(${open?'90':'0'}deg)">▸</span>${label}
  </button>`;
}

function misVoceRowEl(key){
  const tbody=document.getElementById('cart-ov-tbody'); if(!tbody) return null;
  for(const el of tbody.querySelectorAll('tr.cm-sel-row')) if(el.dataset.key===key) return el;
  return null;
}

// ── TRASCINAMENTO delle righe di misura: riordino nella voce o spostamento su
// un'altra voce (lasciandola sulla riga della voce o fra le sue misure). ──
let _misDrag=null;
function misDragAttivo(){ return !!_misDrag; }
function misDragStart(ev,key,idx){
  ev.stopPropagation();
  _misDrag={ key, idx };
  try{ ev.dataTransfer.setData('text/misura', key+'#'+idx); ev.dataTransfer.effectAllowed='move'; }catch(e){}
}
function misDragEnd(){
  _misDrag=null;
  document.querySelectorAll('.mis-riga.cm-drop-before,.mis-riga.cm-drop-after').forEach(el=>el.classList.remove('cm-drop-before','cm-drop-after'));
}
function _misDopo(ev,el){ const r=el.getBoundingClientRect(); return ev.clientY>r.top+r.height/2; }
function misDragOver(ev,el){
  if(!_misDrag) return;
  ev.preventDefault(); ev.stopPropagation();
  const d=_misDopo(ev,el);
  el.classList.toggle('cm-drop-after',d); el.classList.toggle('cm-drop-before',!d);
}
function misDragLeave(el){ el.classList.remove('cm-drop-before','cm-drop-after'); }
function _misRicalcola(key){
  const q=S.qty[key]; if(!q) return;
  if(q.misurazioni && !q.misurazioni.length) delete q.misurazioni;
  if(q.misurazioni) q.qty=window.sommaMisurazioni?window.sommaMisurazioni(q.misurazioni):q.qty;
  else q.qty=0;
}
function _misSposta(da, aKey, aIdx, dopo){
  const qs=S.qty[da.key]; if(!qs||!qs.misurazioni||!qs.misurazioni[da.idx]) return false;
  const qd=S.qty[aKey]||{ qty:0, um:qs.um||'', source:'manual' };
  const listaD=(aKey===da.key)?qs.misurazioni:(qd.misurazioni||[]);
  const r=spostaElemento(qs.misurazioni, da.idx, listaD, aIdx, dopo);
  qs.misurazioni=r.sorgente; qd.misurazioni=r.destinazione; S.qty[aKey]=qd;
  _misRicalcola(da.key); if(aKey!==da.key) _misRicalcola(aKey);
  MIS_OPEN.add(aKey);
  return true;
}
function misDrop(ev,key,idx,el){
  if(!_misDrag) return;
  ev.preventDefault(); ev.stopPropagation();
  const da=_misDrag, dopo=_misDopo(ev,el); misDragEnd();
  if(da.key===key && da.idx===idx) return;
  if(_misSposta(da, key, idx, dopo)){ _misAvviso(da.key,key); refreshCartOverlayIfOpen(); updateCartInfo(); }
}
// rilascio sulla riga di una voce: la misura va in fondo alle sue
function misDropSuVoce(ev,key){
  if(!_misDrag) return;
  ev.preventDefault(); ev.stopPropagation();
  const da=_misDrag; misDragEnd();
  if(da.key===key) return;
  const n=((S.qty[key]||{}).misurazioni||[]).length;
  if(_misSposta(da, key, n, false)){ _misAvviso(da.key,key); refreshCartOverlayIfOpen(); updateCartInfo(); }
}
function _misAvviso(daKey,aKey){
  if(daKey===aKey) return;
  const um=k=>((S.custom.get(k)||cartRows().get(k)||{}).um||'').trim().toLowerCase();
  const u1=um(daKey), u2=um(aKey);
  window.toast?.(u1&&u2&&u1!==u2?`Misura spostata: attenzione, unità di misura diverse (${u1} → ${u2})`:'Misura spostata sull\'altra voce', u1&&u2&&u1!==u2?'warn':'ok');
}

export {
  misFocusCampo, misBlurCampo, misDopoModifica, misSelToggle, misCopia, misIncolla, misPaste, misEliminaSel, misDuplicaRiga, misSpostaRiga,
  misVediVoceApri, misVediVoceChiudi, misVediVoceScegli, misDaAltroComputo, vociCheRichiamano,
  misAddRiga, misCell, misDragAttivo, misDragEnd, misDragLeave, misDragOver, misDragStart, misDrop, misDropSuVoce, misDropRigheVuote, misKeydown, misMutAddRiga, misPanelHtml, misPanelRowEl, misPatchDom,
  misRemoveRiga, misRerenderPanel, misSetCampo, misToggle, misToggleBtn, misVoceRowEl
}
