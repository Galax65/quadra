/* Amministrazione — shell del tool. Centro di controllo dell'hub, admin-only (mai
   visibile alle aziende, vedi src/hub/engine/visibility.ts::isToolVisible).
   Legge/scrive DIRETTAMENTE le stesse chiavi localStorage dell'hub (stesso
   iframe sandboxed con allow-same-origin ⇒ storage condiviso col padre),
   tramite gli STESSI moduli puri usati dall'hub — niente duplicazione. */
import { sendToHub, onHubMessage, bindThemeShortcut } from '../../shared'
import { APP_REGISTRY } from '../../hub/data/registry'
import { normalizeUsers, usersOfCompany, usersWithoutCompany, findUser, makeUser } from '../../hub/data/users'
import { findCompany, companyLogoHtml, CHIAVE_AZIENDA, aziendaSalvata, studio, recapitiAzienda } from '../../hub/data/companies'
import { emptyHubProjectState, migrateHubState } from '../../hub/engine/project-state'
import { isValidProfile } from '../../hub/engine/auth'
import { readAuth } from '../../shared/session-profile'
import { computeAdminStats } from '../../hub/engine/admin-stats'
import { resetToursForUser } from '../../shared/ui/components/tour'
import { initAnalytics } from '../../shared/analytics'
import { CHIAVE_MODELLI, normalizzaModelli } from '../../shared/struttura-computo'

initAnalytics()

const USERS_KEY = 'hub:users'
const AUTH_KEY = 'hub:auth'
const STATE_KEY = 'hub:state'
/** Prefissi di chiave riportati nel breakdown storage di Panoramica. */
const STORAGE_PREFIXES = [USERS_KEY, AUTH_KEY, STATE_KEY]

const S = { view: 'panoramica', users: [], usersNoCompany: [], authProfile: null }

/** Trova un utente per id in una delle due liste (azienda / senza azienda). */
function findUserRef(id) {
  let u = S.users.find(x => x.id === id)
  if (u) return { u, list: S.users }
  u = S.usersNoCompany.find(x => x.id === id)
  if (u) return { u, list: S.usersNoCompany }
  return null
}

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const eur = n => n == null ? '—' : '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })

/* ── Tema (default dark, come i tool tecnici) ── */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  const b = document.getElementById('btnTheme')
  if (b) b.textContent = (t === 'dark') ? '☀' : '☾'
}
function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  sendToHub({ type: 'app:theme', theme: next })
}
onHubMessage(m => {
  if (m.type === 'hub:set-theme') applyTheme(m.theme)
})

/* ── Toast minimale ── */
let _toastT
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast'); if (!el) return
  el.textContent = msg; el.hidden = false
  clearTimeout(_toastT); _toastT = setTimeout(() => { el.hidden = true }, ms)
}

/* ── Persistenza: stesse chiavi/formati dell'hub (solo localStorage — mono-studio locale) ── */
async function loadUsers() {
  try { S.users = normalizeUsers(JSON.parse(localStorage.getItem(USERS_KEY) || 'null')) }
  catch { S.users = normalizeUsers(null) }
  S.usersNoCompany = usersWithoutCompany(S.users)
}
function persistUsers() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(S.users)) } catch { /* storage off */ }
}

function loadAuthProfile() {
  try { const p = readAuth(); return isValidProfile(p) ? p : null } catch { return null }
}
function loadHubProjectState() {
  try { return migrateHubState(JSON.parse(localStorage.getItem(STATE_KEY) || 'null')) } catch { return emptyHubProjectState() }
}
/** Notifica l'hub padre di ricaricare utenti/flag e ridisegnare la sua UI. */
function notifyHubChanged() { sendToHub({ type: 'app:admin-changed' }) }

/* Azienda gestita da questo pannello: come nella vecchia modale, l'admin non
   ha companyId → gestisce l'unica azienda del registro. */
function adminCompanyId() {
  if (S.authProfile && S.authProfile.companyId) return S.authProfile.companyId
  const only = findCompany('studio-demo')
  return only ? only.id : null
}

