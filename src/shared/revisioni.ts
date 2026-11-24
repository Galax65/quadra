/*
  LA CATENA DELLE REVISIONI.

  Un lavoro è una fila di revisioni, numerate una dietro l'altra: la cronologia
  del progetto e del cantiere in un colpo d'occhio.

    rev.00-02  PFTE          computo + elenco prezzi
    rev.03-04  Esecutivo     computo + elenco prezzi (base di gara)
    rev.05     Contratto     = esecutivo + ribasso o prezzi offerti   ◀ in vigore
    rev.06     SAL 1         misure — prezzi dalla rev.05
    rev.07     Perizia 1     computo + elenco (contratto + NP)        ◀ in vigore
    rev.08     SAL 2         misure — prezzi dalla rev.07

  Due nature, una sola catena:

  - le revisioni DI CONTRATTO (PFTE, esecutivo, contratto, perizia) portano
    articoli, prezzi e quantità: sono computi, e il loro elenco prezzi si
    congela con loro;
  - gli AVANZAMENTI (SAL, stato finale, conto finale) non hanno un elenco
    proprio: portano misure e CITANO la revisione in vigore a quella data.

  Se un avanzamento avesse un elenco modificabile si potrebbe cambiare un
  prezzo dentro un SAL: è l'errore che il programma deve rendere impossibile.
*/

/** I capitoli in cui la catena si legge. */
export type CapitoloRevisione = 'computo' | 'contabilita' | 'perizia'

export type TipoRevisione =
  | 'pfte' | 'definitivo' | 'esecutivo' | 'contratto'   // computi di progetto
  | 'perizia'                                            // computo di variante
  | 'sal' | 'statofinale' | 'contofinale'                // avanzamenti

export type StatoRevisione = 'bozza' | 'approvata'

export interface Revisione {
  /** Numero progressivo nella catena: 0, 1, 2… Si legge «rev.03». */
  n: number
  tipo: TipoRevisione
  /** Come si chiama a schermo: «Esecutivo», «SAL n. 2», «Perizia n. 1». */
  etichetta: string
  /** Data in formato italiano gg/mm/aaaa, se c'è. */
  dataIt?: string
  stato: StatoRevisione
  /** Chiave della fase corrispondente nella catena documentale. */
  fase?: string
  /** Lo strumento che tiene questa revisione: è lì che la sidebar la apre. */
  tool?: 'computo' | 'contabilita'
  /** Per gli avanzamenti: numero della revisione di contratto da cui leggono i prezzi. */
  leggeDa?: number
  /** Quante voci porta (computi) o quante ne misura (avanzamenti). */
  voci?: number
  /** Importo che la revisione esprime, quando ha senso. */
  importo?: number | null
}

/** «rev.03» — sempre a due cifre, perché la fila resti allineata. */
export const siglaRevisione = (n: number): string => `rev.${String(n).padStart(2, '0')}`

/** Rinumera la catena dopo un inserimento: i numeri non hanno buchi. */
export function rinumera(catena: Revisione[]): Revisione[] {
  return catena.map((r, i) => (r.n === i ? r : { ...r, n: i }))
}

/* ── L'ALBERO DEL LAVORO ──────────────────────────────────────────────────
   La sidebar è la navigazione, e basta. Un ramo è una tappa (il contratto, un
   SAL, una perizia, la chiusura); le sue foglie sono gli ATTI di quella tappa,
   che si aprono a tutta pagina. Prima la stessa navigazione esisteva in tre
   posti — sidebar, linea del tempo e un muro di schede al centro — e nessuno
   dei tre diceva tutto. */

/** Una foglia: un atto dentro una tappa. */
export interface FogliaAtto {
  /** Chiave del documento dentro la fase (es. «libretto»). */
  tipo: string
  label: string
  /** Articolo di legge, quando l'atto ne ha uno. */
  art?: string
  /** Schermata di lavoro (ci si scrive). Senza questo è un'anteprima di stampa. */
  lavoro?: boolean
}

