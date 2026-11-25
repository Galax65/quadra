/*
  L'ALBERO DEL LAVORO in sidebar.

  È la cronologia del lavoro e, insieme, la sua unica navigazione: i capitoli
  (Computo, Contabilità, Perizie, Chiusura), dentro i capitoli le tappe in
  ordine cronologico — contratto, SAL, perizie, conto finale — e dentro ogni
  tappa i suoi ATTI, che si aprono a tutta pagina.

  Un ramo si apre e si chiude; cliccarlo porta alla tappa, cliccare una foglia
  apre direttamente quel documento. Prima la stessa navigazione stava in tre
  posti (qui, la linea del tempo e un muro di schede al centro): si cercava la
  stessa cosa in tre modi e non si trovava in nessuno.

  I rami li pubblica chi tiene la tappa: il Computo il progetto (il computo in
  corso e le revisioni congelate), la Contabilità il resto (contratto, SAL,
  perizie, chiusura). Qui si uniscono in un albero solo (unisciAlberi): il
  lavoro è uno, anche se gli strumenti sono due.
*/
import { TITOLO_RAMO, perCapitoliAlbero, siglaRevisione, unisciAlberi } from '../../shared/revisioni';
import { escHtml } from './shell.js';
import { apriMenuContestuale } from '../../shared/ui/components/menu';

let albero = [];
let azioni = [];
/** I rami pubblicati da ciascuno strumento, prima di unirli. */
const perTool = {};
/** Rami aperti: si ricordano fra un ridisegno e l'altro. */
const aperti = new Set();
/** L'atto aperto adesso, per tenerlo evidenziato: «fase∣tipo». */
let corrente = '';
/** Al primo albero che arriva si apre la tappa in bozza: è lì che si lavora. */
let primaVolta = true;

/** Riceve i rami di uno strumento (dal suo stato di progetto) e ridisegna l'albero intero. */
export function setAlberoLavoro(rami, nuoveAzioni, tool = 'contabilita') {
  const prima = perTool[tool] || {};
  perTool[tool] = {
    rami: Array.isArray(rami) ? rami : [],
    azioni: Array.isArray(nuoveAzioni) ? nuoveAzioni : (prima.azioni || []),
  };
  const u = unisciAlberi(perTool);
  albero = u.rami;
  azioni = u.azioni;
  if (primaVolta && albero.length) {
    primaVolta = false;
    const viva = albero.find(r => r.stato === 'bozza') || albero[albero.length - 1];
    if (viva) aperti.add(viva.fase);
  }
  renderRevisioni();
}

/** Ricomincia da zero: un progetto nuovo o appena aperto non ha ancora rami. */
export function azzeraAlbero() {
  for (const k of Object.keys(perTool)) delete perTool[k];
  sezioni = null; azioniSezioni = []; correnteLavoro = null;
  albero = []; azioni = []; aperti.clear(); corrente = ''; primaVolta = true;
  renderRevisioni();
}

/** Compatibilità: la vecchia catena piatta vale come albero senza atti. */
export function setRevisioni(rev) {
  if (perTool.contabilita) return;
  setAlberoLavoro((Array.isArray(rev) ? rev : []).map(r => ({
    fase: r.fase || '', etichetta: r.etichetta, dataIt: r.dataIt, stato: r.stato,
    rev: r.n, leggeDa: r.leggeDa, capitolo: 'contabilita', tool: r.tool || 'contabilita',
    nota: r.voci ? `${r.voci} voci` : undefined, atti: [],
  })));
}

/* ── L'ALBERO DI «LAVORO» (Docs/07-Un-lavoro-un-modulo.md) ────────────────
   Lo strumento unico pubblica il suo albero già fatto, a SEZIONI (dati del
   lavoro, analisi prezzi, elenco prezzi, computo, contratto, contabilità):
   l'hub lo disegna e basta. Le sezioni si chiudono; sotto ogni tappa, chiusi,
   i suoi documenti. Quando c'è, prende il posto dell'albero dei due strumenti
   vecchi. */
let sezioni = null;
let azioniSezioni = [];
let correnteLavoro = null;
let toolLavoro = 'lavoro';
const sezChiuse = new Set();
const docAperti = new Set();