/* ── Viste ── */
function showView(name) {
  S.view = name
  for (const v of ['panoramica', 'utenti', 'azienda', 'modelli', 'backup']) {
    const el = document.getElementById('view' + v[0].toUpperCase() + v.slice(1))
    if (el) el.hidden = v !== name
    const tab = document.getElementById('aTab' + v[0].toUpperCase() + v.slice(1))
    if (tab) { tab.classList.toggle('is-active', v === name); tab.setAttribute('aria-selected', String(v === name)) }
  }
  if (name === 'panoramica') renderPanoramica()
  if (name === 'utenti') renderUsers()
  if (name === 'azienda') renderCompany()
  if (name === 'modelli') renderModelli()
}

/* ── Panoramica ── */
function renderPanoramica() {
  const entries = []
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); entries.push([k, (k.length + (localStorage.getItem(k) || '').length) * 2]) } } catch { /* storage off */ }
  const stats = computeAdminStats({
    registry: APP_REGISTRY, users: S.users, hubProjectState: loadHubProjectState(),
    storageEntries: entries, storagePrefixes: STORAGE_PREFIXES,
  })
  const grid = document.getElementById('aStatsGrid')
  if (!grid) return
  grid.innerHTML = `
    <div class="ehb-card a-stat-card">
      <div class="a-stat-card__title">Tool</div>
      <div class="a-stat-card__big">${stats.tools.total}</div>
      <div class="a-stat-row"><span>Stabili</span><b>${stats.tools.stable}</b></div>
      <div class="a-stat-row"><span>Beta</span><b>${stats.tools.beta}</b></div>
      <div class="a-stat-row"><span>Solo admin</span><b>${stats.tools.adminOnly}</b></div>
      ${stats.tools.perCategory.map(c => `<div class="a-stat-row"><span>${esc(c.label)}</span><b>${c.total}</b></div>`).join('')}
    </div>
    <div class="ehb-card a-stat-card">
      <div class="a-stat-card__title">Utenti</div>
      <div class="a-stat-card__big">${stats.users.total}</div>
      <div class="a-stat-row"><span>Attivi</span><b>${stats.users.active}</b></div>
      <div class="a-stat-row"><span>Admin</span><b>${stats.users.admin}</b></div>
    </div>
    <div class="ehb-card a-stat-card">
      <div class="a-stat-card__title">Progetto corrente</div>
      <div class="a-stat-card__big">${esc(stats.project.name || '—')}</div>
      <div class="a-stat-row"><span>Tool con stato salvato</span><b>${stats.project.toolsWithState}</b></div>
      <div class="a-stat-row"><span>Voci di computo</span><b>${stats.project.vociComputo}</b></div>
      <div class="a-stat-row"><span>Stati di avanzamento</span><b>${stats.project.sal}</b></div>
    </div>
    <div class="ehb-card a-stat-card">
      <div class="a-stat-card__title">Memoria locale</div>
      <div class="a-stat-card__big">${stats.storageTotalKB} KB</div>
      ${Object.entries(stats.storageBreakdownKB).map(([k, v]) => `<div class="a-stat-row"><span>${esc(k)}</span><b>${v} KB</b></div>`).join('')}
    </div>`
}

