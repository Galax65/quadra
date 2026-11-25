/**
 * L'ALBERO DEL LAVORO, letto dal modello (modello.ts): la sidebar come l'ha
 * disegnata chi lo usa.
 *
 *   DATI DEL LAVORO
 *   ANALISI PREZZI
 *   ELENCO PREZZI        i prezzari caricati
 *   COMPUTO              PFTE rev.00 · Esecutivo rev.02 · …
 *   CONTRATTO            rev.06
 *   CONTABILITÀ          SAL 1 rev.06 · Perizia rev.07 · SAL 3 rev.07 · SAL finale · CRE
 *
 * Tutte le sezioni sono collassabili; sotto ogni tappa, collassati, i suoi
 * DOCUMENTI (le stampe di quella tappa). Un nodo dice che cosa apre (una tappa
 * nella schermata unica, una pagina dei dati, un documento): chi disegna la
 * sidebar non decide niente.
 */
import { NOME_FASE, catena, sigla, type Lavoro, type Revisione, type Avanzamento } from './modello'
import { tempiLavoro } from './contabilita'
import { attiDi, verbaliDi } from './atti'
import { analisiDi } from './analisi'
import { calcolaAnalisi } from '../compositore/analisi-prezzi'

export type IdSezione = 'dati' | 'analisi' | 'prezzi' | 'computo' | 'contratto' | 'contabilita' | 'cantiere'

/** Un documento di una tappa: si apre nella finestra unica delle stampe. */
export interface DocumentoNodo { tipo: string; titolo: string }

export interface NodoAlbero {
  /** Che cosa apre il clic: una tappa (id), una pagina dei dati, un prezzario. */
  apre: { cosa: 'tappa' | 'dati' | 'contabilita' | 'analisi' | 'prezzario' | 'pagina'; id?: string }
  etichetta: string
  /** «rev.06»: il numero che la tappa porta (il suo, o quello da cui legge i prezzi). */
  sigla?: string
  /** In chiaro, sotto l'etichetta: data, stato. */
  nota?: string
  /** aperta/bozza = si scrive; chiusa/emessa = sola lettura. */
  stato?: 'aperta' | 'chiusa'
  /** Le stampe di questa tappa, collassate sotto il nodo. */
  documenti?: DocumentoNodo[]
}

export interface SezioneAlbero {
  id: IdSezione
  titolo: string
  nodi: NodoAlbero[]
}

/* Le stampe di ogni tipo di tappa: le stesse, in qualunque lavoro. */
const DOC: Record<string, DocumentoNodo[]> = {
  computo: [
    { tipo: 'computo-metrico', titolo: 'Computo metrico estimativo' },
    { tipo: 'elenco-prezzi', titolo: 'Elenco prezzi unitari' },
    { tipo: 'stima-lavori', titolo: 'Stima dei lavori' },
    { tipo: 'incidenza-manodopera', titolo: 'Incidenza della manodopera' },
    { tipo: 'incidenza-sicurezza', titolo: 'Incidenza della sicurezza' },
    { tipo: 'quadro-economico', titolo: 'Quadro economico' },
  ],
  contratto: [
    { tipo: 'registro-bianco', titolo: 'Registro in bianco da vidimare' },
    { tipo: 'copertina', titolo: 'Copertina della contabilità' },
    { tipo: 'dati-contratto', titolo: 'Dati del contratto' },
    { tipo: 'elenco-prezzi', titolo: 'Elenco prezzi contrattuale' },
    { tipo: 'computo-metrico', titolo: 'Computo metrico di contratto' },
    { tipo: 'lista-lavorazioni', titolo: 'Lista delle lavorazioni' },
  ],
  perizia: [
    { tipo: 'fascicolo-perizia', titolo: 'Atti della perizia (fascicolo unico)' },
    { tipo: 'perizia', titolo: 'Perizia di variante' },
    { tipo: 'quadro-comparativo', titolo: 'Quadro comparativo' },
    { tipo: 'verbale-np', titolo: 'Verbale di concordamento nuovi prezzi' },
    { tipo: 'atto-sottomissione', titolo: 'Atto di sottomissione' },
  ],
  sal: [
    { tipo: 'fascicolo', titolo: 'Atti del SAL (fascicolo unico)' },
    { tipo: 'consuntivo-pdf', titolo: 'Computo consuntivo' },
    { tipo: 'libretto', titolo: 'Libretto delle misure' },
    { tipo: 'registro', titolo: 'Registro di contabilità' },
    { tipo: 'sommario', titolo: 'Sommario del registro' },
    { tipo: 'sal', titolo: 'Stato di avanzamento lavori' },
    { tipo: 'certificato', titolo: 'Certificato di pagamento' },
  ],
  salFinale: [
    { tipo: 'consuntivo-pdf', titolo: 'Computo consuntivo' },
    { tipo: 'libretto', titolo: 'Libretto delle misure' },
    { tipo: 'registro', titolo: 'Registro di contabilità' },
    { tipo: 'stato-finale', titolo: 'Stato finale dei lavori' },
    { tipo: 'conto-finale', titolo: 'Conto finale' },
  ],
  cre: [
    { tipo: 'consuntivo-pdf', titolo: 'Computo consuntivo' },
    { tipo: 'cre', titolo: 'Certificato di regolare esecuzione' },
    { tipo: 'relazione-conto-finale', titolo: 'Relazione sul conto finale' },
  ],
}