export function setSezioniLavoro(nuove, azioni, corrente, tool = 'lavoro') {
  sezioni = Array.isArray(nuove) ? nuove : null;
  azioniSezioni = Array.isArray(azioni) ? azioni : [];
  correnteLavoro = corrente || null;
  toolLavoro = tool;
  renderRevisioni();
}

function renderSezioni(list, label, count) {
  label.hidden = false;
  const tappe = sezioni.filter(s => ['computo', 'contratto', 'contabilita'].includes(s.id)).reduce((n, s) => n + s.nodi.length, 0);
  if (count) count.textContent = tappe;
  list.innerHTML = sezioni.map(s => {
    const chiusa = sezChiuse.has(s.id);
    const azioni = azioniSezioni.filter(a => a.sezione === s.id);
    return `<div class="lv-sez" data-sez="${escHtml(s.id)}">
      <button type="button" class="nav-group-title lv-sez__t" aria-expanded="${!chiusa}"
        onclick="toggleSezioneLavoro('${escHtml(s.id)}')" oncontextmenu="menuSezioneLavoro(event,'${escHtml(s.id)}')"><span class="lv-sez__tw">${chiusa ? '▸' : '▾'}</span>${escHtml(s.titolo)}${s.nodi.length && ['computo', 'contabilita', 'prezzi'].includes(s.id) ? `<span class="lv-sez__n">${s.nodi.length}</span>` : ''}</button>
      ${chiusa ? '' : s.nodi.map(nodoHTML).join('') + azioni.map(a => azioneHTML({ ...a, tool: toolLavoro })).join('')}
    </div>`;
  }).join('');
}

function nodoHTML(n) {
  const id = n.apre.id || n.apre.cosa;
  const docs = Array.isArray(n.documenti) ? n.documenti : [];
  const apertiDoc = docAperti.has(id);
  const attivo = correnteLavoro && (n.apre.id === correnteLavoro || (n.apre.cosa === 'pagina' && `§${n.apre.id}` === correnteLavoro)
    || ((n.apre.cosa === 'dati' || n.apre.cosa === 'contabilita') && `§${n.apre.cosa}` === correnteLavoro)
    || (n.apre.cosa === 'prezzario' && `§prezzario:${n.apre.id}` === correnteLavoro));
  return `
    <div class="rev-item lv-nodo${n.stato === 'aperta' ? ' is-bozza' : ''}${attivo ? ' is-attivo' : ''}" role="button" tabindex="0"
         onclick="apriNodoLavoro('${escHtml(n.apre.cosa)}','${escHtml(n.apre.id || '')}')"
         onkeydown="if(event.key==='Enter')apriNodoLavoro('${escHtml(n.apre.cosa)}','${escHtml(n.apre.id || '')}')"
         oncontextmenu="menuNodoLavoro(event,'${escHtml(chiaveNodo(n.apre))}')"
         title="${escHtml(n.etichetta)}${n.nota ? ' — ' + escHtml(n.nota) : ''}">
      <span class="rev-tw">${docs.length ? `<button type="button" class="lv-doc-tw" aria-expanded="${apertiDoc}" title="${apertiDoc ? 'Nascondi' : 'Mostra'} i documenti"
        onclick="event.stopPropagation();toggleDocLavoro('${escHtml(id)}')">${apertiDoc ? '▾' : '▸'}</button>` : '·'}</span>
      <span class="rev-meta">
        <span class="rev-name">${escHtml(n.etichetta)}${n.sigla ? ` <span class="rev-n">${escHtml(n.sigla)}</span>` : ''}</span>
        ${n.nota ? `<span class="rev-nota" title="${escHtml(n.nota)}">${escHtml(n.nota)}</span>` : ''}
      </span>
      ${n.stato === 'chiusa' ? '<span class="lv-lucchetto" title="Chiusa: in sola lettura">🔒</span>' : n.stato === 'aperta' ? '<span class="nav-badge beta">aperta</span>' : ''}
    </div>
    ${apertiDoc && docs.length ? `<div class="rev-atti">${docs.map(d => `
      <div class="rev-atto is-stampa" role="button" tabindex="0"
           onclick="apriDocumentoLavoro('${escHtml(n.apre.id || '')}','${escHtml(d.tipo)}')"
           oncontextmenu="menuDocLavoro(event,'${escHtml(n.apre.id || '')}','${escHtml(d.tipo)}','${escHtml(d.titolo)}')"
           onkeydown="if(event.key==='Enter')apriDocumentoLavoro('${escHtml(n.apre.id || '')}','${escHtml(d.tipo)}')"
           title="${escHtml(d.titolo)}"><span class="rev-atto__i">⎙</span><span class="rev-atto__n">${escHtml(d.titolo)}</span></div>`).join('')}</div>` : ''}`;
}

