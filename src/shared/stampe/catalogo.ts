/**
 * LE STAMPE DEL LAVORO — un catalogo solo, per tutti e due gli strumenti.
 *
 * Un lavoro produce carte: quelle di progetto (computo, elenco prezzi, stima,
 * incidenze, quadro economico), quelle di gara (lista delle lavorazioni, offerte)
 * e quelle di contabilità (libretto, registro, sommario, SAL, certificato, conto
 * finale…). Per chi le firma sono un elenco solo, e si cercano in un posto solo —
 * non «quelle del Computo» e «quelle della Contabilità».
 *
 * Qui vive l'elenco; i comandi restano nei rispettivi strumenti. Una stampa
 * dell'altro strumento si vede comunque, e cliccarla ci porta: la schermata è la
 * stessa, cambia solo chi la disegna.
 */
export type AreaStampa = 'progetto' | 'gara' | 'contabilita' | 'dati'
export type ToolStampa = 'computo' | 'contabilita'

export interface VoceStampa {
  id: string
  titolo: string
  /** Una riga: che cos'è e in che forma esce. */
  nota: string
  /** ⎙ si stampa · ⭳ si scarica · ⌸ apre una schermata di lavoro. */
  forma: 'stampa' | 'file' | 'schermata'
  area: AreaStampa
  tool: ToolStampa
  /** Funzione globale da chiamare, quando la stampa appartiene allo strumento aperto. */
  comando?: string
  /** Falso = c'è ma non si può ancora produrre (manca il dato): `motivo` lo dice. */
  pronta?: boolean
  motivo?: string
  /** Se già prodotta: quando, e con quale impronta (registro degli atti). */
  prodottaIl?: string
  impronta?: string
}

export const AREE: { id: AreaStampa; label: string; nota: string }[] = [
  { id: 'progetto', label: 'Progetto', nota: 'il computo e i suoi elaborati' },
  { id: 'gara', label: 'Gara e contratto', nota: 'lista delle lavorazioni, offerte, aggiudicazione' },
  { id: 'contabilita', label: 'Contabilità', nota: 'gli atti dei lavori, SAL per SAL' },
  { id: 'dati', label: 'Dati e interscambio', nota: 'i file che escono da Quadra' },
]

/** Le stampe del Computo. L'elenco è fisso: i comandi stanno nello strumento. */
export function stampeDelComputo(opt: { vociNelComputo: number; conAnalisi?: boolean } = { vociNelComputo: 0 }): VoceStampa[] {
  const pieno = opt.vociNelComputo > 0
  const motivo = 'Il computo è vuoto: aggiungi voci per avere qualcosa da stampare.'
  const v = (id: string, titolo: string, nota: string, area: AreaStampa, forma: VoceStampa['forma'], comando: string, pronta = pieno): VoceStampa =>
    ({ id, titolo, nota, area, forma, tool: 'computo', comando, pronta, motivo: pronta ? undefined : motivo })
  return [
    v('computo-pdf', 'Computo metrico estimativo', 'PDF impaginato — misure, riporti, categorie', 'progetto', 'stampa', 'exportComputoPdf()'),
    v('elenco-prezzi', 'Elenco prezzi unitari', 'PDF — prezzi in cifre e in lettere', 'progetto', 'stampa', 'exportElencoPrezziPdf()'),
    v('stima', 'Stima dei lavori', 'PDF — quantità, importi, incidenza', 'progetto', 'stampa', 'exportStimaLavoriPdf()'),
    v('incidenza-mdo', 'Incidenza della manodopera', 'PDF — costo della manodopera voce per voce', 'progetto', 'stampa', 'exportIncidenzaMdo()'),
    v('incidenza-sic', 'Incidenza della sicurezza', 'PDF — oneri e incidenza sui lavori', 'progetto', 'stampa', 'exportIncidenzaSicurezza()'),
    v('elenco-np', 'Elenco dei nuovi prezzi', 'PDF — solo NP, cifre e lettere, origine', 'progetto', 'stampa', 'exportElencoNP()'),
    v('verbale-np', 'Verbale dei nuovi prezzi', 'PDF — concordamento delle voci NP', 'progetto', 'stampa', 'exportVerbaleNP()'),
    v('quadro-economico', 'Quadro economico', 'lavori, sicurezza, somme a disposizione', 'progetto', 'schermata', 'apriQuadroEconomico()', true),
    v('analisi-xls', 'Fascicolo analisi prezzi', 'Excel — tutte le analisi del computo', 'progetto', 'file', 'exportFascicoloAP()', !!opt.conAnalisi),
    v('analisi-pdf', 'Analisi prezzi', 'PDF — elaborato stampabile', 'progetto', 'stampa', 'exportFascicoloAPPdf()', !!opt.conAnalisi),
    v('lista-lavorazioni', 'Lista delle lavorazioni e forniture', "PDF — per l'offerta a prezzi unitari", 'gara', 'stampa', 'exportListaLavorazioni()'),
    v('offerte', 'Offerte e quadro comparativo', "richiesta d'offerta, confronto, aggiudicazione", 'gara', 'schermata', 'apriOfferte()', true),
    v('report-pdf', 'Report stampabile', 'computo o estratto, da stampare o salvare in PDF', 'dati', 'stampa', 'openComputoPDF()'),
    v('computo-xlsx', 'Computo in Excel', 'editabile — codice, quantità, importi', 'dati', 'file', 'exportComputoExcel()'),
    v('computo-xpwe', 'Computo in XPWE', 'misure e categorie, per gli altri programmi del settore', 'dati', 'file', 'exportComputoXpwe()'),
  ]
}

