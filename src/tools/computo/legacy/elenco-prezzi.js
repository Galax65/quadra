/* Computo legacy — Elenco Prezzi: pannello flottante (posizione e stato persistiti) e
   trascinamento delle voci verso il computo.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { cartAllEntries, cartDuplicateKeys } from './computo.js'
import { misToggle } from './misure.js'
import { CAT_SEP, S } from './stato.js'
import { MIS_OPEN, addRowToComputo, refreshCartOverlayIfOpen, updateCartInfo } from './computo-overlay.js'
import { esc, fmt, toast } from './index.js'
import { elencoPrezziTabellaHTML } from '../../../shared/elenco-prezzi/tabella'
import { openQuickEdit } from './quick-edit.js'
import { ordineInserisciDopo } from './ordine.js'
import { render, rowKey } from './render.js'
import { articoli, variaPrezzi, confrontaConListino, applicaListino, modificaArticolo } from '../../../shared/elenco-articoli'
import { aggiornaRigheDaListino, calcolaAnalisi } from '../../../shared/compositore/analisi-prezzi'
// Raccoglie le righe nel carrello da TUTTI i prezzari caricati (anche non a video)
// ── ELENCO PREZZI del progetto ────────────────────────────────────────────────
// Aggiungere una voce di prezzario al computo NON la lega più alla ricerca: ne
// salva una COPIA indipendente in S.custom (l'Elenco Prezzi), modificabile a
// posteriori (descrizione/prezzo/U.M.) senza toccare il prezzario. Svuotare o
// cambiare la ricerca non tocca l'Elenco Prezzi. Chiave stabile 'ep:'+rowKey per
// dedup (una voce di prezzario entra una volta sola; per averla in più
// Sottocategorie si usa «Duplica»).
// `scope` = discriminante opzionale (es. un raggruppamento che deve restare distinto):
// la stessa voce di prezzario usata in due quadri resta DUE voci nell'Elenco Prezzi,
// ognuna con la sua quantità e la sua Sottocategoria. Senza scope, dedup come sempre.
export function elencoKeyOf(row, scope){ return 'ep:'+rowKey(row)+(scope?'#'+scope:''); }
export function isInElencoPrezzi(row){
  if(!row) return false;
  const base='ep:'+rowKey(row);
  if(S.custom.has(base)) return true;
  for(const k of S.custom.keys()) if(k===base || k.startsWith(base+'#')) return true; // anche le copie per-quadro
  return false;
}
export function commitRowToElencoPrezzi(row, qty, scope){
  const k=elencoKeyOf(row, scope);
  if(!S.custom.has(k)){
    S.custom.set(k, { desc_short:row.desc_short, declaratoria:row.declaratoria||row.desc_short,
      um:row.um, prezzo:(row.prezzo>0?row.prezzo:null), codice:row.codice,
      regione:row.regione, anno:row.anno, famigliaId:null, famNome:'',
      ru:(row.ru>0?row.ru:undefined),
      source:'prezzario', _ref:rowKey(row), _scope:scope||undefined });
  }
  if(qty!=null && qty>0) S.qty[k]={ qty, um:row.um||'', source:'manual' };
  return k;
}
   // dentro MISURA: come si guardano le voci
    // quale PANNELLO: misura (voci+prezzi) o categorizza (voci+database)
// Elenco unificato delle voci del computo (reali + composte), normalizzato per
// le viste Categorie/Elenco che non distinguono la provenienza.
// Pannello ELENCO PREZZI: il catalogo delle voci del progetto (composte o copiate
// dai prezzari), persistente e indipendente dalla ricerca. Ogni voce composta/copiata
// è modificabile (✎) e rimovibile (✕). Le voci legacy/import (S.sel) sono mostrate
// ma non ancora modificabili (verranno convertite in copie nel 2° giro).
/* DALL'ELENCO PREZZI AL COMPUTO — si trascina.
   L'Elenco Prezzi è il CATALOGO del progetto (ogni voce una volta sola); il Computo Metrico
   è dove quelle voci si usano, e la stessa voce ci compare quante volte serve: le prese in
   cucina e quelle in garage sono la stessa voce di listino ma DUE VOCI DI COMPUTO, perché
   vanno in sottocategorie diverse e si misurano a parte.
   Trascinare crea quindi una VOCE NUOVA — non un'altra misurazione di quella di prima — e
   non le si eredita la categoria: la nuova va categorizzata dove serve a lei.
   Se però la lasci cadere DENTRO un gruppo, la categoria di quel gruppo se la prende: è il
   modo più corto per dire «questa va qui». */
