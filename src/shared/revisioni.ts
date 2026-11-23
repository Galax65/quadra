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

const CAPITOLO: Record<TipoRevisione, CapitoloRevisione> = {
  pfte: 'computo', definitivo: 'computo', esecutivo: 'computo', contratto: 'computo',
  perizia: 'perizia',
  sal: 'contabilita', statofinale: 'contabilita', contofinale: 'contabilita',
}

export const capitoloDi = (t: TipoRevisione): CapitoloRevisione => CAPITOLO[t] || 'computo'

export const TITOLO_CAPITOLO: Record<CapitoloRevisione, string> = {
  computo: 'Computo', contabilita: 'Contabilità', perizia: 'Perizie',
}

/** «rev.03» — sempre a due cifre, perché la fila resti allineata. */
export const siglaRevisione = (n: number): string => `rev.${String(n).padStart(2, '0')}`

/** Un avanzamento legge i prezzi dall'ultima revisione di contratto approvata prima di lui. */
export function inVigoreAlla(catena: Revisione[], n: number): Revisione | null {
  let vig: Revisione | null = null
  for (const r of catena) {
    if (r.n >= n) break
    if (r.stato === 'approvata' && capitoloDi(r.tipo) !== 'contabilita') vig = r
  }
  return vig
}

/** La revisione di contratto in vigore adesso: l'ultima approvata della catena. */
export function contrattoVigente(catena: Revisione[]): Revisione | null {
  return inVigoreAlla(catena, Number.MAX_SAFE_INTEGER)
}

/** La catena divisa per capitoli, nell'ordine in cui si legge. */
export function perCapitoli(catena: Revisione[]): { capitolo: CapitoloRevisione; titolo: string; revisioni: Revisione[] }[] {
  const ordine: CapitoloRevisione[] = ['computo', 'contabilita', 'perizia']
  return ordine
    .map((c) => ({ capitolo: c, titolo: TITOLO_CAPITOLO[c], revisioni: catena.filter((r) => capitoloDi(r.tipo) === c) }))
    .filter((g) => g.revisioni.length > 0)
}

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

import { allaFase, faseSuccessiva } from './contratto'

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
 * Il tipo di una revisione del Computo nella catena, dalla sua FASE memorizzata.
 * Il nome si può cambiare (e dice quel che vuole: «Esecutivo bis», «Dopo la CdS»):
 * dedurre il tipo dal nome farebbe cambiare il posto di una revisione rinominandola.
 * Il nome conta solo per le revisioni vecchie che una fase non l'avevano.
 */
export function tipoRevisioneComputo(fase?: string | null, nome?: string | null): TipoRevisione {
  const f = String(fase || '').trim().toLowerCase()
  const da = f || String(nome || '').toLowerCase()
  if (da === 'pfte' || (!f && (da.includes('pfte') || da.includes('fattibilit')))) return 'pfte'
  if (da === 'definitivo' || (!f && da.includes('defin'))) return 'definitivo'
  return 'esecutivo'
}

/** La fase di un ramo-revisione del Computo: «rev-<id>». */
export const faseRevisioneComputo = (id: string): string => `rev-${id}`
/** Il contrario: l'id della revisione, o null se la fase non è una revisione. */
export const idRevisioneComputo = (fase: string): string | null => (/^rev-(.+)$/.exec(fase)?.[1] ?? null)

/** Le schermate di lavoro del computo in corso: le aree del suo binario. */
export const ATTI_COMPUTO: FogliaAtto[] = [
  { tipo: 'misura', label: 'Computo metrico', lavoro: true },
  { tipo: 'ep', label: 'Elenco prezzi del progetto', lavoro: true },
  { tipo: 'categorizza', label: 'Categorie e WBS', lavoro: true },
  { tipo: 'dati', label: 'Dati generali', lavoro: true },
]

/** Gli atti di una revisione di computo: il suo elenco prezzi, il confronto, la stampa del confronto, la scheda. */
export const ATTI_REVISIONE: FogliaAtto[] = [
  { tipo: 'elenco', label: 'Elenco prezzi della revisione', lavoro: true },
  { tipo: 'confronto', label: 'Confronto con il computo di adesso', lavoro: true },
  { tipo: 'quadro', label: 'Quadro comparativo' },
  { tipo: 'scheda', label: 'Nome, fase e note', lavoro: true },
]

/** Una revisione di progetto non ha un computo suo: ha la scheda, e il confronto di quello su cui poggia. */
export const ATTI_REVISIONE_PROGETTO: FogliaAtto[] = [
  { tipo: 'scheda', label: 'Nome, fase e note', lavoro: true },
  { tipo: 'confronto', label: 'Confronto del suo computo con quello di adesso', lavoro: true },
]