/** Un ramo dell'albero: una tappa del lavoro con i suoi atti. */
export interface RamoLavoro {
  /** Chiave della fase nella catena documentale (es. «sal-2»). */
  fase: string
  etichetta: string
  dataIt?: string
  stato?: StatoRevisione
  /** Numero di revisione, se la tappa ne ha uno. */
  rev?: number
  /** Da quale revisione legge i prezzi (avanzamenti). */
  leggeDa?: number
  capitolo: CapitoloRevisione | 'lavoro' | 'chiusura'
  tool: 'computo' | 'contabilita'
  nota?: string
  /* LE RIGHE DI STATO, sotto il nome del ramo: quale elenco prezzi usa, quanto
     vale, a che punto è. Non si cliccano — dicono. È l'informazione che i programmi di contabilità
     nasconde e per cui si sbaglia la contabilità: «questo SAL che prezzi
     legge?» deve avere risposta senza aprire niente. */
  stati?: { etichetta: string; valore: string }[]
  /** Se il ramo non ha figli: il documento che apre quando lo si clicca. */
  apre?: string
  /** Comando che elimina questa tappa, quando si può ancora eliminare. */
  elimina?: string
  atti: FogliaAtto[]
}

/** Un'azione in fondo a un capitolo dell'albero: «＋ Avvia il primo SAL». */
export interface AzioneAlbero {
  capitolo: CapitoloRevisione | 'lavoro' | 'chiusura'
  etichetta: string
  comando: string
  titolo?: string
  /** Lo strumento che esegue il comando (default: la Contabilità). */
  tool?: 'computo' | 'contabilita'
}

export const TITOLO_RAMO: Record<CapitoloRevisione | 'lavoro' | 'chiusura', string> = {
  lavoro: 'Lavoro', computo: 'Computo', contabilita: 'Contabilità', perizia: 'Perizie', chiusura: 'Chiusura',
}

/** L'albero diviso per capitoli, nell'ordine in cui il lavoro accade. */
export function perCapitoliAlbero(rami: RamoLavoro[]): { capitolo: string; titolo: string; rami: RamoLavoro[] }[] {
  const ordine: (CapitoloRevisione | 'lavoro' | 'chiusura')[] = ['lavoro', 'computo', 'contabilita', 'perizia', 'chiusura']
  return ordine
    .map((c) => ({ capitolo: c, titolo: TITOLO_RAMO[c], rami: rami.filter((r) => r.capitolo === c) }))
    .filter((g) => g.rami.length > 0)
}

/* ── UN ALBERO SOLO PER DUE STRUMENTI ─────────────────────────────────────
   Il lavoro è uno: il Computo ne tiene il progetto (il computo in corso e le
   sue revisioni congelate), la Contabilità tutto quello che viene dopo il
   contratto. Ognuno pubblica i SUOI rami — chi tiene una tappa è anche chi la
   apre — e l'hub li mette in un albero solo. Prima i rami li pubblicava solo la
   Contabilità, e le revisioni del Computo non comparivano da nessuna parte. */

/** Una revisione congelata dal Computo, come viaggia sul bus (senza le voci). */
export interface RevisioneComputo {
  id: string
  nome: string
  /** PFTE, definitivo, esecutivo, contratto, perizia, altro. */
  fase?: string
  data?: string
  voci: number
  totale: number
  /** 'progetto' = cambiano gli elaborati, non il computo (assente = computo). */
  natura?: 'computo' | 'progetto'
  /** Quanti articoli ha l'elenco prezzi congelato. */
  articoli?: number
  /** Per le revisioni di progetto: la revisione di computo su cui poggiano. */
  computoDi?: string
}

/**
 * L'albero del lavoro dai rami che ogni strumento ha pubblicato. Prima il
 * Computo (il progetto viene prima del contratto), poi la Contabilità: dentro
 * ogni capitolo l'ordine è quello in cui ciascuno li ha messi.
 */
export function unisciAlberi(perTool: Partial<Record<'computo' | 'contabilita', { rami?: RamoLavoro[]; azioni?: AzioneAlbero[] }>>): { rami: RamoLavoro[]; azioni: AzioneAlbero[] } {
  const ordine = ['computo', 'contabilita'] as const
  const rami: RamoLavoro[] = []
  const azioni: AzioneAlbero[] = []
  for (const t of ordine) {
    const a = perTool[t]
    if (!a) continue
    for (const r of a.rami || []) rami.push({ ...r, tool: r.tool || t })
    for (const x of a.azioni || []) azioni.push({ ...x, tool: x.tool || t })
  }
  return { rami, azioni }
}