export function epDragStart(ev,key){
  try{ ev.dataTransfer.setData('text/ep-key', key); ev.dataTransfer.effectAllowed='copy'; }catch(e){}
  document.getElementById('cart-ov-body')?.classList.add('ep-drop-armed');
}
export function epDragEnd(){
  const b=document.getElementById('cart-ov-body');
  b?.classList.remove('ep-drop-armed'); b?.classList.remove('ep-drop-over');
}
export function epDropSuComputo(ev){
  ev.preventDefault();
  epDragEnd();
  let key=''; try{ key=ev.dataTransfer.getData('text/ep-key')||''; }catch(e){}
  if(!key) return;
  // DOVE l'hai lasciata: se è dentro il gruppo di una categoria, la nuova voce la eredita
  const sotto=ev.target.closest && ev.target.closest('.cm-sel-row');
  const catDelGruppo=(sotto && S.categoria[sotto.dataset.key]) || '';
  // sempre una VOCE NUOVA: senza misure (sono sue) e senza categoria (la sceglie l'utente)
  const target=cartDuplicateKeys([key], { senzaMisure:true, senzaCategoria:true, muto:true })[0];
  if(!target) return;
  if(catDelGruppo) S.categoria[target]=catDelGruppo;
  if(sotto) ordineInserisciDopo(target, sotto.dataset.key); // la nuova voce compare dove l'hai lasciata
  refreshCartOverlayIfOpen();
  if(!MIS_OPEN.has(target)) misToggle(target); // misure aperte e pronte da scrivere
  const row=document.querySelector(`#cart-ov-body .cm-sel-row[data-key="${CSS.escape(target)}"]`);
  row?.scrollIntoView({ block:'center', behavior:'smooth' });
  toast(catDelGruppo
    ? `Nuova voce di computo in «${catDelGruppo.split(CAT_SEP).pop()}»`
    : 'Nuova voce di computo — assegnale la categoria', 'ok');
}
let EP_FILTRO='';
export function elencoPrezziPanelHtml(map, opts){
  // voci reali legacy (S.sel) come prima; le voci di computo (S.custom) raggruppate per ARTICOLO
  const legacy=[...map].map(([k,r])=>({ id:k, chiavi:[k], codice:r.codice||'', desc:(r.desc_short||r.declaratoria||''), um:r.um||'', prezzo:r.prezzo||0, legacy:true, usi:(S.qty[k]&&S.qty[k].qty>0)?1:0 }));
  const arts=[...legacy, ...articoli(S.custom, S.qty)];
  const nVar=arts.filter(a=>a.variazionePct!=null).length, nNP=arts.filter(a=>a.np).length;
  const rows=arts.length ? arts.map(a=>{
    const k0=a.chiavi[0], ek=k0.replace(/'/g,"\\'");
    const cerca=esc((a.codice+' '+a.desc).toLowerCase());
    const varMark=a.variazionePct!=null
      ? `<span class="ep-var ${a.variazionePct>0?'ep-var--su':'ep-var--giu'}" title="Prezzo di listino € ${fmt(a.prezzoListino)} — variato del ${a.variazionePct>0?'+':''}${fmt(a.variazionePct)}%">${a.variazionePct>0?'▲':'▼'}${fmt(Math.abs(a.variazionePct))}%</span>` : '';
    const nascosta=EP_FILTRO&&!(a.codice+' '+a.desc).toLowerCase().includes(EP_FILTRO);
    return `<div class="ep-row" data-key="${esc(k0)}" data-cerca="${cerca}" draggable="true"${nascosta?' hidden':''}
      ondragstart="epDragStart(event,'${ek}')" ondragend="epDragEnd()"
      title="Trascinala nel computo qui sopra: crea una NUOVA voce di computo (la stessa voce di listino può comparire più volte, in sottocategorie diverse). Lasciandola dentro un gruppo, ne prende la categoria.">
      <span class="ep-code">${a.codice?esc(a.codice):'✎'}${a.np?' <span class="ep-tag">NP</span>':''}${a.analisi?' <span class="ep-tag" title="Prezzo da analisi">AP</span>':''}</span>
      <span class="ep-desc" title="${esc(a.desc)}">${esc(a.desc.slice(0,180))}</span>
      <span class="ep-um">${esc(a.um)}</span>
      <span class="ep-price">${a.prezzo>0?'€ '+fmt(a.prezzo):'—'}${varMark}</span>
      <span class="ep-actions">
        <span class="ep-usi" title="${a.chiavi.length} voc${a.chiavi.length===1?'e':'i'} di computo, ${a.usi} con quantità">×${a.chiavi.length}</span>
        ${a.legacy?`<span class="ep-locked" title="Voce di prezzario importata/legacy — riaggiungila dalla ricerca per renderla modificabile">da prezzario</span>`
                :`<button class="ep-edit" title="Modifica: descrizione, U.M., prezzo (vale per tutte le voci di computo di questo articolo)" onclick="openQuickEdit('${ek}')">✎</button>`}
        <button class="ep-del" title="Togli l'articolo dall'Elenco Prezzi (e dal computo)" onclick="elencoRemoveArticolo('${ek}')">✕</button>
      </span>
    </div>`;
  }).join('') : '<div class="ep-empty">Nessuna voce. Cerca nei prezzari e premi «＋ Aggiungi al computo», o componi una voce.</div>';
  const tools=arts.length?`<div class="ep-tools">
      <input class="ep-filtro" type="search" placeholder="⌕ filtra codice o descrizione…" value="${esc(EP_FILTRO)}" oninput="epFiltra(this.value)" onkeydown="event.stopPropagation()">
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriAggiornaPrezzi()" title="Variazione % in blocco o aggiornamento dai prezzari caricati">Aggiorna prezzi…</button>
      ${nNP?`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportElencoNP()" title="Elenco dei nuovi prezzi (PDF)">Elenco NP</button><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportVerbaleNP()" title="Verbale di concordamento dei nuovi prezzi (PDF)">Verbale NP (${nNP})</button>`:''}
    </div>${nVar?`<div class="ep-info">${nVar} articol${nVar===1?'o':'i'} con prezzo diverso dal listino (▲▼)</div>`:''}`:'';
  const rowsHtml=`${tools}<div class="ep-rows">${rows}</div>`;
  // opts.compact: solo le righe, senza l'intestazione propria — usato dentro il
  // guscio del pannello FLOTTANTE (mountEpFloat), che ha già il suo header col titolo.
  if(opts && opts.compact) return rowsHtml;
  return `<div class="ep-panel">
    <div class="ep-hd">▤ Elenco Prezzi <span class="ep-sub">— catalogo del progetto · ${arts.length} articol${arts.length===1?'o':'i'} · modificabili, indipendenti dalla ricerca</span></div>
    ${rowsHtml}
  </div>`;
}
export function epFiltra(q){
  EP_FILTRO=String(q||'').trim().toLowerCase();
  document.querySelectorAll('.ep-row[data-cerca]').forEach(el=>{ el.hidden=!!EP_FILTRO && !el.dataset.cerca.includes(EP_FILTRO); });
}
// Toglie un ARTICOLO: tutte le sue voci di computo (con conferma se qualcuna ha quantità).
export function elencoRemoveArticolo(key){
  const it=S.custom.get(key);
  if(!it){ elencoRemove(key); return; }
  const art=articoli(S.custom, S.qty).find(a=>a.chiavi.includes(key));
  const chiavi=art?art.chiavi:[key];
  if(art && art.usi && !confirm(`L'articolo ${art.codice||''} è usato in ${art.usi} voc${art.usi===1?'e':'i'} di computo con quantità: toglierlo le elimina dal computo. Procedere?`)) return;
  const undo=chiavi.map(k=>({ k, it:S.custom.get(k), q:S.qty[k], c:S.categoria[k] }));
  for(const k of chiavi){ S.custom.delete(k); delete S.qty[k]; delete S.categoria[k]; }
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
  window.ehbFeedback?.undoToast(chiavi.length>1?`Articolo tolto (${chiavi.length} voci)`:'Voce tolta dall\'Elenco Prezzi', ()=>{
    for(const u of undo){ S.custom.set(u.k,u.it); if(u.q!==undefined) S.qty[u.k]=u.q; if(u.c!==undefined) S.categoria[u.k]=u.c; }
    updateCartInfo(); refreshCartOverlayIfOpen(); render();
  });
}

// ── AGGIORNA PREZZI: variazione % in blocco o dai prezzari caricati ─────────
export function apriAggiornaPrezzi(){
  document.getElementById('ap-agg-ov')?.remove();
  const arts=articoli(S.custom, S.qty).filter(a=>!a.analisi);
  const listino=confrontaConListino(arts, S.allRows||[]);
  // analisi prezzi: righe elementari con codice di prezzario e prezzo diverso (prova su una copia)
  const anaArts=articoli(S.custom, S.qty).filter(a=>a.analisi);
  const ana=anaArts.map(a=>{ const it=S.custom.get(a.chiavi[0]); const copia=JSON.parse(JSON.stringify(it.analisiPrezzi));
    const ch=aggiornaRigheDaListino(copia, S.allRows||[]); return ch.length?{ a, ch:ch.length, da:it.prezzo, nuovo:calcolaAnalisi(copia).prezzoUnitario }:null; }).filter(Boolean);
  const ov=document.createElement('div');
  ov.id='ap-agg-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center';
  const rigaL=(c,i)=>`<tr><td><input type="checkbox" data-l="${i}" checked></td><td style="font-family:var(--mono)">${esc(c.codice)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.desc)}">${esc(c.desc)}</td>
    <td style="text-align:right;font-family:var(--mono)">${c.attuale!=null?fmt(c.attuale):'—'}</td><td style="text-align:right;font-family:var(--mono)"><b>${fmt(c.nuovo)}</b></td>
    <td style="text-align:right;font-family:var(--mono);color:${(c.diffPct||0)>0?'var(--danger)':'var(--accent-text)'}">${c.diffPct!=null?(c.diffPct>0?'+':'')+fmt(c.diffPct)+'%':''}</td><td style="color:var(--text3)">${esc([c.riga.regione,c.riga.anno].filter(Boolean).join(' '))}</td></tr>`;
  ov.innerHTML=`<div style="background:var(--surface);color:var(--text);border-radius:12px;width:min(820px,95vw);max-height:86vh;display:flex;flex-direction:column;font-size:12px;box-shadow:0 14px 40px rgba(0,0,0,.28)">
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center"><b style="font-size:14px;flex:1">Aggiorna i prezzi dell'elenco</b><button class="ehb-icon-btn" onclick="chiudiAggiornaPrezzi()">✕</button></div>
    <div style="overflow:auto;padding:12px 14px;display:grid;gap:14px">
      <section>
        <b>Variazione percentuale</b>
        <p style="color:var(--text3);margin:4px 0 8px">Aumenta o riduce i prezzi (es. 5 = +5%, −3 = −3%). Le voci con analisi prezzi si aggiornano dall'analisi.</p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input id="ap-pct" type="text" inputmode="decimal" placeholder="es. 5 o −3" style="width:90px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)">
          <select id="ap-quali" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)">
            <option value="tutti">su tutti gli articoli (${arts.length})</option>
            <option value="np">solo nuovi prezzi (${arts.filter(a=>a.np).length})</option>
            <option value="listino">solo articoli di prezzario (${arts.filter(a=>!a.np).length})</option>
            ${EP_FILTRO?`<option value="filtro">solo quelli del filtro «${esc(EP_FILTRO)}»</option>`:''}
          </select>
          <input id="ap-nota" placeholder="motivo (storico)" style="flex:1;min-width:160px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface2);color:var(--text)">
          <button class="ehb-btn ehb-btn--sm" onclick="applicaVariazionePct()">Applica</button>
        </div>
      </section>
      <section>
        <b>Dai prezzari caricati</b>
        <p style="color:var(--text3);margin:4px 0 8px">Gli articoli il cui codice c'è in un prezzario caricato (per esempio il prezzario dell'anno nuovo) e con prezzo diverso. Se un codice compare in più prezzari si usa l'anno più recente.</p>
        ${listino.length?`<table style="width:100%;border-collapse:collapse" class="ap-tab"><thead><tr style="color:var(--text3);text-align:left"><th><input type="checkbox" checked onclick="document.querySelectorAll('#ap-agg-ov [data-l]').forEach(c=>c.checked=this.checked)"></th><th>Codice</th><th>Descrizione</th><th style="text-align:right">Attuale</th><th style="text-align:right">Prezzario</th><th style="text-align:right">Diff.</th><th>Fonte</th></tr></thead>
          <tbody>${listino.map(rigaL).join('')}</tbody></table>
          <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="ehb-btn ehb-btn--sm" onclick="applicaAggiornamentoListino()">Aggiorna gli articoli spuntati</button></div>`
          :`<div style="color:var(--text3)">${(S.allRows||[]).length?'Nessuna differenza con i prezzari caricati.':'Nessun prezzario caricato: aprine uno (Cerca) per confrontare i prezzi.'}</div>`}
      </section>
      ${anaArts.length?`<section>
        <b>Analisi prezzi</b>
        <p style="color:var(--text3);margin:4px 0 8px">Le righe delle analisi pescate da un prezzario (manodopera, materiali, noli) si aggiornano ai prezzari caricati; il prezzo della voce si ricalcola con le stesse spese generali e utile.</p>
        ${ana.length?`<table style="width:100%;border-collapse:collapse"><thead><tr style="color:var(--text3);text-align:left"><th>Codice</th><th>Descrizione</th><th style="text-align:right">Righe</th><th style="text-align:right">Attuale</th><th style="text-align:right">Ricalcolato</th></tr></thead><tbody>
          ${ana.map(x=>`<tr><td style="font-family:var(--mono)">${esc(x.a.codice||'—')}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.a.desc)}</td><td style="text-align:right">${x.ch}</td><td style="text-align:right;font-family:var(--mono)">${x.da!=null?fmt(x.da):'—'}</td><td style="text-align:right;font-family:var(--mono)"><b>${fmt(x.nuovo)}</b></td></tr>`).join('')}
          </tbody></table><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="ehb-btn ehb-btn--sm" onclick="applicaAggiornamentoAnalisi()">Aggiorna le analisi</button></div>`
          :`<div style="color:var(--text3)">${(S.allRows||[]).length?'Le righe delle analisi sono già allineate ai prezzari caricati.':'Nessun prezzario caricato.'}</div>`}
      </section>`:''}
    </div></div>`;
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) chiudiAggiornaPrezzi(); });
  ov.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Escape') chiudiAggiornaPrezzi(); });
  document.body.appendChild(ov);
  ov._listino=listino;
  document.getElementById('ap-pct')?.focus();
}
export function applicaAggiornamentoAnalisi(){
  let n=0;
  for(const a of articoli(S.custom, S.qty).filter(x=>x.analisi)){
    const it=S.custom.get(a.chiavi[0]);
    const ap=JSON.parse(JSON.stringify(it.analisiPrezzi));
    if(!aggiornaRigheDaListino(ap, S.allRows||[]).length) continue;
    const prezzo=calcolaAnalisi(ap).prezzoUnitario;
    modificaArticolo(S.custom, a.chiavi[0], { prezzo, analisiPrezzi:ap }, { nota:'analisi aggiornata ai prezzari caricati' });
    n++;
  }
  chiudiAggiornaPrezzi(); updateCartInfo(); refreshCartOverlayIfOpen(); render();
  toast(n?`${n} analis${n===1?'i aggiornata':'i aggiornate'}`:'Nessuna analisi da aggiornare','ok');
}
export function chiudiAggiornaPrezzi(){ document.getElementById('ap-agg-ov')?.remove(); }
export function applicaVariazionePct(){
  const raw=(document.getElementById('ap-pct')?.value||'').replace('−','-').replace(',','.').replace('%','').trim();
  const pct=parseFloat(raw);
  if(!isFinite(pct)||pct===0){ toast('Scrivi una percentuale diversa da zero','warn'); return; }
  const quali=document.getElementById('ap-quali')?.value||'tutti';
  const arts=articoli(S.custom, S.qty).filter(a=>!a.analisi && (quali==='tutti' || (quali==='np'&&a.np) || (quali==='listino'&&!a.np) || (quali==='filtro'&&(a.codice+' '+a.desc).toLowerCase().includes(EP_FILTRO))));
  const nota=(document.getElementById('ap-nota')?.value||'').trim();
  const n=variaPrezzi(S.custom, arts.map(a=>a.id), pct, nota?{ nota:`${nota} (${pct>0?'+':''}${pct}%)` }:{});
  chiudiAggiornaPrezzi(); updateCartInfo(); refreshCartOverlayIfOpen(); render();
  toast(`Prezzi variati del ${pct>0?'+':''}${String(pct).replace('.',',')}% su ${n} articol${n===1?'o':'i'}`,'ok');
}
export function applicaAggiornamentoListino(){
  const ov=document.getElementById('ap-agg-ov'); if(!ov) return;
  const scelte=[...ov.querySelectorAll('[data-l]:checked')].map(c=>ov._listino[+c.dataset.l]).filter(Boolean);
  if(!scelte.length){ toast('Spunta almeno un articolo','warn'); return; }
  const n=applicaListino(S.custom, scelte);
  chiudiAggiornaPrezzi(); updateCartInfo(); refreshCartOverlayIfOpen(); render();
  toast(`${n} articol${n===1?'o aggiornato':'i aggiornati'} ai prezzari caricati`,'ok');
}

