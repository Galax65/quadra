/* hub — lista dei tool, card di benvenuto, ricerca e scorciatoie da tastiera. */
import { toolGlyphSvgById } from '../../shared/ui/glyphs'
import { escHtml } from './shell.js'
import { groupByCategory } from '../data/registry'
import { filterApps } from '../engine/index'
import { enabledApps } from './auth.js'
import { closeSession, currentId, folder, goHome, launchApp, loadedFrames, reloadApp } from './frames.js'
import { closeAppearance, closeCredits, closeGuide, closeLegal } from './guida.js'
import { LOGO_MAP, logoHTML, toggleSidebar } from './shell.js'
import { toggleTheme } from './tema.js'
export let focusIndex   = -1;
export let visibleIds   = [];

/* ══════════════════════════════════════════════
   RENDER LIST
   ══════════════════════════════════════════════ */
export function renderList(apps) {
  const list  = document.getElementById('app-list');
  const empty = document.getElementById('list-empty');
  visibleIds  = apps.map(a => a.id);
  /* La lista dei tool non è più a schermo (l'albero è la navigazione): resta
     in pagina, nascosta, perché la ricerca e il lancio continuano a passare di
     qui. Quindi ogni nodo può mancare, e nessuno deve farne un errore. */
  const cnt = document.getElementById('nav-count');
  if (cnt) cnt.textContent = apps.length;
  if (!list) return;
  if (!apps.length) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  // Tool raggruppati per TEMATICA con intestazione di sezione.
  list.innerHTML = groupByCategory(apps).map(g => `
    <div class="nav-group-title">${g.label}</div>
    ${g.apps.map(navItemHTML).join('')}`).join('');
}

/* Markup di una voce nav (estratto per il raggruppamento). */
export function navItemHTML(app) {
  return `
    <div class="nav-item${loadedFrames[app.id] ? ' live' : ''}${app.id === currentId ? ' active' : ''}" id="nav-${app.id}"
         data-tool="${(LOGO_MAP[app.logoType] || {}).tool || 'hub'}"
         onclick="launchApp('${app.id}')" role="button" tabindex="0" title="${app.name}"
         onkeydown="if(event.key==='Enter')launchApp('${app.id}')">
      ${logoHTML(app, 'nav-logo')}
      <div class="nav-meta">
        <div class="nav-name">${escHtml(app.name)}</div>
        <div class="nav-tagline">${app.tagline || ''}</div>
      </div>
      <div class="nav-right">
        ${app.resolvedFile === null && folder
          ? '<span class="nav-badge wip" title="File non trovato in cartella">missing</span>'
          : app.status === 'stable'
            ? ''
            : '<span class="nav-badge beta">beta</span>'}
      </div>
    </div>`;
}

// Flusso di lavoro mostrato in home: il numero del passo e cosa si fa in quel tool.
// Le categorie senza passo (Amministrazione) stanno a parte, come strumenti di servizio.
const WELCOME_FLOW = {
  'lavoro': { step: 1, desc: 'Computo e revisioni, contratto, SAL, perizie, stato finale e CRE: una catena sola, nella stessa schermata.' },
  'amministrazione': { step: 0, desc: 'Utenti, statistiche e manutenzione dell\'installazione.' },
};
export function renderWelcomeCards() {
  const wrap = document.getElementById('welcome-cards');
  if (!wrap) return;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  const sectionHTML = (g) => {
    const f = WELCOME_FLOW[g.key] || { step: 0, desc: '' };
    const step = f.step ? `<span class="wlc-step">${f.step}</span>` : '';
    return `
    <section class="wlc-group${f.step ? ' wlc-group--step' : ' wlc-group--aux'}">
      <div class="wlc-group-title">${step}${g.label}</div>
      <div class="wlc-group-cards">${g.apps.map(app => welcomeCardHTML(app, arrow, f.desc)).join('')}</div>
    </section>`;
  };
  // Card raggruppate per TEMATICA: i passi del flusso (computo → contabilità) in riga
  // con una freccia fra l'uno e l'altro; gli strumenti di servizio sotto, più discreti.
  const groups = groupByCategory(enabledApps());
  const flow = groups.filter(g => (WELCOME_FLOW[g.key] || {}).step);
  const aux = groups.filter(g => !(WELCOME_FLOW[g.key] || {}).step);
  /* UN LAVORO SOLO (Docs/07-Un-lavoro-un-modulo.md). Computo e contabilità
     sono le tappe di uno stesso lavoro, in uno strumento solo: in home c'è una
     voce sola, «Lavoro», e l'albero in sidebar porta alla tappa. */
  const vociLavoro = flow.flatMap(g => g.apps);
  let html = vociLavoro.length
    ? `<div class="wlc-row wlc-flow"><section class="wlc-group wlc-group--step">
        <div class="wlc-group-title">Lavoro</div>
        <div class="wlc-group-cards">${lavoroCardHTML(vociLavoro, arrow)}</div>
      </section></div>`
    : '';
  if (aux.length) html += `<div class="wlc-row wlc-aux">${aux.map(sectionHTML).join('')}</div>`;
  wrap.innerHTML = html;
}

