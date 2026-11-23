/* Computo legacy — ORDINE delle voci di computo a schermo e in stampa.

   Tre modi (S.ordinamento): 'manuale', 'categorie' (Super › Cat › Sub), 'wbs'.
   L'ordine manuale (S.ordine) si cambia trascinando la maniglia ⠿ di una voce, o
   con i pulsanti ↑ ↓ sulla selezione. Nella vista per categorie (o per WBS),
   lasciando una voce dentro un altro gruppo la voce ne prende la categoria (o la
   WBS): spostare = riassegnare. Le regole pure stanno in
   src/shared/ordine-computo.ts (testate). */
import { ordinaVoci, scorriVoci, spostaVoci, titoliGruppo } from '../../../shared/ordine-computo'
import { FASE_PROGETTO, rigaGruppoHtml } from '../../../shared/griglia'
import { CART_SEL, CAT_SEP, S } from './stato.js'
import { cartRows } from './computo.js'
import { esc, misDragAttivo, misDropSuVoce, toast } from './index.js'
import { MIS_OPEN, refreshCartOverlayIfOpen } from './computo-overlay.js'

export const ETICHETTE_ORDINE = { manuale:'Manuale', categorie:'Categorie', wbs:'WBS' };

export function modoOrdine(){ return ETICHETTE_ORDINE[S.ordinamento] ? S.ordinamento : 'categorie'; }

/** Tutte le chiavi del computo (voci reali + voci dell'elenco prezzi di progetto). */
export function chiaviComputo(map){
  return [...(map||cartRows()).keys(), ...S.custom.keys()];
}

/** Le chiavi nell'ordine a schermo (lo stesso usato da stampa ed export). */
export function chiaviOrdinate(map, modo){
  const m=map||cartRows();
  const k=ordinaVoci(chiaviComputo(m), modo||modoOrdine(), { ordine:S.ordine, categoria:S.categoria, wbs:S.wbs, ordineLivelli:S.ordineCat });
  // sezioni come nella stampa: lavori a misura, lavori a corpo, oneri della sicurezza (in fondo)
  if(typeof window.miuESicurezza!=='function') return k;
  const sic=new Set(k.filter(x=>window.miuESicurezza(x, m.get(x))));
  const corpo=new Set(k.filter(x=>!sic.has(x) && (S.corpo||{})[x]));
  if(!sic.size && !corpo.size) return k;
  return [...k.filter(x=>!sic.has(x)&&!corpo.has(x)), ...k.filter(x=>corpo.has(x)), ...k.filter(x=>sic.has(x))];
}

/** Titoli di gruppo (livelli) di una voce nel modo corrente. */
export function titoliVoce(k, modo){
  return titoliGruppo(modo||modoOrdine(), S.categoria[k], S.wbs[k], S.wbsNodi||{});
}

/** Righe d'intestazione dei gruppi che cambiano fra la voce precedente e questa. */
export function intestazioniGruppo(prec, cur){
  let html='';
  cur.forEach((t,lv)=>{
    if(prec[lv]===t && cur.slice(0,lv).join('|')===prec.slice(0,lv).join('|')) return;
    const id=cur.slice(0,lv+1).join('\u0001');
    // titolo di gruppo della griglia condivisa: lo stesso del libretto e della perizia
    html+=rigaGruppoHtml(FASE_PROGETTO,{ titolo:t, livello:lv, classe:`cart-cat-head cm-grp-head cm-grp-lv${lv}`,
      attributi:`data-gruppo="${esc(id)}" ondragover="ordineDragOver(event,this)" ondragleave="ordineDragLeave(this)" ondrop="ordineDrop(event,this)"`,
      prima:'<span class="cm-drag" draggable="true" ondragstart="ordineDragStartGruppo(event,this)" title="Trascina il gruppo sopra un altro gruppo per spostarlo">⠿</span>' });
  });
  return html;
}

/** Maniglia di trascinamento di una voce (dentro la cella del codice). */
export function maniglia(k){
  return `<span class="cm-drag" draggable="true" ondragstart="ordineDragStart(event,'${String(k).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')" ondragend="ordineDragEnd()" title="Trascina per spostare la voce (con più voci selezionate si spostano tutte)">⠿</span>`;
}

export function setOrdinamento(m){
  if(!ETICHETTE_ORDINE[m]) return;
  S.ordinamento=m;
  refreshCartOverlayIfOpen();
}