/* ── Il tasto destro nell'albero (tappa 7) ─────────────────────────────────
   Il menu è quello condiviso (shared/ui/components/menu.ts); le voci di ogni
   nodo le pubblica lo strumento con l'albero, e il comando scelto torna a lui. */
const chiaveNodo = (a) => (a.cosa === 'tappa' ? a.id || '' : a.cosa === 'prezzario' ? `prezzario:${a.id}` : a.cosa === 'pagina' ? `pagina:${a.id}` : a.cosa);

function nodoPerChiave(k) {
  for (const s of sezioni || []) for (const n of s.nodi) if (chiaveNodo(n.apre) === k) return n;
  return null;
}
const aComando = (v) => (v === 'sep' ? 'sep' : {
  etichetta: v.etichetta, titolo: v.titolo, pericolo: v.pericolo,
  azione: () => alTool(toolLavoro, { type: 'hub:comando', comando: v.comando }),
});

export function menuNodoLavoro(ev, k) {
  ev.preventDefault();
  const n = nodoPerChiave(k);
  if (!n) return;
  const menu = Array.isArray(n.menu) ? n.menu : [];
  const docs = Array.isArray(n.documenti) ? n.documenti : [];
  const id = n.apre.id || n.apre.cosa;
  apriMenuContestuale(ev.clientX, ev.clientY, [
    ...(menu.length ? menu.map(aComando) : [{ etichetta: 'Apri', azione: () => apriNodoLavoro(n.apre.cosa, n.apre.id || '') }]),
    ...(docs.length ? ['sep', { etichetta: docAperti.has(id) ? '▾ Nascondi i documenti' : '▸ Mostra i documenti', azione: () => toggleDocLavoro(id) }] : []),
  ], { titolo: `${n.etichetta}${n.sigla ? ' ' + n.sigla : ''}` });
}

export function menuSezioneLavoro(ev, sezId) {
  ev.preventDefault();
  const s = (sezioni || []).find((x) => x.id === sezId);
  if (!s) return;
  const chiusa = sezChiuse.has(sezId);
  apriMenuContestuale(ev.clientX, ev.clientY, [
    ...azioniSezioni.filter((a) => a.sezione === sezId).map((a) => ({ etichetta: a.etichetta, titolo: a.titolo, azione: () => comandoAlbero(a.comando, toolLavoro) })),
    'sep',
    { etichetta: chiusa ? '▾ Apri la sezione' : '▸ Chiudi la sezione', azione: () => toggleSezioneLavoro(sezId) },
    { etichetta: '▾ Apri tutte le sezioni', azione: () => { sezChiuse.clear(); renderRevisioni(); } },
    { etichetta: '▸ Chiudi le altre', azione: () => { for (const x of sezioni) if (x.id !== sezId) sezChiuse.add(x.id); sezChiuse.delete(sezId); renderRevisioni(); } },
  ], { titolo: s.titolo });
}

export function menuDocLavoro(ev, id, tipo, titolo) {
  ev.preventDefault();
  apriMenuContestuale(ev.clientX, ev.clientY, [
    { etichetta: '⎙ Anteprima e stampa', azione: () => apriDocumentoLavoro(id, tipo) },
  ], { titolo });
}

export function toggleSezioneLavoro(id) { if (sezChiuse.has(id)) sezChiuse.delete(id); else sezChiuse.add(id); renderRevisioni(); }
export function toggleDocLavoro(id) { if (docAperti.has(id)) docAperti.delete(id); else docAperti.add(id); renderRevisioni(); }
export function apriNodoLavoro(cosa, id) {
  correnteLavoro = cosa === 'tappa' ? id : correnteLavoro;
  alTool(toolLavoro, { type: 'hub:vai-a', fase: cosa === 'tappa' ? id : cosa === 'prezzario' ? `prezzario:${id}` : cosa === 'pagina' ? `pagina:${id}` : cosa });
  renderRevisioni();
}
export function apriDocumentoLavoro(id, tipo) { alTool(toolLavoro, { type: 'hub:apri-documento', fase: id, tipo }); }

