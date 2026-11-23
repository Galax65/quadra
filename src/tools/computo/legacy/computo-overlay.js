/* Computo legacy — l'overlay del Computo Metrico: apertura/chiusura, righe e voci
   custom, quantità, riepilogo e pubblicazione verso gli altri tool.

   Lo stato condiviso sta in stato.js, le funzioni degli altri moduli si importano
   per nome: gli import circolari sono sicuri perché i nomi si usano solo dentro i
   corpi funzione (live-binding ESM), come già fanno computo.js e compositore.js. */
import { voceDiSicurezza } from '../../../shared/sicurezza'
import { vociConOfferta, valutaOfferte } from '../../../shared/offerte'
import { importoQta } from '../../../shared/importo'
import { categoriaChipHtml, wbsChipHtml, wbsDatalistHtml, setWbs } from './categorie.js'
import { cartBodyCapitoliHtml, cartBodyCategorieHtml, cartBodyElencoHtml, cartDuplicateKeys, cartFilterRows, cartImpCellHtml, cartMdoLineHtml, cartOpenCatPopoverForSel, cartPatchTotals, cartQtyCellHtml, cartRemoveKeys, cartRigaMDO, cartRows, cartSelClear, cartTotals, cartUpdateSelUI, cartWarn } from './computo.js'
import { misPanelHtml, misToggleBtn } from './misure.js'
import { CART_MODE, CART_QUERY, CART_SEL, CART_VIEW, S } from './stato.js'
import { closeCatPopover } from './categorie-db.js'
import { showCopyPopup } from './clipboard.js'
import { apBuildSheet, updateAPFascicoloBtn } from './dettaglio.js'
import { commitRowToElencoPrezzi, elencoKeyOf, epDropSuComputo, epFloatState, isInElencoPrezzi, mountEpFloat } from './elenco-prezzi.js'
import { _syncRail, esc, fmt, miuAutoModeForComputo, setStep, toast } from './index.js'
import { modificaArticolo } from '../../../shared/elenco-articoli'
import { alberoDelComputo } from '../../../shared/revisioni'
import { FASI_PROGETTO, NOME_FASE, allaFase, descriviContratto, faseDi, faseSuccessiva, promuoviAContratto as promuoviAContrattoPuro, vociDaRevisione } from '../../../shared/contratto'
import { FASE_PROGETTO, OPZ_ORDINE, OPZ_VISTA, TITOLI_SEZIONE, grigliaHtml, piedeFaseHtml, rigaSezioneHtml, rigaVoceHtml, testataHtml } from '../../../shared/griglia'
import { openQuickEdit } from './quick-edit.js'
import { parseNum, render, rowKey } from './render.js'
import { closeCartCtxMenu, renderSelDock, wireCartSelection } from './selezione.js'
import { chiaviOrdinate, intestazioniGruppo, maniglia, pieghaBtn, voceCompatta, modoOrdine, tuttePiegate, titoliVoce } from './ordine.js'

// ── VOCI COMPOSTE = STATO DI SESSIONE ─────────────────────────────────────────
// Le voci composte (S.custom) + quantità vivono in memoria durante la sessione e
// vengono salvate solo nei Carrelli salvati a mano e nel progetto .ehub. NON sono
// più persistite in localStorage fra sessioni (evita residui in «nuovo progetto»/
// chiusura sessione). persistCustomLive resta no-op per non toccare i call-site.
export function persistCustomLive(){ /* no-op: le voci composte sono di sessione (vedi .ehub) */ }

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════

