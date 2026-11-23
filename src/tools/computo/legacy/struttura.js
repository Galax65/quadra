// Computo — STRUTTURA del computo: Supercategorie › Categorie › Subcategorie e WBS.
// Finestra con albero, conteggi e importi; rinomina, elimina, sposta
// gruppi, aggiunge rami; nodi WBS con codice e descrizione; modelli di struttura
// riutilizzabili (salvati in 'hub:modelli-struttura', gestiti in Amministrazione).
// Logica pura in src/shared/struttura-computo.ts.
import { S } from './stato.js'
import {
  alberoCategorie, appiattisci, rinominaCategoria, eliminaCategoria, spostaNelLivello, alberoWbs, ricodificaWbs,
  eliminaWbs, prossimoCodiceWbs, modelloDaProgetto, applicaModello, normalizzaModelli, CHIAVE_MODELLI, partiCategoria,
} from '../../../shared/struttura-computo'
import { importoQta } from '../../../shared/importo'
import { collectExportRows, esc, fmt, refreshCartOverlayIfOpen, rowKey, updateCartInfo } from './index.js'

const LIVELLI=['Supercategoria','Categoria','Subcategoria'];
let _tab='categorie';
let _edit=null;   // { tipo:'cat'|'nuova'|'wbs-nuovo', percorso, livello }