/* ── Utenti ── */
/** Contenuto della cella nome/utente (span), riusato dalla rinomina inline. */
function renderUserIdCell(u) {
  return `<span class="adm-user__name">${esc(u.name)}</span><span class="adm-user__uname">@${esc(u.username)}</span>`
}
/** Markup di una riga utente, riusato sia per gli utenti dell'azienda sia per i profili senza azienda. */
function renderUserRow(u) {
  return `
    <div class="adm-user" data-id="${esc(u.id)}">
      <div class="adm-user__row">
        <div class="adm-user__id">${renderUserIdCell(u)}</div>
        <button type="button" class="adm-chip ${u.role === 'admin' ? 'is-admin' : ''}" title="Cambia ruolo"
          onclick="toggleRole('${esc(u.id)}')">${u.role === 'admin' ? 'admin' : 'utente'}</button>
        <button type="button" class="adm-chip ${u.active ? 'is-on' : 'is-off'}" title="Attiva/disattiva"
          onclick="toggleActive('${esc(u.id)}')">${u.active ? 'attivo' : 'disattivo'}</button>
        <button type="button" class="adm-chip" title="Fa ripartire il tour guidato al prossimo accesso di questo utente"
          onclick="resetTour('${esc(u.id)}')">↺ Tour</button>
        <button type="button" class="adm-chip" title="Rinomina nome/utente" onclick="beginRenameUser('${esc(u.id)}')">✎</button>
        <button type="button" class="adm-user__del" title="Rimuovi" onclick="removeUser('${esc(u.id)}')">✕</button>
      </div>
    </div>`
}
/** Utenti dell'azienda gestita + profili senza azienda, nell'ordine di render. */
function allUsersForView() {
  const coId = adminCompanyId()
  const list = coId ? usersOfCompany(S.users, coId) : []
  return { list, noCo: S.usersNoCompany }
}
function renderUsers() {
  const host = document.getElementById('aUsers')
  if (!host) return
  const { list, noCo } = allUsersForView()
  const count = document.getElementById('aUsersCount')
  const total = list.length + noCo.length
  if (count) count.textContent = total ? `${total} utenti` : ''
  const rows = list.map(renderUserRow).join('')
  const noCoRows = noCo.map(renderUserRow).join('')
  const emptyMsg = '<div class="adm-ph">— nessun utente —</div>'
  host.innerHTML = (rows || emptyMsg) + `
    <form class="adm-user-add" onsubmit="return addUser(event)">
      <input id="aNewName" placeholder="Nome e cognome" autocomplete="off" required>
      <input id="aNewUname" placeholder="utente (es. m.rossi)" autocomplete="off">
      <label class="adm-user-add__co"><input type="checkbox" id="aNewHasCompany" checked> Assegna a ${esc((findCompany(adminCompanyId() || '')?.name) || 'azienda')}</label>
      <button type="submit" class="adm-add-btn">Aggiungi</button>
    </form>
    <div class="adm-section-title">Profili senza azienda</div>` +
    (noCoRows || '<div class="adm-ph">— nessun profilo senza azienda —</div>')
  filterUsers()
}