export let CUSTOM_SEQ = 0;
export function nextCustomKey(){ return 'cmp:'+(++CUSTOM_SEQ)+':'+Date.now(); }
// HTML della cella "Misura": input quantità + marcatore sorgente (⇪ / ✎).
// Imposta/aggiorna la quantità a mano: marca 'manual' e mette la voce nel carrello.
export function setQtyManual(key,val,um){
  const n=parseNum(val);
  // misurare una voce dai risultati = metterla nell'Elenco Prezzi come COPIA e
  // salvare la misura sulla copia (chiave 'ep:'), non più su S.sel.
  const r=rowByKey(key);
  const ek=r?elencoKeyOf(r):key;
  if(!(n>0)){
    delete S.qty[ek];                        // svuotando si toglie la misura (non la voce)
  } else {
    if(r && !S.custom.has(ek)) commitRowToElencoPrezzi(r); // misurare = includere nel computo
    const prevUm=S.qty[ek]&&S.qty[ek].um;
    S.qty[ek]={ qty:n, um: prevUm||um||'', source:'manual' };
  }
  render();                                  // riallinea .sel e marcatore sorgente
  updateCartInfo();
  window.misDopoModifica?.(ek);              // i «vedi voce» che la richiamano si aggiornano
}
// Quantità di una voce CUSTOM (composta, non da S.archive) — stesso formato di
// S.qty delle voci reali, ma NON tocca S.sel (quel Set resta riservato alle righe reali).
export function setQtyCustom(key,val,um){
  const n=parseNum(val);
  if(!(n>0)) delete S.qty[key];
  else S.qty[key]={ qty:n, um: um||'', source:'manual' };
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
// La FASE del computo in corso (PFTE → definitivo → esecutivo): si cambia con
// apriCambioFase, congelando prima quella di adesso (shared/contratto.ts).
export function faseCorrente(){ return faseDi(S.faseProgetto); }
export function passaFaseSuccessiva(){ apriCambioFase(faseSuccessiva(faseCorrente())||faseCorrente()); }
/* IL CAMBIO DI FASE. Tre domande, in una finestra sola:
   - verso quale fase (di solito la successiva, ma un computo messo nella fase
     sbagliata si rimette a posto da qui);
   - da dove si riparte: il computo in corso, oppure una REVISIONE congelata (si
     fa l'esecutivo dal definitivo approvato, non da quello che è rimasto sul
     tavolo dopo);
   - se congelare prima il computo di adesso, perché non vada perso. */
export function apriCambioFase(verso){
  const ora=faseCorrente();
  const ord=(Array.isArray(S.revisioni)?S.revisioni:[]).slice().sort((x,y)=>(x.ts||0)-(y.ts||0));
  const revs=ord.map((r,i)=>({ r, sigla:`rev.${String(i).padStart(2,'0')}` })).filter(x=>x.r.natura!=='progetto' && Array.isArray(x.r.voci) && x.r.voci.length);
  const pieno=S.sel.size+S.custom.size;
  const ov=document.createElement('div');
  ov.id='fase-overlay'; ov.className='overlay open'; ov.style.zIndex='10060';
  ov.onclick=(e)=>{ if(e.target===ov) ov.remove(); };
  ov.innerHTML=`<div id="qe-box" style="max-width:640px;width:min(640px,94vw)">
    <div class="qe-hd"><h3>⇥ Fase del computo</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="document.getElementById('fase-overlay').remove()">Esc ✕</button></div>
    <div class="qe-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">Adesso si lavora al <b>${esc(NOME_FASE[ora])}</b>. Le revisioni già congelate non cambiano.</p>
      <fieldset class="ctr-scelta"><legend>Verso quale fase</legend>
        ${FASI_PROGETTO.map(f=>`<label><input type="radio" name="cf-fase" value="${f}" ${f===(verso||ora)?'checked':''}><span><b>${NOME_FASE[f]}</b>${f===ora?' <span class="ctr-muto">· quella di adesso</span>':''}</span></label>`).join('')}
      </fieldset>
      <fieldset class="ctr-scelta"><legend>Da dove si riparte</legend>
        <label><input type="radio" name="cf-da" value="corrente" checked><span><b>Il computo in corso</b> <span class="ctr-muto">· ${pieno} voci, si continua da qui</span></span></label>
        ${revs.slice().reverse().map(x=>`<label><input type="radio" name="cf-da" value="${esc(x.r.id)}"><span><b>${x.sigla} ${esc(x.r.nome)}</b> <span class="ctr-muto">· ${esc(String(x.r.fase||''))} · ${x.r.voci.length} voci · € ${fmt(x.r.totale)} — il computo in corso riparte da questa revisione</span></span></label>`).join('')}
      </fieldset>
      ${pieno?`<label style="display:flex;gap:8px;align-items:baseline;font-size:12px"><input type="checkbox" id="cf-congela" checked><span>Congela prima il computo di adesso come revisione «${esc(NOME_FASE[ora])}», perché resti</span></label>`:''}
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="document.getElementById('fase-overlay').remove()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="applicaCambioFase()">Conferma</button></div>
  </div>`;
  document.body.appendChild(ov);
}
export function applicaCambioFase(){
  const ov=document.getElementById('fase-overlay'); if(!ov) return;
  const fase=(ov.querySelector('input[name="cf-fase"]:checked')||{}).value||faseCorrente();
  const da=(ov.querySelector('input[name="cf-da"]:checked')||{}).value||'corrente';
  const congela=!!(ov.querySelector('#cf-congela')||{}).checked;
  const prima=faseCorrente();
  const src=da==='corrente'?null:(S.revisioni||[]).find(r=>String(r.id)===da);
  if(da!=='corrente' && !src){ toast('Revisione non trovata','warn'); return; }
  const congelata=congela?congelaComputoInCorso():null;
  if(src){ svuotaComputoInCorso(); caricaVociNelComputo(vociDaRevisione(src.voci), 'revisione'); }
  S.faseProgetto=fase;
  ov.remove();
  updateCartInfo(); render(); publishComputo(); refreshCartOverlayIfOpen();
  const parti=[congelata?`«${NOME_FASE[prima]}» congelato`:'', src?`ripartito da «${src.nome}»`:'', `ora si lavora ${allaFase(fase)}`].filter(Boolean);
  toast(parti.join(' · '),'ok');
}

// ── PROMUOVI A CONTRATTO ───────────────────────────────────────────────────
// Un ATTO, non un ribasso scritto sul computo di adesso: si sceglie QUALE computo
// diventa contratto (quello in corso o una revisione congelata, di solito
// l'esecutivo a base di gara) e COME (ribasso d'asta o prezzi unitari
// dell'offerta aggiudicata), e il risultato si fotografa. La Contabilità importa
// quell'atto: se dopo il computo cambia, il contratto resta quello.
function fontiDelContratto(){
  const a=window.miuRevisioni;
  const ord=(Array.isArray(S.revisioni)?S.revisioni:[]).slice().sort((x,y)=>(x.ts||0)-(y.ts||0));
  const out=[];
  ord.forEach((r,i)=>{
    if(r.natura==='progetto' || !Array.isArray(r.voci) || !r.voci.length) return;
    out.push({ id:r.id, fonte:{ tipo:'revisione', id:r.id, nome:`rev.${String(i).padStart(2,'0')} ${r.nome}`, fase:r.fase }, voci:()=>vociDaRevisione(r.voci), totale:r.totale, fase:r.fase });
  });
  const ora=vociComputoCondivise();
  if(ora.length){
    const tot=a?ora.reduce((s,v)=>s+a.importoVoce(v),0):0;
    out.push({ id:'corrente', fonte:{ tipo:'corrente', nome:`Computo ${NOME_FASE[faseCorrente()].toLowerCase()} in corso`, fase:faseCorrente() }, voci:()=>ora, totale:tot, fase:faseCorrente() });
  }
  return out;
}
/** La fonte proposta: l'ultima revisione dell'esecutivo, se c'è; altrimenti il computo in corso. */
function fontePredefinita(fonti){
  const es=fonti.filter(f=>f.id!=='corrente' && String(f.fase||'').toLowerCase()==='esecutivo');
  return (es[es.length-1] || fonti.find(f=>f.id==='corrente') || fonti[fonti.length-1] || {}).id;
}
export function promuoviAContratto(){
  const fonti=fontiDelContratto();
  if(!fonti.length){ toast('Niente da promuovere: il computo è vuoto e non ci sono revisioni di computo congelate','warn'); return; }
  const prec=S.contratto;
  const scelta=prec&&fonti.some(f=>f.id===(prec.fonte.id||'corrente'))?(prec.fonte.id||'corrente'):fontePredefinita(fonti);
  const agg=(S.offerte||[]).find(o=>o.id===S.aggiudicata);
  const modo=prec?(prec.prezziOfferti&&agg?'offerta':'ribasso'):(agg?'offerta':'ribasso');
  const ribPrec=prec&&prec.ribassoPct!=null?prec.ribassoPct:(S.datiGenerali&&S.datiGenerali.contratto&&S.datiGenerali.contratto.ribassoPct);
  const ov=document.createElement('div');
  ov.id='contratto-overlay'; ov.className='overlay open'; ov.style.zIndex='10060';
  ov.onclick=(e)=>{ if(e.target===ov) chiudiContratto(); };
  ov.innerHTML=`<div id="qe-box" style="max-width:720px;width:min(720px,94vw)">
    <div class="qe-hd"><h3>→ Promuovi a contratto</h3><span class="cmp-sp"></span><button class="cmp-close" onclick="chiudiContratto()">Esc ✕</button></div>
    <div class="qe-body">
      <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">Il contratto è un atto: si sceglie <b>quale computo</b> diventa contratto e <b>come</b>, e si fotografa. La Contabilità importa questo, e lo usa in tutti i SAL anche se poi il computo cambia. Gli <b>oneri della sicurezza non si ribassano</b>.</p>
      ${prec?`<p style="margin:0 0 10px;font-size:12px">Già promosso il ${esc(prec.data||'')}: <b>${esc(descriviContratto(prec))}</b>. Promuovendo di nuovo, l'atto si sostituisce.</p>`:''}
      <fieldset class="ctr-scelta"><legend>Quale computo</legend>
        ${fonti.slice().reverse().map(f=>`<label><input type="radio" name="ctr-fonte" value="${esc(f.id)}" ${f.id===scelta?'checked':''} onchange="ctrAggiorna()"><span><b>${esc(f.fonte.nome)}</b> <span class="ctr-muto">· ${esc(String(f.fase||''))} · € ${fmt(f.totale)}</span></span></label>`).join('')}
      </fieldset>
      <fieldset class="ctr-scelta"><legend>Come</legend>
        <label><input type="radio" name="ctr-modo" value="ribasso" ${modo==='ribasso'?'checked':''} onchange="ctrAggiorna()"><span>Ribasso d'asta sui prezzi di progetto
          <input id="ctr-rib" class="ctr-rib" type="text" inputmode="decimal" value="${esc(ribPrec!=null?String(ribPrec).replace('.',','):'')}" placeholder="es. 12,35" oninput="ctrAggiorna()"> %</span></label>
        <label${agg?'':' class="ctr-muto"'}><input type="radio" name="ctr-modo" value="offerta" ${modo==='offerta'?'checked':''} ${agg?'':'disabled'} onchange="ctrAggiorna()"><span>Prezzi unitari dell'offerta ${agg?`di <b>${esc(agg.nome||'')}</b>`:'<span class="ctr-muto">(nessuna offerta aggiudicata: si aggiudica da Stampa… → Offerte e quadro comparativo)</span>'}</span></label>
      </fieldset>
      <label class="qe-f"><span>Data del contratto</span><input id="ctr-data" value="${esc((prec&&prec.data)||(S.datiGenerali&&S.datiGenerali.contratto&&S.datiGenerali.contratto.data)||'')}" placeholder="gg/mm/aaaa"></label>
      <div id="ctr-esito" style="margin-top:10px;font-size:12px"></div>
    </div>
    <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" onclick="chiudiContratto()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="salvaContratto()">Promuovi a contratto</button></div>
  </div>`;
  document.body.appendChild(ov);
  ctrAggiorna();
}
/** L'atto che verrebbe fuori dalle scelte fatte nella finestra (o un errore da dire). */
function contrattoDallaFinestra(){
  const id=(document.querySelector('input[name="ctr-fonte"]:checked')||{}).value;
  const f=fontiDelContratto().find(x=>x.id===id);
  if(!f) return { errore:'Scegli il computo che diventa contratto' };
  const modo=(document.querySelector('input[name="ctr-modo"]:checked')||{}).value||'ribasso';
  const agg=(S.offerte||[]).find(o=>o.id===S.aggiudicata);
  const rib=parseNum((document.getElementById('ctr-rib')||{}).value||'');
  try{
    return { atto: promuoviAContrattoPuro({ fonte:f.fonte, voci:f.voci(), data:(document.getElementById('ctr-data')||{}).value||'', ts:Date.now(),
      ribassoPct: modo==='ribasso' && rib>0 ? rib : null, offerta: modo==='offerta' ? agg : null }) };
  }catch(e){ return { errore:e.message||String(e) }; }
}
export function ctrAggiorna(){
  const el=document.getElementById('ctr-esito'); if(!el) return;
  const modo=(document.querySelector('input[name="ctr-modo"]:checked')||{}).value;
  const rib=document.getElementById('ctr-rib'); if(rib) rib.disabled=modo==='offerta';
  const r=contrattoDallaFinestra();
  el.innerHTML=r.errore?`<span style="color:var(--danger)">${esc(r.errore)}</span>`
    :`Base d'asta <b>€ ${fmt(r.atto.baseAsta)}</b> · sicurezza € ${fmt(r.atto.sicurezza)} → importo contrattuale <b>€ ${fmt(r.atto.importo)}</b> <span style="color:var(--text3)">(${r.atto.voci.length} voci)</span>`;
}
export function chiudiContratto(){ const ov=document.getElementById('contratto-overlay'); if(ov) ov.remove(); }
export function salvaContratto(){
  const r=contrattoDallaFinestra();
  if(r.errore){ toast(r.errore,'warn'); return; }
  S.contratto=r.atto;
  // compatibilità: i dati generali portano ancora ribasso e data (stampe, Contabilità di prima)
  const dg=S.datiGenerali||(S.datiGenerali={});
  dg.contratto={ ...(r.atto.ribassoPct!=null?{ ribassoPct:r.atto.ribassoPct }:{}), ...(r.atto.prezziOfferti?{ prezziOfferti:true }:{}), data:r.atto.data };
  chiudiContratto();
  publishComputo();
  refreshCartOverlayIfOpen();
  toast(`Promosso a contratto: ${descriviContratto(r.atto)} — importalo nella Contabilità`,'ok');
}

// ── VOCE LIBERA ────────────────────────────────────────────────────────────
// Capita di avere la MISURA prima della voce: un vano rilevato in cantiere, una
// quantità da fissare subito. Si apre una riga vuota, ci si scrive dentro la
// misura, e la voce di prezzario (o la composizione) si assegna dopo: la chiave
// del computo non cambia, quindi misure, categoria e WBS restano dove sono.
export function addVoceLibera(){
  const key=nextCustomKey();
  S.custom.set(key,{ desc_short:'', declaratoria:'', um:'', prezzo:null, libera:true });
  S.qty[key]={ qty:0, um:'', source:'manual', misurazioni:[{ descrizione:'', quantita:0 }] };
  MIS_OPEN.add(key);
  updateCartInfo();
  if(!document.getElementById('cart-overlay')) setStep('misura'); else refreshCartOverlayIfOpen();
  setTimeout(()=>{
    const el=document.querySelector(`[data-mis-key="${CSS.escape(key)}"] [data-mis-input="0:descrizione"]`);
    if(el){ el.focus(); el.scrollIntoView&&el.scrollIntoView({ block:'center' }); }
  },60);
  toast('Voce libera: scrivi la misura, la voce di prezzario la assegni dopo','ok');
  return key;
}
// ── COMPUTO METRICO: misurazioni multi-riga per voce (L1×L2×H×n) ──
// S.qty[key].misurazioni = MisurazioneRiga[] (opzionale, coesiste con .qty che
// resta il totale calcolato — vedi src/shared/compositore/misurazioni.ts). Un
// pannello per riga di carrello (reale o composta), apribile/richiudibile.
export let MIS_OPEN=new Set(); // chiavi con pannello misurazioni aperto nell'overlay carrello
// Intestazione di gruppo quando cambia la categoria (vista raggruppata del computo metrico).
// Prezzo manuale di una voce custom (l'utente lo imposta perché non c'è un
// prezzo di listino) — mai bloccante, resta "senza prezzo" finché non lo valorizza.
export function custSetPrezzo(key,val){
  const it=S.custom.get(key); if(!it) return;
  const n=parseNum(val);
  // il prezzo è dell'ARTICOLO: cambia su tutte le voci di computo con lo stesso codice
  const chiavi=modificaArticolo(S.custom, key, { prezzo:(n>0)?n:null });
  if(chiavi.length>1) toast(`Prezzo aggiornato su ${chiavi.length} voci di computo con il codice ${it.codice}`,'ok');
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
// Unità di misura editabile per una voce composta (Descrizione o
// Analisi Prezzi) direttamente dal carrello — prima era fissa (dalla famiglia
// o dall'Analisi Prezzi al momento dell'aggiunta), non correggibile dopo.
export function custSetUm(key,val){
  const it=S.custom.get(key); if(!it) return;
  for(const k of modificaArticolo(S.custom, key, { um:(val||'').trim() })){
    const q=S.qty[k]; if(q) q.um = (val||'').trim(); // la quantità salvata segue la stessa UM
  }
  refreshCartOverlayIfOpen();
  updateCartInfo();
}
export function removeCustomFromCart(key){
  const _undoItem=S.custom.get(key), _undoQty=S.qty[key], _undoCat=S.categoria[key];
  S.custom.delete(key);
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  MIS_OPEN.delete(key); CART_SEL.delete(key);
  refreshCartOverlayIfOpen();
  updateCartInfo();
  if(_undoItem) window.ehbFeedback?.undoToast('Voce composta rimossa dal computo', ()=>{
    S.custom.set(key,_undoItem);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    refreshCartOverlayIfOpen(); updateCartInfo(); render();
  });
}
// Il carrello è una funzione fondamentale di Computo: il bottone vive nell'header,
// SEMPRE visibile (non solo quando la results-bar di un prezzario è a video).
export let _prevCartN=0;
export let _prevCartRailN=0; // stessa logica di _prevCartN, ma per il flash del binario (rail-computo)
export function updateCartInfo(){
  const n=S.sel.size+S.custom.size; // il badge conta anche le voci composte
  miuAutoModeForComputo(n);         // computo popolato + nessuna scelta dell'utente ⇒ modalità Completa
  const btn=document.getElementById('cart-btn');
  if(btn){
    if(n>_prevCartN){ btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); } // pulsa all'aggiunta
    _prevCartN=n;
    const cnt=btn.querySelector('.cart-count'), tot=btn.querySelector('.cart-total');
    if(n>0){
      btn.classList.remove('disabled'); btn.classList.add('active');
      if(cnt){ cnt.style.display='inline'; cnt.textContent=n.toLocaleString('it'); }
      const t=cartTotals();
      if(tot){ tot.style.display = t.tot>0 ? 'inline' : 'none'; tot.textContent = t.tot>0 ? '€ '+fmt(t.tot) : ''; }
      btn.title=`${n.toLocaleString('it')} voci nel computo metrico${t.tot>0?' · € '+fmt(t.tot):''} — clic per vederle`;
    } else {
      btn.classList.add('disabled'); btn.classList.remove('active');
      if(cnt) cnt.style.display='none';
      if(tot) tot.style.display='none';
      btn.title='Computo Metrico vuoto — clic per aprirlo';
    }
  }
  const clearBtn=document.getElementById('btn-cart-clear');
  if(clearBtn) clearBtn.style.display = n>0 ? '' : 'none';
  // Voci scelte nei risultati di ricerca ma NON ANCORA nel computo (S.searchSel,
  // distinto da S.sel/S.custom sopra): hanno il loro pannello a fondo pagina, dove si
  // vedono per nome e si tolgono una a una — non più un contatore nella barra.
  renderSelDock();
  updateAPFascicoloBtn(); // badge fascicolo Σ segue le voci con analisiPrezzi
  persistCustomLive(); // C2: voci composte + quantità sopravvivono al reload
  publishComputo();
  // contesto sul binario: computo attivo (voci · totale)
  // i due elenchi prezzi si distinguono a colpo d'occhio: quanti prezzari sono
  // caricati (da cui si pesca) e quanti articoli ha l'elenco di questo progetto
  const epN=document.getElementById('ep-rail-n');
  if(epN) epN.textContent=String(n);
  const rc=document.getElementById('rail-computo');
  if(rc){
    if(n>0){
      const t=cartTotals(); rc.innerHTML='Computo: <b>'+n.toLocaleString('it')+' voci'+(t.tot>0?' · € '+fmt(t.tot):'')+'</b>';
      if(n>_prevCartRailN) window.ehbFeedback?.flashElement(rc); // stesso segnale del bump su #cart-btn, ma sul binario
    }
    else rc.textContent='';
  }
  _prevCartRailN=n;
}

// Pubblica il computo (carrello valorizzato) sull'hub → consumato dagli altri tool.

// NUOVI PREZZI: le voci senza codice (composte, analisi prezzi) ricevono un codice
// NP.001, NP.002… STABILE, assegnato una volta sola e salvato con la voce: non cambia
// se si tolgono o si spostano altre voci (prima la numerazione era per posizione).
export function assegnaCodiciNP(){
  let max=0;
  for(const it of S.custom.values()){ const m=/^NP\.(\d+)$/.exec(it.codice||''); if(m) max=Math.max(max,+m[1]); }
  for(const it of S.custom.values()){
    if(it.codice) continue;
    // una VOCE LIBERA ancora vuota non è un nuovo prezzo: è un posto dove ho
    // messo una misura. Prende il codice NP solo quando le do una descrizione
    // (se invece le assegno un articolo di prezzario, il codice arriva da lì).
    if(it.libera && !(it.desc_short||'').trim()) continue;
    it.codice='NP.'+String(++max).padStart(3,'0'); it.np=true;
  }
}
export function publishComputo(){
  assegnaCodiciNP();
  const perChiave=new Map(); const reali=cartRows();
  for(const [k,r] of reali){
    const q=S.qty[k];
    perChiave.set(k,{ codice:r.codice, desc_short:r.desc_short, declaratoria:r.declaratoria,
      um:r.um, prezzo:r.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:r.regione, anno:r.anno, tematica:r.tematica, source:q?q.source:undefined,
      // categoria assegnata a mano nel computo metrico: i consumatori la usano come sezione
      // esplicita del suo computo (stesso campo/semantica di un import esterno) —
      // vedi src/tools/tau/engine/chapters.ts::sectionOf.
      categoria:S.categoria[k]||undefined, wbs:S.wbs[k]||undefined,
      misurazioni:(q&&q.misurazioni&&q.misurazioni.length)?q.misurazioni:undefined });
  }
  // Le voci composte entrano nel computo con lo stesso formato delle voci reali
  // (nessuna voce di prezzario dietro: codice sintetico, niente regione/anno/tematica).
  for(const [k,it] of S.custom){
    const q=S.qty[k];
    perChiave.set(k,{ codice:it.codice||'✎ composta', desc_short:it.desc_short, declaratoria:it.declaratoria,
      um:it.um, prezzo:it.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:undefined, anno:undefined, tematica:undefined, source:'componi',
      categoria:S.categoria[k]||undefined, wbs:S.wbs[k]||undefined,
      misurazioni:(q&&q.misurazioni&&q.misurazioni.length)?q.misurazioni:undefined,
      // inoltro ai consumatori: identità/caratteristiche per il capitolato (additivo)
      famigliaId:it.famigliaId||undefined, caratteristiche:it.caratteristiche||undefined,
      marca:it.marca||undefined, modello:it.modello||undefined, codice_prodotto:it.codice_prodotto||undefined });
  }
  // stesso ordine dello schermo e della stampa
  // sicurezza, lavori a corpo e prezzo dell'offerta aggiudicata viaggiano con la voce
  // (la Contabilità li usa: niente ribasso sulla sicurezza, partite a corpo, prezzi unitari offerti)
  const extra=new Map(vociComputoCondivise().map(v=>[v._key,v]));
  const items=chiaviOrdinate(reali).map(k=>{ const it=perChiave.get(k); if(!it) return null; const x=extra.get(k);
    return x?{ ...it, sicurezza:x.sicurezza, corpo:x.corpo, prezzoOfferto:x.prezzoOfferto }:it; }).filter(Boolean);
  // Le revisioni congelate viaggiano col computo (senza le voci): la Contabilità le
  // conta nella catena (rev.00…), e l'albero del lavoro le mostra come rami del
  // Computo, che è lo strumento che le tiene e le apre (shared/revisioni.ts).
  const revisioni=(Array.isArray(S.revisioni)?S.revisioni:[]).slice().sort((a,b)=>(a.ts||0)-(b.ts||0))
    .map(r=>{
      const progetto=r.natura==='progetto';
      const elenco=!progetto&&window.miuRevisioni?window.miuRevisioni.elenco(r):[];
      return { id:String(r.id), nome:String(r.nome||r.fase||'Revisione'), fase:r.fase||undefined, data:r.data||undefined,
        voci:Array.isArray(r.voci)?r.voci.length:0, totale:Number(r.totale)||0,
        natura:progetto?'progetto':'computo', ...(progetto?{}:{ articoli:elenco.length }), ...(r.computoDi?{ computoDi:String(r.computoDi) }:{}) };
    });
  const T=cartTotals();
  const fase=faseCorrente();
  const ramo=alberoDelComputo({ voci:S.sel.size+S.custom.size, totale:T.tot||0, revisioni, eur:(n)=>'€ '+fmt(n), fase,
    contratto:S.contratto?{ descrizione:descriviContratto(S.contratto), importo:S.contratto.importo, data:S.contratto.data }:null });
  // il CONTRATTO viaggia intero (voci fotografate): la Contabilità importa questo,
  // non il computo di adesso (shared/contratto.ts)
  try{ window.parent.postMessage({ type:'app:project-update', appId:'computo', project:{ items, datiGenerali:S.datiGenerali||{}, revisioni, faseProgetto:fase,
    contratto:S.contratto||null, albero:ramo.rami, azioniAlbero:ramo.azioni, ts:Date.now() } }, '*'); }catch(e){}
}
// Incidenza % manodopera di una riga del computo — dal prezzario (r.ru) o
// ricalcolata al volo dall'Analisi Prezzi della voce composta (mai un valore
// salvato a parte: resta sempre coerente se l'analisi viene poi modificata).
export function mdoBadgeHtml(pct){
  const p=Math.round(Number(pct)||0);
  return p>0 ? `<span class="cm-mdo-badge" title="Incidenza manodopera">MDO ${p}%</span>` : '';
}
// Nota a fianco del totale: voci non valorizzate (senza misura o senza prezzo).
export function clearCart(){
  if(!S.sel.size && !S.custom.size) return;
  S.sel.clear();
  for(const k of S.custom.keys()) if(S.qty[k]) delete S.qty[k];
  S.custom.clear();
  S.categoria={};
  render();
  toast('Computo svuotato','ok');
}
export function rowByKey(key){
  for(const it of S.archive){ if(it.loaded!==true) continue;
    for(const r of it.rows){ if(rowKey(r)===key) return r; } }
  return null;
}
export function rowsBySearchSel(){
  const out=[];
  for(const it of S.archive){ if(it.loaded!==true) continue;
    for(const r of it.rows){ if(S.searchSel.has(rowKey(r))) out.push(r); } }
  return out;
}
// Aggiunge UNA voce di prezzario (dal ＋ di riga o dal dettaglio) all'Elenco Prezzi.
export function addRowToComputo(key){
  const r=(typeof key==='object')?key:rowByKey(key);
  if(!r) return;
  const already=isInElencoPrezzi(r);
  commitRowToElencoPrezzi(r);
  updateCartInfo(); render();
  toast(already?'Già nel computo':'Aggiunta al computo','ok');
}
// Aggiunge le voci SELEZIONATE nei risultati di ricerca all'Elenco Prezzi.
export function addSelectedToComputo(){
  const rows=rowsBySearchSel();
  if(!rows.length){ toast('Seleziona prima una o più voci nei risultati','warn'); return; }
  let n=0;
  rows.forEach(r=>{ if(!isInElencoPrezzi(r)){ commitRowToElencoPrezzi(r); n++; } });
  S.searchSel.clear();
  updateCartInfo(); render();
  toast(n?`${n} vo${n===1?'ce aggiunta':'ci aggiunte'} al computo`:'Voci già nel computo','ok');
}
// Azzera la selezione dei risultati (S.searchSel), senza toccare il computo.
export function clearSearchSel(){
  if(!S.searchSel.size) return;
  S.searchSel.clear();
  updateCartInfo(); render();
}
// Frammenti riusati sia dal render completo (openCart/customRowsHtml) sia dal
// patch mirato post-misurazioni (misPatchDom) — un'unica sorgente per il markup.
// Riga "Incidenza manodopera media" sotto il totale — assente se non c'è nulla di
// prezzato con manodopera nota (nessun buco da colmare con uno zero fuorviante).
// Riallinea conteggio/totale/avviso nell'header e footer dell'overlay aperto.
// Righe CUSTOM (voci composte senza voce di prezzario) — stesso layout delle
// righe reali, ma prezzo e quantità sono editabili (onchange, non oninput: si conferma
// con Invio/blur, come già in misCell/setQtyManual, per non perdere il focus a ogni tasto).
export function customRowsHtml(){
  // (vecchio punto d'ingresso: le voci composte in ordine di inserimento, senza intestazioni)
  return [...S.custom.keys()].map(customRowHtml).join('');
}
export function customRowHtml(k){
  const it=S.custom.get(k); if(!it) return '';
    const q=S.qty[k];
    const ek=String(k).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    // UM editabile anche per le voci composte (Descrizione E Analisi Prezzi): è un
    // dato della voce, non la colonna della fase, quindi sta tra i dati sotto la designazione.
    const umIn=`<input type="text" class="ehb-gr-campo ehb-gr-campo--um" value="${esc(it.um||'')}" placeholder="um"
      onclick="event.stopPropagation()" onchange="custSetUm('${ek}',this.value)" title="Unità di misura — Invio per confermare">`;
    const mdo=cartRigaMDO(null,it);
    // Le celle sono quelle condivise (shared/griglia/celle.ts): qui si dice che cosa ci va.
    const codice = it.codice
      ? (it.np
        ? { tipo:'codice', codice:it.codice, tono:'np', etichetta:it.analisiPrezzi?'NP · Σ':'NP', titolo:`Nuovo prezzo (non da prezzario)${it.analisiPrezzi?': con analisi':''}` }
        : { tipo:'codice', codice:it.codice, tono:'proprio', titolo:'Voce con codice originale (non generata da Computo) — modificabile come una composta' })
      : (it.libera
        ? { tipo:'codice', codice:'', senza:'⌕ libera', tono:'libera', titolo:"Voce libera: la misura c'è, l'articolo si assegna dopo" }
        : { tipo:'codice', codice:'', senza:'✎ composta', tono:'np', titolo:'Voce composta, non da prezzario' });
    codice.prima=maniglia(k)+pieghaBtn(k);
    // La griglia è quella condivisa (shared/griglia): colonne e ordine li decide la fase.
    return rigaVoceHtml(FASE_PROGETTO, {
      classe:'cm-sel-row',
      compatta:voceCompatta(k),
      attributi:`data-key="${esc(k)}" ondragover="ordineDragOver(event,this)" ondragleave="ordineDragLeave(this)" ondrop="ordineDrop(event,this)"`,
      celle:{
        codice,
        designazione:{ tipo:'designazione', testo:it.desc_short||it.declaratoria||'',
          vuoto:'voce libera — misurala, poi assegnale una voce di prezzario',
          nota:it.famNome||'',
          meta:[umIn,
            `<button class="cm-ap-edit-badge" onclick="event.stopPropagation();openQuickEdit('${ek}')" title="${it.libera&&!it.codice?'Assegna la voce: cerca nel prezzario, oppure scrivi descrizione, U.M. e prezzo':'Modifica rapida: descrizione, prezzo, U.M. (Compositore/Analisi Prezzi dal piede)'}">${it.analisiPrezzi?'Σ modifica':(it.libera&&!it.codice?'⌕ assegna voce':'✎ modifica')}</button>`,
            mdoBadgeHtml(mdo), sicurezzaChipHtml(k), eSicurezza(k)?'':corpoChipHtml(k), categoriaChipHtml(k), wbsChipHtml(k)] },
        quantita:`<div data-cell="qty">${cartQtyCellHtml(k)}</div><div data-cell="mis">${misToggleBtn(k)}</div>`,
        prezzo:{ tipo:'campo', valore:it.prezzo>0?fmt(it.prezzo):'', prefisso:'€', segnaposto:'—', isola:true,
          comando:`custSetPrezzo('${ek}',this.value)`, titolo:"Prezzo manuale (non c'è nel prezzario) — Invio per confermare" },
        importo:{ html:cartImpCellHtml(it.prezzo||0,q), attributi:'data-cell="imp"' },
        comandi:{ tipo:'comandi', comandi:[{ icona:'✕', titolo:'Rimuovi dal computo', onclick:`removeCustomFromCart('${ek}')`, pericolo:true }] },
      },
      dopo:misPanelHtml(k),
    });
}
// Ricostruisce l'overlay Carrello se è aperto (dopo un cambio di prezzo/quantità/
// rimozione custom) — no-op se è chiuso. A computo svuotato NON si chiude più:
// openCart() mostra l'empty state (finestra pronta ad accogliere nuove voci).
export function refreshCartOverlayIfOpen(){
  // l'AREA elenco prezzi si riallinea comunque: può essere aperta anche quando
  // il computo non lo è (si modifica un prezzo stando nell'elenco)
  try{ window.refreshElencoPrezziArea?.(); }catch(e){ /* ok */ }
  if(!document.getElementById('cart-overlay')) return;
  openCart();
}
export function openCart(){
  // idempotente: ogni modifica dentro l'overlay (es. il pannello misurazioni) lo ricostruisce
  // chiamando openCart() di nuovo — senza questa pulizia si impilano overlay duplicati con lo
  // stesso #cart-overlay, e chiudere quello in vista (il più recente) non lo toglie davvero,
  // perché closeCart() prende il PRIMO match per id (il più vecchio, sotto): serve richiudere
  // più volte. Rimuovendo prima ogni overlay residuo, ne resta sempre e solo uno.
  // la ricostruzione non deve far saltare la vista: si ricorda dove erano scorse le aree
  // (elenco voci, pannello categorie…) e si ripristina dopo (es. dopo un trascinamento)
  const _scroll=new Map();
  document.querySelectorAll('#cart-overlay [id]').forEach(el=>{ if(el.scrollTop||el.scrollLeft) _scroll.set(el.id,[el.scrollTop,el.scrollLeft]); });
  document.querySelectorAll('#cart-overlay').forEach(el=>el.remove());
  assegnaCodiciNP();
  const map=cartRows();
  const T=cartTotals(map);
  // raggruppate per CATEGORIA (assegnazione manuale): categorizzate prima in ordine
  // alfabetico, poi le non categorizzate senza intestazione — vista piatta di default
  // invariata per chi non usa la funzione.
  // Ordine a schermo = ordine di stampa: manuale, per categorie o per WBS (ordine.js).
  const realRowHtml=(k,r)=>{
      const q=S.qty[k];
    const mdo=cartRigaMDO(r);
    const ek=String(k).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return rigaVoceHtml(FASE_PROGETTO, {
      classe:'cm-sel-row',
      compatta:voceCompatta(k),
      attributi:`data-key="${esc(k)}" ondragover="ordineDragOver(event,this)" ondragleave="ordineDragLeave(this)" ondrop="ordineDrop(event,this)"`,
      celle:{
        codice:{ tipo:'codice', codice:r.codice, prima:maniglia(k)+pieghaBtn(k) },
        designazione:{ tipo:'designazione', testo:r.desc_short||r.declaratoria||'',
          nota:r.regione?`${r.regione}${r.anno&&r.anno!=='—'?' '+r.anno:''}`:'',
          meta:[mdoBadgeHtml(mdo), sicurezzaChipHtml(k,r), eSicurezza(k,r)?'':corpoChipHtml(k), categoriaChipHtml(k), wbsChipHtml(k)] },
        quantita:`<div data-cell="qty">${cartQtyCellHtml(k)}</div><div data-cell="mis">${misToggleBtn(k)}</div>`,
        prezzo:{ tipo:'numero', testo:r.prezzo>0?'€ '+fmt(r.prezzo):'—' },
        importo:{ html:cartImpCellHtml(r.prezzo||0,q), attributi:'data-cell="imp"' },
        comandi:{ tipo:'comandi', comandi:[{ icona:'✕', titolo:'Rimuovi dal computo', onclick:`removeFromCart('${ek}')`, pericolo:true }] },
      },
      dopo:misPanelHtml(k),
    });
  };
  let titoliPrec=[], sicPrec=false, corpoPrec=false;
  const rowsHtml=chiaviOrdinate(map).map(k=>{
    const t=titoliVoce(k);
    // sezioni a sé per i lavori a corpo e per gli oneri della sicurezza (in fondo, come in stampa)
    let sez='';
    if(!corpoPrec && !eSicurezza(k, map.get(k)) && (S.corpo||{})[k]){ corpoPrec=true; titoliPrec=[];
      sez=rigaSezioneHtml(FASE_PROGETTO,{ titolo:TITOLI_SEZIONE.corpo, tono:'corpo', classe:'cm-sez-corpo' }); }
    if(!sicPrec && eSicurezza(k, map.get(k))){ sicPrec=true; titoliPrec=[];
      sez=rigaSezioneHtml(FASE_PROGETTO,{ titolo:TITOLI_SEZIONE.sicurezza, tono:'sicurezza', classe:'cm-sez-sic' }); }
    const head=sez+intestazioniGruppo(titoliPrec,t);
    titoliPrec=t;
    return head+(map.has(k)?realRowHtml(k,map.get(k)):customRowHtml(k));
  }).join('');
  // Computo vuoto: l'overlay si apre lo stesso, come finestra pronta a
  // popolarsi aggiungendo voci dal prezzario.
  const vuoto=!map.size && !S.custom.size;
  const bodyHtml = vuoto
    ? `<div style="text-align:center;padding:48px 24px;color:var(--text3)">
        <div style="font-size:34px;margin-bottom:10px">▤</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:6px">Computo vuoto</div>
        <div style="font-size:11.5px;max-width:420px;margin:0 auto 16px">Aggiungi voci dal prezzario spuntandole o misurandole.</div>
      </div>`
    : CART_MODE==='categorizza' ? cartBodyCategorieHtml(map)
    : CART_VIEW==='elenco' ? cartBodyElencoHtml(map)
    : CART_VIEW==='capitoli' ? cartBodyCapitoliHtml(map)
    : grigliaHtml({ fase:FASE_PROGETTO, idCorpo:'cart-ov-tbody', righe:[{ tipo:'html', html:rowsHtml }] })+wbsDatalistHtml();
  const ov=document.createElement('div');
  ov.id='cart-overlay';
  // Vista (non più modale a schermo intero): montata SOTTO il binario persistente
  // (--chrome-h), fondo opaco, riempie lo spazio. Il binario resta sopra e cliccabile.
  ov.style.cssText='position:fixed;left:0;right:0;bottom:0;top:var(--chrome-h,48px);background:var(--bg);z-index:60;display:flex;flex-direction:column';
  ov.innerHTML=`
    <div style="background:var(--surface);width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden">
      ${cartTestataHtml(map)}
      <div id="cart-ov-selbar" class="cm-selbar">
        <span><b id="cart-ov-seln">0</b> voci selezionate</span>
        <span class="cm-selbar-sp"></span>
        <button class="fam-assign" onclick="cartOpenCatPopoverForSel(event)">🏷 Assegna categoria</button>
        <button onclick="segnaSicurezzaSelezione()" title="Segna (o togli) le voci selezionate come oneri della sicurezza, non soggetti a ribasso">Sicurezza</button>
        <button onclick="ordineScorri(-1)" title="Sposta in su le voci selezionate (nelle viste per gruppi, dentro il proprio gruppo)">↑</button>
        <button onclick="ordineScorri(1)" title="Sposta in giù le voci selezionate">↓</button>
        <button class="fam-assign" onclick="assegnaWbsSelezione()" title="Assegna lo stesso codice WBS a tutte le voci selezionate">WBS…</button>
        <button onclick="showCopyPopup()" title="Copia rapida TSV delle sole voci selezionate — senza analisi prezzi">📋 Copia</button>
        <button onclick="cartDuplicateKeys([...CART_SEL])">⧉ Duplica</button>
        <button class="danger" onclick="cartRemoveKeys([...CART_SEL])">✕ Rimuovi</button>
        <button class="ghost" onclick="cartSelClear()">Deseleziona</button>
      </div>
      <div style="flex:1;overflow:auto;padding:4px var(--sp-5) 110px" id="cart-ov-body"
        ondragover="if(event.dataTransfer.types.includes('text/ep-key')){event.preventDefault();this.classList.add('ep-drop-over')}"
        ondragleave="this.classList.remove('ep-drop-over')"
        ondrop="epDropSuComputo(event)">
        ${window.ehbBarraVoci ? window.ehbBarraVoci({
        cerca: { valore: CART_QUERY, onInput: 'cartFilterRows(this.value)', placeholder: FASE_PROGETTO.cerca },
        viste: CART_MODE==='categorizza' ? undefined : { valore: CART_VIEW, opzioni: OPZ_VISTA, onclickTpl: "cartSetView('%v')" },
        ordine: CART_MODE==='categorizza' ? undefined : { valore: modoOrdine(), opzioni: OPZ_ORDINE, onclickTpl: "setOrdinamento('%v')" },
        espandi: (CART_MODE==='categorizza'||CART_VIEW!=='tabella') ? undefined : { tutteAperte: !tuttePiegate(), onclick: 'piegaTutte()' },
        aggiungi: [
          // La colonna dei prezzi si chiude, quindi si deve poter RIAPRIRE (come nella Contabilità).
          epFloatState().closed
            ? { etichetta:'≡ Prezzi', titolo:"Riapri a destra l'elenco prezzi del progetto", onclick:'epFloatOpen()' }
            : { etichetta:'≡ Prezzi ✓', titolo:"L'elenco prezzi del progetto è aperto a destra", onclick:'epFloatOpen()' },
          { etichetta:'+ Dal prezzario', titolo:"Cerca la voce nei prezzari caricati (o componila) e aggiungila al computo", onclick:"setStep('cerca')" },
          { etichetta:'+ Voce libera', titolo:"Riga vuota su cui fissare subito la misura: l'articolo si assegna dopo", onclick:'addVoceLibera()' },
          { etichetta:'+ Nuovo prezzo…', titolo:'Componi un prezzo che il prezzario non ha: analisi o assimilazione', onclick:'openComponi()', stile:'ghost' },
        ],
        dati: [
          { etichetta:'⇩ XPWE', titolo:'Importa un computo o un elenco prezzi in formato XPWE', onclick:"document.getElementById('file-input')?.click()", stile:'ghost' },
          { etichetta:'⇧ XPWE', titolo:'Esporta il computo in formato XPWE', onclick:'exportComputoXpwe()', stile:'ghost' },
        ],
        // «Stampe» qui non c'è: il comando di stampa è UNO, in testata (come nella Contabilità).
        strumenti: [
          { etichetta:'⧗ Revisioni', titolo:'Revisioni del computo: congela una fase (PFTE, definitivo, esecutivo) e confronta le versioni', onclick:'apriRevisioni()', stile:'ghost' },
          { etichetta:'☰ Struttura', titolo:'Struttura del computo: categorie, WBS e modelli', onclick:'apriStruttura()', stile:'ghost' },
        ],
        extra: [
          faseSuccessiva(faseCorrente())
            ? { etichetta:`⇥ Passa ${allaFase(faseSuccessiva(faseCorrente()))}…`, titolo:`Si passa ${allaFase(faseSuccessiva(faseCorrente()))}: dal computo in corso o da una revisione congelata, congelando prima quello di adesso`, onclick:'passaFaseSuccessiva()', stile:'ghost' }
            : { etichetta:'⇥ Fase…', titolo:'Cambia la fase del computo in corso, o fallo ripartire da una revisione congelata', onclick:'apriCambioFase()', stile:'ghost' },
          { etichetta:'→ Contratto…', titolo:"Un computo diventa CONTRATTO: si sceglie quale (quello in corso o una revisione congelata) e come (ribasso d'asta o prezzi dell'offerta), e la Contabilità importa l'atto", onclick:'promuoviAContratto()' },
        ],
        aiuto: { onclick:'openGuide()', titolo:'Come si lavora in questa schermata' },
      }) : ''}
        ${bodyHtml}
      </div>
      ${cartPiedeHtml(T)}
    </div>`;
  document.body.appendChild(ov);
  for(const [id,[t,l]] of _scroll){ const el=document.getElementById(id); if(el){ el.scrollTop=t; el.scrollLeft=l; } }
  wireCartSelection(ov);
  cartUpdateSelUI();
  if(CART_QUERY) cartFilterRows(CART_QUERY); // riapplica il filtro ricerca dopo un rebuild
  _syncRail(CART_MODE==='categorizza' ? 'categorizza' : 'misura'); // il binario segue la MODALITÀ del carrello (non la vista Tabella/Elenco)
  mountEpFloat(map);
}
export function removeFromCart(key){
  const richiami=window.vociCheRichiamano?window.vociCheRichiamano(S.qty, key):[];
  if(richiami.length && !confirm(`${richiami.length} voc${richiami.length===1?'e richiama':'i richiamano'} questa voce con «vedi voce»: la loro quantità andrà a zero. Rimuovere comunque?`)) return;
  // snapshot per l'Annulla (toast) — qty/categoria si perdono col delete sotto
  const _undoQty=S.qty[key], _undoCat=S.categoria[key];
  S.sel.delete(key);
  if(S.qty[key]) delete S.qty[key];
  if(S.categoria[key]) delete S.categoria[key];
  MIS_OPEN.delete(key); CART_SEL.delete(key);
  window.ehbFeedback?.undoToast('Voce rimossa dal computo', ()=>{
    S.sel.add(key);
    if(_undoQty!==undefined) S.qty[key]=_undoQty;
    if(_undoCat!==undefined) S.categoria[key]=_undoCat;
    refreshCartOverlayIfOpen(); updateCartInfo(); render();
  });
  // aggiorna la riga nell'overlay senza ricostruirlo tutto
  const tbody=document.getElementById('cart-ov-tbody');
  if(tbody){
    const btn=tbody.querySelector(`button[onclick*="${key.replace(/'/g,"\\'")}"]`);
    const tr=btn?btn.closest('tr'):null;
    // il pannello misurazioni (se aperto) è il <tr> gemello subito dopo: va rimosso insieme
    const misTr=tr&&tr.nextElementSibling&&tr.nextElementSibling.classList.contains('mis-panel-row')?tr.nextElementSibling:null;
    if(misTr) misTr.remove();
    if(tr) tr.remove();
    cartPatchTotals();
    if(!S.sel.size && !S.custom.size) refreshCartOverlayIfOpen(); // → empty state, non si chiude
    cartUpdateSelUI();
  } else {
    // viste Categorie/Elenco: niente #cart-ov-tbody da patchare al volo, si
    // ricostruisce tutto (stesso costo di un qualunque altro cambio di stato).
    refreshCartOverlayIfOpen();
  }
  updateCartInfo();
  render();
}
export function closeCart(){
  document.querySelectorAll('#cart-overlay').forEach(el=>el.remove()); // vedi nota in openCart()
  document.querySelectorAll('#ep-float-wrap').forEach(el=>el.remove());
  document.body.style.setProperty('--ep-dock-w','0px');
  CART_SEL.clear(); closeCatPopover(); closeCartCtxMenu();
}

// ══════════════════════════════════════════════════════════════
// EXPORT A TRACCIATO FISSO — fixed-width 234 chars
// ══════════════════════════════════════════════════════════════
// BUG FIX (due difetti distinti):
// 1) Con carrello di sole voci COMPOSTE (S.custom) e nessuna riga da prezzario
//    selezionata (S.sel vuoto), il controllo guardava solo S.sel: le voci composte
//    non finivano MAI nell'export (TSV/Excel/tracciato/report), a prescindere.
// 2) Con carrello COMPLETAMENTE vuoto (S.sel e S.custom entrambi vuoti), la funzione
//    ripiegava su S.filtered — «ciò che è filtrato a video» — che senza una ricerca
//    attiva COINCIDE col prezzario intero (migliaia di voci): un click su «Esporta»
//    a carrello vuoto esportava tutto il prezzario invece di avvisare che è vuoto.
// Ora: SOLO il carrello (S.sel + S.custom); vuoto ⇒ array vuoto, i chiamanti già
// mostrano «Nessuna voce da esportare» quando rows.length===0. Le voci di S.custom
// portano con sé la quantità già risolta (`_qty`) perché la loro chiave in S.qty è
// quella originale di S.custom, non il rowKey sintetico. Solo quelle SENZA codice
// (compositore/Analisi Prezzi) ricevono una TARIFFA PROGRESSIVA («NP.001», «Nuovo
// Prezzo» — convenzione dei computi metrici italiani per le voci fuori prezzario);
// le voci di prezzario reale o con un codice originale mantengono il LORO codice.
// soloSelezionate=true e c'è una selezione attiva in CART_SEL (lazo/clic nel
// carrello) ⇒ solo le voci selezionate, stessa chiave (rowKey/S.custom) usata
// dal resto del carrello. Nessuna selezione o parametro assente ⇒ tutto il
// carrello, comportamento invariato per gli export che non conoscono CART_SEL.
export function collectExportRows(soloSelezionate){
  assegnaCodiciNP();
  const sel=(soloSelezionate && CART_SEL.size) ? CART_SEL : null;
  const rows=[];
  const reali=cartRows();
  // numerazione NP stabile (ordine di inserimento), righe nell'ordine a schermo
  const np=new Map(); let i=0;
  for(const k of S.custom.keys()) np.set(k, ++i);
  for(const k of chiaviOrdinate(reali)){
    if(sel && !sel.has(k)) continue;
    if(reali.has(k)){ rows.push({ ...reali.get(k), _key:k }); continue; }
    const it=S.custom.get(k); if(!it) continue;
    const i=np.get(k);
    rows.push({ _key:k,
      // le voci di prezzario reale (source:'prezzario') o con un codice originale portano
      // il LORO codice/tariffa e lo mantengono in export; solo compositore/Analisi
      // Prezzi (senza codice) restano NP.xxx progressivi.
      codice:it.codice||('NP.'+String(i).padStart(3,'0')), // (di norma già assegnato da assegnaCodiciNP)
      desc_short:it.desc_short, declaratoria:it.declaratoria,
      um:it.um, prezzo:it.prezzo, ru:null,
      // provenienza dell'articolo (voci prese dal prezzario/elenco prezzi); le composte non l'hanno
      regione:it.regione||'—', anno:it.anno||'—',
      _custom:true, _qty:S.qty[k],
      // La scomposizione viaggia con la voce: serve alla «Copia»
      // (formato XMLDCF_EP). Gli altri export la ignorano.
      analisiPrezzi:it.analisiPrezzi,
    });
  }
  return rows;
}

// Report PDF (computo/estratto): apre una finestra stampabile con le voci del
// carrello valorizzate prezzo×quantità (carrello vuoto ⇒ avviso, nessun report).
// Il modello + HTML sono nell'engine puro (engine/report.ts), esposto da main.ts
// su window.miuComputoReport perché questo script classico non importa moduli ES.
export function openComputoPDF(){
  const rows=collectExportRows();
  if(!rows.length){ toast('Nessuna voce da mettere nel report','warn'); return; }
  if(typeof window.miuComputoReport!=='function'){ toast('Modulo report non pronto, riprova tra un attimo','warn'); return; }
  const items=rows.map(r=>{ const q=r._qty||S.qty[rowKey(r)];
    return { codice:r.codice, desc_short:r.desc_short, declaratoria:r.declaratoria,
      um:(q&&q.um)||r.um, prezzo:r.prezzo, qty:(q&&q.qty>0)?q.qty:null,
      regione:r.regione, anno:r.anno }; });
  const html=window.miuComputoReport(items, { now: Date.now() });
  const w=window.open('', '_blank');
  if(!w){ toast('Finestra bloccata: consenti i popup per aprire il report','warn'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// Export EXCEL del computo metrico (formato generico, nessun template esterno):
// una riga per voce con codice/descrizione/categoria/U.M./quantità/prezzo/importo
// + il totale. Stesso pattern SheetJS di exportFascicoloAP (dettaglio.js).
export function exportComputoExcel(){
  const rows=collectExportRows();
  if(!rows.length){ toast('Nessuna voce da esportare','warn'); return; }
  if(!window.computoMetricoAOA || typeof XLSX==='undefined'){ toast('Modulo Excel non pronto, riprova tra un attimo','warn'); return; }
  const righe=rows.map(r=>{
    const q=r._qty||S.qty[rowKey(r)];
    return {
      codice:r.codice||'',
      descrizione:(r.desc_short||r.declaratoria||'').replace(/\s+/g,' ').trim(),
      categoria:S.categoria[rowKey(r)]||'',
      um:(q&&q.um)||r.um||'',
      quantita:(q&&q.qty)||0,
      prezzoUnitario:r.prezzo||0,
    };
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, apBuildSheet(window.computoMetricoAOA(righe), [5,6], [4]), 'Computo Metrico');
  XLSX.writeFile(wb, window.computoMetricoFileName());
  toast(`${righe.length.toLocaleString('it')} voci esportate in Excel`,'ok');
}

// Oneri della sicurezza: scelta manuale (S.sicurezza) › flag della voce composta › capitolo del prezzario.
export function eSicurezza(k, r){
  const cu=S.custom.get(k);
  return voceDiSicurezza((S.sicurezza||{})[k], cu&&cu.sicurezza, r || (cu&&cu._ref?rowByKey(cu._ref):null) || rowByKey(k));
}
window.miuESicurezza=eSicurezza;
window.miuVociComputo=()=>vociComputoCondivise();
// Sotto il totale: quanto è a corpo e quanto oneri della sicurezza, e l'offerta aggiudicata.
export function cartScomposizioneHtml(){
  let corpo=0, sic=0;
  const voci=vociComputoCondivise();
  for(const v of voci){ const q=v.misurazioni&&v.misurazioni.length?v.misurazioni.reduce((s,m)=>s+(m.quantita||0),0):(v.qty||0); const imp=importoQta(q,v.prezzo,v.um);
    if(v.sicurezza) sic+=imp; else if(v.corpo) corpo+=imp; }
  const parti=[];
  if(corpo) parti.push(`a corpo € ${fmt(corpo)}`);
  if(sic) parti.push(`sicurezza € ${fmt(sic)}`);
  const agg=(S.offerte||[]).find(o=>o.id===S.aggiudicata);
  if(agg){ const e=valutaOfferte([agg], voci)[0]; parti.push(`aggiudicata a ${esc(agg.nome)}${e&&e.ribasso!=null?` (−${String(e.ribasso).replace('.',',')}%)`:''}`); }
  return parti.length?'di cui '+parti.join(' · '):'';
}
window.miuScomposizioneHtml=cartScomposizioneHtml;
// LA TESTATA DI FASE, la stessa della Contabilità (shared/griglia/testata.ts): dove
// sono, a che prezzi lavoro, a che punto è — e l'unico comando di stampa della schermata.
export function cartTestataHtml(map){
  const n=map.size+S.custom.size;
  const nRev=(Array.isArray(S.revisioni)?S.revisioni:[]).length;
  return testataHtml({
    titolo: CART_MODE==='categorizza' ? 'Categorizza' : FASE_PROGETTO.nome,
    sottotitolo: CART_MODE==='categorizza'
      ? `${n} voci · trascina una categoria su una voce, o selezionane più d'una col lazo`
      : `${n} voci`,
    idSottotitolo: 'cart-ov-count',
    pastiglie: [
      { testo:`progetto · ${NOME_FASE[faseCorrente()].toLowerCase()}`, tono:'fase' },
      { testo:'elenco prezzi proprio' },
      nRev ? { testo:`${nRev} revision${nRev===1?'e':'i'} congelat${nRev===1?'a':'e'}` } : { testo:'' },
    ],
    stampa: { onclick:'apriStampe()', titolo:'Tutte le stampe del lavoro: progetto, gara e contabilità' },
  });
}
// I valori di controllo in calce: il piede condiviso, con i valori della fase «progetto».
// Si ridisegna intero (cartPatchTotals) invece di ritoccarne i pezzi uno per uno.
export function cartPiedeHtml(T){
  return piedeFaseHtml(FASE_PROGETTO, { totale:T.tot, avviso:cartWarn(T), sotto:[cartMdoLineHtml(T), cartScomposizioneHtml()] }, (n)=>'€ '+fmt(n), {
    id:'cart-ov-piede',
    azioni:`<button class="ehb-btn-fam-danger-outline" onclick="clearCart();setStep('cerca')" style="padding:8px 14px;font-size:12px">Svuota computo</button>`,
    coda:`<button class="ehb-btn ehb-btn--ghost" onclick="setStep('cerca')" title="Torna alla ricerca (Esc)">Chiudi</button>`,
  });
}
window.miuPubblica=()=>{ publishComputo(); refreshCartOverlayIfOpen(); };
// Clic sul bollino SICUREZZA (o da menu): toglie/mette la voce tra gli oneri della sicurezza.
export function toggleSicurezzaVoce(k){
  const ora=!eSicurezza(k);
  S.sicurezza=S.sicurezza||{}; S.sicurezza[k]=ora;
  const it=S.custom.get(k); if(it){ if(ora) it.sicurezza=true; else delete it.sicurezza; }
  toast(ora?'Voce segnata come oneri della sicurezza':'Voce tolta dagli oneri della sicurezza','ok');
  publishComputo(); refreshCartOverlayIfOpen();
}
window.toggleSicurezzaVoce=toggleSicurezzaVoce;
// LAVORI A CORPO: la voce ha un prezzo complessivo fisso (qtà × prezzo del computo) e in
// contabilità si liquida a quote %; in stampa va nella sezione «LAVORI A CORPO».
export function toggleCorpoVoce(k){
  S.corpo=S.corpo||{};
  if(S.corpo[k]) delete S.corpo[k]; else S.corpo[k]=true;
  toast(S.corpo[k]?'Voce a corpo: prezzo complessivo fisso, contabilizzata a quote %':'Voce di nuovo a misura','ok');
  publishComputo(); refreshCartOverlayIfOpen();
}
window.toggleCorpoVoce=toggleCorpoVoce;
export function corpoChipHtml(k){
  const ek=k.replace(/'/g,"\\'");
  return (S.corpo||{})[k]
    ? `<span class="cm-np-tag" style="cursor:pointer" onclick="event.stopPropagation();toggleCorpoVoce('${ek}')" title="Lavoro a corpo — clic per tornare a misura">A CORPO</span>`
    : `<span class="cat3-chip empty" onclick="event.stopPropagation();toggleCorpoVoce('${ek}')" title="Lavoro a corpo (prezzo complessivo fisso, D.Lgs. 36/2023)">◫ a corpo</span>`;
}
// Interruttore sempre visibile sulla riga della voce: bollino pieno se è sicurezza, chip
// tratteggiata «⛑ sicurezza» se no — un clic la mette o la toglie.
export function sicurezzaChipHtml(k, r){
  const ek=k.replace(/'/g,"\\'");
  return eSicurezza(k, r)
    ? `<span class="cm-sic-tag" style="cursor:pointer" onclick="event.stopPropagation();toggleSicurezzaVoce('${ek}')" title="Oneri della sicurezza: non soggetti a ribasso — clic per togliere">SICUREZZA</span>`
    : `<span class="cat3-chip empty" onclick="event.stopPropagation();toggleSicurezzaVoce('${ek}')" title="Segna come oneri della sicurezza (non soggetti a ribasso)">⛑ sicurezza</span>`;
}
// Voci del computo nel formato condiviso (codice, descrizioni, prezzo, misure, categoria).
function vociComputoCondivise(){
  // con un'offerta aggiudicata (prezzi unitari) ogni voce porta anche il suo prezzo offerto
  const agg=(S.offerte||[]).find(o=>o.id===S.aggiudicata);
  return vociConOfferta(collectExportRows().map(r=>{
    const k=r._key||rowKey(r); const q=r._qty||S.qty[k]; const cu=S.custom.get(k)||{};
    return { np:cu.np||undefined, codiceOrig:cu.codiceOrig||undefined, analisiPrezzi:cu.analisiPrezzi?true:undefined, _key:k, codice:r.codice||'', desc_short:r.desc_short, declaratoria:r.declaratoria,
      regione:r.regione||cu.regione||undefined, anno:r.anno||cu.anno||undefined,
      um:(q&&q.um)||r.um||'', prezzo:r.prezzo||0, qty:(q&&q.qty)||0,
      categoria:S.categoria[k]||undefined, wbs:S.wbs[k]||undefined, misurazioni:(q&&q.misurazioni)||undefined,
      sicurezza:eSicurezza(k, r._custom?null:r)||undefined, corpo:(S.corpo||{})[k]||undefined, incMdo:_incMdo(cu, r) };
  }), agg);
}
// % manodopera di una voce: dall'analisi prezzi (calcolata) o dal prezzario/XPWE (R.U.).
function _incMdo(cu, r){
  if(cu.analisiPrezzi && window.calcolaAnalisi && window.incidenzaManodopera){
    try{ const v=window.incidenzaManodopera(window.calcolaAnalisi(cu.analisiPrezzi)); return v>0?v:undefined; }catch(e){ return undefined; }
  }
  const v=+(cu.ru ?? r.ru);
  return v>0?v:undefined;
}

// Stampa PDF del computo metrico estimativo (impaginato, con riporti e numerazione).
export async function exportComputoPdf(){
  const voci=vociComputoCondivise();
  if(!voci.length){ toast('Nessuna voce da stampare','warn'); return; }
  if(typeof window.miuComputoPdf!=='function'){ toast('Modulo di stampa non pronto, riprova tra un attimo','warn'); return; }
  const opz=window.miuOpzioniStampa?await window.miuOpzioniStampa(modoOrdine()):{};
  if(!opz) return;
  // l'ordine di stampa segue la scelta fatta nella finestra (di norma quello a schermo)
  if(opz.raggruppa && opz.raggruppa!==modoOrdine()){
    const pos=new Map(chiaviOrdinate(null, opz.raggruppa).map((k,i)=>[k,i]));
    voci.sort((a,b)=>(pos.get(a._key)??0)-(pos.get(b._key)??0));
  }
  toast('Preparo il PDF del computo…','ok');
  try{
    const { bytes, pagine }=await window.miuComputoPdf(voci, S.datiGenerali||{}, { ...opz, wbsNodi:S.wbsNodi });
    const nome=window.computoMetricoFileName().replace(/\.xlsx$/i,'');
    const nota=`${voci.length} voci · ${pagine} pagin${pagine===1?'a':'e'}`;
    if(window.miuAnteprimaPdf){ window.miuAnteprimaPdf(bytes,{ titolo:'Computo metrico', nomeFile:nome, nota }); return; }
    const blob=new Blob([bytes], { type:'application/pdf' });
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=nome+'.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
    toast(`Computo stampato: ${pagine} pagin${pagine===1?'a':'e'}`,'ok');
  }catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}


// ── Stampe di progetto oltre al computo (moduli puri su window.miuStampeProgetto) ──
/* OGNI stampa passa dall'anteprima: si guarda e poi, dalla stessa riga di
   pulsanti, si stampa o si salva. È lo stesso percorso degli atti della
   contabilità — un solo modo di stampare in tutto il programma. */
function _scaricaPdf(bytes, suffisso, nota){
  const nome=suffisso+window.computoMetricoFileName().replace(/\.xlsx$/i,'').replace(/^computo[-_ ]?metrico/i,'');
  if(window.miuAnteprimaPdf){ window.miuAnteprimaPdf(bytes,{ titolo:suffisso.replace(/-/g,' '), nomeFile:nome, nota:nota||'' }); return; }
  const blob=new Blob([bytes], { type:'application/pdf' });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=nome+'.pdf';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
window.miuScaricaPdf=(b,n)=>_scaricaPdf(b,n);
function _vociPerStampa(){
  const voci=vociComputoCondivise();
  if(!voci.length){ toast('Il computo è vuoto','warn'); return null; }
  if(!window.miuStampeProgetto){ toast('Modulo di stampa non pronto, riprova tra un attimo','warn'); return null; }
  return voci;
}
export async function exportElencoPrezziPdf(){
  const voci=_vociPerStampa(); if(!voci) return;
  try{ const r=await window.miuStampeProgetto.elenco(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Elenco-prezzi'); toast(`Elenco prezzi: ${r.n} voci, ${r.pagine} pagin${r.pagine===1?'a':'e'}`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// STIMA DELL'INCIDENZA DELLA MANODOPERA: importo e costo della manodopera voce per voce.
export async function exportIncidenzaMdo(){
  const voci=_vociPerStampa(); if(!voci) return;
  // stesso ordine e stessi titoli del computo (di norma quelli a schermo), riepiloghi a scelta
  const opz=window.miuOpzioniOrdine?await window.miuOpzioniOrdine(modoOrdine(),'Stampa dell\'incidenza della manodopera'):{};
  if(!opz) return;
  if(opz.raggruppa && opz.raggruppa!==modoOrdine()){
    const pos=new Map(chiaviOrdinate(null, opz.raggruppa).map((k,i)=>[k,i]));
    voci.sort((a,b)=>(pos.get(a._key)??0)-(pos.get(b._key)??0));
  }
  try{ const r=await window.miuStampeProgetto.incidenzaMdo(voci, S.datiGenerali||{}, { ...opz, wbsNodi:S.wbsNodi }); _scaricaPdf(r.bytes,'Incidenza-manodopera');
    toast(`Incidenza manodopera: ${r.incidenza.toFixed(2).replace('.',',')}%${r.senzaDato?` · ${r.senzaDato} voci senza % manodopera`:''}`, r.senzaDato?'warn':'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// ELENCO DEI NUOVI PREZZI: i soli NP, impaginati come l'elenco prezzi (con l'origine).
export async function exportElencoNP(){
  const voci=(_vociPerStampa()||[]).filter(v=>v.np||/^NP\b/i.test(v.codice||''));
  if(!voci.length){ toast('Nel computo non ci sono nuovi prezzi (NP)','warn'); return; }
  try{ const r=await window.miuStampeProgetto.elencoNP(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Elenco-nuovi-prezzi'); toast(`Elenco nuovi prezzi: ${r.n} prezzi`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// LISTA DELLE LAVORAZIONI E FORNITURE (offerta a prezzi unitari): colonne prezzo vuote.
export async function exportListaLavorazioni(){
  const voci=_vociPerStampa(); if(!voci) return;
  try{ const r=await window.miuStampeProgetto.lista(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Lista-lavorazioni-forniture'); toast(`Lista delle lavorazioni: ${r.n} voci, ${r.pagine} pagin${r.pagine===1?'a':'e'}`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// STIMA DELL'INCIDENZA DELLA SICUREZZA: le voci degli oneri e la loro incidenza sui lavori.
export async function exportIncidenzaSicurezza(){
  const voci=_vociPerStampa(); if(!voci) return;
  if(!voci.some(v=>v.sicurezza)){ toast('Nessuna voce segnata come oneri della sicurezza (⛑ sulla voce)','warn'); return; }
  try{ const r=await window.miuStampeProgetto.incidenzaSicurezza(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Incidenza-sicurezza'); toast(`Incidenza della sicurezza: ${r.incidenza.toFixed(2).replace('.',',')}%`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// VERBALE DI CONCORDAMENTO DEI NUOVI PREZZI: i soli NP, con il codice d'origine.
export async function exportVerbaleNP(){
  const voci=(_vociPerStampa()||[]).filter(v=>v.np||/^NP\b/i.test(v.codice||''));
  if(!voci.length){ toast('Nel computo non ci sono nuovi prezzi (NP)','warn'); return; }
  try{ const r=await window.miuStampeProgetto.verbaleNP(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Verbale-nuovi-prezzi'); toast(`Verbale nuovi prezzi: ${r.n} prezzi, ${r.pagine} pagin${r.pagine===1?'a':'e'}`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
export async function exportStimaLavoriPdf(){
  const voci=_vociPerStampa(); if(!voci) return;
  try{ const r=await window.miuStampeProgetto.stima(voci, S.datiGenerali||{}); _scaricaPdf(r.bytes,'Stima-lavori'); toast(`Stima dei lavori: ${r.pagine} pagin${r.pagine===1?'a':'e'}`,'ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
export async function apriQuadroEconomico(){
  const voci=_vociPerStampa(); if(!voci) return;
  const esito=await window.miuStampeProgetto.modifica(voci, S.quadroEconomico||{});
  if(!esito) return;
  S.quadroEconomico=esito.stato;
  if(!esito.stampa){ toast('Quadro economico salvato','ok'); return; }
  try{ const r=await window.miuStampeProgetto.qe(voci, S.datiGenerali||{}, S.quadroEconomico); _scaricaPdf(r.bytes,'Quadro-economico'); toast('Quadro economico stampato','ok'); }
  catch(e){ toast('Errore nella stampa: '+((e&&e.message)||e),'warn'); }
}
// Voci degli ONERI DELLA SICUREZZA (non soggette a ribasso): flag sulle voci selezionate.
export function segnaSicurezzaSelezione(){
  const keys=[...CART_SEL];
  if(!keys.length){ toast('Seleziona prima una o più voci','warn'); return; }
  const reali=cartRows();
  const tutte=keys.every(k=>eSicurezza(k, reali.get(k)));
  S.sicurezza=S.sicurezza||{};
  for(const k of keys){ S.sicurezza[k]=!tutte; const it=S.custom.get(k); if(it){ if(tutte) delete it.sicurezza; else it.sicurezza=true; } }
  toast(tutte?`${keys.length} voc${keys.length===1?'e non è più':'i non sono più'} di sicurezza`:`${keys.length} voc${keys.length===1?'e segnata':'i segnate'} come oneri della sicurezza`,'ok');
  publishComputo(); refreshCartOverlayIfOpen();
}

// WBS in blocco: lo stesso codice (e descrizione) a tutte le voci selezionate.
export async function assegnaWbsSelezione(){
  const keys=[...CART_SEL];
  if(!keys.length){ toast('Seleziona prima una o più voci','warn'); return; }
  if(!window.miuChiediWbs) return;
  const testo=await window.miuChiediWbs(keys.length, S.wbsNodi||{});
  if(testo==null) return;
  for(const k of keys) setWbs(k, testo);
  toast(testo.trim()?`WBS ${testo.trim().split(/\s+/)[0]} assegnata a ${keys.length} voc${keys.length===1?'e':'i'}`:`WBS tolta da ${keys.length} voc${keys.length===1?'e':'i'}`,'ok');
}

// Scheda DATI GENERALI del progetto (oggetto, luogo, CUP/CIG, committente, tecnici,
// impresa, prezzario): form condiviso su window.miuDatiGeneraliLib (main.ts).
/* I dati del lavoro arrivano anche dalla Contabilità: completano i campi
   ancora vuoti, senza mai sovrascrivere quello che è stato scritto qui. */
window.miuCompletaDatiGenerali=(dg)=>{
  if(!dg||!window.miuDatiGeneraliLib) return;
  const prima=JSON.stringify(S.datiGenerali||{});
  S.datiGenerali=window.miuDatiGeneraliLib.completa(S.datiGenerali, dg);
  if(JSON.stringify(S.datiGenerali)!==prima){ window.miuAggiornaDgRail&&window.miuAggiornaDgRail(); }
};
export async function apriDatiGenerali(){
  if(!window.miuDatiGeneraliLib){ toast('Modulo non pronto, riprova tra un attimo','warn'); return; }
  const dg=await window.miuDatiGeneraliLib.apri(S.datiGenerali||{});
  if(!dg) return;
  S.datiGenerali=dg;
  window.miuAggiornaDgRail&&window.miuAggiornaDgRail();
  publishComputo();
  toast('Dati generali salvati','ok');
}

// Export XPWE del computo metrico: elenco prezzi + voci con le righe di
// misura e le categorie (fino a 3 livelli). Il modulo puro è su window.miuXpwe.
export function exportComputoXpwe(){
  const rows=collectExportRows();
  if(!rows.length){ toast('Nessuna voce da esportare','warn'); return; }
  if(!window.miuXpwe){ toast('Modulo XPWE non pronto, riprova tra un attimo','warn'); return; }
  const voci=vociComputoCondivise();
  const dg=S.datiGenerali||{};
  const xml=window.miuXpwe.buildXpwe(voci, { sorgente:'Quadra', datiGenerali:{ oggetto:dg.oggetto, committente:dg.committente, comune:dg.comune, provincia:dg.provincia, impresa:dg.impresa } });
  const blob=new Blob([xml], { type:'application/xml' });
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=window.computoMetricoFileName().replace(/\.xlsx$/i,'')+'.xpwe';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  toast(`${voci.length.toLocaleString('it')} voci esportate in XPWE`,'ok');
}

// Import di un computo XPWE: ogni voce di computo entra nell'Elenco
// Prezzi come voce propria (codice/descrizioni/prezzo del file), con le sue
// righe di misura e la categoria. Non sostituisce le voci già presenti.
export async function importComputoXpwe(file){
  if(!window.miuXpwe){ toast('Modulo XPWE non pronto, riprova tra un attimo','warn'); return; }
  let doc;
  try { doc=window.miuXpwe.parseXpwe(await file.text()); }
  catch(e){ toast('File XPWE non leggibile: '+((e&&e.message)||e),'warn'); return; }
  const voci=window.miuXpwe.xpweToVoci(doc);
  if(!voci.length){ toast('Il file XPWE non contiene voci di computo','warn'); return; }
  /* In quale FASE entra il computo importato: un esecutivo arrivato da fuori è
     un esecutivo, non un PFTE da far avanzare a forza di «Passa al…». */
  const scelta=await chiediFaseImport(file.name, voci.length);
  if(!scelta) return;
  if(scelta.modo==='sostituisci' && (S.sel.size||S.custom.size)){
    if(scelta.congela) congelaComputoInCorso();
    svuotaComputoInCorso();
  }
  S.faseProgetto=scelta.fase;
  // dati generali del file: completano quelli del progetto, senza sovrascrivere
  if(window.miuDatiGeneraliLib){ S.datiGenerali=window.miuDatiGeneraliLib.completa(S.datiGenerali, doc.datiGenerali); window.miuAggiornaDgRail&&window.miuAggiornaDgRail(); }
  caricaVociNelComputo(voci, 'xpwe');
  if(doc.ordineCategorie){
    if(!Array.isArray(S.ordineCat)||S.ordineCat.length!==3) S.ordineCat=[[],[],[]];
    doc.ordineCategorie.forEach((nomi,i)=>{ for(const n of nomi) if(!S.ordineCat[i].includes(n)) S.ordineCat[i].push(n); });
  }
  updateCartInfo(); render(); publishComputo(); refreshCartOverlayIfOpen();
  const avv=doc.avvisi.length?` — ${doc.avvisi.length} avvisi (vedi console)`:'';
  if(doc.avvisi.length) console.warn('[XPWE] '+doc.avvisi.join('\n'));
  toast(`${voci.length.toLocaleString('it')} voci importate da ${file.name} nel ${NOME_FASE[faseCorrente()]}${avv}`, doc.avvisi.length?'warn':'ok');
}

// Mette delle voci (da un file, da una revisione) nel computo in corso, come voci
// di computo modificabili: prezzo, misure, categoria, WBS, sicurezza, a corpo.
export function caricaVociNelComputo(voci, origine){
  for(const v of voci){
    const k=nextCustomKey();
    S.custom.set(k, { codice:v.codice, desc_short:v.desc_short||v.codice, declaratoria:v.declaratoria||v.desc_short||'',
      um:v.um||'', prezzo:(v.prezzo>0?v.prezzo:null), famigliaId:null, famNome:'', source:origine, sicurezza:!!v.sicurezza||undefined, ru:v.incMdo||undefined });
    const q={ qty:v.qty||0, um:v.um||'', source:'xls' };
    if(v.misurazioni&&v.misurazioni.length) q.misurazioni=v.misurazioni.map(m=>({ ...m }));
    if(q.qty>0||q.misurazioni) S.qty[k]=q;
    if(v.categoria) S.categoria[k]=v.categoria;
    if(v.wbs){ S.wbs[k]=v.wbs; if(!(v.wbs in S.wbsNodi)) S.wbsNodi[v.wbs]=''; }
    if(v.sicurezza){ S.sicurezza=S.sicurezza||{}; S.sicurezza[k]=true; }
    if(v.corpo){ S.corpo=S.corpo||{}; S.corpo[k]=true; }
  }
}
// Svuota il computo in corso SENZA chiedere: chi chiama ha già chiesto (e di
// solito ha appena congelato quello che c'era). Le revisioni non si toccano.
export function svuotaComputoInCorso(){
  for(const k of [...S.sel, ...S.custom.keys()]){
    delete S.qty[k]; delete S.categoria[k];
    if(S.wbs) delete S.wbs[k]; if(S.sicurezza) delete S.sicurezza[k]; if(S.corpo) delete S.corpo[k];
  }
  S.sel.clear(); S.custom.clear(); S.ordine=[]; MIS_OPEN.clear();
}
// Congela il computo in corso in una revisione col nome della sua fase. Null se è vuoto.
export function congelaComputoInCorso(){
  const a=window.miuRevisioni, voci=vociComputoCondivise();
  if(!a || !voci.length) return null;
  const ora=faseCorrente();
  S.revisioni=Array.isArray(S.revisioni)?S.revisioni:[];
  const rev=a.snapshot(voci, { id:'rev'+Date.now().toString(36), nome:NOME_FASE[ora], fase:ora, data:new Date().toLocaleDateString('it-IT'), ts:Date.now() });
  S.revisioni.push(rev);
  return rev;
}

// La finestra che chiede in quale fase entra un computo importato.
function chiediFaseImport(nomeFile, n){
  return new Promise((risolvi)=>{
    const pieno=S.sel.size||S.custom.size;
    const ov=document.createElement('div');
    ov.id='fase-overlay'; ov.className='overlay open'; ov.style.zIndex='10060';
    const chiudi=(v)=>{ ov.remove(); risolvi(v); };
    ov.onclick=(e)=>{ if(e.target===ov) chiudi(null); };
    ov.innerHTML=`<div id="qe-box" style="max-width:620px;width:min(620px,94vw)">
      <div class="qe-hd"><h3>⇩ Importa ${esc(nomeFile)}</h3><span class="cmp-sp"></span><button class="cmp-close" data-esito="no">Esc ✕</button></div>
      <div class="qe-body">
        <p style="margin:0 0 10px;font-size:12px;color:var(--text3)">${n} voci. In quale <b>fase</b> del progetto entra questo computo? Un esecutivo arrivato da fuori è un esecutivo: non serve farlo passare dal PFTE.</p>
        <fieldset class="ctr-scelta"><legend>Fase</legend>
          ${FASI_PROGETTO.map(f=>`<label><input type="radio" name="imp-fase" value="${f}" ${f===faseCorrente()?'checked':''}><span><b>${NOME_FASE[f]}</b>${f===faseCorrente()?' <span class="ctr-muto">· la fase di adesso</span>':''}</span></label>`).join('')}
        </fieldset>
        ${pieno?`<fieldset class="ctr-scelta"><legend>Il computo di adesso (${S.sel.size+S.custom.size} voci)</legend>
          <label><input type="radio" name="imp-modo" value="sostituisci" checked><span>Lo sostituisce, dopo averlo <b>congelato</b> come revisione «${esc(NOME_FASE[faseCorrente()])}»</span></label>
          <label><input type="radio" name="imp-modo" value="aggiungi"><span>Si aggiunge alle sue voci</span></label>
        </fieldset>`:''}
      </div>
      <div class="qe-ft"><button class="ehb-btn ehb-btn--ghost" data-esito="no">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" data-esito="si">Importa</button></div>
    </div>`;
    ov.addEventListener('click',(e)=>{
      const b=e.target.closest('[data-esito]'); if(!b) return;
      if(b.dataset.esito!=='si'){ chiudi(null); return; }
      const fase=(ov.querySelector('input[name="imp-fase"]:checked')||{}).value||faseCorrente();
      const modo=pieno?((ov.querySelector('input[name="imp-modo"]:checked')||{}).value||'sostituisci'):'aggiungi';
      chiudi({ fase, modo, congela:modo==='sostituisci' });
    });
    document.body.appendChild(ov);
  });
}
