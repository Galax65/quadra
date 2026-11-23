/**
 * Contabilità — IMPRONTA DEL FASCICOLO (contabilità digitale).
 *
 * All. II.14 art. 12 c. 10 chiede che la contabilità tenuta con strumenti
 * informatici garantisca **autenticità e provenienza** dei dati. Qui non si firma
 * digitalmente (quello è un certificato del tecnico, fuori da questo programma):
 * si fa la cosa che un programma può garantire da sé — un'**impronta** del
 * fascicolo al momento della firma, così che una modifica successiva si veda.
 *
 * Il testo su cui si calcola l'impronta è CANONICO: una serializzazione stabile e
 * leggibile di ciò che gli atti del SAL affermano (voci, misure, quantità, prezzi,
 * importi, detrazioni). Stabile significa che lo stesso fascicolo dà sempre la
 * stessa impronta — niente date di generazione, niente ordini casuali, numeri
 * sempre con lo stesso numero di decimali. Leggibile significa che, se un domani
 * l'algoritmo cambia, si può ancora capire COSA era stato sigillato.
 *
 * Quello che NON entra nell'impronta: le note, gli sblocchi, i documenti prodotti
 * dopo. L'impronta copre i NUMERI della contabilità, non la cronaca del file.
 */
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { partiteVigenti } from './perizie'
import { eseguitoPartita, importoContrattualePartita, voceVisibileInSal, voceSoppressaInSal, round2 } from './contabilita'
import { sommaMisurazioni } from '../../../shared/compositore/misurazioni'
import { valorizzaLista } from './economia'

const n2 = (v: number | null | undefined): string => (v == null ? '' : round2(v).toFixed(2))
const n3 = (v: number | null | undefined): string => (v == null ? '' : (Math.round(v * 1000) / 1000).toFixed(3))

/**
 * Testo canonico degli atti del SAL n: una riga per voce, una riga per misura,
 * più la coda dei totali. Campi separati da `|`, righe da `\n`.
 */
export function testoCanonicoSal(
  appalto: Appalto,
  partite: Partita[],
  sals: Sal[],
  salNumero: number,
  economia: ListaEconomia[] = [],
): string {
  const sal = sals.find((s) => s.numero === salNumero)
  if (!sal) return ''
  const vigenti = partiteVigenti(partite, appalto.perizie, salNumero)
  const righe: string[] = []
  righe.push(`QUADRA-FASCICOLO-SAL|v1`)
  righe.push(`appalto|${appalto.oggetto || ''}|${appalto.ente?.denominazione || ''}|${appalto.impresa?.denominazione || ''}|${appalto.cig || ''}`)
  righe.push(`sal|${sal.numero}|${sal.data || ''}|detrazioni=${n2(sal.detrazioni)}|indice=${sal.indiceRevisione ?? ''}`)
  // le voci nell'ordine del lavoro (stabile: è l'ordine delle partite, non un sort casuale)
  for (const p of vigenti) {
    if (!voceVisibileInSal(p, salNumero)) continue
    const r = sal.righe.find((x) => x.partitaId === p.id)
    const eseg = eseguitoPartita(p, r, salNumero)
    righe.push([
      'voce', p.codice || '', p.descrizione || '', p.um || '', p.modalita,
      p.modalita === 'corpo' ? `importo=${n2(importoContrattualePartita(p))}` : `prezzo=${n2(p.prezzoUnitario)}`,
      p.np ? `np=${p.np.numero}:${p.np.stato}` : '',
      voceSoppressaInSal(p, salNumero) ? 'soppressa' : '',
      p.modalita === 'corpo' ? `quota=${n3(r?.quotaPct)}` : `qta=${n3(r?.misurazioni?.length ? sommaMisurazioni(r.misurazioni) : r?.quantitaProgressiva)}`,
      `eseguito=${n2(eseg)}`,
    ].join('|'))
    for (const m of r?.misurazioni || []) {
      righe.push(['  misura', m.descrizione || '', n3(m.n), n3(m.l1), n3(m.l2), n3(m.h), n3(m.quantita)].join('|'))
    }
  }
  // lavori in economia confluiti in questo SAL
  for (const l of economia.filter((x) => (x.salNumero ?? 1) === salNumero)) {
    const v = valorizzaLista(l)
    righe.push(['economia', String(l.numero ?? ''), l.data || '', `totale=${n2(v.totale)}`].join('|'))
  }
  return righe.join('\n')
}