function toggleActive(id) {
  const ref = findUserRef(id); if (!ref) return
  const u = ref.u
  u.active = !u.active
  persistUsers()
  renderUsers(); notifyHubChanged()
}
function resetTour(id) {
  const ref = findUserRef(id); if (!ref) return
  const u = ref.u
  resetToursForUser(`${u.companyId || 'admin'}::${u.username}`)
  toast(`Tour resettato per ${u.name}: ripartirà al prossimo accesso.`)
}
/* ── Rinomina inline: editing dentro la riga, niente window.prompt né full re-render ── */
function renameCell(id) { return document.querySelector(`.adm-user[data-id="${cssEsc(id)}"] .adm-user__id`) }
function beginRenameUser(id) {
  const ref = findUserRef(id); if (!ref) return
  const u = ref.u
  const cell = renameCell(id); if (!cell) return
  cell.classList.add('adm-user__id--editing')
  cell.innerHTML = `<form class="adm-user__rename" onsubmit="return commitRenameUser(event,'${esc(id)}')">
      <input class="adm-user__rename-name" value="${esc(u.name)}" placeholder="Nome e cognome" autocomplete="off" required>
      <input class="adm-user__rename-uname" value="${esc(u.username)}" placeholder="utente" autocomplete="off" required>
      <button type="submit" class="adm-chip is-on" title="Salva">✓</button>
      <button type="button" class="adm-chip" title="Annulla" onclick="cancelRenameUser('${esc(id)}')">✕</button>
    </form>`
  cell.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); cancelRenameUser(id) } }))
  const first = cell.querySelector('.adm-user__rename-name')
  if (first) { first.focus(); first.select() }
}
function commitRenameUser(e, id) {
  if (e && e.preventDefault) e.preventDefault()
  const ref = findUserRef(id); if (!ref) return false
  const u = ref.u
  const cell = renameCell(id); if (!cell) return false
  const trimmedName = (cell.querySelector('.adm-user__rename-name')?.value || '').trim()
  const trimmedUname = (cell.querySelector('.adm-user__rename-uname')?.value || '').trim()
  if (!trimmedName || !trimmedUname) return false
  const dup = u.companyId ? findUser(S.users, u.companyId, trimmedUname) : findUserRefByUsername(S.usersNoCompany, trimmedUname)
  if (dup && dup.id !== u.id) { toast('Utente già in uso da un altro profilo.'); return false }
  u.name = trimmedName; u.username = trimmedUname
  persistUsers()
  cell.classList.remove('adm-user__id--editing')
  cell.innerHTML = renderUserIdCell(u)
  notifyHubChanged()
  return false
}
function cancelRenameUser(id) {
  const ref = findUserRef(id); if (!ref) return
  const cell = renameCell(id); if (!cell) return
  cell.classList.remove('adm-user__id--editing')
  cell.innerHTML = renderUserIdCell(ref.u)
}
/* ── Ricerca e toggle vista (barra statica sopra la lista) ── */
function filterUsers() {
  const q = (document.getElementById('aUsersFilter')?.value || '').trim().toLowerCase()
  document.querySelectorAll('#aUsers .adm-user').forEach(row => {
    const name = ((row.querySelector('.adm-user__name')?.textContent || '') + ' ' + (row.querySelector('.adm-user__uname')?.textContent || '')).toLowerCase()
    row.hidden = !!q && !name.includes(q)
  })
}
/** Escape sicuro di un id per un selettore CSS (fallback se CSS.escape assente). */
const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s)
function toggleRole(id) {
  const ref = findUserRef(id); if (!ref) return
  const u = ref.u
  u.role = u.role === 'admin' ? 'user' : 'admin'
  persistUsers()
  renderUsers(); notifyHubChanged()
}
function removeUser(id) {
  S.users = S.users.filter(x => x.id !== id)
  S.usersNoCompany = usersWithoutCompany(S.users)
  persistUsers()
  renderUsers(); notifyHubChanged()
}
/** Trova un profilo per username in una lista (case-insensitive), per i profili senza azienda. */
function findUserRefByUsername(list, username) {
  const q = (username || '').trim().toLowerCase()
  if (!q) return null
  return list.find(x => x.username.toLowerCase() === q) || null
}
function addUser(e) {
  if (e && e.preventDefault) e.preventDefault()
  const coId = adminCompanyId()
  const hasCompany = (document.getElementById('aNewHasCompany') || {}).checked !== false
  const name = (document.getElementById('aNewName') || {}).value || ''
  const uname = (document.getElementById('aNewUname') || {}).value || ''
  if (!name.trim()) return false
  if (hasCompany && !coId) return false
  const targetCompanyId = hasCompany ? coId : null

  const u = makeUser(targetCompanyId, name, uname)
  let base = u.username, n = 2
  const dupCheck = () => targetCompanyId ? findUser(S.users, targetCompanyId, u.username) : findUserRefByUsername(usersWithoutCompany(S.users), u.username)
  while (dupCheck()) u.username = `${base}${n++}`
  S.users.push(u)
  S.usersNoCompany = usersWithoutCompany(S.users)
  persistUsers(); renderUsers(); notifyHubChanged()
  return false
}

