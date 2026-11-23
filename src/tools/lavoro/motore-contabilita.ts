/**
 * IL LAVORO NEL MOTORE DELLA CONTABILITÀ — per le stampe della tappa 6.
 *
 * Le stampe contabili (libretto, registro, sommario, SAL, certificato di
 * pagamento, stato finale, conto finale, quadro comparativo) le sa già fare il
 * motore della Contabilità (src/tools/contabilita/engine), con le sue regole:
 * ritenuta 0,5%, anticipazione e suo recupero, IVA, arrotondamento del
 * certificato, perizie che valgono dal loro SAL. Qui il lavoro si traduce nei
 * suoi dati, senza inventare niente:
 *
 *  - le PARTITE sono le voci del contratto (quantità e misure di contratto),
 *    più i nuovi prezzi delle perizie, che compaiono dal SAL della perizia;
 *  - ogni PERIZIA dà le nuove quantità di tutte le sue voci (zero per quelle
 *    tolte), valide dal primo SAL che ne legge i prezzi;
 *  - i SAL (e il SAL finale) portano le misure a tutto il SAL, voce per voce;
 *  - il RIBASSO: quello del contratto, sui lavori; un NP «non soggetto» è una
 *    partita non ribassata; coi prezzi offerti il prezzo della partita è già
 *    quello di contratto, e un NP «soggetto» entra al prezzo ribassato.
 *  - gli oneri della sicurezza sono VOCI (partite di sicurezza), non un
 *    importo a forfait: oneriSicurezza resta zero, per non contarli due volte.
 */
import type { Appalto, Partita, Perizia, Sal, RigaSal, ListaEconomia, Verbale, Riserva, RigaGiornale, Consegna } from '../contabilita/engine/types'
import {
  contratto, datiContabilita, attiDi, verbaliDi, importiContratto, prezzoIn, quantitaVoce, ribassoArticolo, revisione, sigla,
  type Articolo, type Lavoro, type Revisione, type Voce,
} from '../../shared/lavoro'
import { sommaMisurazioni } from '../../shared/compositore/misurazioni'

export interface ContabilitaMotore {
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  perizie: Perizia[]
  /** Gli atti del cantiere, nella forma del motore. */
  liste: ListaEconomia[]
  verbali: Verbale[]
  riserve: Riserva[]
  giornale: RigaGiornale[]
  consegne: Consegna[]
}

const r2 = (n: number): number => Math.round(n * 100) / 100

function partitaDi(r: Revisione, c: Revisione, v: Voce, a: Articolo, introdottaSal?: number): Partita {
  const offerte = !!c.contratto?.prezziOfferti
  // coi prezzi offerti un NP «soggetto» entra al prezzo ribassato del ribasso risultante
  const rib = ribassoArticolo(c, r, a)
  const prezzo = offerte && rib ? r2(prezzoIn(r, a) * (1 - rib / 100)) : prezzoIn(r, a)
  const qty = quantitaVoce(v)
  return {
    id: v.id,
    modalita: v.corpo ? 'corpo' : 'misura',
    codice: a.codice,
    descrizione: a.descrizione,
    ...(a.estesa ? { declaratoria: a.estesa } : {}),
    um: a.um,
    ...(v.categoria ? { categoria: v.categoria } : {}),
    ...(v.wbs ? { wbs: v.wbs } : {}),
    ...(a.sicurezza ? { sicurezza: true } : {}),
    // col ribasso unico, la partita che il ribasso non tocca
    ...(!offerte && !a.sicurezza && rib === 0 && (c.contratto?.ribassoPct ?? 0) > 0 ? { nonRibassata: true } : {}),
    ...(v.corpo
      ? { importoContrattuale: r2(qty * prezzo), ...(v.sottoComputo?.length ? { sottoComputo: v.sottoComputo.map((x) => ({ ...x })) } : {}) }
      : { prezzoUnitario: prezzo, prezzoContratto: prezzo, qtyProgetto: qty, ...(v.misure.length ? { misurazioniProgetto: v.misure } : {}) }),
    ...(offerte && a.prezzo != null ? { prezzoBase: a.prezzo } : {}),
    ...(introdottaSal && introdottaSal > 1 ? { introdottaSal } : {}),
  }
}

