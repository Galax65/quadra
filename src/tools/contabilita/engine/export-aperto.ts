/**
 * Contabilità — EXPORT IN FORMATO APERTO (All. II.14 art. 12 c. 10).
 *
 * La contabilità informatica deve restare leggibile anche senza il programma che
 * l'ha scritta — fra dieci anni, da un collega, da un revisore, da un altro
 * software. Qui si produce un pacchetto di file **aperti e documentati**:
 *
 *   LEGGIMI.txt        cosa c'è dentro e come si rilegge, in italiano
 *   contabilita.json   tutto lo stato, com'è in memoria (JSON, chiavi stabili)
 *   voci.csv           l'elenco prezzi del lavoro, una riga per voce
 *   misure.csv         una riga per misura, con il SAL e la voce a cui appartiene
 *   sal.csv            la cascata di ogni SAL (eseguito, ritenuta, credito…)
 *   impronte.csv       i sigilli dei SAL firmati e gli atti prodotti
 *
 * CSV: separatore `;` (è quello che Excel italiano si aspetta), virgola decimale,
 * testo fra apici doppi. Nessuna formula, nessun foglio di calcolo proprietario.
 */
import type { Appalto, Partita, Sal, Consegna, ListaEconomia, Riserva, Verbale, RigaGiornale } from './types'
import { partiteVigenti } from './perizie'
import { calcolaSals, eseguitoPartita, importoContrattualePartita, round2 } from './contabilita'
import { ALGO_IMPRONTA, improntaCorta } from './impronta'

export interface FileAperto { nome: string; testo: string }

const num = (v: number | null | undefined, dec = 2): string =>
  (v == null ? '' : (Math.round(v * 10 ** dec) / 10 ** dec).toFixed(dec).replace('.', ','))