export function elencoRemove(key){
  const wasCustom=S.custom.has(key), _undoItem=wasCustom?S.custom.get(key):undefined;
  const _undoQty=S.qty[key], _undoCat=S.categoria[key];
  if(wasCustom) S.custom.delete(key);
  else S.sel.delete(key); // riferimento legacy/import
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  updateCartInfo(); refreshCartOverlayIfOpen(); render();
  window.ehbFeedback?.undoToast('Voce tolta dall\'Elenco Prezzi', ()=>{
    if(wasCustom) S.custom.set(key,_undoItem); else S.sel.add(key);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    updateCartInfo(); refreshCartOverlayIfOpen(); render();
  });
}

// ── Elenco Prezzi del progetto: una COLONNA a destra del Computo, come nella
// Contabilità (Docs/06-Interfaccia-unica.md §3). Non una finestra che galleggia
// sopra la tabella: sta sempre lì, il computo le lascia lo spazio (--ep-dock-w), e
// le voci passano di là trascinandole. Si chiude con ✕ e si riapre dalla barra
// («≡ Elenco prezzi»): un pannello che sparisce per sempre al primo ✕ è una trappola.
//  - sopravvive al cambio vista/modo del Computo (openCart() lo AGGIORNA,
//    non lo ricrea — vedi mountEpFloat, chiamato in coda a openCart());
//  - si allarga dal bordo (resize CSS nativo, larghezza persistita via ResizeObserver).
// Stato (larghezza/aperto) in localStorage: preferenza di chi lavora, non dato di
// progetto (non in S). Le vecchie chiavi x/y del pannello flottante si ignorano.
export const EP_FLOAT_KEY='miu:ep-float';
export function epFloatState(){
  // larga di partenza quanto basta a leggere una voce, e mai più di un terzo dello schermo
  const def={ w:Math.round(Math.min(340, (typeof window!=='undefined'?window.innerWidth:1400)*0.28)), closed:false, scheda:'progetto' };
  try{
    const st=Object.assign(def, JSON.parse(localStorage.getItem(EP_FLOAT_KEY)||'{}'));
    return { w:Number(st.w)||def.w, closed:!!st.closed, scheda:st.scheda==='prezzario'?'prezzario':'progetto' };
  }
  catch(e){ return def; }
}
export function epFloatSave(patch){
  const st=Object.assign(epFloatState(), patch);
  try{ localStorage.setItem(EP_FLOAT_KEY, JSON.stringify(st)); }catch(e){}
  return st;
}
export function epFloatHtml(map, st){
  if(st.closed) return ''; // si riapre dalla barra del Computo, non da una pillola
  const n=map.size+articoli(S.custom).length;
  const pz=st.scheda==='prezzario';
  /* DUE ELENCHI, la stessa colonna (come nella Contabilità): l'elenco prezzi
     di QUESTO progetto, e il prezzario regionale caricato da cui si pesca. */
  return `<aside class="ep-float" id="ep-float" style="width:${st.w}px" aria-label="Elenco prezzi">
    <div class="ep-float-hd">
      <div class="ep-float-ttl">${pz?'Prezzario':'Elenco prezzi del progetto'}<span>${pz?'doppio clic o ＋ per metterla nel computo':'trascina una voce nel computo'}</span></div>
      <button class="ehb-icon-btn" onclick="epFloatClose()" title="Chiudi la colonna (si riapre da «≡ Elenco prezzi» nella barra)">✕</button>
    </div>
    <div class="ep-schede" role="tablist">
      <button class="ep-scheda${pz?'':' is-on'}" role="tab" aria-selected="${!pz}" onclick="epScheda('progetto')" title="Gli articoli di questo progetto, con il loro prezzo">Progetto <span class="ep-float-cnt">${n}</span></button>
      <button class="ep-scheda${pz?' is-on':''}" role="tab" aria-selected="${pz}" onclick="epScheda('prezzario')" title="I prezzari caricati (regionali o privati): si cerca e si pesca da qui">Prezzario</button>
    </div>
    <div class="ep-float-body" id="ep-float-body">${pz?prezzarioColonnaHtml():elencoPrezziPanelHtml(map,{compact:true})}</div>
  </aside>`;
}
export function mountEpFloat(map){
  if(!document.getElementById('cart-overlay')) return; // solo mentre il Computo è aperto
  const existing=document.getElementById('ep-float-wrap');
  if(existing){ existing.innerHTML=epFloatHtml(map, epFloatState()); wireEpFloat(); epFloatDockSync(); return; }
  const wrap=document.createElement('div');
  wrap.id='ep-float-wrap';
  wrap.innerHTML=epFloatHtml(map, epFloatState());
  document.body.appendChild(wrap);
  wireEpFloat();
  epFloatDockSync();
}
// larghezza riservata alla colonna (0 se chiusa)
export function epFloatDockSync(){
  const p=document.getElementById('ep-float');
  const w=(p && document.getElementById('cart-overlay')) ? p.offsetWidth : 0;
  document.body.style.setProperty('--ep-dock-w', w+'px');
}
export function epScheda(s){ epFloatSave({ scheda:s==='prezzario'?'prezzario':'progetto', closed:false }); refreshCartOverlayIfOpen();
  if(s==='prezzario') setTimeout(()=>{ const i=document.getElementById('ep-pz-q'); if(i) i.focus(); },30); }