export function ordinamentoSwitchHtml(){
  const m=modoOrdine();
  return `<div class="cm-view-switch cm-ordine-switch" title="Ordine delle voci a schermo e in stampa">
    <span class="cm-ordine-lbl">Ordina</span>${Object.entries(ETICHETTE_ORDINE).map(([v,l])=>
    `<button class="${m===v?'active':''}" onclick="setOrdinamento('${v}')">${l}</button>`).join('')}</div>`;
}

// ── trascinamento ────────────────────────────────────────────────────────────
let _drag=null; // { keys:[...] } oppure { gruppo:'…' }

export function ordineDragStart(ev, k){
  ev.stopPropagation();
  const keys=CART_SEL.has(k) && CART_SEL.size>1 ? chiaviOrdinate().filter(x=>CART_SEL.has(x)) : [k];
  _drag={ keys };
  try{ ev.dataTransfer.setData('text/computo-key', k); ev.dataTransfer.effectAllowed='move'; }catch(e){}
  const row=ev.target.closest('tr'); if(row) try{ ev.dataTransfer.setDragImage(row, 20, 14); }catch(e){}
}
export function ordineDragStartGruppo(ev, el){
  ev.stopPropagation();
  const tr=el.closest('tr');
  _drag={ gruppo:tr.dataset.gruppo };
  try{ ev.dataTransfer.setData('text/computo-key', 'gruppo'); ev.dataTransfer.effectAllowed='move'; }catch(e){}
}
export function ordineDragEnd(){
  _drag=null;
  document.querySelectorAll('.cm-drop-before,.cm-drop-after').forEach(el=>el.classList.remove('cm-drop-before','cm-drop-after'));
}
function _dopo(ev, el){ const r=el.getBoundingClientRect(); return ev.clientY > r.top + r.height/2; }
export function ordineDragOver(ev, el){
  if(misDragAttivo() && el.dataset.key){ ev.preventDefault(); ev.stopPropagation(); el.classList.add('cm-drop-after'); return; }
  if(!_drag || !ev.dataTransfer.types.includes('text/computo-key')) return;
  ev.preventDefault(); ev.stopPropagation();
  const dopo=_drag.gruppo ? false : _dopo(ev, el);
  el.classList.toggle('cm-drop-after', dopo);
  el.classList.toggle('cm-drop-before', !dopo);
}
export function ordineDragLeave(el){ el.classList.remove('cm-drop-before','cm-drop-after'); }

// chiavi della vista appartenenti a un gruppo (prefisso di titoli)
function _chiaviGruppo(vista, gruppo){
  const parti=gruppo.split('\u0001');
  return vista.filter(k=>{ const t=titoliVoce(k); return parti.every((p,i)=>t[i]===p); });
}

export function ordineDrop(ev, el){
  if(misDragAttivo()){ el.classList.remove('cm-drop-before','cm-drop-after'); if(el.dataset.key) misDropSuVoce(ev, el.dataset.key); return; }
  if(!_drag || !ev.dataTransfer.types.includes('text/computo-key')) return; // altri trascinamenti (voce di elenco prezzi) proseguono
  ev.preventDefault(); ev.stopPropagation();
  const drag=_drag; ordineDragEnd();
  const modo=modoOrdine();
  const vista=chiaviOrdinate(null, modo);
  const sulGruppo=el.dataset.gruppo!=null && !el.dataset.key;
  const bersaglio=sulGruppo ? _chiaviGruppo(vista, el.dataset.gruppo)[0] : el.dataset.key;
  if(!bersaglio) return;
  if(drag.gruppo){ // gruppo intero: prima del gruppo (o della voce) su cui cade
    const mosse=_chiaviGruppo(vista, drag.gruppo);
    if(mosse.includes(bersaglio)) return;
    S.ordine=spostaVoci(vista, vista, mosse, bersaglio, false);
    refreshCartOverlayIfOpen();
    return;
  }
  const mosse=drag.keys.filter(k=>k!==bersaglio);
  if(!mosse.length) return;
  const dopo=sulGruppo ? false : _dopo(ev, el);
  S.ordine=spostaVoci(vista, vista, mosse, bersaglio, dopo);
  // nella vista per gruppi, cambiare gruppo = prendere la categoria / la WBS del bersaglio
  // (su un'intestazione si entra nel gruppo, ma solo se è il livello più basso della voce)
  let riass=0;
  if(modo==='categorie' && !sulGruppo){
    const cat=S.categoria[bersaglio]||'';
    for(const k of mosse) if((S.categoria[k]||'')!==cat){ if(cat) S.categoria[k]=cat; else delete S.categoria[k]; riass++; }
    if(riass) toast(cat?`${riass===1?'Voce spostata':riass+' voci spostate'} in «${cat.split(CAT_SEP).pop()}»`:`${riass===1?'Voce tolta':riass+' voci tolte'} dalla categoria`,'ok');
  }else if(modo==='wbs' && !sulGruppo){
    const w=S.wbs[bersaglio]||'';
    for(const k of mosse) if((S.wbs[k]||'')!==w){ if(w) S.wbs[k]=w; else delete S.wbs[k]; riass++; }
    if(riass) toast(w?`${riass===1?'Voce spostata':riass+' voci spostate'} nella WBS ${w}`:`WBS tolta da ${riass===1?'una voce':riass+' voci'}`,'ok');
  }
  refreshCartOverlayIfOpen();
}