const txt = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`
const riga = (celle: (string | number | null | undefined)[]): string => celle.map((c) => (c == null ? '' : String(c))).join(';')
const csv = (intestazioni: string[], righe: string[]): string => [intestazioni.map(txt).join(';'), ...righe].join('\r\n') + '\r\n'

export interface DatiEsportabili {
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  economia?: ListaEconomia[]
  consegne?: Consegna[]
  riserve?: Riserva[]
  verbali?: Verbale[]
  giornale?: RigaGiornale[]
  relazione?: string
}

/** L'elenco prezzi del lavoro: una riga per voce, coi prezzi di contratto. */
export function vociCsv(d: DatiEsportabili): string {
  const righe = d.partite.map((p) => riga([
    txt(p.codice), txt(p.descrizione), txt(p.um), txt(p.modalita),
    num(p.prezzoContratto ?? p.prezzoUnitario), num(p.prezzoUnitario),
    p.modalita === 'corpo' ? num(importoContrattualePartita(p)) : num(p.qtyProgetto, 3),
    txt(p.categoria), p.sicurezza ? txt('sì') : txt(''),
    p.np ? txt(`NP ${p.np.numero} ${p.np.stato}`) : txt(''),
    p.introdottaSal ?? 1, p.soppressaSal ?? '',
  ]))
  return csv(['Codice', 'Designazione', 'U.M.', 'Modalità', 'Prezzo di contratto', 'Prezzo applicato',
    'Quantità di progetto / importo a corpo', 'Categoria', 'Sicurezza', 'Nuovo prezzo', 'Introdotta al SAL', 'Soppressa al SAL'], righe)
}

/** Una riga per misura: è il libretto, in forma tabellare. */
export function misureCsv(d: DatiEsportabili): string {
  const righe: string[] = []
  for (const sal of [...d.sals].sort((a, b) => a.numero - b.numero)) {
    const vigenti = partiteVigenti(d.partite, d.appalto.perizie, sal.numero)
    for (const r of sal.righe) {
      const p = vigenti.find((x) => x.id === r.partitaId)
      if (!p) continue
      if (r.misurazioni?.length) {
        r.misurazioni.forEach((m, i) => righe.push(riga([
          sal.numero, txt(sal.data), txt(p.codice), txt(p.descrizione), txt(p.um), i + 1,
          txt(m.descrizione), num(m.n, 3), num(m.l1, 3), num(m.l2, 3), num(m.h, 3), num(m.quantita, 3),
          num(p.prezzoUnitario),
        ])))
      } else {
        righe.push(riga([
          sal.numero, txt(sal.data), txt(p.codice), txt(p.descrizione), txt(p.um), '',
          txt(p.modalita === 'corpo' ? 'quota a corpo %' : 'quantità a tutto il SAL'),
          '', '', '', '', p.modalita === 'corpo' ? num(r.quotaPct, 3) : num(r.quantitaProgressiva, 3),
          num(p.prezzoUnitario),
        ]))
      }
    }
  }
  return csv(['SAL', 'Data del SAL', 'Codice', 'Designazione', 'U.M.', 'N. misura', 'Descrizione della misura',
    'par.ug.', 'L1', 'L2', 'H/peso', 'Quantità', 'Prezzo'], righe)
}

/** La cascata di ogni SAL, come la stampa il certificato di pagamento. */
export function salCsv(d: DatiEsportabili): string {
  const res = calcolaSals(d.appalto, d.partite, d.sals, d.economia || [])
  const righe = res.map((s) => {
    const sal = d.sals.find((x) => x.numero === s.numero)
    return riga([
      s.numero, txt(sal?.data), num(s.totaleEseguito), num(s.detrazioni), num(s.revisioneProgressiva),
      num(s.ritenuta), num(s.recuperoAnticipazione), num(s.salPrecedenti), num(s.importoSal),
      txt(sal?.firmato ? 'firmato' : 'aperto'), txt(sal?.dataFirma), txt(sal?.impronta || ''),
    ])
  })
  return csv(['SAL', 'Data', 'Totale eseguito', 'Detrazioni', 'Revisione prezzi (progressiva)',
    'Ritenuta 0,50%', 'Recupero anticipazione', 'SAL precedenti', 'Importo del SAL (netto IVA)',
    'Stato', 'Firmato il', `Impronta ${ALGO_IMPRONTA}`], righe)
}

/** Sigilli e atti prodotti: la provenienza dei dati, in chiaro. */
export function improntedCsv(d: DatiEsportabili): string {
  const righe: string[] = []
  for (const s of [...d.sals].sort((a, b) => a.numero - b.numero)) {
    if (!s.firmato) continue
    righe.push(riga([txt('sigillo SAL'), s.numero, txt(s.dataFirma), txt(s.impronta || ''), txt(s.improntaAlgo || ALGO_IMPRONTA), s.sblocchi?.length ?? 0]))
  }
  for (const c of [...(d.consegne || [])].sort((a, b) => a.ts - b.ts)) {
    righe.push(riga([txt('atto prodotto'), c.salNumero ?? '', txt(c.data), txt(c.impronta || ''), txt(c.impronta ? ALGO_IMPRONTA : ''), txt(c.label)]))
  }
  return csv(['Tipo', 'SAL', 'Data', 'Impronta', 'Algoritmo', 'Sblocchi / Atto'], righe)
}

/** Quanto eseguito per voce, a tutto l'ultimo SAL: il riepilogo che serve a un revisore. */
export function eseguitoCsv(d: DatiEsportabili): string {
  const ultimo = d.sals.length ? Math.max(...d.sals.map((s) => s.numero)) : 0
  if (!ultimo) return csv(['Codice', 'Designazione', 'U.M.', 'Eseguito'], [])
  const sal = d.sals.find((s) => s.numero === ultimo)
  const vigenti = partiteVigenti(d.partite, d.appalto.perizie, ultimo)
  const righe = vigenti.map((p) => {
    const r = sal?.righe.find((x) => x.partitaId === p.id)
    return riga([txt(p.codice), txt(p.descrizione), txt(p.um), num(p.prezzoUnitario),
      p.modalita === 'corpo' ? num(importoContrattualePartita(p)) : num(p.qtyProgetto, 3),
      num(eseguitoPartita(p, r, ultimo))])
  })
  return csv(['Codice', 'Designazione', 'U.M.', 'Prezzo', 'Contratto vigente', `Eseguito a tutto il SAL n. ${ultimo}`], righe)
}

const LEGGIMI = (d: DatiEsportabili): string => {
  const firmati = d.sals.filter((s) => s.firmato)
  return `CONTABILITÀ IN FORMATO APERTO