/* ── La scheda «Prezzario» della colonna ────────────────────────────────
   Si cerca nei prezzari caricati senza lasciare il computo: codice o parole,
   tutte. Doppio clic (o ＋) e la voce entra nel computo come quando la si
   aggiunge dalla ricerca. */
let _pzQ='', _pzT=null;
const PZ_MAX=80;
function prezzariCaricati(){ return (S.archive||[]).filter(it=>it.loaded===true && Array.isArray(it.rows)); }
export function prezzarioColonnaHtml(){
  const caricati=prezzariCaricati();
  if(!caricati.length) return `<div class="ep-empty">Nessun prezzario caricato.<br><button class="ehb-btn ehb-btn--sm" onclick="setStep('cerca')" style="margin-top:8px">Carica un prezzario…</button></div>`;
  return `<div class="ep-tools">
      <input id="ep-pz-q" class="ep-filtro" type="search" placeholder="⌕ codice o parole nel prezzario…" value="${esc(_pzQ)}" oninput="epPzCerca(this.value)" onkeydown="event.stopPropagation()">
    </div>
    <div class="ep-info">${caricati.map(it=>esc([it.regione,it.anno].filter(Boolean).join(' ')||it.filename||'prezzario')).join(' · ')}</div>
    <div class="ep-rows" id="ep-pz-righe">${prezzarioRigheHtml(_pzQ)}</div>`;
}
export function prezzarioRigheHtml(q){
  const parole=window.normSearchMiu?window.normSearchMiu(q).split(' ').filter(Boolean):String(q||'').toLowerCase().split(/\s+/).filter(Boolean);
  if(!parole.length || parole.join('').length<2) return '<div class="ep-empty">Scrivi un codice o almeno due lettere.</div>';
  const norm=window.normSearchMiu||((x)=>String(x||'').toLowerCase());
  const out=[];
  for(const it of prezzariCaricati()){
    for(const r of it.rows){
      const t=norm(`${r.codice||''} ${r.desc_short||''} ${r.declaratoria||''}`);
      if(parole.every(p=>t.includes(p))){ out.push(r); if(out.length>PZ_MAX) break; }
    }
    if(out.length>PZ_MAX) break;
  }
  if(!out.length) return '<div class="ep-empty">Nessuna voce del prezzario corrisponde.</div>';
  const righe=out.slice(0,PZ_MAX).map(r=>{
    const k=rowKey(r), ek=String(k).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const gia=isInElencoPrezzi(r);
    return `<div class="ep-row ep-row--pz${gia?' is-gia':''}" ondblclick="epPzAggiungi('${ek}')" title="${esc(r.declaratoria||r.desc_short||'')}">
      <span class="ep-code">${esc(r.codice||'')}</span>
      <span class="ep-desc">${esc(String(r.desc_short||r.declaratoria||'').slice(0,180))}</span>
      <span class="ep-um">${esc(r.um||'')}</span>
      <span class="ep-price">${r.prezzo>0?'€ '+fmt(r.prezzo):'—'}</span>
      <span class="ep-actions">${gia?'<span class="ep-usi" title="Già nell\'elenco prezzi del progetto">✓ nel computo</span>':''}<button class="ep-edit" title="Mettila nel computo" onclick="epPzAggiungi('${ek}')">＋</button></span>
    </div>`;
  }).join('');
  return righe+(out.length>PZ_MAX?`<div class="ep-info">Le prime ${PZ_MAX}: aggiungi parole per restringere.</div>`:'');
}
export function epPzCerca(q){
  _pzQ=String(q||'');
  clearTimeout(_pzT);
  _pzT=setTimeout(()=>{ const el=document.getElementById('ep-pz-righe'); if(el) el.innerHTML=prezzarioRigheHtml(_pzQ); },150);
}
// la voce entra nel computo, e il computo a fianco la mostra subito
export function epPzAggiungi(k){ addRowToComputo(k); refreshCartOverlayIfOpen(); }
export function epPzAggiorna(){ const el=document.getElementById('ep-pz-righe'); if(el) el.innerHTML=prezzarioRigheHtml(_pzQ); }