/* ── Azienda ── */
function renderCompany() {
  const host = document.getElementById('aCompany')
  if (!host) return
  const co = studio()
  const personalizzato = !!aziendaSalvata()
  const v = (k) => escA(personalizzato ? (co[k] || '') : '')
  const campo = (k, etichetta, ph) => `<label class="adm-az__f"><span>${etichetta}</span><input class="ehb-input" id="aAz-${k}" value="${v(k)}" placeholder="${escA(ph)}"></label>`
  host.innerHTML = `
    <div class="adm-co">
      ${companyLogoHtml(co, 'adm-co__logo')}
      <div class="adm-co__txt">
        <div class="adm-co__name">${esc(co.name)}</div>
        <div class="adm-co__addr">${esc(recapitiAzienda(co) || (personalizzato ? '' : 'Profilo dimostrativo: compila i dati qui sotto'))}</div>
      </div>
    </div>
    <div class="adm-az">
      ${campo('name', 'Ragione sociale / nome dello studio *', 'Studio Tecnico …')}
      ${campo('address', 'Indirizzo', 'Via …, CAP Comune (PR)')}
      <div class="adm-az__riga">
        ${campo('piva', 'P.IVA / codice fiscale', '01234567890')}
        ${campo('short', 'Sigla (se non c\'è il logo)', 'automatica dalle iniziali')}
      </div>
      ${campo('contatti', 'Contatti', 'tel. … · email … · PEC …')}
      <div class="adm-az__logo">
        <span>Logo</span>
        ${personalizzato && co.logo ? `<img src="${escA(co.logo)}" alt="logo" class="adm-co__logo">` : '<span class="adm-az__nologo">nessun logo</span>'}
        <button type="button" class="ehb-btn ehb-btn--sm" onclick="document.getElementById('aAzLogo').click()">Scegli immagine…</button>
        ${personalizzato && co.logo ? '<button type="button" class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="aziendaTogliLogo()">Togli</button>' : ''}
        <input type="file" id="aAzLogo" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onchange="aziendaLogo(this)">
      </div>
      <div class="adm-az__azioni">
        <button type="button" class="ehb-btn ehb-btn--accent" onclick="aziendaSalva()">Salva i dati dello studio</button>
        ${personalizzato ? '<button type="button" class="ehb-btn ehb-btn--ghost" onclick="aziendaRipristina()">Torna al profilo dimostrativo</button>' : ''}
      </div>
    </div>`
}
let _logoNuovo = undefined   // data URL scelto ma non ancora salvato; null = da togliere
function aziendaLeggiForm() {
  const g = (k) => (document.getElementById('aAz-' + k)?.value || '').trim()
  const prima = aziendaSalvata() || {}
  const logo = _logoNuovo === undefined ? (prima.logo || '') : (_logoNuovo || '')
  return { name: g('name'), address: g('address'), piva: g('piva'), short: g('short'), contatti: g('contatti'), logo }
}
function aziendaSalva() {
  const d = aziendaLeggiForm()
  if (!d.name) { toast('Scrivi il nome dello studio'); document.getElementById('aAz-name')?.focus(); return }
  try { localStorage.setItem(CHIAVE_AZIENDA, JSON.stringify(d)) } catch { toast('Spazio di archiviazione non disponibile (logo troppo grande?)'); return }
  _logoNuovo = undefined
  toast('Dati dello studio salvati')
  renderCompany()
}
function aziendaRipristina() {
  if (!confirm('Tornare al profilo dimostrativo? I dati dello studio inseriti qui si cancellano.')) return
  localStorage.removeItem(CHIAVE_AZIENDA); _logoNuovo = undefined
  toast('Profilo dimostrativo ripristinato'); renderCompany()
}
function aziendaTogliLogo() { _logoNuovo = null; aziendaSalvaSeValido() }
function aziendaSalvaSeValido() { if ((document.getElementById('aAz-name')?.value || '').trim()) aziendaSalva(); else renderCompany() }
/* Il logo si riduce (lato lungo 360 px) e si salva come data URL: resta incorporato anche
   nei documenti e non riempie la memoria locale. Gli SVG si tengono come sono. */
function aziendaLogo(input) {
  const file = input.files && input.files[0]; input.value = ''
  if (!file) return
  const rd = new FileReader()
  rd.onload = () => {
    const url = String(rd.result || '')
    if (file.type === 'image/svg+xml') { _logoNuovo = url; aziendaSalvaSeValido(); return }
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 360 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      _logoNuovo = c.toDataURL('image/png'); aziendaSalvaSeValido()
    }
    img.onerror = () => toast('Immagine non leggibile')
    img.src = url
  }
  rd.readAsDataURL(file)
}