export function renderRevisioni() {
  const list = document.getElementById('rev-list');
  const label = document.getElementById('rev-label');
  const count = document.getElementById('rev-count');
  if (!list || !label) return;
  if (sezioni) { renderSezioni(list, label, count); return; }
  if (!albero.length) { list.innerHTML = ''; label.hidden = true; return; }
  label.hidden = false;
  if (count) count.textContent = albero.length;
  /* I capitoli esistono anche quando sono ancora vuoti ma c'è qualcosa da
     avviarci: è lì che si clicca per far crescere il lavoro. */
  const gruppi = perCapitoliAlbero(albero);
  const ordine = ['lavoro', 'computo', 'contabilita', 'perizia', 'chiusura'];
  for (const a of azioni) {
    if (gruppi.some(g => g.capitolo === a.capitolo)) continue;
    gruppi.push({ capitolo: a.capitolo, titolo: TITOLO_RAMO[a.capitolo] || a.capitolo, rami: [] });
  }
  gruppi.sort((x, y) => ordine.indexOf(x.capitolo) - ordine.indexOf(y.capitolo));
  /* Il capitolo «Lavoro» (i dati generali) non ripete il titolo: la sezione
     sopra si chiama già LAVORO, e due «LAVORO» uno sotto l'altro sembravano un errore. */
  list.innerHTML = gruppi.map(g => `
    ${g.capitolo === 'lavoro' ? '' : `<div class="nav-group-title">${escHtml(g.titolo)}</div>`}
    ${g.rami.map(ramoHTML).join('')}
    ${azioni.filter(a => a.capitolo === g.capitolo).map(azioneHTML).join('')}`).join('');
}

function azioneHTML(a) {
  return `<div class="rev-azione" role="button" tabindex="0" title="${escHtml(a.titolo || a.etichetta)}"
    onclick="comandoAlbero('${escHtml(a.comando)}','${escHtml(a.tool || 'contabilita')}')"
    onkeydown="if(event.key==='Enter')comandoAlbero('${escHtml(a.comando)}','${escHtml(a.tool || 'contabilita')}')">${escHtml(a.etichetta)}</div>`;
}

/** Crea (o elimina) una tappa: il comando va allo strumento che la tiene. */
export function comandoAlbero(comando, tool = 'contabilita') {
  alTool(tool, { type: 'hub:comando', comando });
}

function ramoHTML(r) {
  const tool = r.tool || 'contabilita';
  const apribile = r.atti.length > 0;
  const stati = (r.stati || []).filter(x => x && x.valore);
  const aperto = apribile && aperti.has(r.fase);
  const nota = [
    r.dataIt || '',
    r.leggeDa != null ? `prezzi ${siglaRevisione(r.leggeDa)}` : '',
    r.nota || '',
  ].filter(Boolean).join(' · ');
  const sigla = r.rev != null ? siglaRevisione(r.rev) : '';
  const attivo = corrente.startsWith(`${r.fase}|`);
  return `
    <div class="rev-item${r.stato === 'bozza' ? ' is-bozza' : ''}${attivo ? ' is-attivo' : ''}" data-tool="${escHtml(tool)}"
         onclick="apriRamo('${escHtml(tool)}','${escHtml(r.fase)}',${apribile},'${escHtml(r.apre || '')}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter')apriRamo('${escHtml(tool)}','${escHtml(r.fase)}',${apribile},'${escHtml(r.apre || '')}')"
         title="${escHtml(r.etichetta)}${r.stato === 'bozza' ? ' — in bozza' : ''}">
      <span class="rev-tw">${apribile ? (aperto ? '▾' : '▸') : '·'}</span>
      ${sigla ? `<span class="rev-n">${sigla}</span>` : ''}
      <span class="rev-meta">
        <span class="rev-name">${escHtml(r.etichetta)}</span>
        ${nota ? `<span class="rev-nota" title="${escHtml(nota)}">${escHtml(nota)}</span>` : ''}
      </span>
      ${r.stato === 'bozza' ? '<span class="nav-badge beta">bozza</span>' : ''}
      ${r.elimina ? `<button type="button" class="rev-del" title="Elimina questa tappa"
        onclick="event.stopPropagation();comandoAlbero('${escHtml(r.elimina)}','${escHtml(tool)}')">✕</button>` : ''}
    </div>
    ${stati.length ? `<div class="rev-stati">${stati.map(x =>
      `<div class="rev-stato" title="${escHtml(x.etichetta)}: ${escHtml(x.valore)}"><span>${escHtml(x.etichetta)}</span><b>${escHtml(x.valore)}</b></div>`).join('')}</div>` : ''}
    ${aperto ? `<div class="rev-atti">${r.atti.map(a => attoHTML(tool, r.fase, a)).join('')}</div>` : ''}`;
}