export function epFloatClose(){ epFloatSave({ closed:true }); refreshCartOverlayIfOpen(); }
export function epFloatOpen(){ epFloatSave({ closed:false }); refreshCartOverlayIfOpen(); }
export function wireEpFloat(){
  const panel=document.getElementById('ep-float');
  if(!panel) return; // colonna chiusa: niente da osservare
  // resize orizzontale nativo (CSS) — persiste la larghezza via ResizeObserver.
  // mountEpFloat rimonta il nodo (innerHTML) a ogni refresh del Computo — molto
  // spesso, non solo sui resize veri — quindi qui riparte sempre un observer NUOVO.
  // Il suo primo scatto riporta la dimensione ATTUALE del box appena osservato
  // (non un resize dell'utente): se non lo si scarta, ogni remount ri-salva la
  // dimensione corrente com'è nel momento del mount (che può essere più piccola
  // di quella salvata, per un clamp momentaneo di max-width o layout non ancora
  // assestato), rimpicciolendo il pannello da solo a ogni refresh —
  // era il bug per cui l'Elenco Prezzi «tornava sempre piccolo».
  if(window.ResizeObserver && !panel._epRo){
    let epRoFirstFire=true;
    panel._epRo=new ResizeObserver(()=>{
      if(epRoFirstFire){ epRoFirstFire=false; return; }
      epFloatDockSync();
      epFloatSave({ w:Math.round(panel.offsetWidth) });
    });
    panel._epRo.observe(panel);
  }
}

