/**
 * IL PANNELLO PREZZI — tappa 3 di Docs/07-Un-lavoro-un-modulo.md.
 *
 * Uno solo, a destra, per ogni tappa del lavoro. Tre schede, sempre le stesse:
 *  - PROGETTO (o CONTRATTO, quando la tappa è il contratto o una perizia):
 *    l'elenco prezzi della revisione aperta, con quante voci usano ogni articolo;
 *  - PREZZARIO: i prezzari del programma (quelli importati e quelli installati),
 *    da cui si cerca e si pesca;
 *  - ALTRO PROGETTO: gli articoli di un altro lavoro, aperto da file.
 * Una voce entra nella tappa aperta con «＋» o con un doppio clic; se la tappa
 * è chiusa, il pannello si legge e lo dice.
 *
 * Modulo PURO: riceve lo stato e restituisce HTML; i comandi `lvPz…` li espone main.ts.
 */
import { elencoArticoli, sigla, type Lavoro, type Revisione } from '../../shared/lavoro'
import type { PrezzarioDisponibile } from '../../shared/prezzari/archivio'
import type { PriceRow } from '../computo/engine/types'
import { fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export type SchedaPrezzi = 'progetto' | 'prezzario' | 'altro'

export interface Pannello {
  aperto: boolean
  scheda: SchedaPrezzi
  /** Ricerca della scheda aperta. */
  q: string
  /** Solo i nuovi prezzi e le analisi (da ANALISI PREZZI nella sidebar). */
  soloNp: boolean
  /** I prezzari del programma. */
  prezzari: PrezzarioDisponibile[]
  /** Il prezzario scelto, le sue righe, e quelle trovate dalla ricerca. */
  prezzario: string | null
  righe: PriceRow[]
  trovate: PriceRow[]
  stato: string
  /** Un altro lavoro aperto da file. */
  altro: { nome: string; lavoro: Lavoro; rev: string } | null
  /** I filtri del prezzario, a cascata (come nel Computo): disciplina › sistema › settore. */
  filtri?: { disciplina?: string; sistema?: string; settore?: string }
}

/** Le voci del prezzario che passano i filtri. */
export function filtraPrezzario(righe: PriceRow[], f: Pannello['filtri'] = {}): PriceRow[] {
  return righe.filter((x) => (!f.disciplina || x.disciplina === f.disciplina) && (!f.sistema || x.sistema === f.sistema) && (!f.settore || x.settore === f.settore))
}

/** I valori di un filtro, dentro quelli scelti più in alto (la cascata). */
export function valoriFiltro(righe: PriceRow[], campo: 'disciplina' | 'sistema' | 'settore', f: Pannello['filtri'] = {}): string[] {
  const sopra = campo === 'disciplina' ? {} : campo === 'sistema' ? { disciplina: f.disciplina } : { disciplina: f.disciplina, sistema: f.sistema }
  return [...new Set(filtraPrezzario(righe, sopra).map((x) => (x[campo] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'))
}

export function nuovoPannello(): Pannello {
  return { aperto: true, scheda: 'progetto', q: '', soloNp: false, prezzari: [], prezzario: null, righe: [], trovate: [], stato: '', altro: null }
}

/** La prima scheda si chiama come l'elenco che mostra. */
export const nomePrimaScheda = (r: Revisione | null): string => (r && r.tipo !== 'computo' ? 'Contratto' : 'Progetto')

const riga = (o: { codice: string; descrizione: string; estesa?: string; um: string; prezzo: number | null; usi?: number; np?: boolean; sic?: boolean; aggiungi?: string; modifica?: string }): string => `
  <div class="lv-pz-riga${o.aggiungi ? ' is-prendibile' : ''}"${o.aggiungi ? ` ondblclick="${esc(o.aggiungi)}"` : ''} title="${esc(o.estesa || o.descrizione)}"
    data-codice="${esc(o.codice)}" data-descrizione="${esc(o.descrizione)}" oncontextmenu="lvPzMenu(event,this)">
    <div class="lv-pz-riga__su">
      <span class="lv-pz-cod">${esc(o.codice || '—')}${o.np ? ' <span class="lv-pz-tag">NP</span>' : ''}${o.sic ? ' <span class="lv-pz-tag is-sic">sic.</span>' : ''}</span>
      <span class="lv-pz-um">${esc(o.um)}</span>
      <span class="lv-pz-prezzo">${o.prezzo != null ? '€ ' + fmt(o.prezzo) : '—'}</span>
      ${o.usi != null ? `<span class="lv-pz-usi" title="Voci che lo usano">×${o.usi}</span>` : ''}
      ${o.modifica ? `<button class="ehb-icon-btn lv-pz-cmd" onclick="${esc(o.modifica)}" title="Modifica l'articolo">✎</button>` : ''}
      ${o.aggiungi ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft lv-pz-cmd" onclick="${esc(o.aggiungi)}" title="Una voce nuova di questo articolo (anche doppio clic)">＋</button>` : ''}
    </div>
    <div class="lv-pz-desc">${esc(o.descrizione || '(senza descrizione)')}</div>
  </div>`

function schedaProgetto(r: Revisione | null, p: Pannello, o: OpzioniPannello): string {
  if (!r) return '<p class="lv-pz-vuoto">Apri una revisione dalla sidebar: qui compare il suo elenco prezzi.</p>'
  const scrive = o.scrive ?? r.stato === 'aperta'
  const s = p.q.trim().toLowerCase()
  const art = elencoArticoli(r)
    .filter((a) => !p.soloNp || a.origine === 'np' || a.origine === 'analisi')
    .filter((a) => !s || `${a.codice} ${a.descrizione}`.toLowerCase().includes(s))
  const righe = art.map((a) => riga({
    codice: a.codice, descrizione: a.descrizione, estesa: a.estesa, um: a.um, prezzo: a.prezzo, usi: a.usi,
    np: a.origine === 'np' || a.origine === 'analisi', sic: a.sicurezza,
    aggiungi: scrive ? `lvPzVoceDaArticolo(${q(a.id)})` : undefined,
    modifica: scrive && !o.inSal ? `lvPzModificaArticolo(${q(a.id)})` : undefined,
  })).join('')
  return `
    <p class="lv-pz-nota">${p.soloNp ? 'Nuovi prezzi e prezzi da analisi' : `L'elenco prezzi di ${esc(sigla(r.numero))}`}: ${art.length} articol${art.length === 1 ? 'o' : 'i'}.${p.soloNp ? ` <button class="lv-pz-link" onclick="lvPzSoloNp(false)">Mostra tutti</button>` : ''}</p>
    ${righe || `<p class="lv-pz-vuoto">${s ? 'Nessun articolo corrisponde.' : 'Ancora nessun articolo: pescali dal prezzario, o «＋ Voce libera».'}</p>`}`
}

function schedaPrezzario(r: Revisione | null, p: Pannello, o: OpzioniPannello): string {
  const scrive = !!o.perAnalisi || (!!o.libero && !!o.scrive) || (!o.inSal && !!r && r.stato === 'aperta')
  if (!p.prezzari.length) {
    return `<p class="lv-pz-vuoto">Nessun prezzario nel programma.</p>
      <p class="lv-pz-nota">Si importa il prezzario ufficiale della regione (XML o Excel, come si scarica dal portale), un elenco prezzi XPWE, o il listino di un fornitore in Excel: resta nell'archivio del programma.</p>
      <button class="ehb-btn ehb-btn--sm" onclick="lvPzImportaXpwe()">⇩ Importa un prezzario…</button>`
  }
  const righe = p.trovate.map((x, i) => riga({
    codice: x.codice, descrizione: x.desc_short || x.declaratoria, estesa: x.declaratoria, um: x.um, prezzo: x.prezzo,
    aggiungi: scrive ? `lvPzDaPrezzario(${i})` : undefined,
  })).join('')
  const f = p.filtri || {}
  const attivi = !!(f.disciplina || f.sistema || f.settore)
  const nota = (p.q.trim() || attivi) && p.righe.length ? `${p.trovate.length} trovat${p.trovate.length === 1 ? 'a' : 'e'} su ${p.righe.length.toLocaleString('it-IT')} voci` : p.stato
  // i filtri a cascata, solo se il prezzario porta quelle colonne
  const sel = (campo: 'disciplina' | 'sistema' | 'settore', etichetta: string): string => {
    const v = valoriFiltro(p.righe, campo, f)
    if (v.length < 2 && !f[campo]) return ''
    return `<select class="lv-pz-sel lv-pz-filtro" onchange="lvPzFiltro('${campo}',this.value)" title="${etichetta}"><option value="">${etichetta}: tutte</option>${v.map((x) => `<option value="${esc(x)}"${f[campo] === x ? ' selected' : ''}>${esc(x.length > 48 ? x.slice(0, 47) + '…' : x)}</option>`).join('')}</select>`
  }
  const filtri = p.righe.length ? sel('disciplina', 'Disciplina') + (f.disciplina ? sel('sistema', 'Sistema') : '') + sel('settore', 'Settore') : ''
  return `
    ${filtri}${attivi ? '<button class="lv-pz-link lv-pz-piede" onclick="lvPzFiltro(\'\',\'\')">togli i filtri</button>' : ''}
    <p class="lv-pz-nota">${esc(nota)}${o.inSal && o.libero ? ' · «＋»: l\'articolo entra nel contratto e si misura nel SAL' : o.inSal ? ' · in un SAL si consulta: un prezzo nuovo è un nuovo prezzo, cioè una perizia' : !scrive && r ? ' · la revisione è chiusa: qui si consulta' : ''}</p>
    ${righe || (p.prezzario ? `<p class="lv-pz-vuoto">${p.q ? 'Nessuna voce corrisponde.' : ''}</p>` : '')}
    <div class="lv-pz-piede"><button class="lv-pz-link" onclick="lvPzImportaXpwe()" title="XML o Excel regionale, XPWE, listino Excel, CSV del Cratere">⇩ Importa un prezzario…</button></div>`
}

function schedaAltro(r: Revisione | null, p: Pannello, o: OpzioniPannello): string {
  const scrive = (!!o.libero && !!o.scrive) || (!o.inSal && !!r && r.stato === 'aperta')
  if (!p.altro) {
    return `<p class="lv-pz-nota">Gli articoli di un altro lavoro: si apre il suo file e si prendono quelli che servono, con il loro prezzo.</p>
      <button class="ehb-btn ehb-btn--sm" onclick="lvPzApriAltro()">Apri un altro lavoro…</button>`
  }
  const revs = p.altro.lavoro.revisioni
  const src = revs.find((x) => x.id === p.altro!.rev) ?? revs[revs.length - 1]
  const s = p.q.trim().toLowerCase()
  const art = src ? src.articoli.filter((a) => !s || `${a.codice} ${a.descrizione}`.toLowerCase().includes(s)) : []
  return `
    <p class="lv-pz-nota"><b>${esc(p.altro.nome)}</b> · <button class="lv-pz-link" onclick="lvPzApriAltro()">un altro…</button></p>
    ${art.map((a) => riga({ codice: a.codice, descrizione: a.descrizione, estesa: a.estesa, um: a.um, prezzo: a.prezzo, np: a.origine === 'np', sic: a.sicurezza, aggiungi: scrive ? `lvPzDaAltro(${q(a.id)})` : undefined })).join('') || '<p class="lv-pz-vuoto">Nessun articolo.</p>'}`
}

/** Che cosa si sceglie PRIMA di cercare: il prezzario, o la revisione dell'altro lavoro. */
function selettore(p: Pannello): string {
  if (p.scheda === 'prezzario' && p.prezzari.length) {
    return `<select class="lv-pz-sel" onchange="lvPzScegli(this.value)" aria-label="Prezzario">${p.prezzario ? '' : '<option value="">— scegli un prezzario —</option>'}${p.prezzari.map((x) => `<option value="${esc(x.id)}"${x.id === p.prezzario ? ' selected' : ''}>${esc(x.nome)}${x.n ? ` (${x.n.toLocaleString('it-IT')} voci)` : ''}</option>`).join('')}</select>`
  }
  if (p.scheda === 'altro' && p.altro) {
    const revs = p.altro.lavoro.revisioni
    const src = revs.find((x) => x.id === p.altro!.rev) ?? revs[revs.length - 1]
    return `<select class="lv-pz-sel" onchange="lvPzRevAltro(this.value)" aria-label="Revisione dell'altro lavoro">${revs.map((x) => `<option value="${esc(x.id)}"${x.id === src?.id ? ' selected' : ''}>${esc(sigla(x.numero))} · ${esc(x.nome || x.fase || x.tipo)} (${x.articoli.length} articoli)</option>`).join('')}</select>`
  }
  return ''
}

/** Nel SAL il pannello mostra l'elenco di contratto: si scrive solo nel libretto. */
export interface OpzioniPannello { scrive?: boolean; inSal?: boolean; /** SAL di una contabilità senza computo: si pesca da tutte le schede. */ libero?: boolean; /** Su una pagina di analisi: «＋» aggiunge una riga all'analisi. */ perAnalisi?: boolean }

/** Il pannello intero: testata, schede, ricerca, elenco. */
export function pannelloPrezziHtml(r: Revisione | null, p: Pannello, o: OpzioniPannello = {}): string {
  if (!p.aperto) return ''
  const schede: [SchedaPrezzi, string][] = [['progetto', nomePrimaScheda(r)], ['prezzario', 'Prezzario'], ['altro', 'Altro progetto']]
  const corpo = p.scheda === 'prezzario' ? schedaPrezzario(r, p, o) : p.scheda === 'altro' ? schedaAltro(r, p, o) : schedaProgetto(r, p, o)
  const scrive = o.scrive ?? (!!r && r.stato === 'aperta')
  return `<aside class="lv-prezzi" id="lv-prezzi" aria-label="Elenco prezzi">
    <div class="lv-pz-hd">
      <div class="lv-pz-t">Elenco prezzi<span>${o.perAnalisi ? '＋: la voce entra come riga dell\'analisi' : o.inSal ? (scrive ? '＋: la voce entra nel libretto' : 'il SAL è emesso: si consulta') : scrive ? 'doppio clic o ＋: la voce entra nella tappa aperta' : 'in sola lettura'}</span></div>
      <button class="ehb-icon-btn" onclick="lvPzChiudi()" title="Chiudi il pannello (si riapre da «≡ Prezzi» nella barra)">✕</button>
    </div>
    <div class="lv-pz-schede" role="tablist">${schede.map(([id, t]) => `<button role="tab" class="lv-pz-scheda${p.scheda === id ? ' is-on' : ''}" aria-selected="${p.scheda === id}" onclick="lvPzScheda('${id}')">${esc(t)}</button>`).join('')}</div>
    ${selettore(p)}
    <input type="search" class="lv-pz-q" id="lv-pz-q" value="${esc(p.q)}" placeholder="⌕ codice o parole" oninput="lvPzCerca(this.value)" autocomplete="off">
    <div class="lv-pz-body" id="lv-pz-body">${corpo}</div>
  </aside>`
}
