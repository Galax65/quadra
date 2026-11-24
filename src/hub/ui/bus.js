/* hub — il bus: stato condiviso fra i tool e listener dei messaggi dai frame. */
import { valida } from '../../shared/memoria-studio'
import { APP_REGISTRY } from '../data/registry'
import { emptyHubProjectState, ensureProjectId, projectStateMessages, setToolProject, sourceForApp } from '../engine/index'
import { loadUsers, refreshToolVisibility } from './auth.js'
import { goHome, hideOverlay, launchApp, loadedFrames } from './frames.js'
import { _collector, markProjectDirty } from './progetto.js'
import { setAlberoLavoro, setRevisioni, setSezioniLavoro } from './revisioni-nav.js'
import { setTheme, suiteTheme } from './tema.js'

/* ══════════════════════════════════════════════
   STATO CONDIVISO TRA APP (single source of truth)
   L'hub fa da bus: riceve lo stato da un'app e lo
   ritrasmette alle altre (es. un computo verso Contabilità).
   ══════════════════════════════════════════════ */
// UNA istanza di progetto corrente — identità (id/name) + stato per-appId GENERICO
// (niente più phiProject/pricelistComputo/tauComputo hard-coded; inclusi pi/lambda e ogni tool).
export let hubState; // { id, name, tools: { [appId]: project } }
// AVVIO SEMPRE PULITO (richiesta utente: niente residui di altri progetti): l'app
// parte da un progetto NUOVO e vuoto; per riprendere un lavoro si usa «Apri
// progetto» (.ehub). Non si ripristina più silenziosamente la sessione precedente.
// Il progetto vuoto riceve SUBITO un'identità: si entra direttamente al lavoro, senza
// la vecchia schermata bloccante «Prima di iniziare». Nuovo/Apri/Salva restano nella
// sidebar e nella barra del tool; al primo salvataggio si sceglie il nome del file.
hubState = ensureProjectId(emptyHubProjectState(),
  () => 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
try { localStorage.removeItem('hub:state'); } catch(e) {}

export function persistHubState() {
  try {
    localStorage.setItem('hub:state', JSON.stringify(hubState));
  } catch(e) {}
}
export function relayToFrames(msg, exceptWindow) {
  Object.values(loadedFrames).forEach(f => {
    if (exceptWindow && f.contentWindow === exceptWindow) return;
    try { f.contentWindow.postMessage(msg, '*'); } catch(e) {}
  });
}
// Invia lo stato condiviso corrente a un singolo frame (al suo caricamento) — GENERICO per appId.
export function pushStateToFrame(frame) {
  for (const m of projectStateMessages(hubState)) {
    try { frame.contentWindow.postMessage(m, '*'); } catch(e) {}
  }
}

/* ══════════════════════════════════════════════
   POST MESSAGE BUS
   ══════════════════════════════════════════════ */
window.addEventListener('message', event => {
  // Sicurezza (edizione cloud): ascolta solo messaggi same-origin. In desktop/
  // Electron i tool sono caricati da file:// → origin '' o 'null': consentito.
  if (event.origin && event.origin !== 'null' && event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {

    case 'hub:navigate': if (msg.appId) launchApp(msg.appId); break;
    case 'hub:ready':    hideOverlay(); break;
    case 'hub:go-home':  goHome(); break;
    /* Amministrazione ha mutato gli utenti in localStorage (stesso storage, altro iframe):
       l'hub ricarica la sua copia in-memory e ridisegna sidebar/home. */
    case 'app:admin-changed': loadUsers(); refreshToolVisibility(); break;
    case 'app:theme': {
      // Il modo è UNICO per la suite: il toggle DENTRO un tool cambia il
      // tema di TUTTA la suite (hub + altri tool aperti). Se il modo segnalato
      // coincide con quello corrente è solo l'eco di boot (il frame parte già col
      // modo iniettato) → non propagare e non "pinnare". Altrimenti è una scelta
      // esplicita dell'utente: pinna, persiste e propaga a tutti gli altri frame.
      if (msg.theme !== 'light' && msg.theme !== 'dark') break;
      if (msg.theme !== suiteTheme.mode) setTheme(msg.theme, { user: true, exceptWindow: event.source });
      break;
    }
    case 'app:ready': hideOverlay(); break;

    /* Risposta di un tool a hub:collect-state → accumula per il progetto Quadra. */
    case 'app:full-state':
      if (_collector && msg.appId) {
        _collector.states[msg.appId] = msg.state;
        if (_collector.expected.every(id => id in _collector.states)) {
          clearTimeout(_collector.timer);
          _collector.finish();
        }
      }
      break;

    /* Un'app pubblica il proprio progetto → l'hub lo memorizza,
       lo persiste e lo ritrasmette alle altre. */
    case 'app:project-update': {
      // GENERICO per qualsiasi appId del registry (nessun ramo per-tool hard-coded).
      if (!msg.appId || !APP_REGISTRY.some(a => a.id === msg.appId)) break;
      markProjectDirty(); // un tool ha cambiato qualcosa → progetto non salvato
      hubState = setToolProject(hubState, msg.appId, msg.project || null);
      // la catena delle revisioni va in sidebar: è la cronologia del lavoro
      if (msg.project && Array.isArray(msg.project.sezioni)) setSezioniLavoro(msg.project.sezioni, msg.project.azioniSezioni, msg.project.corrente, msg.appId);
      else if (msg.project && Array.isArray(msg.project.albero)) setAlberoLavoro(msg.project.albero, msg.project.azioniAlbero, msg.appId);
      else if (msg.project && Array.isArray(msg.project.revisioni)) setRevisioni(msg.project.revisioni);
      persistHubState();
      relayToFrames(
        { type:'hub:project-state', source: sourceForApp(msg.appId), project: hubState.tools[msg.appId] || null, appId: msg.appId },
        event.source);
      break;
    }

    /* Un'app chiede lo stato condiviso corrente (es. Contabilità all'avvio, per il computo di Computo). */
    case 'app:request-state':
      try {
        // Replica lo stato di OGNI tool (i consumatori filtrano per `source`/`appId`).
        for (const m of projectStateMessages(hubState)) event.source.postMessage(m, '*');
      } catch(e) {}
      break;
  }
});

/* Lo stato del Progetto lo riscrive anche progetto.js (apri/nuovo/salva). */
export function setHubState(v) { hubState = v }