function _dichiarate(){ if(!Array.isArray(S.catDichiarate)) S.catDichiarate=[]; return S.catDichiarate; }
// ordine DEFINITO dei nomi per livello [Super, Categoria, Sub]: vale a schermo, in stampa e nei pannelli
function _ordineCat(){ if(!Array.isArray(S.ordineCat)||S.ordineCat.length!==3) S.ordineCat=[[],[],[]]; return S.ordineCat; }
function _importi(){
  const out={};
  try{
    for(const r of collectExportRows()){
      const k=r._key||rowKey(r); const q=r._qty||S.qty[k]||{};
      out[k]=importoQta(q.qty||0, r.prezzo||0, q.um||r.um);
    }
  }catch(e){}
  return out;
}
function _chiaviComputo(){ try{ return collectExportRows().map(r=>r._key||rowKey(r)); }catch(e){ return Object.keys(S.categoria||{}); } }
function _modelli(){ try{ return normalizzaModelli(JSON.parse(localStorage.getItem(CHIAVE_MODELLI)||'[]')); }catch(e){ return []; } }
function _salvaModelli(m){ try{ localStorage.setItem(CHIAVE_MODELLI, JSON.stringify(m)); return true; }catch(e){ return false; } }
function _dopo(){ refreshCartOverlayIfOpen(); updateCartInfo(); _render(); }
const _p=a=>esc(JSON.stringify(a)).replace(/'/g,'&#39;');

export function apriStruttura(tab){
  if(tab) _tab=tab;
  _edit=null;
  document.getElementById('str-ov')?.remove();
  const ov=document.createElement('div');
  ov.id='str-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
  ov.innerHTML='<div id="str-box" style="background:var(--surface);color:var(--text);border-radius:12px;width:min(860px,95vw);height:min(82vh,760px);display:flex;flex-direction:column;box-shadow:0 14px 40px rgba(0,0,0,.28);font-size:12px"></div>';
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) chiudiStruttura(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown',_esc,true);
  _render();
}
function _esc(e){ if(e.key==='Escape' && document.getElementById('str-ov')){ if(_edit){ _edit=null; _render(); } else chiudiStruttura(); e.stopPropagation(); e.preventDefault(); } }
export function chiudiStruttura(){ document.getElementById('str-ov')?.remove(); document.removeEventListener('keydown',_esc,true); }
export function strTab(t){ _tab=t; _edit=null; _render(); }

function _render(){
  const box=document.getElementById('str-box'); if(!box) return;
  const tabBtn=(t,l)=>`<button class="ehb-btn ehb-btn--sm ${_tab===t?'':'ehb-btn--ghost'}" onclick="strTab('${t}')">${l}</button>`;
  box.innerHTML=`
    <div style="padding:12px 14px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <b style="font-size:14px">Struttura del computo</b>
      <span style="display:flex;gap:4px;margin-left:8px">${tabBtn('categorie','Categorie')}${tabBtn('wbs','WBS')}${tabBtn('modelli','Modelli')}</span>
      <span style="flex:1"></span>
      <button class="ehb-icon-btn" onclick="chiudiStruttura()" title="Chiudi (Esc)">✕</button>
    </div>
    <div style="flex:1;overflow:auto;padding:8px 14px">${_tab==='categorie'?_htmlCategorie():_tab==='wbs'?_htmlWbs():_htmlModelli()}</div>`;
  const inp=box.querySelector('[data-str-focus]'); if(inp){ inp.focus(); inp.select&&inp.select(); }
}

// ── CATEGORIE ──────────────────────────────────────────────────────────────
function _htmlCategorie(){
  const imp=_importi();
  const albero=alberoCategorie(S.categoria||{}, S.ordine||[], imp, _dichiarate(), _ordineCat());
  const nodi=appiattisci(albero);
  const senza=_chiaviComputo().filter(k=>!partiCategoria(S.categoria[k]).length).length;
  const riga=n=>{
    const p=_p(n.percorso);
    const inEdit=_edit&&_edit.tipo==='cat'&&JSON.stringify(_edit.percorso)===JSON.stringify(n.percorso);
    const nome=inEdit
      ? `<input data-str-focus value="${esc(n.nome)}" onkeydown="if(event.key==='Enter')strRinomina('${p}',this.value)" onblur="strRinomina('${p}',this.value)" style="font-size:12px;padding:2px 6px;border:1px solid var(--accent);border-radius:4px;background:var(--surface2);color:var(--text);width:60%">`
      : `<span ondblclick="strEdit('${p}')" title="Doppio clic per rinominare" style="${n.livello===0?'font-weight:700':n.livello===1?'font-weight:600':''}">${esc(n.nome)}</span>`;
    const nuovaQui=_edit&&_edit.tipo==='nuova'&&JSON.stringify(_edit.percorso)===JSON.stringify(n.percorso);
    return `<div class="str-riga" style="display:flex;align-items:center;gap:6px;padding:4px 6px 4px ${8+n.livello*22}px;border-bottom:1px solid var(--border)">
      <span style="font-size:9px;color:var(--text3);min-width:74px;text-transform:uppercase">${LIVELLI[n.livello]||''}</span>
      <span style="flex:1;min-width:0">${nome}</span>
      <span style="color:var(--text3);min-width:60px;text-align:right">${n.voci?n.voci+' voc'+(n.voci===1?'e':'i'):'vuota'}</span>
      <span style="font-family:var(--mono);min-width:96px;text-align:right">${n.voci?'€ '+fmt(n.importo):''}</span>
      <span style="display:flex;gap:2px;min-width:150px;justify-content:flex-end">
        <button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Sposta prima (ordine della struttura: vale a schermo e in stampa)" onclick="strSposta('${p}',-1)">↑</button><button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Sposta dopo" onclick="strSposta('${p}',1)">↓</button>
        <button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Rinomina (su tutte le voci)" onclick="strEdit('${p}')">✎</button>
        ${n.livello<2?`<button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Aggiungi ${LIVELLI[n.livello+1].toLowerCase()}" onclick="strNuova('${p}')">＋</button>`:''}
        <button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Elimina il ramo (le voci restano, al livello sopra)" onclick="strElimina('${p}')">✕</button>
      </span></div>${nuovaQui?_rigaNuova(n.percorso):''}`;
  };
  const nuovaRadice=_edit&&_edit.tipo==='nuova'&&!_edit.percorso.length;
  return `<p style="color:var(--text3);margin:2px 0 8px">Questo è l'<b>ordine della struttura</b>: vale a schermo (ordine «Categorie»), in stampa, nei riepiloghi e nel pannello di Categorizza. ↑ ↓ spostano un ramo fra i suoi pari, anche se non ha ancora voci.
      Rinominare un ramo lo cambia su tutte le voci; con un nome già esistente i due rami si fondono. I rami vuoti (aggiunti qui o da un modello) compaiono fra le scelte quando assegni le categorie.</p>
    ${nodi.map(riga).join('')||'<div style="color:var(--text3);padding:10px">Nessuna categoria nel computo.</div>'}
    ${nuovaRadice?_rigaNuova([]):''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="strNuova('[]')">＋ Supercategoria</button>
      <span style="color:var(--text3)">${senza?`${senza} voc${senza===1?'e':'i'} senza categoria`:'Tutte le voci hanno una categoria'}</span>
    </div>`;
}
function _rigaNuova(percorso){
  const p=_p(percorso);
  return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px 4px ${8+percorso.length*22}px">
    <span style="font-size:9px;color:var(--accent-text);min-width:74px;text-transform:uppercase">${LIVELLI[percorso.length]}</span>
    <input data-str-focus placeholder="nome…" onkeydown="if(event.key==='Enter')strCreaNuova('${p}',this.value)" onblur="strCreaNuova('${p}',this.value)" style="font-size:12px;padding:2px 6px;border:1px solid var(--accent);border-radius:4px;background:var(--surface2);color:var(--text);width:50%"></div>`;
}
export function strEdit(p){ _edit={ tipo:'cat', percorso:JSON.parse(p) }; _render(); }
export function strNuova(p){ _edit={ tipo:'nuova', percorso:JSON.parse(p) }; _render(); }
export function strRinomina(p,v){
  if(!_edit) return; _edit=null;
  const perc=JSON.parse(p);
  const nome=String(v||'').trim();
  if(!nome || nome===perc[perc.length-1]){ _render(); return; }
  const n=rinominaCategoria(S.categoria, _dichiarate(), perc, nome);
  // il nome rinominato tiene il suo posto nell'ordine della struttura
  const l=_ordineCat()[perc.length-1]; const i=l.indexOf(perc[perc.length-1]);
  if(i>=0){ if(l.includes(nome)) l.splice(i,1); else l[i]=nome; }
  window.toast?.(n?`Rinominata su ${n} voc${n===1?'e':'i'}`:'Rinominata','ok');
  _dopo();
}
export function strCreaNuova(p,v){
  if(!_edit) return; _edit=null;
  const nome=String(v||'').replace(/·/g,'-').trim();
  if(nome){ const d=_dichiarate(); const r=[...JSON.parse(p), nome].join(' · '); if(!d.includes(r)) d.push(r); updateCartInfo(); }
  _render();
}
export function strElimina(p){
  const perc=JSON.parse(p);
  const n=Object.values(S.categoria||{}).filter(c=>{ const x=partiCategoria(c); return perc.every((y,i)=>x[i]===y); }).length;
  if(n && !confirm(`Eliminare «${perc.join(' › ')}»? ${n} voc${n===1?'e':'i'} ${perc.length>1?'restano nel livello sopra':'restano senza categoria'}.`)) return;
  eliminaCategoria(S.categoria, _dichiarate(), perc);
  _dopo();
}
export function strSposta(p,delta){
  const perc=JSON.parse(p);
  const liv=perc.length-1, padre=perc.slice(0,-1);
  // i pari nell'ordine attuale dell'albero
  let nodi=alberoCategorie(S.categoria||{}, S.ordine||[], {}, _dichiarate(), _ordineCat());
  for(const nome of padre){ const n=nodi.find(x=>x.nome===nome); nodi=n?n.figli:[]; }
  const fratelli=nodi.map(n=>n.nome);
  const ord=_ordineCat();
  ord[liv]=spostaNelLivello(ord[liv]||[], fratelli, perc[liv], delta);
  if(window.setOrdinamento && S.ordinamento!=='categorie') window.setOrdinamento('categorie');
  _dopo();
}

// ── WBS ────────────────────────────────────────────────────────────────────
function _htmlWbs(){
  const nodi=alberoWbs(S.wbs||{}, S.wbsNodi||{}, _importi());
  const senza=_chiaviComputo().filter(k=>!(S.wbs[k]||'').trim()).length;
  const riga=n=>`<div class="str-riga" style="display:flex;align-items:center;gap:6px;padding:3px 6px 3px ${8+n.livello*22}px;border-bottom:1px solid var(--border)">
      <input value="${esc(n.codice)}" title="Codice: cambiandolo cambia anche nei figli e nelle voci" onchange="strWbsCodice('${esc(n.codice)}',this.value)" style="font-family:var(--mono);font-size:11.5px;width:${70+n.livello*14}px;padding:2px 5px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text);${n.livello===0?'font-weight:700':''}">
      <input value="${esc(n.descrizione)}" placeholder="${n.implicito?'(nodo senza descrizione)':'descrizione…'}" onchange="strWbsDescr('${esc(n.codice)}',this.value)" style="flex:1;font-size:12px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text);${n.livello===0?'font-weight:700':''}">
      <span style="color:var(--text3);min-width:60px;text-align:right">${n.voci?n.voci+' voc'+(n.voci===1?'e':'i'):'vuoto'}</span>
      <span style="font-family:var(--mono);min-width:96px;text-align:right">${n.voci?'€ '+fmt(n.importo):''}</span>
      <button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Aggiungi un nodo figlio" onclick="strWbsNuovo('${esc(n.codice)}')">＋</button>
      <button class="ehb-icon-btn" style="width:22px;height:22px;min-width:0;padding:0" title="Elimina il nodo e i figli (le voci restano senza WBS)" onclick="strWbsElimina('${esc(n.codice)}')">✕</button>
    </div>`;
  return `<p style="color:var(--text3);margin:2px 0 8px">Codici gerarchici a punti (01, 01.02, 01.02.03). Cambiare un codice lo cambia nei figli e in tutte le voci;
      gli importi dei nodi comprendono i figli. Le voci si assegnano dal chip WBS di ogni voce (o «WBS…» sulle selezionate).</p>
    ${nodi.map(riga).join('')||'<div style="color:var(--text3);padding:10px">Nessun nodo WBS.</div>'}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="strWbsNuovo('')">＋ Nodo principale</button>
      <span style="color:var(--text3)">${senza?`${senza} voc${senza===1?'e':'i'} senza WBS`:'Tutte le voci hanno una WBS'}</span>
    </div>`;
}
export function strWbsCodice(da,a){
  const r=ricodificaWbs(S.wbs, S.wbsNodi, da, String(a||''));
  if(r.errore){ window.toast?.(r.errore,'warn'); _render(); return; }
  if(r.voci) window.toast?.(`Codice cambiato su ${r.voci} voc${r.voci===1?'e':'i'}`,'ok');
  _dopo();
}
export function strWbsDescr(c,v){ S.wbsNodi[c]=String(v||'').trim(); refreshCartOverlayIfOpen(); updateCartInfo(); }
export function strWbsNuovo(padre){
  const c=prossimoCodiceWbs(S.wbsNodi, S.wbs, padre);
  S.wbsNodi[c]='';
  _render();
  const el=[...document.querySelectorAll('#str-box input')].find(i=>i.value===c);
  const d=el&&el.nextElementSibling; if(d){ d.focus(); d.scrollIntoView({ block:'center' }); }
}
export function strWbsElimina(c){
  const n=Object.values(S.wbs||{}).filter(x=>x&&(x===c||x.startsWith(c+'.'))).length;
  if(n && !confirm(`Eliminare il nodo ${c} e i suoi figli? ${n} voc${n===1?'e restano':'i restano'} senza WBS.`)) return;
  eliminaWbs(S.wbs, S.wbsNodi, c);
  _dopo();
}

// ── MODELLI ────────────────────────────────────────────────────────────────
function _htmlModelli(){
  const mm=_modelli();
  const lista=mm.map(m=>`<div class="str-riga" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border)">
      <b style="flex:1">${esc(m.nome)}</b>
      <span style="color:var(--text3)">${m.categorie.length} rami · ${Object.keys(m.wbs).length} nodi WBS</span>
      <button class="ehb-btn ehb-btn--sm" onclick="strApplicaModello('${esc(m.id)}')">Applica a questo progetto</button>
    </div>`).join('');
  return `<p style="color:var(--text3);margin:2px 0 8px">Un modello raccoglie categorie e nodi WBS da riusare in altri progetti. Applicarlo aggiunge i rami e i nodi che mancano,
      senza toccare quelli già presenti né le voci. I modelli si rinominano, eliminano, esportano e importano in <b>Amministrazione → Modelli</b>.</p>
    <div style="display:flex;gap:6px;align-items:center;margin:8px 0 12px">
      <input id="str-nome-modello" placeholder="nome del modello (es. Strade comunali)" style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)" onkeydown="if(event.key==='Enter')strSalvaModello()">
      <button class="ehb-btn ehb-btn--sm" onclick="strSalvaModello()">Salva la struttura di questo progetto come modello</button>
    </div>
    ${lista||'<div style="color:var(--text3);padding:10px">Nessun modello salvato.</div>'}`;
}
export function strSalvaModello(){
  const inp=document.getElementById('str-nome-modello');
  const nome=(inp&&inp.value||'').trim();
  if(!nome){ window.toast?.('Dai un nome al modello','warn'); inp&&inp.focus(); return; }
  const m=modelloDaProgetto(nome, S.categoria||{}, S.ordine||[], _dichiarate(), S.wbs||{}, S.wbsNodi||{}, Date.now(), _ordineCat());
  if(!m.categorie.length && !Object.keys(m.wbs).length){ window.toast?.('Il progetto non ha ancora categorie né WBS','warn'); return; }
  const mm=_modelli().filter(x=>x.nome!==nome);
  mm.push(m);
  if(_salvaModelli(mm)) window.toast?.(`Modello «${nome}» salvato`,'ok');
  _render();
}
export function strApplicaModello(id){
  const m=_modelli().find(x=>x.id===id); if(!m) return;
  const r=applicaModello(m, _dichiarate(), S.wbsNodi);
  // l'ordine dei rami del modello diventa l'ordine della struttura (in coda ai nomi già ordinati)
  const ord=_ordineCat();
  for(const ramo of m.categorie||[]) partiCategoria(ramo).forEach((n,i)=>{ if(i<3 && !ord[i].includes(n)) ord[i].push(n); });
  window.toast?.(`Modello applicato: ${r.categorie} rami e ${r.wbs} nodi WBS aggiunti`,'ok');
  _dopo();
}

export const strutturaWindow={ apriStruttura, chiudiStruttura, strTab, strEdit, strNuova, strRinomina, strCreaNuova, strElimina, strSposta,
  strWbsCodice, strWbsDescr, strWbsNuovo, strWbsElimina, strSalvaModello, strApplicaModello };