/* La card «Lavoro»: una sola, per tutte le fasi. */
function lavoroCardHTML(apps, arrow) {
  const active = apps.some(a => loadedFrames[a.id]);
  const live = active ? '<span class="wlc-live"><span class="pulse"></span>attivo</span>' : '';
  return `
    <div class="wlc-card wlc-card--lavoro${active ? ' active-session' : ''}${folder ? '' : ' preview'}" data-tool="hub" role="button" tabindex="0"
         title="Apri il lavoro: progetto, contratto, contabilità e perizie" id="wlc-lavoro"
         onclick="apriLavoro()" onkeydown="if(event.key==='Enter')apriLavoro()">
      <span class="wlc-go">${arrow}</span>
      <div class="wlc-card-top"><div class="ehb-logo wlc-logo" data-tool="hub"><span class="ehb-logo__glyph">▦</span></div></div>
      <div class="wlc-card-body">
        <div class="wlc-card-name">Lavoro</div>
        <div class="wlc-card-tag">Computo, contratto, contabilità e perizie</div>
        <div class="wlc-card-desc">Una catena di fasi: il computo e le sue revisioni, il contratto, i SAL e le perizie. L'albero a sinistra dice dove sei e che cosa viene dopo.</div>
      </div>
      <div class="wlc-card-foot">${live}</div>
    </div>`;
}

/* Apre il lavoro: carica TUTTI gli strumenti che ne tengono una parte, perché
   ognuno pubblichi i suoi rami nell'albero, e mostra quello della fase in corso
   — la Contabilità quando c'è un contratto, altrimenti il Computo. */
export async function apriLavoro() {
  /* Lo strumento unico «Lavoro» (Docs/07) tiene tutto il lavoro: si apre lui.
     Computo e Contabilità non ci sono più (tappa 8). */
  if (!enabledApps().some(a => a.id === 'lavoro')) return;
  await launchApp('lavoro');
  // l'albero è la navigazione: si apre la sidebar, se era chiusa
  const sb = document.getElementById('sidebar');
  if (sb && sb.classList.contains('collapsed')) toggleSidebar();
}