${'='.repeat(64)}

Opera:     ${d.appalto.oggetto || '(oggetto non indicato)'}
Ente:      ${d.appalto.ente?.denominazione || '—'}
Impresa:   ${d.appalto.impresa?.denominazione || '—'}
CIG:       ${d.appalto.cig || '—'}
Esportato: ${new Date().toLocaleString('it-IT')}

Questo pacchetto contiene la contabilità dei lavori in formati aperti e
documentati, perché resti leggibile anche senza il programma che l'ha
prodotta (Allegato II.14 art. 12 c. 10 D.Lgs. 36/2023: la contabilità
tenuta con strumenti informatici deve garantire autenticità e provenienza
dei dati).

FILE
----
LEGGIMI.txt        questo file
contabilita.json   tutti i dati, come li tiene il programma. JSON, chiavi
                   stabili: è la copia completa, le altre sono viste.
voci.csv           elenco prezzi del lavoro, una riga per voce
misure.csv         il libretto: una riga per misura, col SAL e la voce
eseguito.csv       quanto eseguito per voce a tutto l'ultimo SAL
sal.csv            la cascata di ogni SAL fino all'importo da pagare
impronte.csv       sigilli dei SAL firmati e atti prodotti

I CSV usano il punto e virgola come separatore, la virgola decimale e il
testo fra apici doppi: si apre con un doppio clic in Excel o LibreOffice
in italiano. Nessuna formula, nessun formato proprietario.

IMPRONTE
--------
${firmati.length
  ? firmati.map((s) => `SAL n. ${s.numero} firmato il ${s.dataFirma || '—'}\n  ${s.improntaAlgo || ALGO_IMPRONTA}: ${s.impronta || '(nessuna impronta)'}`).join('\n')
  : 'Nessun SAL firmato: nessun sigillo da dichiarare.'}

L'impronta è l'hash ${ALGO_IMPRONTA} del contenuto del fascicolo al momento della
firma: ricalcolandola si verifica che i dati non siano cambiati. Non è una
firma digitale e non sostituisce la sottoscrizione degli atti.
`
}

/** Il pacchetto completo: file di testo, pronti da scrivere in uno zip. */
export function pacchettoAperto(d: DatiEsportabili): FileAperto[] {
  const stato = {
    formato: 'quadra-contabilita-aperta',
    v: 1,
    esportatoIl: new Date().toISOString(),
    nota: 'Copia completa dei dati della contabilità. I CSV accanto a questo file ne sono viste leggibili.',
    appalto: d.appalto,
    partite: d.partite,
    sals: d.sals,
    economia: d.economia || [],
    riserve: d.riserve || [],
    verbali: d.verbali || [],
    giornale: d.giornale || [],
    relazione: d.relazione || '',
    consegne: d.consegne || [],
  }
  return [
    { nome: 'LEGGIMI.txt', testo: LEGGIMI(d) },
    { nome: 'contabilita.json', testo: JSON.stringify(stato, null, 2) },
    { nome: 'voci.csv', testo: vociCsv(d) },
    { nome: 'misure.csv', testo: misureCsv(d) },
    { nome: 'eseguito.csv', testo: eseguitoCsv(d) },
    { nome: 'sal.csv', testo: salCsv(d) },
    { nome: 'impronte.csv', testo: improntedCsv(d) },
  ]
}

/** Riepilogo per il messaggio all'utente: quante righe ha prodotto ogni file. */
export const righeDi = (f: FileAperto): number => Math.max(0, f.testo.trim().split(/\r?\n/).length - 1)
export { improntaCorta, round2 }
