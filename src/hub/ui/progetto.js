/* hub — Progetto Quadra (.quadra; si aprono anche i vecchi .ehub): raccolta dello stato dai tool, salvataggio,
   apertura, nuovo progetto e ripristino differito. */
import { bundleProgettoQuadra, contaToolDelProgetto, parseProgettoQuadra } from '../../shared/progetto-quadra'
import { openModal } from '../../shared/ui/components/modal'
import { APP_REGISTRY } from '../data/registry'
import { ensureProjectId, setProjectIdentity } from '../engine/index'
import { hubState, persistHubState, relayToFrames, setHubState } from './bus.js'
import { goHome, launchApp, loadedFrames } from './frames.js'
import { hubToast } from './shell.js'
import { azzeraAlbero } from './revisioni-nav.js'

/* ══════════════════════════════════════════════
   PROGETTO QUADRA — salva/apri l'intero stato del programma in un file .quadra.
   L'hub chiede a ogni tool caricato il suo stato pieno (hub:collect-state →
   app:full-state), lo impacchetta (shared/progetto-quadra) e lo scarica. All'apertura
   ridistribuisce gli stati ai tool (hub:restore-state), anche al loro caricamento.
   ══════════════════════════════════════════════ */
export let _collector = null;                 // raccolta in corso degli stati (Promise)
export const pendingRestore = Object.create(null); // appId → stato da ripristinare al load

