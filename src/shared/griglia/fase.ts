/**
 * IL DESCRITTORE DI FASE — che cosa cambia da una fase all'altra del lavoro.
 *
 * Computo, libretto e perizia sono lo stesso oggetto: un elenco di voci con una
 * quantità, prezzate da un elenco prezzi (Docs/06-Interfaccia-unica.md §2).
 * Cambia solo QUALE COLONNA SI SCRIVE, QUALE SI CONFRONTA e QUALI VALORI DI
 * CONTROLLO stanno in calce. Questo file lo dice, fase per fase, in un posto
 * solo: la griglia (griglia.ts) e il piede (piede.ts) lo leggono, e nessuno
 * dei due strumenti ridecide per conto suo l'ordine delle colonne o i totali.
 *
 * L'ordine delle colonne è quello degli atti contabili: codice, designazione,
 * (confronto), quantità, prezzo, importo. Una fase che non ha una colonna la
 * omette; le altre non si spostano.
 */
import type { OpzioneOrdine } from '../ui/barra-voci'

export type IdFase = 'progetto' | 'contratto' | 'sal' | 'perizia'

export type IdColonna = 'codice' | 'designazione' | 'confronto' | 'quantita' | 'prezzo' | 'importo' | 'differenza' | 'comandi'

/** Le colonne numeriche: a destra, cifre tabulari. */
export const COLONNE_NUMERICHE: ReadonlySet<IdColonna> = new Set(['confronto', 'quantita', 'prezzo', 'importo', 'differenza'])

export interface ColonnaGriglia {
  id: IdColonna
  titolo: string
  /** Spiegazione al passaggio del mouse sull'intestazione. */
  aiuto?: string
}

/** I valori di controllo in calce: una sintesi a sinistra, il numero che conta a destra. */
export interface Calce {
  /** Sintesi a sinistra (HTML già pronto: conteggi, scomposizioni). */
  sintesi?: string
  etichetta: string
  valore: string
  /** Righe sotto il numero (HTML già pronto). */
  sotto?: string[]
  /** Il numero è fuori dalle regole (es. oltre il quinto d'obbligo). */
  allarme?: boolean
}

export type Formatta = (n: number) => string

export interface DescrittoreFase<V = unknown> {
  fase: IdFase
  /** Come si chiama la schermata (testata, aiuto). */
  nome: string
  colonne: ColonnaGriglia[]
  /** La colonna che in questa fase si scrive: l'unica che ha l'aspetto di un campo. */
  scrive: IdColonna
  /** La colonna con cui si confronta quello che si scrive, se c'è. */
  confronta?: IdColonna
  /** Segnaposto della ricerca nella barra. */
  cerca: string
  /** MOSTRA: quale sottoinsieme di voci tenere a schermo (vuoto = nessuna scelta). */
  mostra?: OpzioneOrdine[]
  /** I valori di controllo di questa fase. */
  calce: (v: V, eur: Formatta) => Calce
}

/** La parte del descrittore che serve a disegnare la griglia (i valori in calce no). */
export type StrutturaFase = Pick<DescrittoreFase<never>, 'fase' | 'colonne' | 'scrive' | 'confronta'>

/* ── Le viste e gli ordini: gli stessi in ogni fase ─────────────────────── */

export type VistaVoci = 'tabella' | 'elenco' | 'capitoli'

export const OPZ_VISTA: OpzioneOrdine[] = [
  { valore: 'tabella', etichetta: 'Tabella', titolo: 'Le voci come righe modificabili, con le misure' },
  { valore: 'elenco', etichetta: 'Elenco', titolo: "Una riga per voce, sola lettura: più voci a colpo d'occhio" },
  { valore: 'capitoli', etichetta: 'Capitoli', titolo: 'Raggruppate per categoria, con il totale di ogni capitolo' },
]

