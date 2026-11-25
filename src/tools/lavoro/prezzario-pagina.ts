/**
 * IL PREZZARIO A TUTTA PAGINA — un prezzario del programma (regionale,
 * listino di un fornitore, elenco importato), voce per voce come una tabella:
 * si cerca, si filtra, si sfoglia, si porta una voce nel computo aperto e, se
 * il prezzario è dell'archivio, si corregge sul posto.
 *
 * Due provenienze, due regole (shared/prezzari/archivio.ts):
 *  - quelli IMPORTATI stanno nell'archivio del programma su questo computer:
 *    codice, descrizione, unità, prezzo e incidenza della manodopera si
 *    scrivono nella tabella, le voci si aggiungono e si tolgono;
 *  - quelli INSTALLATI col programma sono il testo ufficiale e restano com'è:
 *    per cambiarli se ne fa una COPIA nell'archivio, e si lavora su quella.
 *
 * Un prezzario regionale ha decine di migliaia di voci: la tabella ne mostra
 * un blocco alla volta («Mostra altre…»), la ricerca le guarda tutte.
 *
 * Modulo PURO: riceve lo stato e restituisce HTML; i comandi `lvPp…` li espone main.ts.
 */
import { testataHtml } from '../../shared/griglia'
import type { PrezzarioDisponibile } from '../../shared/prezzari/archivio'
import type { PriceRow } from '../computo/engine/types'
import { filtraPrezzario, valoriFiltro } from './prezzi'
import { fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export interface StatoPrezzario {
  /** Il prezzario aperto (id dell'archivio: `arc:…` o `pkg:…`). */
  id: string | null
  /** Le sue voci (le stesse in memoria del pannello a destra). */
  righe: PriceRow[]
  q: string
  filtri: { disciplina?: string; sistema?: string; settore?: string }
  /** Quante righe mostrare (si allunga con «Mostra altre»). */
  mostra: number
  stato: string
}

export const BLOCCO = 300
export const nuovoStatoPrezzario = (): StatoPrezzario => ({ id: null, righe: [], q: '', filtri: {}, mostra: BLOCCO, stato: '' })

/** Tutte le parole della ricerca, in qualunque ordine, nel codice o nelle descrizioni. */
export function cercaRighe(righe: PriceRow[], ricerca: string): number[] {
  const parole = ricerca.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out: number[] = []
  righe.forEach((r, i) => {
    if (!parole.length) { out.push(i); return }
    const t = `${r.codice} ${r.desc_short} ${r.declaratoria} ${r.um}`.toLowerCase()
    if (parole.every((p) => t.includes(p))) out.push(i)
  })
  return out
}

/** Gli indici delle righe da mostrare: filtri, poi ricerca. */
export function righeVisibili(st: StatoPrezzario): number[] {
  const f = st.filtri
  const attivi = !!(f.disciplina || f.sistema || f.settore)
  const ammesse = attivi ? new Set(filtraPrezzario(st.righe, f)) : null
  return cercaRighe(st.righe, st.q).filter((i) => !ammesse || ammesse.has(st.righe[i]))
}

export interface OpzioniPrezzario {
  prezzari: PrezzarioDisponibile[]
  /** Dove va «＋»: la revisione aperta (computo o perizia), se c'è. */
  destinazione?: string | null
}

export function paginaPrezzario(st: StatoPrezzario, o: OpzioniPrezzario): string {
  const p = o.prezzari.find((x) => x.id === st.id) || null
  const scrive = p?.origine === 'archivio'
  const vis = st.righe.length ? righeVisibili(st) : []
  const mostrate = vis.slice(0, st.mostra)

  const scelta = `<select class="lv-el-rev" onchange="lvPpScegli(this.value)" aria-label="Prezzario">${st.id ? '' : '<option value="">— scegli un prezzario —</option>'}${o.prezzari.map((x) => `<option value="${esc(x.id)}"${x.id === st.id ? ' selected' : ''}>${esc(x.nome)}${x.origine === 'archivio' ? ' · archivio' : ''}${x.n ? ` (${x.n.toLocaleString('it-IT')})` : ''}</option>`).join('')}</select>`
  const azioni = `${scelta}${p && !scrive ? '<button class="ehb-btn ehb-btn--sm" onclick="lvPpCopia()" title="Il prezzario installato resta com\'è: se ne fa una copia nell\'archivio, e si modifica quella">✎ Copia modificabile…</button>' : ''}${scrive ? '<button class="ehb-btn ehb-btn--sm" onclick="lvPpNuova()" title="Una voce nuova in fondo al prezzario">＋ Voce</button>' : ''}<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvPzImportaXpwe()" title="XML o Excel regionale, XPWE, listino Excel, CSV">⇩ Importa…</button>${scrive ? '<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvPpTogliPrezzario()" title="Togli questo prezzario dall\'archivio del programma">✕ Togli</button>' : ''}`

  const f = st.filtri
  const sel = (campo: 'disciplina' | 'sistema' | 'settore', etichetta: string): string => {
    const v = valoriFiltro(st.righe, campo, f)
    if (v.length < 2 && !f[campo]) return ''
    return `<select onchange="lvPpFiltro('${campo}',this.value)" title="${etichetta}"><option value="">${etichetta}: tutte</option>${v.map((x) => `<option value="${esc(x)}"${f[campo] === x ? ' selected' : ''}>${esc(x.length > 60 ? x.slice(0, 59) + '…' : x)}</option>`).join('')}</select>`
  }
  const filtri = st.righe.length ? sel('disciplina', 'Disciplina') + (f.disciplina ? sel('sistema', 'Sistema') : '') + sel('settore', 'Settore') : ''

  const cella = (i: number, campo: string, valore: string, cls = '', extra = ''): string => scrive
    ? `<td id="pp-${i}-${campo}" class="${cls}"><input value="${esc(valore)}" onchange="lvPpSet(${i},'${campo}',this.value)"${extra}></td>`
    : `<td class="${cls}">${esc(valore)}</td>`
  const corpo = mostrate.map((i) => {
    const r = st.righe[i]
    const breve = r.desc_short || r.declaratoria
    const estesa = r.declaratoria && r.declaratoria !== breve ? r.declaratoria : ''
    return `<tr>
      ${cella(i, 'codice', r.codice || '', 'lv-el-cod')}
      ${scrive
        ? `<td id="pp-${i}-desc_short" class="lv-el-des"><input value="${esc(breve)}" onchange="lvPpSet(${i},'desc_short',this.value)"${estesa ? ` title="${esc(estesa)}"` : ''}></td>`
        : `<td class="lv-el-des"><span class="lv-pp-des"${estesa ? ` title="${esc(estesa)}"` : ''}>${esc(breve || '(senza descrizione)')}</span></td>`}
      ${cella(i, 'um', r.um || '', 'lv-el-um')}
      ${scrive
        ? `<td id="pp-${i}-prezzo" class="lv-el-pr"><input class="lv-el-num" inputmode="decimal" value="${Number.isFinite(r.prezzo) ? esc(fmt(r.prezzo)) : ''}" onchange="lvPpSet(${i},'prezzo',this.value)"></td>`
        : `<td class="lv-el-pr">${Number.isFinite(r.prezzo) ? fmt(r.prezzo) : '—'}</td>`}
      ${scrive
        ? `<td id="pp-${i}-ru" class="lv-el-pr lv-pp-ru"><input class="lv-el-num" inputmode="decimal" value="${r.ru ? esc(fmt(r.ru, 2)) : ''}" onchange="lvPpSet(${i},'ru',this.value)" title="Incidenza della manodopera, %"></td>`
        : `<td class="lv-el-pr lv-pp-ru">${r.ru ? fmt(r.ru, 2) : '—'}</td>`}
      <td class="lv-str-az">
        <button class="ehb-icon-btn" onclick="lvPpVoce(${i})" title="${scrive ? 'Tutta la voce: anche la descrizione estesa' : 'La voce per intero, con la descrizione estesa'}">${scrive ? '✎' : '⌕'}</button>
        ${o.destinazione ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="lvPpPrendi(${i})" title="Una voce nuova di questo articolo in ${esc(o.destinazione)}">＋</button>` : ''}
        ${scrive ? `<button class="ehb-icon-btn is-pericolo" onclick="lvPpTogli(${i})" title="Togli la voce dal prezzario">✕</button>` : ''}
      </td>
    </tr>`
  }).join('')

  const quante = st.righe.length
  const nota = !p ? 'Scegli un prezzario del programma, o importane uno.'
    : scrive ? 'Prezzario dell\'archivio del programma: codice, descrizione, unità, prezzo e incidenza della manodopera si scrivono qui e si salvano da soli. Le voci già portate in un computo tengono il loro prezzo: l\'elenco prezzi del lavoro non cambia di nascosto.'
      : 'Prezzario installato col programma: è il testo ufficiale e si consulta. Per cambiarlo, «✎ Copia modificabile»: la copia va nell\'archivio e si modifica quella.'

  return `<section class="lv-page lv-dati">
    ${testataHtml({
      titolo: 'Prezzario', revisione: p ? p.nome : undefined,
      sottotitolo: st.stato || (quante ? `${quante.toLocaleString('it-IT')} voci` : ''),
      pastiglie: p ? [{ testo: scrive ? 'archivio · modificabile' : 'installato · si consulta', tono: 'fase' }] : [],
      azioni,
    })}
    <div class="lv-body lv-el">
      <p class="lv-nota">${esc(nota)}${o.destinazione ? ` «＋» porta la voce in <b>${esc(o.destinazione)}</b>.` : ''}</p>
      ${quante ? `<div class="lv-el-barra">
        <input type="search" id="lv-pp-q" class="lv-el-q" value="${esc(st.q)}" placeholder="⌕ codice, parole o unità" oninput="lvPpCerca(this.value)" autocomplete="off">
        ${filtri}${(f.disciplina || f.sistema || f.settore) ? '<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvPpFiltro(\'\',\'\')">togli i filtri</button>' : ''}
        <span class="lv-nota">${vis.length === quante ? '' : `${vis.length.toLocaleString('it-IT')} trovate · `}${mostrate.length < vis.length ? `le prime ${mostrate.length.toLocaleString('it-IT')}` : ''}</span>
      </div>
      ${mostrate.length ? `<table class="lv-ct-tab lv-el-tab lv-pp-tab">
        <thead><tr><th>Codice</th><th>Descrizione</th><th>U.M.</th><th class="lv-el-pr">Prezzo €</th><th class="lv-el-pr" title="Incidenza della manodopera">MdO %</th><th></th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>` : '<p class="lv-nota">Nessuna voce corrisponde.</p>'}
      ${mostrate.length < vis.length ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvPpAltre()">Mostra altre ${Math.min(BLOCCO, vis.length - mostrate.length).toLocaleString('it-IT')}</button>` : ''}` : ''}
    </div>
  </section>`
}