export interface ContestoContabilita {
  /** I SAL del lavoro, con lo stato. */
  sals: { numero: number; firmato?: boolean }[]
  conPartite: boolean
  conPerizie: boolean
  /** Le perizie di variante del lavoro: ognuna ha il suo fascicolo, come un SAL. */
  perizie?: { numero: number; approvata?: boolean }[]
  /** Contabilità semplificata attiva (art. 12 c. 11-bis): compaiono le fatture con il visto. */
  semplificata?: boolean
  /** Fatture registrate, di cui quante già vistate. */
  fatture?: { totali: number; vistate: number }
  /** Quanti termini di legge sono in ritardo o in scadenza adesso. */
  scadenzeUrgenti?: number
  /** Quando un atto è già stato prodotto: id della stampa → data e impronta. */
  prodotte?: Record<string, { data: string; impronta?: string }>
}

/** Le stampe della Contabilità: quelle del lavoro, più il fascicolo di ogni SAL. */
export function stampeDellaContabilita(ctx: ContestoContabilita): VoceStampa[] {
  const out: VoceStampa[] = []
  const senzaVoci = 'Non ci sono ancora voci da contabilizzare.'
  const push = (id: string, titolo: string, nota: string, forma: VoceStampa['forma'], comando: string, pronta: boolean, motivo?: string): void => {
    const p = ctx.prodotte?.[id]
    out.push({ id, titolo, nota, area: 'contabilita', forma, tool: 'contabilita', comando, pronta, motivo: pronta ? undefined : motivo, prodottaIl: p?.data, impronta: p?.impronta })
  }
  push('registro-bianco', 'Registro in bianco da vidimare', 'fogli numerati e vuoti, da bollare prima dell\'inizio dei lavori', 'stampa', "vaiA('avvio')", true)
  push('giornale', 'Giornale dei lavori', 'diario di cantiere, giorno per giorno', 'stampa', "vaiA('avvio')", true)
  for (const s of [...ctx.sals].sort((a, b) => a.numero - b.numero)) {
    push(`atti-${s.numero}`, `Atti del SAL n. ${s.numero}`, `fascicolo completo: libretto, sotto-computi, registro, sommario, SAL, certificato${s.firmato ? ' · firmato' : ''}`, 'stampa', `stampaAttiSal(${s.numero})`, ctx.conPartite, senzaVoci)
  }
  if (!ctx.sals.length) push('atti-0', 'Atti del SAL', 'libretto, registro, sommario, SAL, certificato', 'stampa', 'nuovoSalOggi()', false, 'Non c\'è ancora nessun SAL: aprine uno dalla linea del tempo.')
  // La perizia è una tappa come il SAL: stesso fascicolo, stesso comando, stessa riga.
  for (const pz of [...(ctx.perizie || [])].sort((a, b) => a.numero - b.numero)) {
    push(`perizia-${pz.numero}`, `Atti della perizia n. ${pz.numero}`, `fascicolo completo: perizia, quadro comparativo, nuovi prezzi, atto di sottomissione${pz.approvata ? ' · approvata' : ' · in bozza'}`, 'stampa', `stampaAttiPerizia(${pz.numero})`, ctx.conPartite, senzaVoci)
  }
  if (ctx.conPerizie && !(ctx.perizie || []).length) push('perizie', 'Perizie di variante', 'quadro comparativo, atto di sottomissione (o aggiuntivo) e nuovi prezzi', 'schermata', 'openPerizie()', true)
  if (ctx.semplificata) {
    const f = ctx.fatture || { totali: 0, vistate: 0 }
    push('fatture', 'Visti del DL sulle fatture', f.totali
      ? `contabilità semplificata — ${f.vistate} di ${f.totali} fatture vistate`
      : 'contabilità semplificata — nessuna fattura registrata', 'stampa', "vaiA('avvio')", f.totali > 0, 'Aggiungi una fattura dalla cronologia del cantiere.')
  }
  push('registro-atti', 'Registro degli atti prodotti', 'atti, sigilli e verifica delle impronte', 'stampa', "vaiA('avvio')", true)
  push('scadenziario', 'Scadenziario dei termini', ctx.scadenzeUrgenti ? `foglio di lavoro — ${ctx.scadenzeUrgenti} termin${ctx.scadenzeUrgenti === 1 ? 'e' : 'i'} da sorvegliare adesso` : 'foglio di lavoro — certificati, pagamenti, riserve, conto finale', 'stampa', "vaiA('avvio')", true)
  push('stato-finale', 'Stato finale e conto finale', 'chiusura dei lavori, credito residuo', 'stampa', "vaiA('chiusura')", ctx.conPartite, senzaVoci)
  out.push({ id: 'export-aperto', titolo: 'Contabilità in formato aperto', nota: 'zip — JSON, CSV e leggimi: leggibile anche senza Quadra', forma: 'file', area: 'dati', tool: 'contabilita', comando: 'esportaFormatoAperto()', pronta: ctx.conPartite, motivo: ctx.conPartite ? undefined : senzaVoci })
  return out
}

