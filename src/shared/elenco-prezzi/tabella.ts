/**
 * L'ELENCO PREZZI DEL LAVORO — una tabella sola, per i due strumenti.
 *
 * Gli articoli sono gli stessi in progetto e in contabilità: cambia solo che di
 * là si computano e di qua si contabilizzano. Per chi guarda devono avere la
 * stessa forma — stesse colonne, stesso ordine, stesse parole — altrimenti
 * sembrano due cataloghi diversi dello stesso lavoro.
 *
 * Qui vive la forma; i comandi restano nei rispettivi strumenti e arrivano come
 * HTML già pronto nella colonna delle azioni.
 */
export interface VoceElenco {
  /** Numero d'ordine, se lo strumento ne tiene uno. */
  n?: number | string
  codice: string
  descrizione: string
  /** Sotto la descrizione, in grigio: categoria, WBS, note brevi. */
  sotto?: string
  um?: string
  /** Prezzo in uso (di contratto in progetto, contabilizzato in contabilità). */
  prezzo?: number | null
  /** Prezzo di contratto, quando è un dato distinto da quello in uso. */
  contratto?: number | null
  /** Da dove viene il prezzo: prezzario, contratto, assimilazione, analisi. */
  provenienza?: string
  /** Dove è usata: «SAL 1, 2», «3 voci di computo», «non misurata». */
  usataIn?: string
  /** Nuovo prezzo. */
  np?: boolean
  /** Prezzo diverso da quello di contratto: si segnala, non si corregge. */
  scostato?: boolean
  /** Comandi della riga, già pronti (li disegna lo strumento). */
  azioni?: string
  /** Attributi per il trascinamento, dove lo strumento lo prevede. */
  dragAttrs?: string
}

export interface OpzioniElenco {
  /** Mostra la colonna del prezzo di contratto accanto a quello in uso. */
  conContratto?: boolean
  /** Etichetta della colonna del prezzo in uso. */
  etichettaPrezzo?: string
  /** Testo quando non c'è nessuna voce. */
  vuoto?: string
  /** id del <tbody>, per ridisegnare solo le righe quando si filtra. */
  idCorpo?: string
  /** Come si dice che una voce non è ancora usata: «non misurata» in contabilità. */
  etichettaNonUsata?: string
  /** Spiegazione del segno ≠ accanto a un prezzo che si scosta dal contratto. */
  titoloScostamento?: string
}

const esc = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const eur = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Le righe soltanto: serve a ridisegnare dopo una ricerca, senza rifare la testata. */
export function righeElencoHTML(voci: VoceElenco[], opt: OpzioniElenco = {}): string {
  const col = 7 + (opt.conContratto ? 1 : 0)
  if (!voci.length) return `<tr><td colspan="${col}" class="b-muted ep-vuoto">${esc(opt.vuoto || "L'elenco prezzi è vuoto.")}</td></tr>`
  return voci.map((v) => `<tr${v.dragAttrs ? ' ' + v.dragAttrs : ''}>
    <td class="b-num b-mono">${esc(v.n ?? '')}</td>
    <td class="b-mono">${esc(v.codice || '—')}${v.np ? ' <span class="b-np">NP</span>' : ''}</td>
    <td>${esc(v.descrizione || '(da definire)')}${v.sotto ? `<span class="b-muted"> · ${esc(v.sotto)}</span>` : ''}</td>
    <td>${esc(v.um || '')}</td>
    ${opt.conContratto ? `<td class="b-num">${v.contratto == null ? '—' : eur(v.contratto)}</td>` : ''}
    <td class="b-num"${v.scostato ? ` title="${esc(opt.titoloScostamento || 'Prezzo diverso da quello di contratto')}"` : ''}>${v.prezzo == null ? '<i>da definire</i>' : eur(v.prezzo)}${v.scostato ? ' <span class="b-np">≠</span>' : ''}</td>
    <td class="b-muted">${esc(v.provenienza || '')}</td>
    <td class="b-muted">${v.usataIn ? esc(v.usataIn) : `<i>${esc(opt.etichettaNonUsata || 'non usata')}</i>`}</td>
    <td class="b-rowact">${v.azioni || ''}</td>
  </tr>`).join('')
}

/** La tabella intera: stessa forma nei due strumenti. */
export function elencoPrezziTabellaHTML(voci: VoceElenco[], opt: OpzioniElenco = {}): string {
  return `<div class="b-tablewrap"><table class="b-etable b-ep">
    <thead><tr>
      <th class="b-num">N.</th><th>Codice</th><th>Designazione</th><th>U.M.</th>
      ${opt.conContratto ? '<th class="b-num">Contratto</th>' : ''}
      <th class="b-num">${esc(opt.etichettaPrezzo || 'Prezzo')}</th>
      <th>Provenienza</th><th>Usata in</th><th></th>
    </tr></thead>
    <tbody${opt.idCorpo ? ` id="${esc(opt.idCorpo)}"` : ''}>${righeElencoHTML(voci, opt)}</tbody>
  </table></div>`
}