/** Funzione di digest: in app e nei test è `crypto.subtle`; iniettabile per i test DOM. */
export type Digest = (dati: Uint8Array) => Promise<ArrayBuffer>

const digestDiSistema = (): Digest | null => {
  const sub = (globalThis as { crypto?: { subtle?: { digest?: (a: string, d: Uint8Array) => Promise<ArrayBuffer> } } }).crypto?.subtle
  return sub?.digest ? ((d) => sub.digest!('SHA-256', d)) : null
}

export const ALGO_IMPRONTA = 'SHA-256'

/**
 * Impronta SHA-256 di un testo, in esadecimale minuscolo. Ritorna `null` se
 * l'ambiente non offre `crypto.subtle` (es. una pagina servita in http semplice):
 * meglio dire che non si può sigillare che scrivere un'impronta finta.
 */
export async function improntaTesto(testo: string, digest?: Digest): Promise<string | null> {
  const d = digest || digestDiSistema()
  if (!d) return null
  const buf = await d(new TextEncoder().encode(testo))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Impronta del fascicolo di un SAL (testo canonico → SHA-256). */
export async function improntaSal(
  appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, economia: ListaEconomia[] = [], digest?: Digest,
): Promise<string | null> {
  return improntaTesto(testoCanonicoSal(appalto, partite, sals, salNumero, economia), digest)
}

export type EsitoVerifica = 'integro' | 'modificato' | 'senza-impronta' | 'non-firmato' | 'non-verificabile'

export interface Verifica {
  salNumero: number
  esito: EsitoVerifica
  attesa?: string
  trovata?: string
}

/**
 * Verifica un SAL sigillato: ricalcola l'impronta e la confronta con quella del
 * sigillo. Si verifica anche un SAL SBLOCCATO che porta un sigillo — è proprio il
 * caso in cui serve sapere se il fascicolo è ancora quello firmato.
 * `senza-impronta` = firmato prima che questa funzione esistesse (non è un
 * allarme); `non-verificabile` = l'ambiente non sa calcolare l'hash.
 */
export async function verificaSal(
  appalto: Appalto, partite: Partita[], sals: Sal[], salNumero: number, economia: ListaEconomia[] = [], digest?: Digest,
): Promise<Verifica> {
  const sal = sals.find((s) => s.numero === salNumero)
  if (!sal) return { salNumero, esito: 'non-firmato' }
  if (!sal.impronta) return { salNumero, esito: sal.firmato ? 'senza-impronta' : 'non-firmato' }
  const ora = await improntaSal(appalto, partite, sals, salNumero, economia, digest)
  if (ora == null) return { salNumero, esito: 'non-verificabile', attesa: sal.impronta }
  return { salNumero, esito: ora === sal.impronta ? 'integro' : 'modificato', attesa: sal.impronta, trovata: ora }
}

/** Impronta accorciata per l'interfaccia e il cartiglio: primi 8 e ultimi 8. */
export const improntaCorta = (h: string | null | undefined): string =>
  (!h ? '—' : h.length <= 20 ? h : `${h.slice(0, 8)}…${h.slice(-8)}`)

export const ESITO_LABEL: Record<EsitoVerifica, string> = {
  integro: 'integro',
  modificato: 'MODIFICATO dopo la firma',
  'senza-impronta': 'firmato senza impronta',
  'non-firmato': 'non firmato',
  'non-verificabile': 'impronta non verificabile qui',
}