const statoRev = (r: Revisione): string =>
  r.stato === 'aperta'
    ? (r.tipo === 'contratto' ? 'in definizione' : r.tipo === 'perizia' ? 'in bozza' : 'in lavorazione')
    : (r.tipo === 'contratto' ? (r.contratto?.prezziOfferti ? 'prezzi offerti' : `ribasso ${String(r.contratto?.ribassoPct ?? 0).replace('.', ',')}%`) : r.tipo === 'perizia' ? 'approvata' : 'consegnata')

function nodoRevisione(r: Revisione): NodoAlbero {
  const etichetta = r.tipo === 'computo' ? (r.nome || NOME_FASE[r.fase || 'PFTE'])
    : r.tipo === 'contratto' ? 'Contratto'
    : (r.nome || 'Perizia di variante')
  return {
    apre: { cosa: 'tappa', id: r.id }, etichetta, sigla: sigla(r.numero),
    nota: [r.data, statoRev(r)].filter(Boolean).join(' · '),
    stato: r.stato, documenti: DOC[r.tipo],
  }
}

function nodoAvanzamento(l: Lavoro, a: Avanzamento): NodoAlbero {
  const da = l.revisioni.find((r) => r.id === a.leggeDa)
  const etichetta = a.tipo === 'sal' ? `SAL ${a.n}` : a.tipo === 'salFinale' ? 'SAL finale' : 'CRE'
  return {
    apre: { cosa: 'tappa', id: a.id }, etichetta, sigla: da ? sigla(da.numero) : undefined,
    nota: [a.data, a.stato === 'emesso' ? (a.tipo === 'cre' ? 'approvato' : 'emesso') : 'in bozza'].join(' · '),
    stato: a.stato === 'emesso' ? 'chiusa' : 'aperta', documenti: DOC[a.tipo],
  }
}

/** L'elenco prezzi del lavoro, a tutta pagina: quello dell'ultima revisione (le altre si scelgono dalla pagina). */
function nodoElenco(l: Lavoro): NodoAlbero[] {
  const ult = [...l.revisioni].sort((a, b) => a.ordine - b.ordine).pop()
  if (!ult) return []
  const n = ult.articoli.length
  return [{ apre: { cosa: 'pagina', id: `elenco:${ult.id}` }, etichetta: 'Elenco prezzi del lavoro', sigla: sigla(ult.numero), nota: `${n} articol${n === 1 ? 'o' : 'i'}${ult.stato === 'aperta' ? '' : ' · si consulta'}` }]
}

/** Quanti nuovi prezzi e prezzi da analisi ha l'ultima revisione: ANALISI PREZZI. */
function npDellUltima(l: Lavoro): number {
  const ult = [...l.revisioni].sort((a, b) => a.ordine - b.ordine).pop()
  return ult ? ult.articoli.filter((a) => a.origine === 'np' || a.origine === 'analisi').length : 0
}

/** Sotto «Contratto, tempi e pagamenti»: il termine vigente, o che i lavori sono sospesi. */
function notaTempi(l: Lavoro): string | undefined {
  const t = tempiLavoro(l)
  return t.sospensioneAperta ? 'lavori sospesi' : t.termineVigente ? `termine ${t.termineVigente}` : undefined
}

