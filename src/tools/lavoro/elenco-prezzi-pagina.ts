/**
 * L'ELENCO PREZZI A TUTTA PAGINA — gli articoli di una revisione (computo,
 * contratto, perizia), uno per riga, come una tabella: si consulta, si cerca,
 * si filtra e, se la revisione è aperta, si corregge sul posto.
 *
 * Il pannello a destra resta lo strumento per PESCARE (dal prezzario, da un
 * altro lavoro); questa pagina è quella per TENERE l'elenco: codici,
 * descrizioni, unità, prezzi, sicurezza, quante voci usano ogni articolo e per
 * quale importo, gli articoli che non usa nessuno.
 *
 * Le regole sono quelle del modello (modificaArticolo, togliArticolo):
 *  - il contratto stipulato e le revisioni chiuse si leggono soltanto;
 *  - in perizia il prezzo di contratto non cambia: un prezzo diverso è un NP;
 *  - un articolo usato da una voce non si toglie.
 *
 * Modulo PURO: riceve lo stato e restituisce HTML; i comandi `lvEl…` li espone main.ts.
 */
import { testataHtml } from '../../shared/griglia'
import { elencoArticoli, quantitaVoce, prezzoIn, sigla, type Lavoro, type Revisione, type Articolo } from '../../shared/lavoro'
import { importoQta } from '../../shared/importo'
import { eur, fmt } from './schermata'

const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const q = (s: string): string => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export type FiltroElenco = 'tutti' | 'usati' | 'inutilizzati' | 'np' | 'sicurezza'

export interface StatoElenco {
  /** Ricerca: codice o parole della descrizione. */
  q: string
  filtro: FiltroElenco
}

export const nuovoStatoElenco = (): StatoElenco => ({ q: '', filtro: 'tutti' })

const ORIGINE: Record<Articolo['origine'], string> = { prezzario: 'prezzario', np: 'NP', analisi: 'analisi', manuale: 'manuale' }

/** Il testo in cui si cerca: codice, descrizione breve ed estesa, unità di misura, in minuscolo. */
export const testoRicerca = (a: Pick<Articolo, 'codice' | 'descrizione' | 'estesa' | 'um'>): string =>
  `${a.codice} ${a.descrizione} ${a.estesa || ''} ${a.um || ''}`.toLowerCase()

/** Corrisponde alla ricerca? Tutte le parole, in qualunque ordine. */
export function corrispondeRicerca(testo: string, ricerca: string): boolean {
  const parole = ricerca.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return parole.every((p) => testo.includes(p))
}

/** Gli articoli della revisione, con usi e importo, filtrati (la ricerca la fa la pagina, al volo). */
export function righeElenco(r: Revisione, filtro: FiltroElenco): (Articolo & { usi: number; importo: number; n: number })[] {
  const importi = new Map<string, number>()
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  for (const v of r.voci) {
    const a = art.get(v.articolo); if (!a) continue
    importi.set(a.id, (importi.get(a.id) || 0) + importoQta(quantitaVoce(v), prezzoIn(r, a), a.um))
  }
  return elencoArticoli(r)
    .map((a, i) => ({ ...a, importo: Math.round((importi.get(a.id) || 0) * 100) / 100, n: i + 1 }))
    .filter((a) => filtro === 'tutti'
      || (filtro === 'usati' && a.usi > 0)
      || (filtro === 'inutilizzati' && a.usi === 0)
      || (filtro === 'np' && (a.origine === 'np' || a.origine === 'analisi'))
      || (filtro === 'sicurezza' && !!a.sicurezza))
}

/** Perché una revisione non si modifica, in chiaro (null se si modifica). */
function percheSolaLettura(r: Revisione): string | null {
  if (r.stato === 'aperta') return null
  if (r.tipo === 'contratto') return 'Il contratto è stipulato: l\'elenco si consulta. Un prezzo nuovo è un nuovo prezzo, cioè una perizia.'
  if (r.tipo === 'perizia') return 'La perizia è approvata: l\'elenco si consulta.'
  return 'La revisione è consegnata: l\'elenco si consulta. Per cambiarlo, «＋ Nuova revisione da questa» o «↺ Riapri».'
}