/* Due cose diverse, e si devono distinguere a colpo d'occhio: le schermate
   DI LAVORO, dove si scrive, e le ANTEPRIME di stampa, che mostrano l'atto
   esattamente come verrà emesso e non si modificano. */
function attoHTML(tool, fase, a) {
  const k = `${fase}|${a.tipo}`;
  return `
    <div class="rev-atto${a.lavoro ? ' is-lavoro' : ' is-stampa'}${corrente === k ? ' is-attivo' : ''}" role="button" tabindex="0"
         onclick="apriAtto('${escHtml(tool)}','${escHtml(fase)}','${escHtml(a.tipo)}')"
         onkeydown="if(event.key==='Enter')apriAtto('${escHtml(tool)}','${escHtml(fase)}','${escHtml(a.tipo)}')"
         title="${escHtml(a.label)}${a.art ? ' — ' + escHtml(a.art) : ''}">
      <span class="rev-atto__i">${a.lavoro ? '✎' : '⎙'}</span>
      <span class="rev-atto__n">${escHtml(a.label)}</span>
      ${a.art ? `<span class="rev-atto__art">${escHtml(a.art)}</span>` : ''}
    </div>`;
}

/** Parla al tool che tiene la fase, e lo porta davanti: quello che si apre
 *  dall'albero si deve vedere. Prima, se il tool era già caricato, il messaggio
 *  arrivava al riquadro NASCOSTO — «Importa un computo» apriva la sua finestra
 *  dietro lo strumento a schermo, e sembrava non fare niente. */
function alTool(tool, msg) {
  const gia = document.querySelector(`iframe[data-app="${tool}"]`);
  window.launchApp?.(tool);
  const manda = () => document.querySelector(`iframe[data-app="${tool}"]`)?.contentWindow?.postMessage(msg, '*');
  if (gia) manda(); else setTimeout(manda, 400);
}

/** Un ramo: apre o chiude gli atti, e intanto porta alla tappa. */
export function apriRamo(tool, fase, apribile, apre) {
  if (apribile) { if (aperti.has(fase)) aperti.delete(fase); else aperti.add(fase); }
  if (apre) { apriAtto(tool, fase, apre); return; }
  if (fase) { corrente = ''; alTool(tool, { type: 'hub:vai-a', fase }); }
  renderRevisioni();
}

/** Apri tutto / chiudi tutto, come la coppia di pulsanti sopra un albero. */
export function espandiRami(tutti) {
  /* L'albero di «Lavoro»: ⊞ apre tutte le sezioni e i documenti di ogni tappa;
     ⊟ chiude prima i documenti e, al clic dopo, anche le sezioni. */
  if (sezioni) {
    if (tutti) {
      sezChiuse.clear();
      for (const s of sezioni) for (const n of s.nodi) if (Array.isArray(n.documenti) && n.documenti.length) docAperti.add(n.apre.id || n.apre.cosa);
    } else if (docAperti.size) {
      docAperti.clear();
    } else {
      for (const s of sezioni) sezChiuse.add(s.id);
    }
    renderRevisioni();
    return;
  }
  aperti.clear();
  if (tutti) for (const r of albero) if (r.atti.length) aperti.add(r.fase);
  renderRevisioni();
}

/** Una foglia: apre quel documento a tutta pagina. */
export function apriAtto(tool, fase, tipo) {
  corrente = `${fase}|${tipo}`;
  alTool(tool, { type: 'hub:apri-documento', fase, tipo });
  renderRevisioni();
}

/** Compatibilità con il vecchio nome. */
export function apriRevisione(tool, fase) { apriRamo(tool, fase, false, ''); }