export const OPZ_ORDINE: OpzioneOrdine[] = [
  { valore: 'manuale', etichetta: 'Manuale', titolo: "Nell'ordine in cui le voci sono state iscritte" },
  { valore: 'categorie', etichetta: 'Categorie', titolo: 'Raggruppate per categoria (stesso ordine a schermo e in stampa)' },
  { valore: 'wbs', etichetta: 'WBS', titolo: 'Per codice WBS (le voci senza WBS in coda)' },
]

/** Ricerca testuale sulle voci: la stessa regola in ogni fase. */
export function filtraVoci<T>(voci: T[], q: string, testo: (v: T) => string): T[] {
  const s = q.trim().toLowerCase()
  return s ? voci.filter((v) => testo(v).toLowerCase().includes(s)) : voci
}

/* ── Le fasi ────────────────────────────────────────────────────────────── */

export interface ValoriProgetto {
  totale: number
  /** Avviso accanto all'etichetta (voci senza prezzo o senza quantità). HTML. */
  avviso?: string
  /** Righe sotto il totale: incidenza manodopera, a corpo, sicurezza, offerta. HTML. */
  sotto?: string[]
}

export const FASE_PROGETTO: DescrittoreFase<ValoriProgetto> = {
  fase: 'progetto',
  nome: 'Computo metrico',
  colonne: [
    { id: 'codice', titolo: 'Codice' },
    { id: 'designazione', titolo: 'Designazione' },
    { id: 'quantita', titolo: 'Quantità' },
    { id: 'prezzo', titolo: 'Prezzo' },
    { id: 'importo', titolo: 'Importo' },
    { id: 'comandi', titolo: '' },
  ],
  scrive: 'quantita',
  cerca: '⌕ cerca nel computo',
  calce: (v, eur) => ({
    etichetta: 'Totale computo' + (v.avviso || ''),
    valore: eur(v.totale),
    sotto: v.sotto,
  }),
}

export interface ValoriContratto {
  /** Importo dei lavori a base d'asta. */
  baseAsta: number
  /** Ribasso già formattato (4 decimali), o null con l'offerta a prezzi unitari. */
  ribasso: string | null
  contrattuale: number
  sicurezza: number
}

/** Il contratto: l'esecutivo scelto, con ribasso o prezzi offerti. Si confronta col progetto. */
export const FASE_CONTRATTO: DescrittoreFase<ValoriContratto> = {
  fase: 'contratto',
  nome: 'Contratto',
  colonne: [
    { id: 'codice', titolo: 'Codice' },
    { id: 'designazione', titolo: 'Designazione' },
    { id: 'confronto', titolo: 'Prezzo di progetto' },
    { id: 'quantita', titolo: 'Quantità' },
    { id: 'prezzo', titolo: 'Prezzo di contratto' },
    { id: 'importo', titolo: 'Importo' },
  ],
  scrive: 'prezzo',
  confronta: 'confronto',
  cerca: '⌕ cerca nel contratto',
  calce: (v, eur) => ({
    sintesi: `Base d'asta ${eur(v.baseAsta)}${v.ribasso != null ? ` · ribasso ${v.ribasso}` : ' · offerta a prezzi unitari'}`,
    etichetta: 'Importo contrattuale',
    valore: eur(v.contrattuale),
    sotto: [`di cui sicurezza ${eur(v.sicurezza)}, non soggetta a ribasso`],
  }),
}

export interface ValoriSal {
  salN: number
  /** Voci con misure in questo SAL. */
  misurate: number
  /** Voci del contratto a questo avanzamento. */
  quante: number
  /** Voci a schermo (dopo ricerca e MOSTRA). */
  mostrate: number
  /** Lordo di questo SAL (assente al primo). */
  inQuestoSal: number | null
  /** Lordo a tutto il SAL, sicurezza compresa. */
  lordo: number
  sicurezza: number
  daLiquidare: number
}