/**
 * L'AREA «Elenco prezzi» a tutta pagina usa la TABELLA CONDIVISA con la
 * Contabilità: stesse colonne, stesso ordine, stesse parole. Il pannello
 * flottante resta com'è, perché serve a un'altra cosa — trascinare una voce nel
 * computo — e non a guardare il catalogo.
 *
 * Resta ferma la distinzione che conta: il PREZZARIO (regionale o privato) è un
 * archivio del programma da cui si pesca; questo è l'elenco prezzi DI QUESTO
 * LAVORO, con i suoi prezzi e la loro provenienza.
 */
export function elencoPrezziTabella(map){
  const legacy=[...map].map(([k,r])=>({ id:k, chiavi:[k], codice:r.codice||'', desc:(r.desc_short||r.declaratoria||''), um:r.um||'', prezzo:r.prezzo||0, legacy:true, usi:(S.qty[k]&&S.qty[k].qty>0)?1:0 }));
  const arts=[...legacy, ...articoli(S.custom, S.qty)];
  const voci=arts.map((a,i)=>{
    const k0=a.chiavi[0], ek=k0.replace(/'/g,"\\'");
    const usate=a.chiavi.length;
    return {
      n:i+1, codice:a.codice, descrizione:a.desc, um:a.um, prezzo:a.prezzo>0?a.prezzo:null,
      np:!!a.np,
      scostato:a.variazionePct!=null,
      provenienza:a.legacy?'da prezzario':(a.np?'nuovo prezzo':(a.analisi?'analisi prezzi':'composta a mano')),
      usataIn: usate ? `${usate} voc${usate===1?'e':'i'} di computo${a.usi?` · ${a.usi} con quantità`:''}` : '',
      dragAttrs:`draggable="true" data-key="${esc(k0)}" ondragstart="epDragStart(event,'${ek}')" ondragend="epDragEnd()"`,
      azioni:(a.legacy?'':`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="openQuickEdit('${ek}')" title="Modifica descrizione, unità di misura e prezzo">✎</button>`)
        +`<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="elencoRemoveArticolo('${ek}')" title="Togli l'articolo dall'elenco prezzi (e dal computo)">✕</button>`,
    };
  });
  return elencoPrezziTabellaHTML(voci, {
    etichettaPrezzo:'Prezzo', etichettaNonUsata:'non computata',
    titoloScostamento:'Prezzo diverso da quello di listino',
    vuoto:"L'elenco è vuoto: pesca una voce da un prezzario (archivio del programma) o componine una a mano.",
  });
}