/* ── Modelli di struttura del computo (categorie + WBS) ── */
function leggiModelli() { try { return normalizzaModelli(JSON.parse(localStorage.getItem(CHIAVE_MODELLI) || '[]')) } catch { return [] } }
function scriviModelli(mm) { try { localStorage.setItem(CHIAVE_MODELLI, JSON.stringify(mm)) } catch { toast('Spazio di archiviazione non disponibile') } }
const S_MOD = { aperto: null }
const escA = (x) => esc(x).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
function renderModelli() {
  const mm = leggiModelli()
  const cnt = document.getElementById('aModelliCount'); if (cnt) cnt.textContent = String(mm.length)
  const el = document.getElementById('aModelli'); if (!el) return
  if (!mm.length) { el.innerHTML = '<div class="adm-ph">Nessun modello. Creane uno dal Computo: ☰ Struttura → Modelli.</div>'; return }
  el.innerHTML = mm.map((m) => {
    const aperto = S_MOD.aperto === m.id
    const det = aperto ? `<div class="adm-modello__det">
        <div><b>Categorie</b>${m.categorie.length ? '<ul>' + m.categorie.map((c) => `<li>${esc(c.split(' · ').join(' › '))}</li>`).join('') + '</ul>' : '<p>—</p>'}</div>
        <div><b>WBS</b>${Object.keys(m.wbs).length ? '<ul>' + Object.entries(m.wbs).map(([c, d]) => `<li><code>${esc(c)}</code> ${esc(d)}</li>`).join('') + '</ul>' : '<p>—</p>'}</div>
      </div>` : ''
    return `<div class="adm-modello">
      <div class="adm-modello__head">
        <input class="adm-modello__nome" value="${escA(m.nome)}" onchange="rinominaModello('${esc(m.id)}', this.value)" title="Rinomina">
        <span class="adm-modello__info">${m.categorie.length} rami · ${Object.keys(m.wbs).length} nodi WBS${m.creato ? ' · ' + new Date(m.creato).toLocaleDateString('it-IT') : ''}</span>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriModello('${esc(m.id)}')">${aperto ? 'Chiudi' : 'Contenuto'}</button>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="duplicaModello('${esc(m.id)}')">Duplica</button>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="esportaModelli('${esc(m.id)}')">Esporta</button>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="eliminaModello('${esc(m.id)}')">Elimina</button>
      </div>${det}</div>`
  }).join('')
}
function apriModello(id) { S_MOD.aperto = S_MOD.aperto === id ? null : id; renderModelli() }
function rinominaModello(id, nome) {
  const mm = leggiModelli(); const m = mm.find((x) => x.id === id); if (!m || !String(nome).trim()) { renderModelli(); return }
  m.nome = String(nome).trim(); scriviModelli(mm); toast('Modello rinominato'); renderModelli()
}
function duplicaModello(id) {
  const mm = leggiModelli(); const m = mm.find((x) => x.id === id); if (!m) return
  mm.push({ ...JSON.parse(JSON.stringify(m)), id: 'm' + Date.now().toString(36), nome: m.nome + ' (copia)', creato: Date.now() })
  scriviModelli(mm); renderModelli()
}
function eliminaModello(id) {
  const mm = leggiModelli(); const m = mm.find((x) => x.id === id); if (!m) return
  if (!confirm(`Eliminare il modello «${m.nome}»? I progetti a cui è già stato applicato non cambiano.`)) return
  scriviModelli(mm.filter((x) => x.id !== id)); toast('Modello eliminato'); renderModelli()
}
function esportaModelli(id) {
  const mm = leggiModelli().filter((m) => !id || m.id === id)
  if (!mm.length) { toast('Nessun modello da esportare'); return }
  const nome = id && mm[0] ? 'modello-' + mm[0].nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'modelli-struttura'
  dl(JSON.stringify({ kind: 'quadra-modelli-struttura', v: 1, modelli: mm }, null, 2), nome + '.json', 'application/json')
}
function importaModelli(input) {
  const file = input.files && input.files[0]; input.value = ''
  if (!file) return
  file.text().then((t) => {
    let nuovi
    try { nuovi = normalizzaModelli(JSON.parse(t)) } catch { nuovi = [] }
    if (!nuovi.length) { toast('Nel file non ci sono modelli di struttura'); return }
    const mm = leggiModelli()
    for (const n of nuovi) {
      const i = mm.findIndex((x) => x.id === n.id || x.nome === n.nome)
      if (i >= 0) mm[i] = n; else mm.push(n)
    }
    scriviModelli(mm); toast(`${nuovi.length} modell${nuovi.length === 1 ? 'o importato' : 'i importati'}`); renderModelli()
  })
}