/** Giornale, verbali, riserve, liste in economia, scadenziario: pagine, con quanto c'è dentro. */
function nodiCantiere(l: Lavoro): NodoAlbero[] {
  const a = attiDi(l)
  const conta = (n: number, uno: string, molti: string): string | undefined => (n ? `${n} ${n === 1 ? uno : molti}` : undefined)
  const aperte = a.riserve.filter((r) => r.esito !== 'definita' && r.esito !== 'rinunciata').length
  return [
    { apre: { cosa: 'pagina', id: 'giornale' }, etichetta: 'Giornale dei lavori', nota: conta(a.giornale.length, 'giorno', 'giorni') },
    { apre: { cosa: 'pagina', id: 'verbali' }, etichetta: 'Verbali e ordini di servizio', nota: conta(verbaliDi(l).length, 'atto', 'atti') },
    { apre: { cosa: 'pagina', id: 'riserve' }, etichetta: 'Riserve', nota: a.riserve.length ? `${a.riserve.length} · ${aperte} apert${aperte === 1 ? 'a' : 'e'}` : undefined },
    { apre: { cosa: 'pagina', id: 'economie' }, etichetta: 'Liste in economia', nota: conta(a.economie.length, 'lista', 'liste') },
    { apre: { cosa: 'pagina', id: 'scadenze' }, etichetta: 'Scadenziario' },
    { apre: { cosa: 'pagina', id: 'registro-atti' }, etichetta: 'Registro degli atti', nota: conta(a.consegne.length, 'atto prodotto', 'atti prodotti') },
  ]
}

/** L'albero intero, nell'ordine in cui il lavoro accade. */
export function alberoLavoro(l: Lavoro): SezioneAlbero[] {
  const tappe = catena(l)
  const computi = tappe.filter((t): t is Revisione & { famiglia: 'revisione' } => t.famiglia === 'revisione' && t.tipo === 'computo')
  const contr = tappe.filter((t): t is Revisione & { famiglia: 'revisione' } => t.famiglia === 'revisione' && t.tipo === 'contratto')
  // in contabilità SAL e perizie stanno insieme, nell'ordine dei fatti
  const conta = tappe.filter((t) => t.famiglia === 'avanzamento' || t.tipo === 'perizia')
  const titolo = l.dati.oggetto ? String(l.dati.oggetto) : 'Dati generali'
  return [
    { id: 'dati', titolo: 'DATI DEL LAVORO', nodi: [
      { apre: { cosa: 'dati' }, etichetta: titolo },
      { apre: { cosa: 'contabilita' }, etichetta: 'Contratto, tempi e pagamenti', nota: notaTempi(l) },
    ] },
    // le analisi del lavoro, una pagina ciascuna; poi i nuovi prezzi della revisione, nel pannello
    { id: 'analisi', titolo: 'ANALISI PREZZI', nodi: [
      ...analisiDi(l).map((a): NodoAlbero => {
        const p = calcolaAnalisi(a).prezzoUnitario
        return { apre: { cosa: 'pagina', id: `analisi:${a.id}` }, etichetta: `${a.codice} ${a.descrizioneBreve}`, nota: `€ ${p.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${a.um ? ` al ${a.um}` : ''}` }
      }),
      ...(npDellUltima(l) ? [{ apre: { cosa: 'analisi' as const }, etichetta: 'Nuovi prezzi della revisione', nota: `${npDellUltima(l)} articol${npDellUltima(l) === 1 ? 'o' : 'i'}` }] : []),
    ] },
    { id: 'prezzi', titolo: 'ELENCO PREZZI', nodi: [...nodoElenco(l), ...l.prezzari.map((p) => ({ apre: { cosa: 'prezzario' as const, id: p.id }, etichetta: p.nome, nota: ((n) => (n && n !== p.nome ? n : undefined))([p.regione, p.anno].filter(Boolean).join(' ')) }))] },
    { id: 'computo', titolo: 'COMPUTO', nodi: computi.map(nodoRevisione) },
    { id: 'contratto', titolo: 'CONTRATTO', nodi: contr.map(nodoRevisione) },
    { id: 'contabilita', titolo: 'CONTABILITÀ', nodi: conta.map((t) => (t.famiglia === 'avanzamento' ? nodoAvanzamento(l, t) : nodoRevisione(t))) },
    // gli atti del cantiere: da quando c'è un contratto
    ...(contr.length ? [{ id: 'cantiere' as const, titolo: 'CANTIERE', nodi: nodiCantiere(l) }] : []),
  ]
}