export function paginaElencoPrezzi(l: Lavoro, r: Revisione, st: StatoElenco): string {
  const scrive = r.stato === 'aperta'
  const perizia = r.tipo === 'perizia'
  const offerti = r.contratto?.prezziOfferti
  const tutte = righeElenco(r, 'tutti')
  const righe = righeElenco(r, st.filtro)
  const usati = tutte.filter((a) => a.usi > 0).length
  const totale = righe.reduce((s, a) => s + a.importo, 0)

  const cella = (id: string, campo: string, html: string, cls = ''): string => `<td id="el-${esc(id)}-${campo}"${cls ? ` class="${cls}"` : ''}>${html}</td>`
  const input = (a: Articolo, campo: 'codice' | 'descrizione' | 'um', extra = ''): string =>
    `<input value="${esc(a[campo] ?? '')}" onchange="lvElSet(${q(r.id)},${q(a.id)},'${campo}',this.value)"${extra}>`

  const corpo = righe.map((a) => {
    // in perizia il prezzo di contratto è fisso: si scrive solo quello dei nuovi prezzi
    const prezzoFisso = perizia && a.origine !== 'np'
    const storico = [
      a.prezzoListino != null ? `listino € ${fmt(a.prezzoListino)}` : '',
      ...(a.storico || []).map((x) => `${x.data}: ${x.da != null ? fmt(x.da) : '—'} → ${x.a != null ? fmt(x.a) : '—'}${x.nota ? ` (${x.nota})` : ''}`),
    ].filter(Boolean).join('\n')
    const prezzo = scrive && !prezzoFisso
      ? `<input class="lv-el-num" inputmode="decimal" value="${a.prezzo != null ? esc(fmt(a.prezzo)) : ''}" onchange="lvElSet(${q(r.id)},${q(a.id)},'prezzo',this.value)"${storico ? ` title="${esc(storico)}"` : ''}>`
      : `<span${prezzoFisso && scrive ? ' title="In perizia il prezzo di contratto non cambia: un prezzo diverso è un nuovo prezzo (NP)"' : storico ? ` title="${esc(storico)}"` : ''}>${a.prezzo != null ? fmt(a.prezzo) : '—'}</span>`
    const az = [
      `<button class="ehb-icon-btn" onclick="lvElModifica(${q(r.id)},${q(a.id)})" title="${scrive ? 'Tutto l\'articolo: anche la descrizione estesa, il ribasso, lo storico del prezzo' : 'Vedi l\'articolo per intero'}">${scrive ? '✎' : '⌕'}</button>`,
      scrive && perizia && a.origine !== 'np' ? `<button class="ehb-icon-btn" onclick="lvElNP(${q(r.id)},${q(a.id)})" title="Rendilo un nuovo prezzo (NP): poi il prezzo si può concordare">NP</button>` : '',
      scrive && a.usi === 0 ? `<button class="ehb-icon-btn is-pericolo" onclick="lvElTogli(${q(r.id)},${q(a.id)})" title="Togli l'articolo dall'elenco: nessuna voce lo usa">✕</button>` : '',
    ].join('')
    return `<tr data-cerca="${esc(testoRicerca(a))}"${st.q && !corrispondeRicerca(testoRicerca(a), st.q) ? ' hidden' : ''} class="${a.usi ? '' : 'is-inutile'}">
      <td class="lv-ct-n">${a.n}</td>
      ${cella(a.id, 'codice', scrive ? input(a, 'codice') : `<b>${esc(a.codice || '—')}</b>`, 'lv-el-cod')}
      ${cella(a.id, 'descrizione', `${scrive ? input(a, 'descrizione', a.estesa ? ` title="${esc(a.estesa)}"` : '') : `<span title="${esc(a.estesa || a.descrizione)}">${esc(a.descrizione || '(senza descrizione)')}</span>`}`, 'lv-el-des')}
      ${cella(a.id, 'um', scrive ? input(a, 'um') : esc(a.um), 'lv-el-um')}
      ${cella(a.id, 'prezzo', prezzo, 'lv-el-pr')}
      ${offerti ? `<td class="lv-el-pr">${offerti[a.id] != null ? fmt(offerti[a.id]) : '—'}</td>` : ''}
      <td class="lv-el-or"><span class="ehb-pastiglia">${esc(ORIGINE[a.origine])}</span></td>
      ${cella(a.id, 'sicurezza', `<input type="checkbox"${a.sicurezza ? ' checked' : ''}${scrive ? ` onchange="lvElSet(${q(r.id)},${q(a.id)},'sicurezza',this.checked)"` : ' disabled'} title="Oneri della sicurezza: non soggetti a ribasso">`, 'lv-el-sic')}
      <td class="lv-ct-n">${a.usi || '—'}</td>
      <td class="lv-ct-n">${a.importo ? eur(a.importo) : '—'}</td>
      <td class="lv-str-az">${az}</td>
    </tr>`
  }).join('')

  const filtri: [FiltroElenco, string][] = [['tutti', 'Tutti gli articoli'], ['usati', 'Usati da qualche voce'], ['inutilizzati', 'Non usati'], ['np', 'Nuovi prezzi e analisi'], ['sicurezza', 'Sicurezza']]
  const revisioni = [...l.revisioni].sort((x, y) => x.ordine - y.ordine)
  const sceltaRev = revisioni.length > 1
    ? `<select class="lv-el-rev" onchange="lvElRev(this.value)" aria-label="Revisione">${revisioni.map((x) => `<option value="${esc(x.id)}"${x.id === r.id ? ' selected' : ''}>${esc(sigla(x.numero))} · ${esc(x.nome || x.fase || x.tipo)}</option>`).join('')}</select>`
    : ''
  const nota = percheSolaLettura(r)
    ?? (perizia ? 'In perizia si scrivono i nuovi prezzi: il prezzo degli articoli di contratto resta quello («NP» per farne un nuovo prezzo).'
      : 'Codice, descrizione, unità e prezzo sono dell\'articolo: la modifica vale per tutte le voci che lo usano. Un prezzo cambiato resta nello storico (passa il mouse sul prezzo).')

  return `<section class="lv-page lv-dati">
    ${testataHtml({
      titolo: 'Elenco prezzi', revisione: sigla(r.numero),
      sottotitolo: `${tutte.length} articol${tutte.length === 1 ? 'o' : 'i'} · ${usati} usat${usati === 1 ? 'o' : 'i'} nelle voci`,
      pastiglie: [{ testo: r.tipo === 'computo' ? 'progetto' : r.tipo, tono: 'fase' }, ...(scrive ? [] : [{ testo: 'sola lettura' }])],
      azioni: `${sceltaRev}${scrive ? `<button class="ehb-btn ehb-btn--sm" onclick="lvElNuovo(${q(r.id)})" title="Un articolo nuovo nell'elenco, scritto a mano">＋ ${perizia ? 'Nuovo prezzo' : 'Articolo'}…</button>` : ''}<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="lvElPannello(${q(r.id)})" title="Il pannello a destra: per pescare dal prezzario o da un altro lavoro">≡ Prezzario…</button>`,
      stampa: { onclick: `lvStampaRev(${q(r.id)},'elenco-prezzi')`, titolo: 'Stampa l\'elenco prezzi di questa revisione' },
    })}
    <div class="lv-body lv-el">
      <p class="lv-nota">${esc(nota)}</p>
      <div class="lv-el-barra">
        <input type="search" id="lv-el-q" class="lv-el-q" value="${esc(st.q)}" placeholder="⌕ codice, parole o unità" oninput="lvElCerca(this.value)" autocomplete="off">
        <select onchange="lvElFiltro(this.value)" aria-label="Quali articoli">${filtri.map(([v, t]) => `<option value="${v}"${st.filtro === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <span class="lv-nota" id="lv-el-conta"></span>
      </div>
      ${righe.length ? `<table class="lv-ct-tab lv-el-tab">
        <thead><tr><th class="lv-ct-n">N.</th><th>Codice</th><th>Descrizione</th><th>U.M.</th><th class="lv-el-pr">Prezzo €</th>${offerti ? '<th class="lv-el-pr">Offerto €</th>' : ''}<th>Origine</th><th title="Oneri della sicurezza">Sic.</th><th class="lv-ct-n">Voci</th><th class="lv-ct-n">Importo</th><th></th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr><td colspan="${offerti ? 9 : 8}">Importo delle voci${st.filtro === 'tutti' ? '' : ' degli articoli mostrati'}, ai prezzi della revisione${r.tipo === 'contratto' && !offerti ? ', prima del ribasso' : ''}</td><td class="lv-ct-n"><b>${eur(totale)}</b></td><td></td></tr></tfoot>
      </table>` : `<p class="lv-nota">${tutte.length ? 'Nessun articolo in questo filtro.' : 'L\'elenco è vuoto: gli articoli si pescano dal prezzario (pannello a destra) o si scrivono a mano.'}</p>`}
    </div>
  </section>`
}