const esc = (s: string): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ICONA: Record<VoceStampa['forma'], string> = { stampa: '⎙', file: '⭳', schermata: '⌸' }
const NOME_TOOL: Record<ToolStampa, string> = { computo: 'Computo', contabilita: 'Contabilità' }

export interface OpzioniStampe {
  /** Lo strumento aperto: le stampe degli altri si aprono navigando. */
  tool: ToolStampa
  /** Comando da chiamare per passare all'altro strumento, con l'id della stampa. */
  vaiAllAltro?: string
}

/** La griglia delle stampe: stessa forma nei due strumenti. */
export function stampeHTML(voci: VoceStampa[], opt: OpzioniStampe): string {
  const aree = AREE.filter((a) => voci.some((v) => v.area === a.id))
  return `<div class="ehb-stampe">${aree.map((a) => {
    const righe = voci.filter((v) => v.area === a.id).map((v) => rigaHTML(v, opt)).join('')
    return `<section class="ehb-stampe__gruppo">
      <div class="ehb-stampe__lab">${esc(a.label)}<span>${esc(a.nota)}</span></div>
      ${righe}
    </section>`
  }).join('')}</div>`
}

function rigaHTML(v: VoceStampa, opt: OpzioniStampe): string {
  const altrove = v.tool !== opt.tool
  // Di una stampa dell'ALTRO strumento non sappiamo se è producibile: lo sa lui.
  // Si apre comunque, e la risposta la dà di là, invece di spegnersi qui per nulla.
  const bloccata = !altrove && v.pronta === false
  const azione = altrove
    ? (opt.vaiAllAltro ? `${opt.vaiAllAltro.replace('%s', v.id)}` : '')
    : (bloccata ? '' : v.comando || '')
  const coda = altrove
    ? `<em>in ${esc(NOME_TOOL[v.tool])}</em>`
    : v.prodottaIl
      ? `<em>prodotto il ${esc(v.prodottaIl)}${v.impronta ? ` · ${esc(v.impronta.slice(0, 8))}…` : ''}</em>`
      : ''
  const titolo = bloccata && v.motivo ? v.motivo : altrove ? `Si apre in ${NOME_TOOL[v.tool]}` : v.nota
  // l'id sul pulsante serve a chi arriva dall'altro strumento con una stampa
  // già scelta: la si lancia ritrovandola qui, senza valutare stringhe di codice
  return `<button class="ehb-stampa${bloccata ? ' is-vuota' : ''}${altrove ? ' is-altrove' : ''}" data-stampa="${esc(v.id)}" ${azione ? `onclick="${esc(azione)}"` : 'disabled'} title="${esc(titolo)}">
    <span class="ehb-stampa__ic">${ICONA[v.forma]}</span>
    <span class="ehb-stampa__txt"><b>${esc(v.titolo)}</b><small>${esc(v.nota)}</small></span>
    ${coda ? `<span class="ehb-stampa__coda">${coda}</span>` : ''}
  </button>`
}
