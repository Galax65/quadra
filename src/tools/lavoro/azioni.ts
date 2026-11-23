/**
 * LE AZIONI DI UNA TAPPA — il tasto destro (tappa 7 di
 * Docs/07-Un-lavoro-un-modulo.md). Un elenco solo, per tappa e per stato:
 * la pagina lo apre col tasto destro, la sidebar lo riceve con l'albero e
 * rimanda il comando scelto («t:<azione>:<id>») a main.ts, che lo esegue.
 * Modulo PURO: riceve il lavoro, restituisce le azioni.
 */
import { contratto, offertaModificabile, type Lavoro } from '../../shared/lavoro'

export type AzioneTappa = { etichetta: string; comando: string; titolo?: string; pericolo?: boolean } | 'sep'

export const chiaveNodo = (a: { cosa: string; id?: string }): string => a.cosa === 'tappa' ? a.id || '' : a.cosa === 'prezzario' ? `prezzario:${a.id}` : a.cosa === 'pagina' ? `pagina:${a.id}` : a.cosa

export function azioniTappa(L: Lavoro, id: string): AzioneTappa[] {
  const t = (azione: string, etichetta: string, titolo?: string, pericolo?: boolean): AzioneTappa =>
    ({ etichetta, comando: `t:${azione}:${id}`, ...(titolo ? { titolo } : {}), ...(pericolo ? { pericolo } : {}) })
  if (id === 'dati') return [t('apri', '✎ Dati generali…')]
  if (id === 'contabilita') return [t('apri', 'Apri contratto, tempi e pagamenti')]
  if (id === 'analisi') return [t('apri', 'Apri i nuovi prezzi e le analisi')]
  if (id.startsWith('prezzario:')) return [t('apri', "Apri nell'elenco prezzi")]
  if (id.startsWith('pagina:analisi:')) return [t('apri', 'Apri'), t('stampa', "⎙ Stampa l'analisi…")]
  if (id.startsWith('pagina:')) {
    const p = id.slice(7)
    return [
      t('apri', 'Apri'),
      ...(p === 'registro-atti' ? [t('stampa', '⎙ Stampa il registro degli atti…')] : []),
      ...(p === 'giornale' ? [t('stampa', '⎙ Stampa il giornale…')] : p === 'riserve' ? [t('stampa', '⎙ Stampa il prospetto delle riserve…')] : p === 'scadenze' ? [t('stampa', '⎙ Stampa lo scadenziario…')] : []),
    ]
  }
  const r = L.revisioni.find((x) => x.id === id)
  if (r) {
    const aperta = r.stato === 'aperta'
    const c = contratto(L)
    return [
      t('apri', 'Apri'), t('stampa', '⎙ Stampa…'), 'sep',
      ...(r.tipo !== 'contratto' ? [t('struttura', '⌸ Struttura: categorie e WBS…')] : []),
      ...(r.tipo === 'computo' ? [t('qe', '⌸ Quadro economico…'), t('offerte', '⌸ Offerte e gara…'), 'sep' as const] : []),
      ...(r.tipo === 'computo' ? (aperta
        ? [t('voce', '＋ Voce libera…'), t('xpwe', '⇩ Importa un computo XPWE…'), t('varia-prezzi', '％ Varia i prezzi…'), t('prezzi-prezzario', '⟳ Prezzi dal prezzario…'), t('consegna', '✓ Consegna…', 'Chiude la revisione: da qui si legge e non si modifica')]
        : [...(!c ? [t('promuovi', '→ Contratto…', 'Questo computo consegnato diventa contratto'), t('nuova-da', '＋ Nuova revisione da questa…')] : [])]) : []),
      ...(r.tipo === 'contratto' ? [
        ...(offertaModificabile(L) ? [t('ribasso', '% Ribasso…'), ...(r.contratto?.prezziOfferti ? [] : [t('prezzi-unitari', '€ Prezzi unitari…')])] : []),
        ...(!L.avanzamenti.length ? [t('sal', '＋ SAL n. 1…')] : []),
      ] : []),
      ...(r.tipo === 'perizia' ? (aperta
        ? [t('voce', '＋ Nuovo prezzo…'), t('xpwe', '⇩ Importa la perizia XPWE…'), t('ribasso-np', '% Ribasso NP…'), t('consegna', '✓ Approva…', 'La perizia approvata diventa il contratto vigente')]
        : []) : []),
      'sep',
      ...(r.tipo !== 'contratto' ? [t('descrivi', '✎ Numero, fase, nome e data…')] : []),
      ...(!aperta && r.tipo !== 'contratto' ? [t('riapri', '↺ Riapri', 'Torna in lavorazione, se niente ci poggia sopra', true)] : []),
    ]
  }
  const a = L.avanzamenti.find((x) => x.id === id)
  if (a) {
    const bozza = a.stato === 'bozza'
    const ultimo = !L.avanzamenti.some((x) => x.ordine > a.ordine)
    return [
      t('apri', 'Apri'), t('stampa', '⎙ Stampa…'), 'sep',
      ...(bozza ? [
        ...(a.tipo === 'sal' ? [t('xpwe-sal', '⇩ Importa una contabilità XPWE…')] : []),
        ...(a.tipo !== 'cre' ? [t('dati-sal', '✎ Dati del SAL (detrazioni, note)…')] : []),
        ...(a.tipo === 'salFinale' ? [t('confronta', '⇩ XPWE: confronta o prendi le misure…')] : []),
        t('emetti', a.tipo === 'cre' ? '✓ Approva…' : '✓ Emetti…'),
      ] : [
        ...(a.tipo !== 'cre' ? [t('confronta', '⇄ Confronta con un XPWE…')] : []),
        ...(ultimo && a.tipo === 'sal' ? [t('sal', `＋ SAL n. ${a.n + 1}…`), t('sal-finale', '⚑ SAL finale…')] : []),
        ...(ultimo && a.tipo === 'salFinale' ? [t('cre', '＋ CRE…')] : []),
        ...(ultimo ? ['sep' as const, t('riapri', '↺ Riapri', 'Torna in bozza', true)] : []),
      ]),
    ]
  }
  return []
}