/* ── Backup / Ripristino / Diagnostica ── */
function suiteSettingEntries() {
  const out = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('hub:') && !['hub:auth', 'hub:state', 'hub:users'].includes(k)) out[k] = localStorage.getItem(k)
    }
  } catch { /* storage off */ }
  return out
}
function dl(content, name, type) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function exportConfig() {
  const cfg = { kind: 'ehub-config', v: 1, ts: Date.now(), users: S.users, settings: suiteSettingEntries() }
  dl(JSON.stringify(cfg, null, 2), 'ehub-config.json', 'application/json')
  toast('Configurazione esportata')
}
function importConfig(input) {
  const file = input.files && input.files[0]
  input.value = ''
  if (!file) return
  const r = new FileReader()
  r.onload = ev => {
    let cfg
    try { cfg = JSON.parse(String(ev.target.result)) }
    catch { toast('File configurazione non valido'); return }
    if (!cfg || cfg.kind !== 'ehub-config') { toast('Non è un file di configurazione Quadra'); return }
    if (Array.isArray(cfg.users)) { S.users = normalizeUsers(cfg.users); persistUsers() }
    const s = cfg.settings || {}
    try { for (const k in s) { if (k.startsWith('hub:') && s[k] != null) localStorage.setItem(k, s[k]) } } catch { /* storage off */ }
    toast('Configurazione importata')
    notifyHubChanged()
    renderUsers()
  }
  r.onerror = () => toast('Impossibile leggere il file')
  r.readAsText(file)
}
function importConfigClick() { document.getElementById('aConfigFile')?.click() }
function exportDiagnostics() {
  const entries = []
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); entries.push([k, (k.length + (localStorage.getItem(k) || '').length) * 2]) } } catch { /* storage off */ }
  const stats = computeAdminStats({ registry: APP_REGISTRY, users: S.users, hubProjectState: loadHubProjectState(), storageEntries: entries, storagePrefixes: STORAGE_PREFIXES })
  dl(JSON.stringify({ generato: new Date().toISOString(), versione: (window.QUADRA_VERSIONS && window.QUADRA_VERSIONS.app.version) || '—', stats }, null, 2), 'ehub-diagnostica.json', 'application/json')
  toast('Report diagnostico esportato')
}

/* ── Avvio: protezione difensiva (l'hub non carica mai Amministrazione per un'azienda, ma
   se qualcuno apre Amministrazione.html direttamente, non mostrare dati sensibili).
   Il profilo admin locale lo scrive l'hub in sessionStorage all'avvio (vedi
   initAuth in hub/ui/auth.js): qui si legge, non si genera. */
async function boot() {
  S.authProfile = loadAuthProfile()
  if (!S.authProfile || S.authProfile.role !== 'admin') {
    document.getElementById('app').innerHTML = '<div class="adm-ph" style="max-width:420px;margin:60px auto">Centro di controllo riservato all\'amministratore. Accedi come admin dall\'hub.</div>'
    document.querySelector('.ehb-tabs')?.remove()
    return
  }
  await loadUsers()
  renderPanoramica()
  document.getElementById('aConfigFile')?.addEventListener('change', e => importConfig(e.target))
  document.getElementById('aModelliFile')?.addEventListener('change', e => importaModelli(e.target))
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark')
}
boot()

Object.assign(window, {
  toggleTheme, showView,
  toggleActive, resetTour, toggleRole, removeUser, addUser,
  filterUsers,
  beginRenameUser, commitRenameUser, cancelRenameUser,
  exportConfig, importConfig, importConfigClick, exportDiagnostics,
  rinominaModello, duplicaModello, eliminaModello, esportaModelli, apriModello,
  aziendaSalva, aziendaRipristina, aziendaTogliLogo, aziendaLogo,
})

bindThemeShortcut(toggleTheme)