/** Il lavoro tradotto nei dati del motore della Contabilità. */
export function contabilitaMotore(l: Lavoro): ContabilitaMotore | null {
  const c = contratto(l)
  if (!c) return null
  const d = l.dati
  const dc = datiContabilita(l)
  const ic = importiContratto(c)
  const ordinati = [...l.avanzamenti].filter((a) => a.tipo !== 'cre').sort((x, y) => x.ordine - y.ordine)
  const cre = l.avanzamenti.find((a) => a.tipo === 'cre')
  const ultimoN = ordinati.length ? ordinati[ordinati.length - 1].n : 0

  // le partite del contratto
  const artC = new Map(c.articoli.map((a) => [a.id, a]))
  const partite: Partita[] = c.voci.filter((v) => artC.has(v.articolo)).map((v) => partitaDi(c, c, v, artC.get(v.articolo)!))
  const presenti = new Set(partite.map((p) => p.id))

  // le perizie: nuove quantità e NP, dal primo SAL che ne legge i prezzi
  const perizie: Perizia[] = []
  const revPerizie = l.revisioni.filter((r) => r.tipo === 'perizia').sort((x, y) => x.ordine - y.ordine)
  let vigenti = new Set(c.voci.map((v) => v.id))
  revPerizie.forEach((p, i) => {
    const primo = ordinati.find((a) => a.leggeDa === p.id)
    const dalSal = primo ? primo.n : ultimoN + 1
    const art = new Map(p.articoli.map((a) => [a.id, a]))
    for (const v of p.voci) {
      if (presenti.has(v.id) || !art.has(v.articolo)) continue
      // il NP entra come partita dal SAL della perizia, senza quantità di contratto,
      // con la sua scheda (numero, iter, derivazione): la leggono verbale ed elenco NP
      const a = art.get(v.articolo)!
      const numNp = Number(/^NP[.\s-]?(\d+)/i.exec(a.codice.trim())?.[1]) || partite.filter((x) => x.np).length + 1
      const rib = ribassoArticolo(c, p, a)
      partite.push({
        ...partitaDi(p, c, v, a, dalSal), qtyProgetto: null,
        np: {
          numero: numNp, stato: p.stato === 'chiusa' ? 'approvato' : 'concordato', periziaN: i + 1,
          origine: a.origine === 'analisi' ? 'analisi' : a.codiceOrig ? 'assimilazione' : 'prezzario',
          ...(a.codiceOrig ? { base: { codice: a.codiceOrig, prezzo: a.prezzo } } : {}),
          ...(rib ? { ribassoPct: rib } : {}),
        },
      })
      presenti.add(v.id)
    }
    const qui = new Set(p.voci.map((v) => v.id))
    perizie.push({
      numero: i + 1, data: p.data, oggetto: p.nome || `Perizia di variante ${sigla(p.numero)}`, dalSal,
      approvata: p.stato === 'chiusa', ...(p.chiusaIl ? { dataApprovazione: p.chiusaIl } : {}),
      voci: [
        ...p.voci.map((v) => (v.corpo
          ? { partitaId: v.id, importo: r2(quantitaVoce(v) * prezzoIn(p, art.get(v.articolo)!)) }
          : { partitaId: v.id, qty: quantitaVoce(v), ...(v.misure.length ? { misurazioni: v.misure } : {}) })),
        // le voci che la perizia toglie: quantità zero
        ...[...vigenti].filter((id) => !qui.has(id)).map((id) => ({ partitaId: id, qty: 0 })),
      ],
    })
    vigenti = qui
  })

  // i SAL e il SAL finale: misure a tutto il SAL
  const sals: Sal[] = ordinati.map((a) => ({
    numero: a.n, data: a.data,
    righe: a.righe.filter((x) => presenti.has(x.voce)).map((x): RigaSal => ({
      partitaId: x.voce,
      ...(x.quotaPct != null ? { quotaPct: x.quotaPct } : {}),
      ...(x.sotto?.length ? { sotto: x.sotto.map((y) => ({ voceId: y.voceId, ...(y.misure?.length ? { misurazioni: y.misure } : { quantitaProgressiva: y.quantita ?? null }) })) } : {}),
      ...(x.misure.length ? { misurazioni: x.misure, quantitaProgressiva: sommaMisurazioni(x.misure) } : x.quantita != null ? { quantitaProgressiva: x.quantita } : {}),
    })),
    ...(a.stato === 'emesso' ? { firmato: true, ...(a.emessoIl ? { dataFirma: a.emessoIl } : {}) } : {}),
    ...(a.detrazioni ? { detrazioni: a.detrazioni } : {}), ...(a.note ? { note: a.note } : {}),
    ...(a.impronta ? { impronta: a.impronta, improntaAlgo: 'SHA-256', ...(a.improntaTs ? { improntaTs: a.improntaTs } : {}) } : {}),
  }))

  const appalto: Appalto = {
    oggetto: String(d.oggetto || ''),
    ...(d.cup ? { cup: d.cup } : {}), ...(d.cig ? { cig: d.cig } : {}),
    ente: { denominazione: String(d.committente || ''), ...(d.indirizzoCommittente ? { indirizzo: d.indirizzoCommittente } : {}) },
    impresa: { denominazione: String(d.impresa || '') },
    ...(d.rup ? { rup: d.rup } : {}), ...(d.direttoreLavori ? { direttoreLavori: d.direttoreLavori } : {}),
    ...(d.comune ? { comune: d.comune } : {}), ...(d.provincia ? { provincia: d.provincia } : {}),
    ...(d.progettista ? { progettista: d.progettista } : {}), ...(d.cse ? { cse: d.cse } : {}),
    ...(d.prezzario ? { prezzario: d.prezzario } : {}),
    baseAsta: ic.baseAsta,
    ...(c.contratto?.prezziOfferti ? { prezziUnitari: true, ribassoPct: null } : { ribassoPct: c.contratto?.ribassoPct ?? 0 }),
    oneriSicurezza: 0,
    ...(dc.ivaPct != null ? { ivaPct: dc.ivaPct } : {}),
    ...(dc.dataStipula ? { dataStipula: dc.dataStipula } : {}),
    ...(dc.numeroContratto ? { numeroContratto: dc.numeroContratto } : {}),
    ...(dc.registrazione ? { registrazione: { luogo: dc.registrazione } } : {}),
    ...(dc.dataConsegna ? { dataConsegna: dc.dataConsegna } : {}),
    ...(dc.giorniUtili ? { giorniUtili: dc.giorniUtili } : {}),
    ...(dc.penalePerMille != null ? { penalePerMille: dc.penalePerMille } : {}),
    ...(dc.anticipazionePct != null ? { anticipazionePct: dc.anticipazionePct } : {}),
    ...(dc.arrotondamentoCertificato ? { arrotondamentoCertificato: dc.arrotondamentoCertificato } : {}),
    ...(dc.articoloCapitolato ? { articoloCapitolato: dc.articoloCapitolato } : {}),
    ...(dc.contoFinale ? { contoFinale: { ...dc.contoFinale } } : {}),
    ...(dc.durcRegolare != null || dc.durcData ? { durc: { regolare: !!dc.durcRegolare, ...(dc.durcData ? { data: dc.durcData } : {}) } } : {}),
    ...(dc.semplificata ? { contabilitaSemplificata: true } : {}),
    ...(dc.accordoQuadro ? { accordoQuadro: { importoMassimo: dc.accordoQuadro.importoMassimo, applicativi: dc.accordoQuadro.applicativi.map((x) => ({ ...x })) } } : {}),
    // il CRE del lavoro è il collaudo dell'appalto: senza la sua approvazione la ritenuta non si svincola
    ...(cre ? { collaudo: { tipo: 'cre' as const, data: cre.data, ...(cre.stato === 'emesso' && cre.emessoIl ? { dataApprovazione: cre.emessoIl } : {}) } } : {}),
    perizie,
    modalita: partite.some((p) => p.modalita === 'corpo') ? (partite.some((p) => p.modalita === 'misura') ? 'misto' : 'corpo') : 'misura',
    tipologia: 'lavori',
  }
  const atti = attiDi(l)
  const liste: ListaEconomia[] = atti.economie.map((x) => ({
    id: x.id, numero: x.numero, data: x.data, ...(x.salNumero != null ? { salNumero: x.salNumero } : {}), ...(x.ordineRef ? { ordineRef: x.ordineRef } : {}),
    operai: x.operai, mezzi: x.mezzi, provviste: x.provviste, ...(x.note ? { note: x.note } : {}),
  }))
  const verbali: Verbale[] = verbaliDi(l).map((v) => ({
    id: v.id, tipo: v.tipo, ...(v.data ? { data: v.data } : {}), ...(v.numero != null ? { numero: v.numero } : {}),
    ...(v.oggetto ? { oggetto: v.oggetto } : {}), ...(v.testo ? { testo: v.testo } : {}), ...(v.motivo ? { motivo: v.motivo } : {}),
    ...(v.giorniProroga != null ? { giorniProroga: v.giorniProroga } : {}),
  }))
  const riserve: Riserva[] = atti.riserve.map(({ id: _id, ...r }) => r)
  const giornale: RigaGiornale[] = atti.giornale.map(({ id: _id, ...g }) => g)
  const consegne: Consegna[] = atti.consegne.map((c) => ({ ...c }))
  return { appalto, partite, sals, perizie, liste, verbali, riserve, giornale, consegne }
}

/** Il numero di SAL del motore per un avanzamento del lavoro (il CRE legge lo stato finale). */
export function salNumeroDi(l: Lavoro, avId: string): number {
  const a = l.avanzamenti.find((x) => x.id === avId)
  return a ? a.n : 0
}

/** Per i test: la revisione da cui legge un avanzamento. */
export const revisioneDi = (l: Lavoro, avId: string): Revisione => revisione(l, l.avanzamenti.find((x) => x.id === avId)!.leggeDa)