/** ↑ / ↓ sulla selezione (dentro il proprio gruppo, nelle viste per gruppi). */
export function ordineScorri(delta){
  const keys=[...CART_SEL];
  if(!keys.length){ toast('Seleziona prima una o più voci','warn'); return; }
  const vista=chiaviOrdinate();
  if(modoOrdine()==='manuale'){ S.ordine=scorriVoci(vista, keys, delta); }
  else{
    // si scambia solo con voci dello stesso gruppo: altrimenti l'ordinamento le rimetterebbe a posto
    const out=[...vista], set=new Set(keys);
    const idx=out.map((k,i)=>set.has(k)?i:-1).filter(i=>i>=0);
    if(delta>0) idx.reverse();
    for(const i of idx){
      const j=i+delta;
      if(j<0||j>=out.length||set.has(out[j])) continue;
      if(titoliVoce(out[i]).join('|')!==titoliVoce(out[j]).join('|')) continue;
      [out[i],out[j]]=[out[j],out[i]];
    }
    S.ordine=out;
  }
  refreshCartOverlayIfOpen();
}

/** Dopo aver creato una voce trascinandola dall'elenco prezzi: mettila sotto la riga su cui è caduta. */
export function ordineInserisciDopo(nuova, dopoDi){
  if(!nuova || !dopoDi) return;
  const vista=chiaviOrdinate();
  S.ordine=spostaVoci(vista, vista, [nuova], dopoDi, true);
  if(modoOrdine()==='wbs' && S.wbs[dopoDi]) S.wbs[nuova]=S.wbs[dopoDi];
}

// ── VOCI COMPRESSE: una riga per voce — codice, descrizione breve
// troncata, quantità, prezzo, importo. Si comprimono tutte insieme (pulsante in
// testata) o una alla volta (▾/▸ accanto al codice). La preferenza globale si
// ricorda; le eccezioni per singola voce valgono per la sessione. ──
const PIEGA_KEY='quadra:computo-compatto';
let _compatto=false; try{ _compatto=localStorage.getItem(PIEGA_KEY)==='1'; }catch(e){}
const _eccezioni=new Set(); // voci il cui stato è l'opposto di quello globale
export function voceCompatta(k){ return _compatto!==_eccezioni.has(k); }
export function vocePiega(k){
  if(_eccezioni.has(k)) _eccezioni.delete(k); else _eccezioni.add(k);
  const tr=document.querySelector(`#cart-ov-tbody tr.cm-sel-row[data-key="${CSS.escape(k)}"]`);
  if(tr){
    tr.classList.toggle('is-compatta', voceCompatta(k)); // voce piegata: stile della griglia condivisa
    const b=tr.querySelector('.cm-fold'); if(b) b.textContent=voceCompatta(k)?'▸':'▾';
  }
}
export function piegaTutte(){
  _compatto=!_compatto; _eccezioni.clear();
  // «Collassa tutte» chiude anche i pannelli delle misure: una riga per voce, davvero
  if(_compatto) MIS_OPEN.clear();
  try{ localStorage.setItem(PIEGA_KEY, _compatto?'1':'0'); }catch(e){}
  refreshCartOverlayIfOpen();
}
export function pieghaBtn(k){
  const ek=String(k).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button class="cm-fold" onclick="event.stopPropagation();vocePiega('${ek}')" title="Collassa / espandi questa voce">${voceCompatta(k)?'▸':'▾'}</button>`;
}
/** Vero quando le voci sono tutte piegate (una riga per voce). */
export function tuttePiegate(){ return _compatto; }
export function piegaTutteBtn(){
  return `<button class="cm-fold-all" onclick="piegaTutte()" title="${_compatto?'Mostra tutte le voci per esteso':'Una riga per voce: più voci a colpo d\'occhio'}">${_compatto?'⊞ Espandi tutte':'⊟ Collassa tutte'}</button>`;
}