/**
 * I rami del Computo: le revisioni congelate, in ordine di tempo (rev.00, rev.01…,
 * gli stessi numeri che la Contabilità dà loro nella catena), e in coda il
 * computo in corso, in bozza: è lì che si lavora finché il progetto non si congela.
 */
export function alberoDelComputo(o: {
  voci: number
  totale: number
  revisioni: RevisioneComputo[]
  eur: (n: number) => string
  /** La fase del computo in corso: PFTE, definitivo, esecutivo (shared/contratto.ts). */
  fase?: 'PFTE' | 'definitivo' | 'esecutivo'
  /** L'atto di promozione, se c'è: da dove viene e quanto vale. */
  contratto?: { descrizione: string; importo: number; data?: string } | null
}): { rami: RamoLavoro[]; azioni: AzioneAlbero[] } {
  const fase = o.fase || 'PFTE'
  const nomeFase = fase === 'PFTE' ? 'PFTE' : fase === 'definitivo' ? 'definitivo' : 'esecutivo'
  const dopo = faseSuccessiva(fase)
  const numero = new Map(o.revisioni.map((r, i) => [r.id, i]))
  const rami: RamoLavoro[] = o.revisioni.map((r, i) => {
    const progetto = r.natura === 'progetto'
    const base = progetto && r.computoDi != null ? numero.get(r.computoDi) : undefined
    return {
      fase: faseRevisioneComputo(r.id),
      etichetta: r.nome,
      ...(r.data ? { dataIt: r.data } : {}),
      stato: 'approvata' as const,
      rev: i,
      capitolo: 'computo' as const,
      tool: 'computo' as const,
      nota: progetto
        ? 'revisione di progetto'
        : `${r.voci} voc${r.voci === 1 ? 'e' : 'i'}${r.articoli != null ? ` · ${r.articoli} prezz${r.articoli === 1 ? 'o' : 'i'}` : ''}`,
      stati: progetto
        ? [{ etichetta: 'Computo', valore: base != null ? `invariato (${siglaRevisione(base)})` : 'non congelato' }]
        : [{ etichetta: r.fase ? `Fase ${r.fase}` : 'Totale', valore: o.eur(r.totale) }],
      atti: progetto ? (base != null ? ATTI_REVISIONE_PROGETTO : ATTI_REVISIONE_PROGETTO.slice(0, 1)) : ATTI_REVISIONE,
    }
  })
  /* Il computo in corso è il computo di una FASE: si chiama col suo nome. */
  rami.push({
    fase: 'computo',
    etichetta: `${nomeFase === 'PFTE' ? 'PFTE' : nomeFase.charAt(0).toUpperCase() + nomeFase.slice(1)} · in corso`,
    stato: 'bozza',
    capitolo: 'computo',
    tool: 'computo',
    nota: `${o.voci} voc${o.voci === 1 ? 'e' : 'i'}`,
    stati: [
      ...(o.voci ? [{ etichetta: 'Totale', valore: o.eur(o.totale) }] : []),
      ...(o.contratto ? [{ etichetta: 'Contratto da', valore: o.contratto.descrizione }] : []),
    ],
    atti: ATTI_COMPUTO,
  })
  const azioni: AzioneAlbero[] = []
  // un computo arrivato da fuori (XPWE) entra qui, nella fase che si sceglie
  azioni.push({ capitolo: 'computo', tool: 'computo', etichetta: '⇩ Importa un computo…', comando: 'importa-xpwe', titolo: 'Un computo in XPWE (da altri programmi): si sceglie in quale fase entra' })
  if (o.voci) azioni.push({ capitolo: 'computo', tool: 'computo', etichetta: '＋ Congela una revisione', comando: 'nuova-revisione', titolo: 'Fotografa il computo di adesso per confrontarlo dopo' })
  if (dopo) azioni.push({ capitolo: 'computo', tool: 'computo', etichetta: `⇥ Passa ${allaFase(dopo)}…`, comando: 'fase-successiva', titolo: `Si passa ${allaFase(dopo)}: dal computo in corso o da una revisione congelata, congelando prima la fase ${nomeFase}` })
  if (o.voci || o.revisioni.some((r) => r.natura !== 'progetto' && r.voci > 0)) {
    azioni.push({ capitolo: 'computo', tool: 'computo', etichetta: o.contratto ? '→ Rifai la promozione a contratto' : '→ Promuovi a contratto', comando: 'promuovi-contratto', titolo: 'Scegli quale computo diventa contratto, e con quale ribasso o con quali prezzi offerti' })
  }
  return { rami, azioni }
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