// Id stabile del progetto Quadra corrente (identità di ISTANZA UNICA).
export function genProjectId() { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

// Stato "modifiche non salvate": il pulsante Salva si colora finché lo stato
// del programma è cambiato dall'ultimo salvataggio/apertura di un progetto.
export let projectDirty = false;
export let _suppressDirtyUntil = Date.now() + 3000; // ignora gli update di avvio/ripristino
export function updateSaveButtons() {
  document.querySelectorAll('.js-save-project').forEach(b => b.classList.toggle('dirty', projectDirty));
}
export function markProjectDirty() {
  if (Date.now() < _suppressDirtyUntil) return;
  if (!projectDirty) { projectDirty = true; updateSaveButtons(); }
}
/* ESCI SENZA SALVARE? Il lavoro vive in memoria finché non si salva il file
   del progetto: chiudere la finestra con modifiche in sospeso significa
   perderlo. Il browser (e Electron) mostrano l'avviso solo se qualcuno
   annulla l'evento: lo facciamo qui, una volta sola per tutta la suite. */
/* Il guscio desktop chiede QUI se c'è lavoro da salvare, e mostra una vera
   domanda (Salva · Esci senza salvare · Annulla). */
window.__quadraDirty = () => projectDirty;
window.__quadraSalva = async () => { await window.saveProgettoQuadra?.(); return !projectDirty; };

/* L'avviso del browser vale SOLO nel browser. Su desktop annullare la chiusura
   da qui blocca la finestra — la domanda la fa il guscio, e annullarla due
   volte significa non chiudersi più e dover forzare l'uscita. */
if (!window.ehubNative) {
  window.addEventListener('beforeunload', (e) => {
    if (!projectDirty) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
}

export function markProjectSaved() {
  if (projectDirty) { projectDirty = false; updateSaveButtons(); }
  else updateSaveButtons();
}

export function dlHub(content, name, type) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* Chiede lo stato pieno a tutti i frame caricati; risolve quando tutti hanno
   risposto o allo scadere del timeout (i tool senza supporto non rispondono). */
/* Timeout generoso: un lavoro grande (molte voci, misure e atti) si serializza in
   più tempo, e il file finirebbe scritto SENZA quel tool. C'è comunque
   l'early-finish quando tutti i frame hanno risposto: il timeout lungo paga solo
   se un tool è muto. */
export function collectFullState(timeoutMs = 8000) {
  return new Promise(resolve => {
    const expected = Object.keys(loadedFrames);
    if (!expected.length) { resolve({}); return; }
    const states = {};
    const finish = () => { if (!_collector) return; _collector = null; resolve(states); };
    _collector = { states, expected, finish, timer: setTimeout(finish, timeoutMs) };
    relayToFrames({ type: 'hub:collect-state' });
  });
}

/* Percorso del file di ogni progetto salvato con «Salva con nome» (solo app desktop):
   «Salva progetto» poi riscrive lo STESSO file invece di crearne uno nuovo per data. */
const CHIAVE_PERCORSI = 'hub:percorsi-progetto';
function percorsoProgetto(id) {
  try { return (JSON.parse(localStorage.getItem(CHIAVE_PERCORSI) || '{}') || {})[id] || null; } catch { return null; }
}
function ricordaPercorso(id, p) {
  try { const m = JSON.parse(localStorage.getItem(CHIAVE_PERCORSI) || '{}') || {}; m[id] = p; localStorage.setItem(CHIAVE_PERCORSI, JSON.stringify(m)); } catch { /* best-effort */ }
}

/* Contenuto del file .quadra (null se non c'è niente da salvare). */
async function contenutoProgetto() {
  hubToast('Raccolta stato dei tool…');
  const states = await collectFullState();
  if (!Object.keys(states).length) {
    hubToast('Niente da salvare: apri e usa almeno un tool', { warn: true });
    return null;
  }
  // Il progetto corrente ha un'identità stabile (id) e un nome → nel bundle.
  setHubState(ensureProjectId(hubState, genProjectId));
  persistHubState();
  const bundle = bundleProgettoQuadra(states, { now: Date.now(), name: hubState.name || undefined });
  return { content: JSON.stringify(bundle, null, 2), n: contaToolDelProgetto(bundle) };
}

/* «Salva con nome». App desktop: la finestra di salvataggio del sistema (nome e
   cartella, pulsante «Salva»). Browser: si chiede il nome e il file si scarica. */
export async function saveProgettoQuadraAs() {
  if (window.ehubNative && window.ehubNative.saveProjectAs) {
    const c = await contenutoProgetto();
    if (!c) return;
    const nome = (hubState.name || 'progetto').replace(/[\\/:*?"<>|]+/g, '_');
    const res = await window.ehubNative.saveProjectAs(`${nome}.quadra`, c.content);
    if (res && res.path) {
      const nuovo = res.path.split(/[\\/]/).pop().replace(/\.quadra$/i, '');
      if (nuovo && nuovo !== hubState.name) { setHubState(setProjectIdentity(hubState, hubState.id, nuovo)); persistHubState(); }
      ricordaPercorso(hubState.id, res.path);
      markProjectSaved(); hubToast(`Progetto salvato (${c.n} tool) → ${res.path}`);
    } else if (res && res.canceled) hubToast('Salvataggio annullato', { warn: true });
    else hubToast('Errore nel salvataggio' + (res && res.error ? `: ${res.error}` : ''), { warn: true });
    return;
  }
  // Browser: qui c'era una `window.prompt()`, che in Electron non esiste: si usa il
  // modal condiviso, come ovunque nell'hub.
  const input = document.createElement('input');
  input.className = 'ehb-input';
  input.style.width = '100%';
  input.value = hubState.name || 'progetto';
  input.setAttribute('aria-label', 'Nome del progetto');
  const choice = await openModal({
    title: 'Salva con nome',
    body: input,
    actions: [
      { label: 'Annulla', variant: 'ghost', value: 'cancel' },
      { label: 'Salva', variant: 'accent', value: 'ok' },
    ],
  });
  if (choice !== 'ok') return;
  const nm = (input.value || '').trim();
  if (nm) setHubState(setProjectIdentity(hubState, hubState.id, nm));
  await saveProgettoQuadra();
}
export async function saveProgettoQuadra() {
  const c = await contenutoProgetto();
  if (!c) return;
  const { content, n } = c;
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (hubState.name || 'progetto').replace(/[^\w.-]+/g, '_');
  const filename = `${safeName}-${stamp}.quadra`; // estensione Quadra (i vecchi .ehub si aprono ancora)
  // Electron: se il progetto ha già un file («Salva con nome»), lo riscrive; altrimenti
  // scrive nella cartella dei progetti (chiesta la prima volta). Browser: download.
  if (window.ehubNative && window.ehubNative.saveProject) {
    const p = window.ehubNative.saveProjectTo && percorsoProgetto(hubState.id);
    let res = p ? await window.ehubNative.saveProjectTo(p, content) : null;
    if (!res || res.error) res = await window.ehubNative.saveProject(filename, content);
    if (res && res.path) { markProjectSaved(); hubToast(`Progetto salvato (${n} tool) → ${res.path}`); }
    else if (res && res.canceled) hubToast('Salvataggio annullato', { warn: true });
    else hubToast('Errore nel salvataggio' + (res && res.error ? `: ${res.error}` : ''), { warn: true });
    return;
  }
  dlHub(content, filename, 'application/json');
  markProjectSaved();
  hubToast(`Progetto Quadra salvato — ${n} tool`);
}

/* Chiede cosa fare delle modifiche non salvate PRIMA di azzerare la sessione
   (nuovo progetto o logout): un solo dialogo a 3 scelte (Salva/Scarta/Annulla)
   invece di due `confirm()` in sequenza — con `confirm()` premere "Annulla" sul
   primo ne apriva subito un secondo, percepito come una doppia richiesta.
   Ritorna true se si può procedere (salvato o scartato di proposito), false se
   l'utente ha annullato l'operazione. */
export async function confirmDiscardUnsaved(title) {
  if (!projectDirty) return true;
  const choice = await openModal({
    title,
    message: 'Il progetto Quadra corrente ha modifiche non salvate.',
    actions: [
      { label: 'Annulla', variant: 'ghost', value: 'cancel' },
      { label: 'Scarta', value: 'discard' },
      { label: 'Salva', variant: 'accent', value: 'save' },
    ],
  });
  if (choice === 'save') { await saveProgettoQuadra(); return true; }
  if (choice === 'discard') return true;
  hubToast('Operazione annullata', { warn: true });
  return false;
}
/* Azzera identità e stato per-tool in memoria (nuova istanza di progetto) — nucleo
   condiviso da «Nuovo progetto» e dal logout: niente stato di un utente
   visibile al successivo su una macchina condivisa. */
export function resetProjectSession() {
  setHubState(ensureProjectId(setProjectIdentity({ ...hubState, tools: {} }, null, null), genProjectId));
  persistHubState();
  for (const k in pendingRestore) delete pendingRestore[k];
  azzeraAlbero(); // l'albero è del progetto: uno nuovo parte senza rami
  markProjectSaved();
}
/* Nuovo progetto: riparte da zero. Se ci sono tool aperti ricarica l'hub (i tool
   ripartono vuoti: il progetto non è persistito per-tool); altrimenti torna alla home. */
export async function newProgettoQuadra() {
  if (!(await confirmDiscardUnsaved('Nuovo progetto'))) return;
  resetProjectSession();
  if (Object.keys(loadedFrames).length > 0) { window.location.reload(); return; }
  goHome();
  hubToast('Nuovo progetto — si riparte da zero');
}

export function openProgettoQuadra() {
  const inp = document.getElementById('ehub-file');
  if (inp) inp.click();
}

export function onEhubFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    let bundle;
    try { bundle = parseProgettoQuadra(String(ev.target.result)); }
    catch (err) { hubToast((err && err.message) || 'File progetto non valido', { warn: true }); return; }
    applyProgettoQuadra(bundle);
  };
  r.onerror = () => hubToast('Impossibile leggere il file', { warn: true });
  r.readAsText(file);
}

export async function applyProgettoQuadra(bundle) {
  const tools = bundle.tools || {};
  const ids = Object.keys(tools).filter(id => APP_REGISTRY.some(a => a.id === id));
  if (!ids.length) { hubToast('Progetto privo di tool riconosciuti', { warn: true }); return; }
  // GUARDIA IMPORT a livello Quadra — aprire un progetto con modifiche non salvate chiede
  // conferma esplicita (salva prima / scarta / annulla), così non si perde lavoro né si mescolano
  // istanze. Disponibile solo con conferme native del browser/Electron.
  if (projectDirty && typeof window.confirm === 'function') {
    const salva = window.confirm(
      'Il progetto Quadra corrente ha modifiche non salvate.\n\n' +
      'OK = SALVA prima di aprire\nAnnulla = scegli se scartarle');
    if (salva) {
      await saveProgettoQuadra();
    } else {
      const scarta = window.confirm(
        'Aprire il nuovo progetto SCARTANDO le modifiche non salvate?\n\n' +
        'OK = scarta e apri\nAnnulla = annulla apertura');
      if (!scarta) { hubToast('Apertura annullata', { warn: true }); return; }
    }
  }
  // Aprire un .ehub stabilisce l'ISTANZA del progetto corrente (nuova identità + nome).
  // Lo stato per-appId riparte pulito: i tool ripubblicano il proprio progetto al ripristino.
  setHubState(ensureProjectId(setProjectIdentity({ ...hubState, tools: {} }, null, bundle.name || null), genProjectId));
  persistHubState();
  azzeraAlbero(); // i rami li ripubblicano gli strumenti, al ripristino
  // Appena caricato = allineato al file: non "non salvato". Sopprime gli update
  // indotti dal ripristino (un tool che ripubblica il proprio stato) per ~2.5s.
  _suppressDirtyUntil = Date.now() + 2500;
  markProjectSaved();
  for (const id of ids) {
    if (loadedFrames[id]) {
      try { loadedFrames[id].contentWindow.postMessage({ type: 'hub:restore-state', appId: id, state: tools[id] }, '*'); } catch (e) {}
    } else {
      pendingRestore[id] = tools[id];        // ripristinato quando il tool verrà aperto
    }
  }
  hubToast(`Progetto caricato — ${ids.length} tool ripristinati`);
  /* Il lavoro è uno: si caricano tutti gli strumenti che ne tengono una parte,
     così ognuno ripubblica i suoi rami e l'albero è intero da subito (prima si
     apriva solo il primo, e l'altro metà del lavoro restava fuori dall'albero
     finché non lo si apriva a mano). Si mostra il primo del progetto. */
  for (const id of ids.slice(1)) await launchApp(id);
  await launchApp(ids[0]);
}

/* Al caricamento di un frame: se c'è uno stato in attesa per quel tool, applicalo. */
export function flushPendingRestore(id, frame) {
  if (!(id in pendingRestore)) return;
  const state = pendingRestore[id];
  delete pendingRestore[id];
  try { frame.contentWindow.postMessage({ type: 'hub:restore-state', appId: id, state }, '*'); } catch (e) {}
}