export const FASE_SAL: DescrittoreFase<ValoriSal> = {
  fase: 'sal',
  nome: 'Libretto delle misure',
  colonne: [
    { id: 'codice', titolo: 'Codice' },
    { id: 'designazione', titolo: 'Designazione' },
    { id: 'quantita', titolo: 'Eseguito a tutto il SAL' },
    { id: 'prezzo', titolo: 'Prezzo unit.', aiuto: 'Prezzo di contratto: la contabilità si fa a questo prezzo' },
    { id: 'importo', titolo: 'Importo' },
    { id: 'comandi', titolo: '' },
  ],
  scrive: 'quantita',
  cerca: '⌕ cerca nel libretto',
  /* Un libretto NON è l'elenco prezzi: si apre su quello che in questo SAL è
     stato misurato, e con un clic si vede tutto il contratto. */
  mostra: [
    { valore: 'misurate', etichetta: 'Misurate', titolo: 'Solo le voci che in questo libretto hanno misure' },
    { valore: 'tutte', etichetta: 'Tutto il contratto', titolo: 'Tutte le voci di contratto, anche quelle non ancora misurate' },
  ],
  /* Importi al lordo del ribasso, come nel registro: qui si misura, non si liquida. */
  calce: (v, eur) => ({
    sintesi: `<b>${v.misurate}</b> voci misurate su ${v.quante}${v.mostrate !== v.quante ? ` · ${v.mostrate} mostrate` : ''}`
      + (v.inQuestoSal != null ? `<span class="ehb-piede__muto"> · in questo SAL ${eur(v.inQuestoSal)}</span>` : ''),
    etichetta: `Totale contabilizzato a tutto il SAL n. ${v.salN}`,
    valore: eur(v.lordo),
    sotto: [`di cui sicurezza ${eur(v.sicurezza)}${v.daLiquidare > 0 ? ` · da liquidare ${eur(v.daLiquidare)}` : ''}`],
  }),
}

export interface ValoriPerizia {
  variate: number
  voci: number
  aumenti: number
  diminuzioni: number
  prima: number
  dopo: number
  differenza: number
  /** Variazione sul contratto originario, già formattata (null se non calcolabile). */
  variazione: string | null
  oltreQuinto: boolean
}

export const FASE_PERIZIA: DescrittoreFase<ValoriPerizia> = {
  fase: 'perizia',
  nome: 'Perizia di variante',
  colonne: [
    { id: 'codice', titolo: 'Codice' },
    { id: 'designazione', titolo: 'Designazione' },
    { id: 'confronto', titolo: 'Contratto vigente' },
    { id: 'quantita', titolo: 'Perizia' },
    { id: 'differenza', titolo: 'Differenza' },
  ],
  scrive: 'quantita',
  confronta: 'confronto',
  cerca: '⌕ cerca nella perizia',
  mostra: [
    { valore: 'variate', etichetta: 'Variate', titolo: 'Solo le voci che la perizia cambia (e i nuovi prezzi)' },
    { valore: 'tutte', etichetta: 'Tutto il contratto', titolo: 'Tutte le voci di contratto, anche quelle non variate' },
  ],
  calce: (v, eur) => ({
    sintesi: `<b>${v.variate}</b> voci variate su ${v.voci}`
      + `<span class="ehb-piede__muto"> · maggiori lavori ${eur(v.aumenti)} · minori ${eur(v.diminuzioni)}</span>`
      + `<div class="ehb-piede__muto">Contratto vigente ${eur(v.prima)} → con la perizia ${eur(v.dopo)}</div>`,
    etichetta: 'Differenza sul contratto vigente',
    valore: `${v.differenza >= 0 ? '+ ' : '− '}${eur(Math.abs(v.differenza))}`,
    sotto: [`sul contratto originario ${v.variazione ?? '—'}${v.oltreQuinto ? " — oltre il quinto d'obbligo" : ''}`],
    allarme: v.oltreQuinto,
  }),
}

export const FASI: Record<IdFase, DescrittoreFase<never>> = {
  progetto: FASE_PROGETTO as DescrittoreFase<never>,
  contratto: FASE_CONTRATTO as DescrittoreFase<never>,
  sal: FASE_SAL as DescrittoreFase<never>,
  perizia: FASE_PERIZIA as DescrittoreFase<never>,
}