/* Markup di una welcome-card (estratto per il raggruppamento). */
export function welcomeCardHTML(app, arrow, desc = '') {
    const hasFolder = !!folder;
    const missing   = hasFolder && !app.resolvedFile;
    const active    = !!loadedFrames[app.id];
    let cls = 'wlc-card';
    if (missing)         cls += ' missing';
    else if (!hasFolder) cls += ' preview';
    if (active)          cls += ' active-session';
    let pill;
    if (missing)                   pill = '<span class="wlc-status missing">non trovato</span>';
    else if (app.status === 'beta')pill = '<span class="wlc-status beta"><span class="d"></span>beta</span>';
    else                           pill = '';   // gli stabili non mostrano chip (solo beta/missing)
    const live = active ? '<span class="wlc-live"><span class="pulse"></span>attiva</span>' : '';
    // Icona dell'integrazione: il tool BERSAGLIO, col suo accento (Contabilità ← Computo).
    // Card ridotte (redesign hub-welcome-orizzontale): l'integrazione è una micro-icona
    // del tool bersaglio accanto al nome; il testo completo resta nel tooltip.
    // Una card può avere più integrazioni: un'icona per ciascuna.
    const note = (app.notes || []).map(n => {
      const svg = toolGlyphSvgById(n.icon);
      if (!svg) return '';
      return `<span class="wlc-feat-glyph" data-tool="${n.icon}" title="${n.text}">${svg}</span>`;
    }).join('');
    const tool = (LOGO_MAP[app.logoType] || {}).tool || 'hub';
    const closeSess = active
      ? `<button class="wlc-close-sess" title="Chiudi la sessione di ${app.name}" aria-label="Chiudi sessione" onclick="event.stopPropagation();closeSession('${app.id}',event)">✕</button>`
      : '';
    return `
    <div class="${cls}" data-tool="${tool}" role="button" tabindex="0" title="${app.name}"
         onclick="launchApp('${app.id}')"
         onkeydown="if(event.key==='Enter')launchApp('${app.id}')">
      ${closeSess}
      <span class="wlc-go">${arrow}</span>
      <div class="wlc-card-top">
        ${logoHTML(app, 'wlc-logo')}
      </div>
      <div class="wlc-card-body">
        <div class="wlc-card-name">${escHtml(app.name)}${note}</div>
        <div class="wlc-card-tag">${app.tagline || ''}</div>
        ${desc ? `<div class="wlc-card-desc">${desc}</div>` : ''}
      </div>
      <div class="wlc-card-foot">${pill}${live}</div>
    </div>`;
}

export function filterList() {
  renderList(filterApps(enabledApps(), document.getElementById('search').value));
}

/* ══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Modale guida aperta: Esc chiude, gli altri tasti non agiscono sotto
  const guideOv = document.getElementById('guide-overlay');
  if (guideOv && guideOv.classList.contains('open')) {
    if (e.key === 'Escape') closeGuide();
    return;
  }
  const legalOv = document.getElementById('legal-overlay');
  if (legalOv && legalOv.classList.contains('open')) {
    if (e.key === 'Escape') closeLegal();
    return;
  }
  const creditsOv = document.getElementById('credits-overlay');
  if (creditsOv && creditsOv.classList.contains('open')) {
    if (e.key === 'Escape') closeCredits();
    return;
  }
  const appearanceOv = document.getElementById('appearance-overlay');
  if (appearanceOv && appearanceOv.classList.contains('open')) {
    if (e.key === 'Escape') closeAppearance();
    return;
  }
  if (e.target === document.getElementById('search')) {
    if (e.key === 'Escape') { e.target.value = ''; filterList(); e.target.blur(); }
    return;
  }
  // Qualsiasi altro campo di input (es. login) non deve subire le scorciatoie
  // globali (T/B/R): stesso guard di bindThemeShortcut in shared/theme.ts.
  const activeEl = e.target;
  if (activeEl && (/input|select|textarea/i.test(activeEl.tagName) || activeEl.isContentEditable)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    focusIndex = Math.max(0, Math.min(visibleIds.length - 1, focusIndex + (e.key === 'ArrowDown' ? 1 : -1)));
    const el = document.getElementById('nav-' + visibleIds[focusIndex]);
    if (el) { el.focus(); el.scrollIntoView({ block:'nearest' }); }
  }
  else if (e.key === 'Enter' && focusIndex >= 0) launchApp(visibleIds[focusIndex]);
  else if (e.key === '/') { e.preventDefault(); document.getElementById('search').focus(); }
  else if (e.key.toLowerCase() === 't') toggleTheme();
  else if (e.key.toLowerCase() === 'b') toggleSidebar();
  else if (e.key.toLowerCase() === 'r') { e.preventDefault(); reloadApp(); }
  else if (e.key === 'Escape' && currentId) goHome();
});

/* L'indice della voce a fuoco si azzera anche tornando alla home (frames.js). */
export function setFocusIndex(v) { focusIndex = v }

