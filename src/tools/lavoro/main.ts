/**
 * LAVORO — lo strumento unico di Docs/07-Un-lavoro-un-modulo.md (tappa 2).
 *
 * Tiene il lavoro (src/shared/lavoro/) e apre ogni tappa nella stessa
 * schermata (schermata.ts). La navigazione è l'albero della sidebar dell'hub:
 * questo strumento gliela pubblica (alberoLavoro) e ne riceve i clic. Tutto il
 * resto — griglia, misure, barra, testata, piede, stampe — viene dai moduli
 * condivisi: qui ci sono solo i comandi.
 *
 * Questa tappa copre le revisioni di COMPUTO: voci, misure, categorie/WBS,
 * consegna in sola lettura, revisioni nuove, numerazione libera, import XPWE,
 * stampe del computo. Contratto e contabilità arrivano nelle tappe 4 e 5.
 */
import { sendToHub, onHubMessage, applySuiteAesthetics, bindThemeShortcut, loadPdfLib, type HubToTool } from '../../shared'
import { loadXLSX } from '../../shared/vendor'
import {
  nuovoLavoro, nuovoComputo, rinumera, descrivi, chiudi, riapri, revisione, numeroProposto, sigla, modificabile, importiRevisione,
  aggiungiArticolo, modificaArticolo, togliArticolo, aggiungiVoce, modificaVoce, eliminaVoce, duplicaVoce, caricaVoci, impostaDati,
  alberoLavoro, quantitaVoce, NOME_FASE, FASI, type Lavoro, type Revisione, type Fase, type Articolo, type Voce,
} from '../../shared/lavoro'
import { paginaRevisione, paginaVuota, paginaAvanzamento, titoloAvanzamento, fmt, misureAVista, type Vista } from './schermata'
import { daXpwe } from './xpwe'
import { paginaContabilita } from './contabilita'
import { vociConsuntivo } from './consuntivo'
import { paginaAnalisi } from './analisi-pagina'
import { paginaQE, paginaOfferte } from './progetto-pagine'
import { paginaStruttura, scelteStruttura } from './struttura-pagina'
import { paginaDati } from './dati-pagina'
import { paginaPrezzario, nuovoStatoPrezzario, BLOCCO } from './prezzario-pagina'
import { paginaElencoPrezzi, nuovoStatoElenco, corrispondeRicerca, type FiltroElenco } from './elenco-prezzi-pagina'
import { leggiLibreria, scriviLibreria, aggiungiALibreria, testoLibreria } from '../../shared/compositore/libreria-personale'
import {
  rinominaCategoria, eliminaCategoria, spostaNelLivello, alberoCategorie, ricodificaWbs, eliminaWbs, prossimoCodiceWbs, modelloDaProgetto, applicaModello, normalizzaModelli,
  CHIAVE_MODELLI, type ModelloStruttura,
} from '../../shared/struttura-computo'
import { nuovaContabilitaLibera, voceNelContrattoLibero, avanzamento } from '../../shared/lavoro'
import { cambiaStruttura, strutturaDi, variaPrezzi, confrontaConPrezzario, applicaPrezzario, rendiNuovoPrezzo } from '../../shared/lavoro'
import { leggiColonnaPrezzi, type Offerta } from '../../shared/offerte'
import { impostaQE, impostaOfferte } from '../../shared/lavoro'
import type { RigaQE } from '../../shared/quadro-economico'
import {
  analisiDi, nuovaAnalisi, modificaAnalisi, duplicaAnalisi, togliAnalisi, aggiungiRigaAnalisi, modificaRigaAnalisi, togliRigaAnalisi,
  applicaAnalisi, tipoDaVoce, type AnalisiPrezzi, type AnalisiRiga,
} from '../../shared/lavoro'
import { aggiornaRigheDaListino } from '../../shared/compositore/analisi-prezzi'
import { analisiPrezziHTML, fascicoloAnalisiHTML } from '../computo/engine/analisi-prezzi-report'
import { paginaGiornale, paginaVerbali, paginaRiserve, paginaEconomie, paginaScadenze, paginaRegistroAtti, prospettoRiserveHTML } from './cantiere'
import {
  aggiungiGiorno, modificaGiorno, togliGiorno, aggiungiAtto, modificaAtto, togliAtto, verbaliDi, aggiungiRiserva, modificaRiserva, togliRiserva,
  aggiungiLista, modificaLista, togliLista, attiDi, type TipoAttoLibero, type EsitoRiserva, type ListaEconomia,
} from '../../shared/lavoro'
import { giornaleHTML, listaEconomiaHTML, scadenze, scadenziarioHTML, vistoFatturaHTML } from '../contabilita/engine'
import { oggiISO } from '../../shared/date-it'
import { azioniTappa, chiaveNodo, type AzioneTappa } from './azioni'
import { contabilitaMotore } from './motore-contabilita'
import {
  librettoPdf, registroPdf, sommarioPdf, statoFinalePdf, quadroComparativoPdf,
  salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML, attoSottomissioneHTML, verbaleHTML, elencoNuoviPrezziHTML,
} from '../contabilita/engine'
import { periziaHTML } from '../contabilita/engine/perizia-atto'
import { enteDi, kickerDi, headMetaDi, footerFieldsDi } from '../contabilita/engine/doc-common'
import { renderDocPage } from '../../shared/doc/doc'
import {
  librettoHTML, registroHTML, sommarioHTML, quadroComparativoHTML, partiteVigenti, registroInBiancoPdf, improntaSal, improntaTesto, verificaSal, registroAttiHTML,
  type Verifica,
} from '../contabilita/engine'
import { fondiAtti, esportaEditabile } from '../../shared/doc/fascicolo'
import {
  situazioneContabilePdf, confrontoProgettoEseguitoPdf, frontespizioHTML, salAOA, registroAOA, sommarioAOA, pacchettoAperto, calcolaSal as calcolaSalMotore,
} from '../contabilita/engine'
import { consuntivoHTML } from '../contabilita/engine/consuntivo'
import { penale, penaleHTML } from '../contabilita/engine/penali'
import { tempi as tempiMotore } from '../contabilita/engine/tempi'
import { statoSvincolo, svincoloHTML } from '../contabilita/engine/svincolo'
import { corpiConSottoComputo, librettoSottoComputiHTML } from '../contabilita/engine/sotto-computo'
import { datiContrattoHTML } from '../contabilita/engine/dati-contratto'
import { registraConsegna, firmaAvanzamento } from '../../shared/lavoro'
import { loadJSZip } from '../../shared/vendor'
import { applicaStileStampa } from '../../shared/doc/stile-stampa'
import { marcaBozza } from '../../shared/doc/doc'
import { pannelloPrezziHtml, nuovoPannello, filtraPrezzario, type SchedaPrezzi } from './prezzi'
import { prezzariDisponibili, caricaPrezzario, cercaNelPrezzario } from '../../shared/prezzari/carica'
import { salvaPrezzario, ultimoPrezzario, ricordaUltimo, fileArchivio, aggiornaRighePrezzario, togliPrezzario } from '../../shared/prezzari/archivio'
import type { PriceRow } from '../computo/engine/types'
import { leggiPrezzarioFile, type LibXlsx } from '../../shared/prezzari/leggi-file'
import { parseProgettoQuadra } from '../../shared/progetto-quadra'
import {
  registraPrezzario, voceDaArticolo, promuoviAContratto, impostaRibasso, nuovoSal, emetti, riapriAvanzamento, modificaRigaAvanzamento,
  nuovaPerizia, nuovoSalFinale, nuovoCre, importiPerizia, contoFinale, importaMisureSal, proponiGruppi, importaPerizia, confrontaConXpwe, statoFinaleDaXpwe, impostaPrezziUnitari, impostaPrezzoOfferto, impostaRibassoNp, ribassoRisultante, type MisuraDatata,
  impostaContabilita, datiContabilita, aggiungiFattura, modificaFattura, togliFattura, aggiungiSospensione, modificaSospensione, togliSospensione, aggiungiProroga, modificaProroga, togliProroga, type DatiContabilita,
  rigaDi, contratto, vigente, importiContratto, vociEccedenti, datiAvanzamento, impostaSottoComputo, eseguitoSotto, spostaVoce, type Avanzamento, type RigaAvanzamento,
} from '../../shared/lavoro'
import type { MisurazioneRiga } from '../../shared/compositore/misurazioni'
import { impostaCampo, testoAMisure, misureATesto, copiaRighe, spostaRiga, type Fattore } from '../../shared/compositore/misure-edit'
import { leggiNumeroTesto } from '../../shared/campo-numero'
import { leggiCampo } from '../../shared/compositore/misure-edit'
import { openModal } from '../../shared/ui/components/modal'
import { apriMenuContestuale, type RigaMenu, type VoceMenu } from '../../shared/ui/components/menu'
import { CAMPI_DATI_GENERALI, normalizzaDatiGenerali } from '../../shared/dati-generali'
import { parseXpwe, xpweToVoci, type VoceComputo } from '../../shared/xpwe/xpwe'
import { impostaStudioStampe, impostaStileStampaPdf } from '../../shared/stampa/registro-pdf'
import { leggiPreferenzeStampa } from '../../shared/stampe/preferenze'
import { computoPdf } from '../../shared/stampa/computo-pdf'
import {
  elencoPrezziPdf, stimaLavoriPdf, incidenzaManodoperaPdf, incidenzaSicurezzaPdf, verbaleNuoviPrezziPdf, listaLavorazioniPdf, quadroEconomicoPdf, quadroComparativoOffertePdf,
} from '../../shared/stampa/progetto-pdf'
import { calcolaQE, normalizzaQE } from '../../shared/quadro-economico'
import { salvaFile } from '../../shared/ui/scarica'
import { buildXpwe } from '../../shared/xpwe/xpwe'
import { computoMetricoAOA } from '../computo/engine/computo-excel'
import { analisiPrezziAOA, fascicoloIndiceAOA, fascicoloSheetName, fascicoloFileName } from '../computo/engine/analisi-prezzi-excel'
import { anteprimaPdf, anteprimaHTML } from '../../shared/ui/anteprima-pdf'

/* ── Stato ────────────────────────────────────────────────────────────── */

let L: Lavoro = nuovoLavoro()
/** La tappa aperta (id di una revisione o di un avanzamento), o null. */
let corrente: string | null = null
const vista: Vista = { q: '', ordine: 'manuale', aperte: new Set(), chiuse: new Set() }
/** Mette a vista le misure di una voce, nel foglio e con «solo voci». */
function apriMisure(id: string): void { vista.aperte.add(id); vista.chiuse?.delete(id) }
/** Il pannello prezzi a destra: anche lui stato della vista, non del lavoro. */
const pz = nuovoPannello()

const $ = (id: string): HTMLElement | null => document.getElementById(id)
const oggi = (): string => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

let _toastT: number | undefined
function toast(msg: string, ms = 3200): void {
  const el = $('lv-toast'); if (!el) return
  el.textContent = msg; el.hidden = false
  clearTimeout(_toastT); _toastT = window.setTimeout(() => { el.hidden = true }, ms)
}

/** La revisione aperta adesso (null se è aperto un avanzamento, o niente). */
function rev(): Revisione | null {
  return corrente ? L.revisioni.find((r) => r.id === corrente) ?? null : null
}

/** L'avanzamento aperto adesso (SAL, SAL finale, CRE), o null. */
function av(): Avanzamento | null {
  return corrente ? L.avanzamenti.find((a) => a.id === corrente) ?? null : null
}
/** La revisione da cui legge l'avanzamento aperto (il contratto, o la perizia). */
function revDiAv(a: Avanzamento): Revisione { return revisione(L, a.leggeDa) }

/** Ogni modifica passa di qui: o riesce e si ridisegna, o si dice perché no. */
function aggiorna(f: (l: Lavoro) => Lavoro, messaggio?: string): boolean {
  try {
    L = f(L)
    // si è lasciato un campo (Tab, clic altrove): si ridisegna DOPO che il fuoco
    // è arrivato dove va, così si ritrova quel campo e si continua a scrivere
    if (window.event?.type === 'change' && !_fuocoDopo) { _ridisegnoInAttesa = true; setTimeout(() => { if (_ridisegnoInAttesa) { _ridisegnoInAttesa = false; render() } }, 0); pubblica() }
    else { render(); pubblica() }
    if (messaggio) toast(messaggio)
    return true
  } catch (e) {
    toast((e as Error).message || String(e))
    return false
  }
}

/* ── Disegno ──────────────────────────────────────────────────────────── */

/** Il campo col fuoco, per ritrovarlo dopo il ridisegno (le misure si scrivono di fila). */
let _fuocoDopo: string | null = null
let _ridisegnoInAttesa = false
function chiaveFuoco(el: Element | null): string | null {
  if (!el || !(el instanceof HTMLElement)) return null
  if (el.id === 'lv-pz-q') return 'id|lv-pz-q'
  if (el.id === 'lv-el-q') return 'id|lv-el-q'
  if (el.id === 'lv-pp-q') return 'id|lv-pp-q'
  const mis = el.getAttribute('data-mis-input')
  const voce = el.closest('[data-voce]')?.getAttribute('data-voce')
  if (mis && voce) return `mis|${voce}|${mis}`
  const td = el.closest('td[id]')
  return td ? `td|${td.id}` : null
}
function ritrovaFuoco(k: string | null): void {
  if (!k) return
  const [tipo, a, b] = k.split('|')
  if (tipo === 'id') {
    const inp = document.getElementById(a)
    if (inp instanceof HTMLInputElement) { inp.focus(); const n = inp.value.length; inp.setSelectionRange(n, n) }
    return
  }
  const el = tipo === 'mis'
    ? document.querySelector(`[data-voce="${CSS.escape(a)}"] [data-mis-input="${CSS.escape(b)}"]`)
    : document.querySelector(`#${CSS.escape(a)} input`)
  if (el instanceof HTMLInputElement) { el.focus(); el.select?.() }
}

function render(): void {
  _ridisegnoInAttesa = false
  const host = $('lv-app'); if (!host) return
  const fuoco = _fuocoDopo ?? chiaveFuoco(document.activeElement)
  _fuocoDopo = null
  const scroll = $('lv-body')?.scrollTop ?? 0
  const scrollPz = $('lv-pz-body')?.scrollTop ?? 0
  vista.prezziAperti = pz.aperto
  const r = rev(), a = av()
  // il colore dice la FASE: progetto verde, contratto e contabilità porpora
  document.documentElement.setAttribute('data-tool', a || (r && r.tipo !== 'computo') ? 'contabilita' : 'computo')
  const pagina = corrente === PAGINA_CONTABILITA ? paginaContabilita(L, oggi())
    : corrente === '§dati' ? paginaDati(L)
    : corrente?.startsWith('§prezzario') ? paginaPrezzario(_pp, { prezzari: pz.prezzari, destinazione: destinazionePrezzario() })
    : corrente?.startsWith('§analisi:') && apAperta() ? paginaAnalisi(L, apAperta()!, revAperta())
    : corrente?.startsWith('§struttura:') && revDaPagina() ? paginaStruttura(revDaPagina()!, modelliStruttura())
    : corrente?.startsWith('§elenco:') && revDaPagina() ? paginaElencoPrezzi(L, revDaPagina()!, _el)
    : corrente?.startsWith('§qe:') && revDaPagina() ? paginaQE(revDaPagina()!)
    : corrente?.startsWith('§offerte:') && revDaPagina() ? paginaOfferte(L, revDaPagina()!, vociPerStampa(revDaPagina()!))
    : corrente === '§giornale' ? paginaGiornale(L)
    : corrente === '§verbali' ? paginaVerbali(L)
    : corrente === '§riserve' ? paginaRiserve(L, oggiISO())
    : corrente === '§economie' ? paginaEconomie(L)
    : corrente === '§scadenze' ? paginaScadenze(L, contabilitaMotore(L), oggiISO())
    : corrente === '§registro-atti' ? paginaRegistroAtti(L, _verifiche)
    : a ? paginaAvanzamento(L, a, vista) : r ? paginaRevisione(L, r, vista) : paginaVuota(L)
  // nel SAL l'elenco prezzi è quello del contratto: si consulta, e «＋» porta la voce nel libretto
  host.innerHTML = pagina + (a ? pannelloPrezziHtml(revDiAv(a), pz, { scrive: a.stato === 'bozza' && a.tipo !== 'cre', inSal: true, libero: !!contratto(L)?.contratto?.libero })
    : apAperta() ? pannelloPrezziHtml(revAperta(), pz, { perAnalisi: true })
    : pannelloPrezziHtml(r, pz))
  const body = $('lv-body'); if (body) body.scrollTop = scroll
  const bpz = $('lv-pz-body'); if (bpz) bpz.scrollTop = scrollPz
  ritrovaFuoco(fuoco)
}

/* ── L'albero della sidebar: lo pubblica chi tiene il lavoro ──────────── */

function pubblica(): void {
  sendToHub({ type: 'app:project-update', appId: 'lavoro', project: {
    // ogni nodo porta il suo menu del tasto destro: le stesse azioni della pagina
    sezioni: alberoLavoro(L).map((sez) => ({ ...sez, nodi: sez.nodi.map((n) => ({ ...n, menu: azioniTappa(L, chiaveNodo(n.apre)) })) })),
    azioniSezioni: [
      // dopo il contratto un computo nuovo è una perizia: le azioni del computo non si propongono più
      ...(contratto(L) ? [] : [
        { sezione: 'computo', etichetta: '＋ Nuovo computo…', comando: 'nuovo-computo', titolo: 'Una revisione di computo, in una fase qualunque' },
        { sezione: 'computo', etichetta: '⇩ Importa un computo XPWE…', comando: 'importa-xpwe', titolo: 'Da un altro programma che esporta il formato XPWE' },
      ]),
      { sezione: 'prezzi', etichetta: '≣ Prezzari del programma…', comando: 'carica-prezzario', titolo: 'I prezzari regionali e i listini, a tutta pagina: si consultano, si importano, e quelli dell\'archivio si modificano' },
      { sezione: 'analisi', etichetta: '＋ Nuova analisi…', comando: 'nuova-analisi', titolo: "Un prezzo composto: manodopera, materiali, noli, spese generali e utile" },
      { sezione: 'analisi', etichetta: '★ Dalla libreria…', comando: 'libreria', titolo: 'Voci e analisi salvate su questo dispositivo' },
      ...(contratto(L) ? [{ sezione: 'contabilita', etichetta: '⭳ Contabilità in formato aperto…', comando: 'formato-aperto', titolo: 'Uno zip con JSON, CSV e un leggimi: leggibile anche senza Quadra' }] : []),
      ...(analisiDi(L).length ? [{ sezione: 'analisi', etichetta: '⎙ Fascicolo delle analisi…', comando: 'fascicolo-analisi', titolo: 'Tutte le analisi del lavoro, con l\'indice' }] : []),
      ...azioniContabili(),
    ],
    corrente,
    dati: L.dati,
    ts: Date.now(),
  } } as never)
}

/* ── Le azioni di una tappa: il tasto destro, nella pagina e nella sidebar ──
   Un elenco solo, fatto qui: la pagina lo apre col tasto destro, la sidebar lo
   riceve con l'albero e rimanda il comando scelto («t:<azione>:<id>»). */

/** Esegue un'azione di tappa: apre la tappa, poi fa la cosa. */
function eseguiAzioneTappa(comando: string): void {
  const [, azione, ...resto] = comando.split(':')
  const id = resto.join(':')
  if (!azione || !id) return
  if (id.startsWith('pagina:')) { apri(id); if (azione === 'stampa') void stampaPagina(id.slice(7)); return }
  if (id === 'dati' || id === 'contabilita' || id === 'analisi' || id.startsWith('prezzario:')) { apri(id); return }
  if (corrente !== id) apri(id)
  const fa: Record<string, () => unknown> = {
    apri: () => undefined, stampa: lvStampa, consegna: lvConsegna, voce: lvVoceLibera, xpwe: lvImportaXpwe,
    promuovi: lvPromuovi, 'nuova-da': lvNuovaDaQuesta, riapri: lvRiapri, descrivi: lvDescrivi,
    ribasso: lvRibasso, 'prezzi-unitari': lvPrezziUnitari, sal: lvNuovoSal, 'ribasso-np': lvRibassoNp,
    'varia-prezzi': lvVariaPrezzi, 'prezzi-prezzario': lvPrezziDaPrezzario,
    qe: () => apri(`pagina:qe:${id}`), offerte: () => apri(`pagina:offerte:${id}`), struttura: () => apri(`pagina:struttura:${id}`), elenco: () => apri(`pagina:elenco:${id}`),
    emetti: lvEmetti, 'xpwe-sal': lvImportaXpweSal, 'dati-sal': lvDatiSal, confronta: lvConfrontaXpwe, 'sal-finale': lvSalFinale, cre: lvCre,
  }
  void fa[azione]?.()
}

/** Il menu di una tappa nella pagina (tasto destro sulla testata o su un punto vuoto). */
function menuDaAzioni(x: number, y: number, azioni: AzioneTappa[], titolo?: string): void {
  apriMenuContestuale(x, y, azioni.map((v): RigaMenu => (v === 'sep' ? 'sep' : { etichetta: v.etichetta, titolo: v.titolo, pericolo: v.pericolo, azione: () => eseguiAzioneTappa(v.comando) })), { titolo })
}

/** Le azioni che fanno crescere il lavoro dopo il progetto: dove si può, quando si può. */
function azioniContabili(): { sezione: string; etichetta: string; comando: string; titolo?: string }[] {
  const out: { sezione: string; etichetta: string; comando: string; titolo?: string }[] = []
  const c = contratto(L)
  if (!c) {
    out.push({ sezione: 'contabilita', etichetta: '＋ Contabilità senza computo…', comando: 'contabilita-libera', titolo: 'Lavoro privato o senza computo: si misura quello che si fa, l\'elenco prezzi cresce dal SAL' })
    out.push({ sezione: 'contabilita', etichetta: '⇩ Contabilità da un file XPWE…', comando: 'contabilita-xpwe', titolo: 'Il contratto dall\'elenco della contabilità, i SAL dalle misure datate' })
  }
  if (!c && L.revisioni.some((r) => r.tipo === 'computo' && r.stato === 'chiusa')) {
    out.push({ sezione: 'contratto', etichetta: '→ Contratto da un computo consegnato…', comando: 'promuovi', titolo: 'Il computo consegnato diventa contratto, con il ribasso d\'asta' })
  }
  if (vigente(L)) {
    const ult = [...L.avanzamenti].sort((x, y) => x.ordine - y.ordine).pop()
    const finale = L.avanzamenti.some((a) => a.tipo !== 'sal')
    if (!ult || (ult.tipo === 'sal' && ult.stato === 'emesso')) {
      out.push({ sezione: 'contabilita', etichetta: `＋ SAL n. ${(ult?.n ?? 0) + 1}…`, comando: 'nuovo-sal', titolo: 'Un nuovo stato di avanzamento: si misura l\'eseguito nella stessa griglia' })
      if (ult) out.push({ sezione: 'contabilita', etichetta: '⚑ SAL finale…', comando: 'sal-finale', titolo: 'Lo stato finale dei lavori: dopo viene il CRE' })
    }
    if (!finale && !L.revisioni.some((r) => r.tipo === 'perizia' && r.stato === 'aperta')) {
      out.push({ sezione: 'contabilita', etichetta: '＋ Perizia di variante…', comando: 'perizia', titolo: 'Una revisione nuova del contratto: quantità variate e nuovi prezzi' })
    }
    if (!finale) {
      out.push({ sezione: 'contabilita', etichetta: '⇩ Importa una perizia XPWE…', comando: 'importa-xpwe-perizia', titolo: 'La variante preparata con un altro programma: nella perizia in bozza, o in una nuova' })
    }
    if (importSalPossibile()) {
      out.push({ sezione: 'contabilita', etichetta: '⇩ Importa una contabilità XPWE…', comando: 'importa-xpwe-sal', titolo: 'Le misure datate di una contabilità XPWE: diventano i SAL, abbinate alle voci del contratto' })
    }
    const fin = L.avanzamenti.find((a) => a.tipo === 'salFinale')
    if (fin && fin.stato === 'emesso' && !L.avanzamenti.some((a) => a.tipo === 'cre')) {
      out.push({ sezione: 'contabilita', etichetta: '＋ CRE…', comando: 'cre', titolo: 'Il certificato di regolare esecuzione' })
    }
  }
  return out
}

/** Apre una tappa nella schermata (dalla sidebar, o dopo averla creata). */
/** L'analisi aperta adesso, se la pagina è un'analisi. */
function apAperta(): AnalisiPrezzi | null {
  if (!corrente?.startsWith('§analisi:')) return null
  const id = corrente.slice('§analisi:'.length)
  return analisiDi(L).find((a) => a.id === id) ?? null
}
/** La revisione di una pagina di progetto (quadro economico, offerte). */
function revDaPagina(): Revisione | null {
  const m = /^§(?:qe|offerte|struttura|elenco):(.+)$/.exec(corrente || '')
  return m ? L.revisioni.find((r) => r.id === m[1]) ?? null : null
}
/** La revisione dove si scrive adesso: il computo in lavorazione o la perizia in bozza (l'ultima). */
function revAperta(): Revisione | null {
  return [...L.revisioni].filter((r) => r.stato === 'aperta' && r.tipo !== 'contratto').sort((x, y) => x.ordine - y.ordine).pop() ?? null
}

/** La pagina dei dati della contabilità: non è una tappa, ma si apre nello stesso posto. */
const PAGINA_CONTABILITA = '§contabilita'

function apri(id: string | null): void {
  if (id === 'dati') { corrente = '§dati'; pz.aperto = false; render(); pubblica(); return }
  if (id === 'contabilita') { corrente = PAGINA_CONTABILITA; pz.aperto = false; render(); pubblica(); return }
  if (id && id.startsWith('pagina:')) {
    corrente = `§${id.slice(7)}`; pz.aperto = false; render(); pubblica()
    if (id === 'pagina:registro-atti') void verificaImpronte().then(() => { if (corrente === '§registro-atti') render() })
    return
  }
  if (id === 'analisi') { pz.aperto = true; pz.scheda = 'progetto'; pz.soloNp = true; render(); return }
  if (id && id.startsWith('prezzario:')) { void lvPpScegli(id.slice(10)); return }
  const esiste = !!id && (L.revisioni.some((r) => r.id === id) || L.avanzamenti.some((a) => a.id === id))
  if (id && !esiste) return
  corrente = esiste ? id : null
  vista.aperte.clear(); vista.chiuse?.clear()
  render(); pubblica()
}

/* ── Finestre ─────────────────────────────────────────────────────────── */

/** Un modulo nella finestra condivisa: campi in HTML, risolve coi valori o null. */
async function finestra(titolo: string, campiHtml: string, conferma = 'Conferma'): Promise<Record<string, string> | null> {
  const body = document.createElement('div')
  body.className = 'lv-form'
  body.innerHTML = campiHtml
  const esito = await openModal({ title: titolo, body, actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: conferma, variant: 'accent', value: true }] })
  if (esito !== true) return null
  const out: Record<string, string> = {}
  body.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]').forEach((el) => {
    out[el.name] = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value
  })
  return out
}
const campo = (nome: string, etichetta: string, valore: string | number = '', extra = ''): string =>
  `<label class="lv-f"><span>${esc(etichetta)}</span><input name="${nome}" value="${esc(valore)}" ${extra}></label>`
const scelta = (nome: string, etichetta: string, voci: [string, string][], val = ''): string =>
  `<label class="lv-f"><span>${esc(etichetta)}</span><select name="${nome}">${voci.map(([v, t]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`
const spunta = (nome: string, etichetta: string, on: boolean): string =>
  `<label class="lv-f lv-f--spunta"><input type="checkbox" name="${nome}"${on ? ' checked' : ''}><span>${esc(etichetta)}</span></label>`

const opzFasi = (): [string, string][] => FASI.map((f) => [f, NOME_FASE[f]])

/* ── Comandi: le revisioni ────────────────────────────────────────────── */

async function lvNuovoComputo(da?: string): Promise<string | null> {
  const computi = L.revisioni.filter((r) => r.tipo === 'computo').sort((a, b) => a.ordine - b.ordine)
  const src = da ? revisione(L, da) : computi[computi.length - 1]
  const v = await finestra('Nuova revisione di computo', `
    <p class="lv-nota">Una revisione di computo, in una fase qualunque. Il numero è proposto in ordine, ma si può cambiare (anche saltando: le revisioni del progetto che non toccano il computo non ne prendono uno).</p>
    <div class="lv-righe">
      ${scelta('fase', 'Fase', opzFasi(), src?.fase || 'PFTE')}
      ${campo('numero', 'Revisione n.', numeroProposto(L), 'inputmode="numeric" style="width:80px"')}
      ${campo('data', 'Data', oggi(), 'placeholder="gg/mm/aaaa"')}
    </div>
    ${campo('nome', 'Nome (facoltativo)', '', 'placeholder="es. Esecutivo dopo la conferenza dei servizi"')}
    ${scelta('da', 'Parti da', [['', 'un computo vuoto'], ...computi.map((r): [string, string] => [r.id, `${sigla(r.numero)} ${r.nome || NOME_FASE[r.fase || 'PFTE']} (${r.voci.length} voci)`])], src?.id || '')}
  `, 'Crea')
  if (!v) return null
  let id: string | null = null
  aggiorna((l) => {
    const r = nuovoComputo(l, { fase: v.fase as Fase, numero: Number(v.numero), data: v.data || oggi(), ...(v.da ? { da: v.da } : {}), ...(v.nome.trim() ? { nome: v.nome.trim() } : {}) })
    id = r.id
    return r.lavoro
  })
  if (id) apri(id)
  return id
}
function lvNuovaDaQuesta(): void { const r = rev(); if (r) void lvNuovoComputo(r.id) }

async function lvDescrivi(): Promise<void> {
  const r = rev(); if (!r) return
  const v = await finestra(`${sigla(r.numero)} — numero, fase, nome e data`, `
    <div class="lv-righe">
      ${campo('numero', 'Revisione n.', r.numero, 'inputmode="numeric" style="width:80px"')}
      ${r.tipo === 'computo' ? scelta('fase', 'Fase', opzFasi(), r.fase) : ''}
      ${campo('data', 'Data', r.data)}
    </div>
    ${campo('nome', 'Nome', r.nome || '')}
    <p class="lv-nota">Si correggono anche a revisione consegnata: non cambiano il contenuto.</p>
  `, 'Salva')
  if (!v) return
  aggiorna((l) => {
    let x = Number(v.numero) !== r.numero ? rinumera(l, r.id, Number(v.numero)) : l
    x = descrivi(x, r.id, { ...(v.fase ? { fase: v.fase as Fase } : {}), nome: v.nome.trim() || undefined, data: v.data || r.data })
    return x
  })
}

async function lvConsegna(): Promise<void> {
  const r = rev(); if (!r) return
  if (r.tipo === 'perizia') {
    const i = importiPerizia(L, r.id)
    const v = await finestra(`Approvazione della perizia ${sigla(r.numero)}`, `
      <p class="lv-nota">La perizia si <b>chiude</b> e diventa il contratto vigente: i SAL successivi ne portano prezzi e numero. Contratto vigente € ${fmt(i.lordo.prima)} → con la perizia <b>€ ${fmt(i.lordo.dopo)}</b> (${i.lordo.differenza >= 0 ? '+' : '−'} € ${fmt(Math.abs(i.lordo.differenza))})${i.ribassoPct ? `; al netto del ribasso ${fmt(i.ribassoPct, 4)}%: € ${fmt(i.prima)} → € ${fmt(i.dopo)}` : ''}.</p>
      ${i.oltreQuinto ? `<p class="lv-nota"><b>Oltre il quinto d'obbligo</b> sul contratto originario (${fmt(i.variazionePct ?? 0)}%): serve l'atto di sottomissione dell'impresa.</p>` : ''}
      ${campo('data', 'Data di approvazione', oggi())}`, 'Approva')
    if (!v) return
    aggiorna((l) => chiudi(l, r.id, v.data || oggi()), `Perizia ${sigla(r.numero)} approvata: i SAL successivi ne portano i prezzi`)
    return
  }
  const contr = r.tipo === 'contratto'
  const ic = contr ? importiContratto(r) : null
  const v = await finestra(contr ? `Contratto ${sigla(r.numero)} in vigore` : `Consegna ${sigla(r.numero)}`, contr ? `
    <p class="lv-nota">Il contratto entra <b>in vigore</b>: da qui si apre il SAL. Importo contrattuale <b>€ ${fmt(ic!.contrattuale)}</b> (base d'asta € ${fmt(ic!.baseAsta)}${ic!.ribassoPct != null ? `, ribasso ${fmt(ic!.ribassoPct, 4)}%` : ''}, sicurezza € ${fmt(ic!.sicurezza)}).</p>
    ${campo('data', 'Data', oggi())}` : `
    <p class="lv-nota">La revisione si <b>chiude</b>: da qui si legge e si stampa, non si modifica più. Per cambiarla si fa una revisione nuova; si può anche riaprire, finché niente ci poggia sopra (un contratto stipulato, per esempio).</p>
    ${campo('data', 'Data di consegna', oggi())}
  `, contr ? 'In vigore' : 'Consegna')
  if (!v) return
  aggiorna((l) => chiudi(l, r.id, v.data || oggi()), contr ? `Contratto ${sigla(r.numero)} in vigore: ora si apre il SAL n. 1` : `${sigla(r.numero)} consegnata: ora è in sola lettura`)
}

async function lvRiapri(): Promise<void> {
  const a = av()
  if (a) {
    const ok = await openModal({ title: `Riaprire il ${titoloAvanzamento(a)}?`, message: 'Torna in bozza e le misure si possono cambiare. Se è già stato firmato o pagato, la correzione va fatta nel SAL successivo.', actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Riapri', variant: 'accent', value: true }] })
    if (ok === true) aggiorna((l) => riapriAvanzamento(l, a.id), `${titoloAvanzamento(a)} di nuovo in bozza`)
    return
  }
  const r = rev(); if (!r) return
  const ok = await openModal({ title: `Riaprire ${sigla(r.numero)}?`, message: 'Torna in lavorazione e si può modificare. Se la revisione è già stata consegnata a qualcuno, meglio farne una nuova.', actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Riapri', variant: 'accent', value: true }] })
  if (ok === true) aggiorna((l) => riapri(l, r.id), `${sigla(r.numero)} di nuovo in lavorazione`)
}

/* ── I dati della contabilità ─────────────────────────────────────────── */

const DATE_CT = new Set(['dataStipula', 'dataConsegna', 'dataUltimazione'])
const NUMERI_CT = new Set(['giorniUtili', 'anticipazionePct', 'penalePerMille', 'ivaPct', 'importoMinimoSal', 'arrotondamentoCertificato'])
const SPUNTE_CT = new Set(['durcRegolare', 'semplificata'])
const dataValida = (t: string): boolean => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)

/** Un campo della pagina: date gg/mm/aaaa, numeri con la virgola, testo. Vuoto lo toglie. */
function lvCt(chiave: string, testo: string): void {
  const t = String(testo).trim()
  let v: unknown = t || undefined
  if (t && (DATE_CT.has(chiave) || chiave === 'durcData') && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  if (SPUNTE_CT.has(chiave)) v = !!t || undefined
  if (NUMERI_CT.has(chiave)) {
    const n = t ? leggiNumeroTesto(t) : null
    if (n != null && !Number.isFinite(n)) { toast('Numero non valido'); render(); return }
    v = n ?? undefined
  }
  aggiorna((l) => impostaContabilita(l, { [chiave]: v } as Partial<DatiContabilita>))
}
function lvCtCF(chiave: string, testo: string): void {
  const t = String(testo).trim()
  if (t && chiave.startsWith('data') && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  let v: unknown = t || undefined
  if (chiave === 'giorniTermine') { const n = t ? Math.round(Number(t)) : null; if (n != null && !(n > 0 && n <= 30)) { toast('Il termine va da 1 a 30 giorni'); render(); return } v = n ?? undefined }
  aggiorna((l) => impostaContabilita(l, { contoFinale: { ...(datiContabilita(l).contoFinale || {}), [chiave]: v } }))
}
/* L'accordo quadro */
type AQ = NonNullable<ReturnType<typeof datiContabilita>['accordoQuadro']>
const aqDi = (): AQ => JSON.parse(JSON.stringify(datiContabilita(L).accordoQuadro || { importoMassimo: null, applicativi: [] }))
function lvAq(si: boolean): void { aggiorna((l) => impostaContabilita(l, { accordoQuadro: si ? aqDi() : undefined })) }
function lvAqMax(testo: string): void {
  const t = String(testo).trim(); const n = t ? leggiNumeroTesto(t) : null
  if (n != null && !Number.isFinite(n)) { toast('Importo non valido'); render(); return }
  aggiorna((l) => impostaContabilita(l, { accordoQuadro: { ...aqDi(), importoMassimo: n } }))
}
function lvAqNuovo(): void { const aq = aqDi(); aq.applicativi.push({ numero: aq.applicativi.reduce((m, x) => Math.max(m, x.numero), 0) + 1, data: oggi(), importo: 0 }); aggiorna((l) => impostaContabilita(l, { accordoQuadro: aq })) }
function lvAqApp(i: number, k: string, testo: string): void {
  const aq = aqDi(); const x = aq.applicativi[i]; if (!x) return
  const t = String(testo).trim()
  if (k === 'importo') { const n = leggiNumeroTesto(t || '0'); if (n == null || !Number.isFinite(n)) { toast('Importo non valido'); render(); return } x.importo = n }
  else if (k === 'data' && t && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  else (x as unknown as Record<string, string>)[k] = t
  aggiorna((l) => impostaContabilita(l, { accordoQuadro: aq }))
}
function lvAqTogli(i: number): void { const aq = aqDi(); aq.applicativi.splice(i, 1); aggiorna((l) => impostaContabilita(l, { accordoQuadro: aq })) }

function lvFattNuova(): void { aggiorna((l) => aggiungiFattura(l, { data: oggi() })) }
function lvFatt(id: string, k: string, testo: string): void {
  const t = String(testo).trim()
  if ((k === 'data' || k === 'vistoData') && t && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  let v: unknown = t || undefined
  if (k === 'importo') { const n = t ? leggiNumeroTesto(t) : null; if (n != null && !Number.isFinite(n)) { toast('Importo non valido'); render(); return } v = n ?? undefined }
  aggiorna((l) => modificaFattura(l, id, { [k]: v }))
}
function lvFattTogli(id: string): void { aggiorna((l) => togliFattura(l, id)) }
function lvFattStampa(id: string): void {
  const m = motoreOAvviso(); if (!m) return
  const f = (datiContabilita(L).fatture || []).find((x) => x.id === id); if (!f) return
  stampaHtml(`Visto sulla fattura ${f.numero || ''}`.trim(), vistoFatturaHTML(m.appalto, f, m.partite, m.sals, datiContabilita(L).fatture, m.liste))
}
function lvSospNuova(): void { aggiorna((l) => aggiungiSospensione(l, { dal: oggi() })) }
function lvSosp(id: string, campo: string, testo: string): void {
  const t = String(testo).trim()
  if ((campo === 'dal' || (campo === 'al' && t)) && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  aggiorna((l) => modificaSospensione(l, id, { [campo]: t || undefined }))
}
function lvSospTogli(id: string): void { aggiorna((l) => togliSospensione(l, id)) }
function lvProrogaNuova(): void { aggiorna((l) => aggiungiProroga(l, { data: oggi(), giorni: 0 })) }
function lvProroga(id: string, campo: string, testo: string): void {
  const t = String(testo).trim()
  if (campo === 'giorni') {
    const n = Math.round(Number(t.replace(',', '.')) || 0)
    aggiorna((l) => modificaProroga(l, id, { giorni: Math.max(0, n) })); return
  }
  if (campo === 'data' && t && !dataValida(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  aggiorna((l) => modificaProroga(l, id, { [campo]: t || undefined }))
}
function lvProrogaTogli(id: string): void { aggiorna((l) => togliProroga(l, id)) }

/* ── Registro in bianco e registro degli atti ─────────────────────────── */

async function stampaRegistroBianco(): Promise<void> {
  const m = contabilitaMotore(L); if (!m) { toast('Il registro si prepara dal contratto in poi'); return }
  const v = await finestra('Registro di contabilità in bianco', `
    <p class="lv-nota">I fogli numerati e vuoti del registro, da bollare e vidimare prima dell'inizio dei lavori.</p>
    ${campo('fogli', 'Fogli', 50, 'inputmode="numeric" style="width:100px"')}`, 'Anteprima')
  if (!v) return
  await loadPdfLib()
  const out = await registroInBiancoPdf((window as unknown as { PDFLib: unknown }).PDFLib, m.appalto, Number(v.fogli) || 50)
  anteprimaPdf(out.bytes, { titolo: 'Registro di contabilità in bianco', nomeFile: 'registro-in-bianco', nota: `${out.pagine} pagine` })
}

/** Le verifiche delle impronte dei SAL firmati: si calcolano aprendo la pagina. */
let _verifiche: Verifica[] = []
async function verificaImpronte(): Promise<void> {
  const m = contabilitaMotore(L); if (!m) { _verifiche = []; return }
  _verifiche = await Promise.all(m.sals.filter((s) => s.firmato).map((s) => verificaSal(m.appalto, m.partite, m.sals, s.numero, m.liste)))
}
function lvRegistroAttiStampa(): void {
  const m = motoreOAvviso(); if (!m) return
  stampaHtml('Registro degli atti prodotti', registroAttiHTML(m.appalto, m.consegne, m.sals, _verifiche))
}

/* ── La contabilità senza computo (lavori privati) ─────────────────────── */

async function lvContabilitaLibera(): Promise<string | null> {
  if (contratto(L)) { toast("Il contratto c'è già"); return null }
  const v = await finestra('Contabilità senza computo', `
    <p class="lv-nota">Per un lavoro privato, o un lavoro senza computo: un contratto <b>a misura</b> in vigore da subito. Nel SAL si misura quello che si fa: ogni articolo preso dal prezzario, da un altro progetto o scritto a mano entra nell'elenco del contratto. Il computo consuntivo si stampa da ogni SAL.</p>
    <div class="lv-righe">
      ${campo('data', 'Data', oggi())}
      ${campo('ribasso', 'Sconto o ribasso %', '', 'inputmode="decimal" placeholder="nessuno" style="width:140px"')}
      ${campo('pattuito', 'Importo pattuito €', '', 'inputmode="decimal" placeholder="se c\'è" style="width:150px"')}
      ${campo('numero', 'Revisione n.', numeroProposto(L), 'inputmode="numeric" style="width:80px"')}
    </div>
    ${spunta('sal', 'Apri subito il SAL n. 1', true)}`, 'Crea')
  if (!v) return null
  const rib = v.ribasso.trim() ? leggiNumeroTesto(v.ribasso) : 0
  const patt = v.pattuito.trim() ? leggiNumeroTesto(v.pattuito) : null
  if (rib == null || !Number.isFinite(rib) || (patt != null && !Number.isFinite(patt))) { toast('Numero non valido'); return null }
  let id = '', sal = ''
  aggiorna((l) => {
    const c = nuovaContabilitaLibera(l, { data: v.data || oggi(), numero: Number(v.numero), ribassoPct: rib, importoPattuito: patt }); id = c.id
    if (!v.sal) return c.lavoro
    const s = nuovoSal(c.lavoro, v.data || oggi()); sal = s.id; return s.lavoro
  }, 'Contabilità senza computo: in vigore')
  if (sal) { vista.mostra = 'misurate'; apri(sal); lvPzApri('prezzario') } else if (id) apri(id)
  return id || null
}
/** Un lavoro avviato con un altro programma, senza il computo: il contratto nasce dall'elenco della contabilità XPWE. */
async function lvContabilitaXpwe(): Promise<void> {
  if (!contratto(L)) {
    const v = await finestra('Contabilità da un file XPWE', `
      <p class="lv-nota">Il contratto nasce a misura dall'elenco prezzi della contabilità; le misure datate diventano i SAL (prima si vede come si raggruppano).</p>
      <div class="lv-righe">${campo('data', 'Data del contratto', oggi())}${campo('ribasso', 'Ribasso %', '', 'inputmode="decimal" placeholder="nessuno" style="width:130px"')}</div>`, 'Scegli il file')
    if (!v) return
    const rib = v.ribasso.trim() ? leggiNumeroTesto(v.ribasso) : 0
    if (rib == null || !Number.isFinite(rib)) { toast('Ribasso non valido'); return }
    if (!aggiorna((l) => nuovaContabilitaLibera(l, { data: v.data || oggi(), ribassoPct: rib }).lavoro)) return
  }
  lvImportaXpweSal()
}
async function lvImportoPattuito(): Promise<void> {
  const r = rev(); if (!r?.contratto?.libero) return
  const v = await finestra('Importo pattuito', `${campo('importo', 'Importo €', r.contratto.importoPattuito ? fmt(r.contratto.importoPattuito) : '', 'inputmode="decimal" style="width:160px"')}<p class="lv-nota">L'importo concordato col committente, se c'è: è il riferimento del lavoro. Vuoto = solo a misura.</p>`, 'Salva')
  if (!v) return
  const n = v.importo.trim() ? leggiNumeroTesto(v.importo) : null
  if (n != null && !Number.isFinite(n)) { toast('Importo non valido'); return }
  aggiorna((l) => ({ ...l, revisioni: l.revisioni.map((x) => (x.id === r.id ? { ...x, contratto: { ...x.contratto!, importoPattuito: n } } : x)) }))
}

/* ── I prezzi dell'elenco: variazione, prezzario, nuovi prezzi, confronto ─ */

async function lvVariaPrezzi(): Promise<void> {
  const r = rev(); if (!r || r.stato !== 'aperta') return
  const v = await finestra('Varia i prezzi', `
    <p class="lv-nota">Tutti i prezzi dell'elenco (non la sicurezza) cambiano della stessa percentuale; ogni cambio resta nello storico dell'articolo.</p>
    <div class="lv-righe">${campo('pct', 'Variazione %', '', 'inputmode="decimal" placeholder="es. +3,5 o -2" style="width:140px"')}${campo('nota', 'Motivo', '', 'placeholder="es. aggiornamento ISTAT"')}</div>`, 'Applica')
  if (!v) return
  const pct = leggiNumeroTesto(v.pct.replace('+', ''))
  if (pct == null || !Number.isFinite(pct) || pct === 0) { toast('Percentuale non valida'); return }
  let n = 0
  aggiorna((l) => { const x = variaPrezzi(l, r.id, pct, { nota: v.nota.trim() || undefined }); n = x.n; return x.lavoro })
  toast(`${n} prezzi variati del ${fmt(pct)}%`)
}
async function lvPrezziDaPrezzario(): Promise<void> {
  const r = rev(); if (!r || r.stato !== 'aperta') return
  if (!pz.righe.length) { toast('Scegli prima il prezzario nella scheda «Prezzario» a destra: il confronto si fa con quello'); lvPzApri('prezzario'); return }
  const p = pz.prezzari.find((y) => y.id === pz.prezzario)
  const diff = confrontaConPrezzario(r, pz.righe)
  if (!diff.length) { toast(`Nessun prezzo diverso da ${p?.nome || 'quel prezzario'} (per codice)`); return }
  const body = document.createElement('div'); body.className = 'lv-form'
  body.innerHTML = `<p class="lv-nota">${diff.length} articol${diff.length === 1 ? 'o ha' : 'i hanno'} un prezzo diverso da <b>${esc(p?.nome || 'prezzario')}</b>. Spunta quelli da aggiornare: il cambio resta nello storico.</p>
    <div class="lv-cfr-scorre"><table class="lv-cfr"><thead><tr><th></th><th>Codice</th><th>Descrizione</th><th>Attuale</th><th>Prezzario</th></tr></thead><tbody>
    ${diff.map((d, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td class="lv-cfr-cod">${esc(d.codice)}</td><td>${esc(d.descrizione)}</td><td>${d.attuale != null ? '€ ' + fmt(d.attuale) : '—'}</td><td>€ ${fmt(d.nuovo)}${d.diffPct != null ? ` (${d.diffPct > 0 ? '+' : ''}${fmt(d.diffPct)}%)` : ''}</td></tr>`).join('')}
    </tbody></table></div>`
  const ok = await openModal({ title: 'Prezzi dal prezzario', body, actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Aggiorna', variant: 'accent', value: true }] })
  if (ok !== true) return
  const scelte = [...body.querySelectorAll<HTMLInputElement>('input[data-i]')].filter((x) => x.checked).map((x) => diff[Number(x.dataset.i)])
  aggiorna((l) => applicaPrezzario(l, r.id, scelte, `dal prezzario ${p?.nome || ''}`.trim()), `${scelte.length} prezzi aggiornati`)
}
function lvRendiNP(voceId: string): void {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  let codice = ''
  aggiorna((l) => { const x = rendiNuovoPrezzo(l, r.id, v.articolo); codice = x.codice; return x.lavoro })
  if (codice) toast(`Ora è il nuovo prezzo ${codice}`)
}
/** Un codice in tutti i prezzari del programma: prezzo per prezzario. */
async function lvConfrontaCodice(codice: string): Promise<void> {
  if (!codice) return
  toast(`Cerco ${codice} in ${pz.prezzari.length} prezzari…`)
  const trovati: { nome: string; prezzo: number; um: string }[] = []
  for (const p of pz.prezzari) {
    try {
      const righe = await caricaPrezzario(p.id)
      const x = righe.find((y) => (y.codice || '').trim() === codice.trim())
      if (x) trovati.push({ nome: p.nome, prezzo: x.prezzo, um: x.um })
    } catch { /* un prezzario illeggibile non ferma il confronto */ }
  }
  const body = document.createElement('div'); body.className = 'lv-form'
  body.innerHTML = trovati.length
    ? `<table class="lv-cfr"><thead><tr><th>Prezzario</th><th>U.M.</th><th>Prezzo</th></tr></thead><tbody>${trovati.map((t) => `<tr><td>${esc(t.nome)}</td><td>${esc(t.um)}</td><td>€ ${fmt(t.prezzo)}</td></tr>`).join('')}</tbody></table>`
    : `<p class="lv-nota">${esc(codice)} non c'è negli altri prezzari del programma.</p>`
  await openModal({ title: `Confronto: ${codice}`, body, actions: [{ label: 'Chiudi', variant: 'accent', value: true }] })
}

/* ── La libreria personale: voci e analisi da riusare ─────────────────── */

function lvLibSalvaVoce(voceId: string): void {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  const a = articoloDi(r, v)
  const lib = aggiungiALibreria(leggiLibreria(), { nome: a.codice ? `${a.codice} — ${a.descrizione}` : a.descrizione, um: a.um || 'cad', breve: a.descrizione, estesa: a.estesa || a.descrizione })
  toast(scriviLibreria(lib) ? 'Salvata nella libreria' : 'Non riesco a salvare la libreria su questo dispositivo')
}
function lvLibSalvaAnalisi(id: string): void {
  const a = analisiDi(L).find((x) => x.id === id); if (!a) return
  const lib = aggiungiALibreria(leggiLibreria(), { nome: `${a.codice} — ${a.descrizioneBreve}`, um: a.um || 'cad', breve: a.descrizioneBreve, estesa: a.descrizioneEstesa || a.descrizioneBreve, analisiPrezzi: JSON.parse(JSON.stringify(a)) })
  toast(scriviLibreria(lib) ? 'Analisi salvata nella libreria' : 'Non riesco a salvare la libreria su questo dispositivo')
}
/** Dalla libreria: una voce (nella revisione aperta) o un'analisi (nel lavoro). */
async function lvLibInserisci(): Promise<void> {
  const lib = leggiLibreria()
  if (!lib.length) { toast('La libreria è vuota: «★ Salva nella libreria» dal tasto destro su una voce o da un\'analisi'); return }
  const v = await finestra('Dalla libreria', `
    <p class="lv-nota">Le voci e le analisi salvate su questo dispositivo. Una voce entra nella revisione aperta come voce libera (il prezzo si scrive); un'analisi entra fra le analisi del lavoro.</p>
    ${scelta('id', 'Voce', lib.map((x): [string, string] => [x.id, `${x.analisiPrezzi ? '[analisi] ' : ''}${x.nome} (${x.um})`]))}`, 'Inserisci')
  if (!v) return
  const x = lib.find((y) => y.id === v.id); if (!x) return
  if (x.analisiPrezzi) {
    let id = ''
    aggiorna((l) => { const n = nuovaAnalisi(l, {}); id = n.id; return { ...n.lavoro, analisi: analisiDi(n.lavoro).map((a) => (a.id === id ? { ...JSON.parse(JSON.stringify(x.analisiPrezzi)), id, codice: a.codice } : a)) } }, 'Analisi dalla libreria')
    if (id) apri(`pagina:analisi:${id}`)
    return
  }
  const r = revAperta(); if (!r) { toast('Per inserire una voce serve una revisione aperta'); return }
  if (corrente !== r.id) apri(r.id)
  const t = testoLibreria(x)
  let voceId = ''
  aggiorna((l) => {
    const a = aggiungiArticolo(l, r.id, { codice: '', descrizione: t.breve, ...(t.estesa && t.estesa !== t.breve ? { estesa: t.estesa } : {}), um: x.um, prezzo: null, origine: r.tipo === 'perizia' ? 'np' : 'manuale' })
    const nv = aggiungiVoce(a.lavoro, r.id, { articolo: a.id }); voceId = nv.id
    return modificaVoce(nv.lavoro, r.id, nv.id, { misure: [{ descrizione: '', quantita: 0 }] })
  }, 'Voce dalla libreria: scrivi codice e prezzo con ✎, e le misure')
  if (voceId) { apriMisure(voceId); render() }
}

/* ── La struttura: categorie, WBS, modelli ────────────────────────────── */

function modelliStruttura(): ModelloStruttura[] {
  try { return normalizzaModelli(JSON.parse(localStorage.getItem(CHIAVE_MODELLI) || '[]')) } catch { return [] }
}
const percorso = (j: string): string[] => { try { return JSON.parse(j) as string[] } catch { return [] } }
function strRev(): Revisione | null { return revDaPagina() }
function lvStrRinomina(p: string, nuovo: string): void {
  const r = strRev(); if (!r) return
  const t = String(nuovo).trim(); if (!t) { toast('Il nome non resta vuoto: per togliere il ramo c\'è ✕'); render(); return }
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { rinominaCategoria(x.categoria, x.s.dichiarate, percorso(p), t) }))
}
async function lvStrElimina(p: string): Promise<void> {
  const r = strRev(); if (!r) return
  const ok = await openModal({ title: 'Togliere il ramo?', message: 'Le voci del ramo restano nel computo, senza questa categoria.', actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Togli', variant: 'accent', value: true }] })
  if (ok === true) aggiorna((l) => cambiaStruttura(l, r.id, (x) => { eliminaCategoria(x.categoria, x.s.dichiarate, percorso(p)) }))
}
function lvStrSposta(p: string, delta: number): void {
  const r = strRev(); if (!r) return
  const per = percorso(p); const liv = per.length - 1
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => {
    const ol = x.s.ordineLivelli || [[], [], []]
    // i fratelli nell'ordine a schermo
    let nodi = alberoCategorie(x.categoria, x.ordine, {}, x.s.dichiarate, ol)
    for (const nome of per.slice(0, -1)) nodi = nodi.find((n) => n.nome === nome)?.figli || []
    ol[liv] = spostaNelLivello(ol[liv] || [], nodi.map((n) => n.nome), per[liv], delta < 0 ? -1 : 1)
    x.s.ordineLivelli = ol
  }))
}
async function lvStrNuova(p: string): Promise<void> {
  const r = strRev(); if (!r) return
  const padre = percorso(p)
  const v = await finestra(padre.length ? `Un ramo dentro «${padre[padre.length - 1]}»` : 'Una supercategoria', campo('nome', 'Nome', ''), 'Aggiungi')
  if (!v || !v.nome.trim()) return
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { x.s.dichiarate.push([...padre, v.nome.trim()].join(' · ')) }))
}
function lvWbsCodice(da: string, a: string): void {
  const r = strRev(); if (!r) return
  let err = ''
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { const e = ricodificaWbs(x.wbs, x.s.wbsNodi, da, a); if (e.errore) err = e.errore }))
  if (err) { toast(err); render() }
}
function lvWbsDescr(c: string, testo: string): void {
  const r = strRev(); if (!r) return
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { x.s.wbsNodi[c] = String(testo).trim() }))
}
function lvWbsNuovo(padre: string): void {
  const r = strRev(); if (!r) return
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { x.s.wbsNodi[prossimoCodiceWbs(x.s.wbsNodi, x.wbs, padre)] = '' }))
}
function lvWbsElimina(c: string): void {
  const r = strRev(); if (!r) return
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { eliminaWbs(x.wbs, x.s.wbsNodi, c) }))
}
async function lvModSalva(): Promise<void> {
  const r = strRev(); if (!r) return
  const v = await finestra('Salva come modello', campo('nome', 'Nome del modello', ''), 'Salva')
  if (!v) return
  const st = strutturaDi(r)
  const m = modelloDaProgetto(v.nome, Object.fromEntries(r.voci.map((x) => [x.id, x.categoria])), r.voci.map((x) => x.id), st.dichiarate, Object.fromEntries(r.voci.map((x) => [x.id, x.wbs])), st.wbsNodi, Date.now(), st.ordineLivelli)
  try { localStorage.setItem(CHIAVE_MODELLI, JSON.stringify([...modelliStruttura(), m])); toast(`Modello «${m.nome}» salvato`) } catch { toast('Non riesco a salvare il modello su questo dispositivo') }
  render()
}
function lvModApplica(id: string): void {
  const r = strRev(); if (!r) return
  const m = modelliStruttura().find((x) => x.id === id); if (!m) return
  let esito = { categorie: 0, wbs: 0 }
  aggiorna((l) => cambiaStruttura(l, r.id, (x) => { esito = applicaModello(m, x.s.dichiarate, x.s.wbsNodi) }))
  toast(`Modello «${m.nome}»: ${esito.categorie} rami e ${esito.wbs} nodi WBS aggiunti`)
}

/* ── Quadro economico e offerte ────────────────────────────────────────── */

function qeDi(revId: string): ReturnType<typeof normalizzaQE> { return normalizzaQE(revisione(L, revId).qe) }
function lvQE(revId: string, i: number, k: string, testo: string): void {
  const qe = qeDi(revId); const r = qe.righeB[i]; if (!r) return
  const t = String(testo).trim()
  if (k === 'valore') { const n = leggiNumeroTesto(t || '0'); if (n == null || !Number.isFinite(n)) { toast('Numero non valido'); render(); return } r.valore = n }
  else if (k === 'tipo') { r.tipo = t === 'percentuale' ? 'percentuale' : 'importo'; if (r.tipo === 'percentuale' && !r.base) r.base = 'A' }
  else (r as unknown as Record<string, string>)[k] = t
  aggiorna((l) => impostaQE(l, revId, qe))
}
function lvQESic(revId: string, testo: string): void {
  const n = leggiNumeroTesto(String(testo).trim() || '0'); if (n == null || !Number.isFinite(n)) { toast('Numero non valido'); render(); return }
  aggiorna((l) => impostaQE(l, revId, { ...qeDi(revId), sicurezzaExtra: n }))
}
function lvQENuova(revId: string): void {
  const qe = qeDi(revId)
  const riga: RigaQE = { codice: `B${qe.righeB.length + 1}`, descrizione: '', tipo: 'importo', valore: 0 }
  aggiorna((l) => impostaQE(l, revId, { ...qe, righeB: [...qe.righeB, riga] }))
}
function lvQETogli(revId: string, i: number): void { const qe = qeDi(revId); aggiorna((l) => impostaQE(l, revId, { ...qe, righeB: qe.righeB.filter((_, j) => j !== i) })) }

const offerteDi = (revId: string): Offerta[] => JSON.parse(JSON.stringify(revisione(L, revId).offerte || []))
function lvOffNuova(revId: string): void {
  const o = offerteDi(revId)
  aggiorna((l) => impostaOfferte(l, revId, [...o, { id: `off-${Date.now().toString(36)}`, nome: `Offerta ${o.length + 1}`, data: oggi() }]))
}
function lvOff(revId: string, i: number, k: string, testo: string): void {
  const o = offerteDi(revId); const x = o[i]; if (!x) return
  const t = String(testo).trim()
  if (k === 'ribassoPct') { const n = t ? leggiNumeroTesto(t) : null; if (n != null && !(n >= 0 && n < 100)) { toast('Ribasso non valido'); render(); return } x.ribassoPct = n }
  else (x as unknown as Record<string, string>)[k] = t
  aggiorna((l) => impostaOfferte(l, revId, o))
}
function lvOffPrezzi(revId: string, i: number, testo: string): void {
  const o = offerteDi(revId); const x = o[i]; if (!x) return
  const voci = vociPerStampa(revisione(L, revId)).filter((v) => !v.sicurezza)
  const col = leggiColonnaPrezzi(testo)
  const prezzi: Record<string, number> = { ...(x.prezzi || {}) }
  voci.forEach((v, j) => { const p = col[j]; if (p != null) prezzi[v.codice] = p })
  x.prezzi = prezzi
  aggiorna((l) => impostaOfferte(l, revId, o), `${col.filter((p) => p != null).length} prezzi letti`)
}
function lvOffTogli(revId: string, i: number): void { aggiorna((l) => impostaOfferte(l, revId, offerteDi(revId).filter((_, j) => j !== i))) }
/** Dall'offerta scelta nasce il contratto: il suo ribasso, o i suoi prezzi (per articolo). */
async function lvOffContratto(revId: string, i: number): Promise<void> {
  const r = revisione(L, revId); const o = (r.offerte || [])[i]; if (!o) return
  const conPrezzi = Object.keys(o.prezzi || {}).length > 0
  const ok = await openModal({ title: `Contratto con ${o.nome}`, message: conPrezzi ? 'Il contratto nasce a prezzi unitari: i prezzi offerti diventano quelli di contratto.' : `Il contratto nasce con il ribasso del ${fmt(o.ribassoPct ?? 0, 4)}%.`, actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Crea il contratto', variant: 'accent', value: true }] })
  if (ok !== true) return
  const prezziOfferti: Record<string, number> = {}
  if (conPrezzi) for (const a of r.articoli) { if (a.sicurezza) continue; const p = o.prezzi![a.codice] ?? (o.ribassoPct != null && a.prezzo != null ? Math.round(a.prezzo * (1 - o.ribassoPct / 100) * 100) / 100 : undefined); if (p != null) prezziOfferti[a.id] = p }
  let id = ''
  aggiorna((l) => { const c = promuoviAContratto(l, revId, { data: o.data || oggi(), offerente: o.nome, ...(conPrezzi ? { prezziOfferti } : { ribassoPct: o.ribassoPct ?? 0 }) }); id = c.id; return c.lavoro }, `Contratto con ${o.nome}: in vigore`)
  if (id) apri(id)
}
/** La stampa di una revisione da una sua pagina (quadro economico, offerte): la pagina resta dov'è. */
async function lvStampaRev(revId: string, tipo: string): Promise<void> {
  const prima = corrente
  corrente = revId
  try { await stampaDocumento(tipo) } finally { corrente = prima }
}

/* ── L'elenco prezzi a tutta pagina ─────────────────────────────────────
   Ricerca e filtro sono della vista, non del lavoro: restano finché si
   passa da una revisione all'altra. */
let _el = nuovoStatoElenco()

function lvElRev(revId: string): void { apri(`pagina:elenco:${revId}`) }
function lvElFiltro(f: string): void { _el = { ..._el, filtro: f as FiltroElenco }; render() }
/** La ricerca si fa sulle righe già disegnate: si scrive senza ridisegnare la pagina. */
function lvElCerca(testo: string): void {
  _el = { ..._el, q: testo }
  let n = 0, tot = 0
  document.querySelectorAll<HTMLTableRowElement>('.lv-el-tab tbody tr[data-cerca]').forEach((tr) => {
    const si = corrispondeRicerca(tr.dataset.cerca || '', testo)
    tr.hidden = !si; tot++; if (si) n++
  })
  const c = $('lv-el-conta'); if (c) c.textContent = testo.trim() ? `${n} su ${tot}` : ''
}
/** Un campo dell'articolo scritto sul posto: codice, descrizione, unità, prezzo, sicurezza. */
function lvElSet(revId: string, artId: string, campo: string, valore: string | boolean): void {
  let patch: Partial<Articolo>
  if (campo === 'prezzo') {
    const t = String(valore).trim()
    const n = !t ? null : /[+*/x:()]/i.test(t) ? leggiCampo(t).valore ?? NaN : leggiNumeroTesto(t)
    if (n != null && !Number.isFinite(n)) { toast('Prezzo non valido'); render(); return }
    patch = { prezzo: n }
  } else if (campo === 'sicurezza') patch = { sicurezza: valore === true || undefined }
  else if (campo === 'codice' || campo === 'descrizione' || campo === 'um') patch = { [campo]: String(valore).trim() }
  else return
  if (!aggiorna((l) => modificaArticolo(l, revId, artId, patch))) render()
}
async function lvElModifica(revId: string, artId: string): Promise<void> {
  const r = L.revisioni.find((x) => x.id === revId); if (!r) return
  const a = r.articoli.find((x) => x.id === artId); if (!a) return
  if (r.stato !== 'aperta') {
    await finestra(`${a.codice || 'Articolo'}`, `<p><b>${esc(a.descrizione)}</b></p>${a.estesa ? `<p class="lv-nota">${esc(a.estesa)}</p>` : ''}
      <p class="lv-nota">${esc(a.um)} · ${a.prezzo != null ? '€ ' + fmt(a.prezzo) : 'senza prezzo'}${a.sicurezza ? ' · oneri della sicurezza' : ''}</p>
      ${a.storico?.length ? `<p class="lv-nota"><b>Storico del prezzo</b>${a.prezzoListino != null ? ` — listino € ${fmt(a.prezzoListino)}` : ''}</p><ul class="lv-nota">${a.storico.map((x) => `<li>${esc(x.data)}: ${x.da != null ? '€ ' + fmt(x.da) : '—'} → ${x.a != null ? '€ ' + fmt(x.a) : '—'}${x.nota ? ` (${esc(x.nota)})` : ''}</li>`).join('')}</ul>` : ''}`, 'Chiudi')
    return
  }
  const x = await finestraVoce(r, a, {}, `${a.codice || 'Articolo'} — modifica`)
  if (x) aggiorna((l) => modificaArticolo(l, revId, artId, x.art))
}
function lvElNP(revId: string, artId: string): void {
  let codice = ''
  aggiorna((l) => { const x = rendiNuovoPrezzo(l, revId, artId); codice = x.codice; return x.lavoro })
  if (codice) toast(`Ora è il nuovo prezzo ${codice}: il prezzo si può concordare`)
}
function lvElTogli(revId: string, artId: string): void {
  const a = L.revisioni.find((x) => x.id === revId)?.articoli.find((x) => x.id === artId); if (!a) return
  aggiorna((l) => togliArticolo(l, revId, artId), `${a.codice || 'Articolo'} tolto dall'elenco`)
}
async function lvElNuovo(revId: string): Promise<void> {
  const r = L.revisioni.find((x) => x.id === revId); if (!r) return
  const np = r.tipo === 'perizia'
  const x = await finestraVoce(r, { origine: np ? 'np' : 'manuale' }, {}, np ? 'Nuovo prezzo' : 'Articolo nuovo')
  if (!x) return
  aggiorna((l) => aggiungiArticolo(l, revId, { codice: '', descrizione: '', um: '', prezzo: null, ...x.art, origine: np ? 'np' : 'manuale' }).lavoro, 'Articolo aggiunto in fondo all\'elenco')
  requestAnimationFrame(() => { const b = $('lv-body'); if (b) b.scrollTop = b.scrollHeight })
}
/** Il prezzario si pesca dalla revisione: la si apre col pannello a destra. */
function lvElPannello(revId: string): void { apri(revId); lvPzApri('prezzario') }

/* ── Le analisi prezzi ─────────────────────────────────────────────────── */

/**
 * Una nuova analisi: si crea subito, con il codice proposto, e si apre la sua
 * pagina con il cursore sulla descrizione. Niente finestra prima: codice,
 * descrizione e unità si scrivono nella pagina, insieme a tutto il resto.
 */
function lvApNuova(): void {
  let id = ''
  aggiorna((l) => { const a = nuovaAnalisi(l, { descrizioneBreve: '' }); id = a.id; return a.lavoro })
  if (!id) return
  apri(`pagina:analisi:${id}`); lvPzApri('prezzario')
  requestAnimationFrame(() => {
    const d = document.querySelector<HTMLInputElement>('input[name="descrizioneBreve"]')
    if (d) { d.focus(); d.select() }
  })
}
function lvAp(id: string, k: string, testo: string): void {
  const t = String(testo).trim()
  const numerici = ['quantitaRiferimento', 'arrotondamento', 'speseGeneraliPct', 'utileImpresaPct']
  let v: unknown = t
  if (numerici.includes(k)) { const n = leggiNumeroTesto(t || '0'); if (n == null || !Number.isFinite(n)) { toast('Numero non valido'); render(); return } v = n }
  if (k === 'descrizioneEstesa') v = t || undefined
  if ((k === 'codice' || k === 'descrizioneBreve') && !t) { toast('Codice e descrizione non restano vuoti'); render(); return }
  aggiorna((l) => modificaAnalisi(l, id, { [k]: v } as Partial<AnalisiPrezzi>))
}
function lvApRigaNuova(id: string, tipo: string): void {
  aggiorna((l) => aggiungiRigaAnalisi(l, id, { tipo: tipo as AnalisiRiga['tipo'], um: tipo === 'manodopera' || tipo === 'nolo' ? 'h' : '' }))
  requestAnimationFrame(() => { const r = document.querySelectorAll<HTMLInputElement>('.lv-ct-tab tbody tr:last-child input'); r[0]?.focus() })
}
function lvApRiga(id: string, i: number, k: string, testo: string): void {
  const t = String(testo).trim()
  let v: unknown = t
  if (k === 'quantita' || k === 'prezzoUnitario') {
    const n = !t ? 0 : /[+*/x:()]/i.test(t) ? leggiCampo(t).valore ?? NaN : leggiNumeroTesto(t)
    if (n == null || !Number.isFinite(n)) { toast('Numero non valido'); render(); return }
    v = n
  }
  aggiorna((l) => modificaRigaAnalisi(l, id, i, { [k]: v } as Partial<AnalisiRiga>))
}
function lvApRigaTogli(id: string, i: number): void { aggiorna((l) => togliRigaAnalisi(l, id, i)) }
function lvApApplica(id: string): void {
  const r = revAperta(); if (!r) return
  let nuovo = false
  aggiorna((l) => { const x = applicaAnalisi(l, id, r.id); nuovo = x.nuovo; return x.lavoro })
  toast(nuovo ? `Nell'elenco prezzi di ${sigla(r.numero)}: «＋» a destra per metterlo nel computo` : `Prezzo aggiornato nell'elenco di ${sigla(r.numero)}`)
}
function lvApDuplica(id: string): void { let n = ''; aggiorna((l) => { const d = duplicaAnalisi(l, id); n = d.id; return d.lavoro }); if (n) apri(`pagina:analisi:${n}`) }
async function lvApTogli(id: string): Promise<void> {
  const ok = await openModal({ title: "Eliminare l'analisi?", message: "Gli articoli che ne hanno preso il prezzo lo tengono; l'analisi non si potrà più stampare né riapplicare.", actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Elimina', variant: 'accent', value: true }] })
  if (ok !== true) return
  aggiorna((l) => togliAnalisi(l, id))
  corrente = null; render(); pubblica()
}
function lvApAggiorna(id: string): void {
  if (!pz.righe.length) { toast('Scegli prima un prezzario a destra: da lì si riprendono i prezzi elementari'); lvPzApri('prezzario'); return }
  const a: AnalisiPrezzi = JSON.parse(JSON.stringify(analisiDi(L).find((x) => x.id === id)))
  const p = pz.prezzari.find((y) => y.id === pz.prezzario)
  const cambiate = aggiornaRigheDaListino(a, pz.righe.map((x) => ({ codice: x.codice, prezzo: x.prezzo, regione: p?.regione || x.regione, anno: p?.anno || x.anno })))
  if (!cambiate.length) { toast('Nessun prezzo elementare cambiato rispetto al prezzario scelto'); return }
  aggiorna((l) => ({ ...l, analisi: analisiDi(l).map((x) => (x.id === id ? a : x)) }), `${cambiate.length} prezz${cambiate.length === 1 ? 'o' : 'i'} elementar${cambiate.length === 1 ? 'e' : 'i'} aggiornat${cambiate.length === 1 ? 'o' : 'i'}`)
}
function lvApStampa(id: string): void {
  const a = analisiDi(L).find((x) => x.id === id); if (!a) return
  stampaHtml(`Analisi prezzi ${a.codice}`, analisiPrezziHTML(a))
}
function lvApFascicolo(): void {
  const tutte = analisiDi(L)
  if (!tutte.length) { toast('Nessuna analisi da stampare'); return }
  stampaHtml('Fascicolo delle analisi prezzi', fascicoloAnalisiHTML(tutte))
}
function lvMenuAnalisi(ev: MouseEvent, id: string): void {
  if (menuNativo(ev)) return
  ev.preventDefault()
  apriMenuContestuale(ev.clientX, ev.clientY, [
    { etichetta: '⎙ Stampa l\'analisi…', azione: () => lvApStampa(id) },
    { etichetta: '⎙ Fascicolo di tutte le analisi…', azione: lvApFascicolo },
    'sep',
    ...(revAperta() ? [{ etichetta: `→ Nell'elenco prezzi di ${sigla(revAperta()!.numero)}`, azione: () => lvApApplica(id) }] : []),
    { etichetta: '≡ Righe dal prezzario', azione: () => lvPzApri('prezzario') },
    { etichetta: '⧉ Duplica', azione: () => lvApDuplica(id) },
    { etichetta: '★ Salva nella libreria', azione: () => lvLibSalvaAnalisi(id) },
    'sep',
    { etichetta: '✕ Elimina', pericolo: true, azione: () => void lvApTogli(id) },
  ], { titolo: analisiDi(L).find((x) => x.id === id)?.codice })
}

/* ── Gli atti del cantiere ─────────────────────────────────────────────── */

const dataOk = (t: string): boolean => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)

/** Il giorno dopo l'ultimo del giornale (o oggi), per la riga nuova. */
function prossimoGiorno(): string {
  const g = attiDi(L).giornale
  const u = g[g.length - 1]?.data
  const m = u && /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(u)
  if (!m) return oggi()
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1] + 1))
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}
function lvGioNuovo(): void { aggiorna((l) => aggiungiGiorno(l, { data: attiDi(l).giornale.some((x) => x.data === oggi()) ? prossimoGiorno() : oggi() }).lavoro) }
function lvGio(id: string, campo: string, testo: string): void { aggiorna((l) => modificaGiorno(l, id, { [campo]: String(testo).trim() || (campo === 'data' ? undefined : '') })) }
function lvGioTogli(id: string): void { aggiorna((l) => togliGiorno(l, id)) }

function lvAttoNuovo(tipo: string): void {
  let id = ''
  aggiorna((l) => { const a = aggiungiAtto(l, tipo as TipoAttoLibero, oggi()); id = a.id; return a.lavoro })
  if (id) requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.lv-atto:last-child input:not(.lv-ct-data)')?.focus())
}
function lvAtto(id: string, campo: string, testo: string): void {
  const t = String(testo).trim()
  if (campo === 'data' && !dataOk(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  aggiorna((l) => modificaAtto(l, id, { [campo]: t || undefined }))
}
function lvAttoTogli(id: string): void { aggiorna((l) => togliAtto(l, id)) }

function lvRisNuova(): void { aggiorna((l) => aggiungiRiserva(l, { oggetto: 'Riserva', data: oggi() }).lavoro) }
function lvRis(id: string, campo: string, testo: string): void {
  const t = String(testo).trim()
  let v: unknown = t || undefined
  if ((campo === 'data' || campo === 'dataEsplicitazione') && t && !dataOk(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  if (campo === 'importo') { const n = t ? leggiNumeroTesto(t) : null; if (n != null && !Number.isFinite(n)) { toast('Importo non valido'); render(); return } v = n ?? undefined }
  if (campo === 'salNumero') v = t ? Number(t) : undefined
  if (campo === 'confermataContoFinale') v = !!t || undefined
  if (campo === 'esito') v = (t || 'aperta') as EsitoRiserva
  if (campo === 'oggetto' && !t) { toast("La riserva ha un oggetto"); render(); return }
  aggiorna((l) => modificaRiserva(l, id, { [campo]: v }))
}
function lvRisTogli(id: string): void { aggiorna((l) => togliRiserva(l, id)) }

function lvEcoNuova(): void {
  const aperto = L.avanzamenti.find((a) => a.stato === 'bozza' && a.tipo !== 'cre')
  aggiorna((l) => aggiungiLista(l, oggi(), aperto?.n).lavoro)
}
function lvEco(id: string, campo: string, testo: string): void {
  const t = String(testo).trim()
  if (campo === 'data' && !dataOk(t)) { toast('Data non valida: gg/mm/aaaa'); render(); return }
  aggiorna((l) => modificaLista(l, id, { [campo]: campo === 'salNumero' ? (t ? Number(t) : undefined) : (t || undefined) }))
}
function lvEcoTogli(id: string): void { aggiorna((l) => togliLista(l, id)) }
type GruppoEco = 'operai' | 'mezzi' | 'provviste'
function lvEcoRigaNuova(id: string, gruppo: GruppoEco): void {
  const x = attiDi(L).economie.find((e) => e.id === id); if (!x) return
  const nuova = gruppo === 'operai' ? { qualifica: '', ore: null, tariffaOraria: null } : gruppo === 'mezzi' ? { descrizione: '', ore: null, tariffaOraria: null } : { descrizione: '', um: '', quantita: null, prezzoUnitario: null }
  aggiorna((l) => modificaLista(l, id, { [gruppo]: [...x[gruppo], nuova] } as Partial<ListaEconomia>))
}
function lvEcoRiga(id: string, gruppo: GruppoEco, i: number, campo: string, testo: string): void {
  const x = attiDi(L).economie.find((e) => e.id === id); if (!x) return
  const t = String(testo).trim()
  const numerici = ['ore', 'tariffaOraria', 'quantita', 'prezzoUnitario']
  let v: unknown = t
  if (numerici.includes(campo)) { const n = t ? leggiNumeroTesto(t) : null; if (n != null && !Number.isFinite(n)) { toast('Numero non valido'); render(); return } v = n }
  const righe = (x[gruppo] as unknown as Record<string, unknown>[]).map((r, j) => (j === i ? { ...r, [campo]: v } : r))
  aggiorna((l) => modificaLista(l, id, { [gruppo]: righe } as Partial<ListaEconomia>))
}
function lvEcoRigaTogli(id: string, gruppo: GruppoEco, i: number): void {
  const x = attiDi(L).economie.find((e) => e.id === id); if (!x) return
  aggiorna((l) => modificaLista(l, id, { [gruppo]: (x[gruppo] as unknown[]).filter((_, j) => j !== i) } as Partial<ListaEconomia>))
}

/** Le stampe del cantiere: le fa il motore, come gli atti contabili. */
function stampaHtml(titolo: string, html: string): void {
  const nomeFile = titolo.replace(/[^\w.àèéìòù-]+/gi, '-')
  anteprimaHTML(applicaStileStampa(html, leggiPreferenzeStampa().stile), { titolo, nomeFile, estensione: 'html', rifai: async () => applicaStileStampa(html, leggiPreferenzeStampa().stile) })
}
function motoreOAvviso(): ReturnType<typeof contabilitaMotore> {
  const m = contabilitaMotore(L)
  if (!m) toast('Gli atti del cantiere si stampano dal contratto in poi')
  return m
}
async function stampaPagina(p: string): Promise<void> {
  if (p.startsWith('analisi:')) { lvApStampa(p.slice(8)); return }
  const m = motoreOAvviso(); if (!m) return
  if (p === 'giornale') stampaHtml('Giornale dei lavori', giornaleHTML(m.appalto, m.giornale, m.sals, m.verbali, m.riserve))
  else if (p === 'riserve') stampaHtml('Prospetto delle riserve', prospettoRiserveHTML(m, oggiISO(), oggi()))
  else if (p === 'registro-atti') lvRegistroAttiStampa()
  else if (p === 'scadenze') stampaHtml('Scadenziario', scadenziarioHTML(m.appalto, scadenze({ appalto: m.appalto, sals: m.sals, riserve: m.riserve, verbali: m.verbali }, oggiISO()), oggi()))
}
function lvGioStampa(): void { void stampaPagina('giornale') }
function lvRisStampa(): void { void stampaPagina('riserve') }
function lvScadStampa(): void { void stampaPagina('scadenze') }
function lvAttoStampa(id: string): void {
  const m = motoreOAvviso(); if (!m) return
  const v = m.verbali.find((x) => x.id === id); if (!v) return
  const titolo = verbaliDi(L).find((x) => x.id === id)
  stampaHtml(`${titolo?.tipo === 'ordine' ? 'Ordine di servizio' : 'Verbale'} ${v.numero ?? ''} ${v.data ?? ''}`.trim(), verbaleHTML(m.appalto, v, m.partite))
}
function lvEcoStampa(id: string): void {
  const m = motoreOAvviso(); if (!m) return
  const x = m.liste.find((e) => e.id === id); if (!x) return
  stampaHtml(`Lista in economia n. ${x.numero}`, listaEconomiaHTML(m.appalto, x))
}

/* ── Contratto e SAL ──────────────────────────────────────────────────── */

async function lvPromuovi(): Promise<void> {
  const consegnati = L.revisioni.filter((r) => r.tipo === 'computo' && r.stato === 'chiusa').sort((a, b) => a.ordine - b.ordine)
  if (!consegnati.length) { toast('Prima si consegna un computo: diventa contratto un computo consegnato'); return }
  const cur = rev()
  const src = cur && cur.tipo === 'computo' && cur.stato === 'chiusa' ? cur : consegnati[consegnati.length - 1]
  const v = await finestra('Il computo diventa contratto', `
    <p class="lv-nota">Voci e prezzi del computo scelto diventano quelli del <b>contratto</b>, che prende una revisione nuova ed è subito in vigore: si passa al SAL. Ribasso o prezzi offerti si correggono finché nessun SAL è emesso.</p>
    ${scelta('da', 'Computo', consegnati.slice().reverse().map((r): [string, string] => [r.id, `${sigla(r.numero)} ${r.nome || NOME_FASE[r.fase || 'PFTE']} (${r.voci.length} voci)`]), src.id)}
    ${scelta('offerta', 'Offerta', [['ribasso', "A ribasso: un ribasso % sul totale dei lavori (mai sulla sicurezza)"], ['unitari', 'A prezzi unitari: il prezzo offerto di ogni articolo']], 'ribasso')}
    <div class="lv-righe">
      ${campo('ribasso', "Ribasso d'asta %", '', 'inputmode="decimal" placeholder="es. 12,35" style="width:120px"')}
      ${campo('numero', 'Revisione n.', numeroProposto(L), 'inputmode="numeric" style="width:80px"')}
      ${campo('data', 'Data del contratto', oggi())}
    </div>
    ${spunta('sal', 'Apri subito il SAL n. 1 (con il ribasso)', true)}
  `, 'Crea il contratto')
  if (!v) return
  const unitari = v.offerta === 'unitari'
  const rib = v.ribasso.trim() ? leggiNumeroTesto(v.ribasso) : 0
  if (!unitari && (rib == null || !Number.isFinite(rib))) { toast('Ribasso non valido'); return }
  let id = '', sal = ''
  aggiorna((l) => {
    const c = promuoviAContratto(l, v.da, { data: v.data || oggi(), numero: Number(v.numero), ...(unitari ? { prezziOfferti: {} } : { ribassoPct: rib ?? 0 }) })
    id = c.id
    if (unitari || !v.sal) return c.lavoro
    const s = nuovoSal(c.lavoro, v.data || oggi()); sal = s.id
    return s.lavoro
  }, unitari ? 'Contratto in vigore: scrivi i prezzi offerti, poi «＋ SAL n. 1…»' : undefined)
  if (sal) { vista.mostra = 'tutte'; apri(sal); toast(`Contratto ${sigla(revisione(L, id).numero)} in vigore: SAL n. 1 aperto`) }
  else if (id) { apri(id); if (!unitari) toast('Contratto in vigore') }
}

async function lvPrezziUnitari(): Promise<void> {
  const r = rev(); if (!r || r.tipo !== 'contratto') return
  const ok = await openModal({ title: 'Offerta a prezzi unitari', message: "Si scrive il prezzo offerto di ogni articolo, nella colonna del prezzo; dove manca vale quello di progetto. Il ribasso non si applica più.", actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Passa ai prezzi unitari', variant: 'accent', value: true }] })
  if (ok === true) aggiorna((l) => impostaPrezziUnitari(l, r.id), 'Scrivi i prezzi offerti nella colonna del prezzo')
}

function lvSetOfferto(artId: string, testo: string): void {
  const r = rev(); if (!r || r.tipo !== 'contratto') return
  const t = String(testo).trim()
  const n = t ? leggiNumeroTesto(t) : null
  if (n != null && !Number.isFinite(n)) { toast('Prezzo non valido'); render(); return }
  aggiorna((l) => impostaPrezzoOfferto(l, r.id, artId, n))
}

async function lvRibasso(): Promise<void> {
  const r = rev(); if (!r || r.tipo !== 'contratto') return
  if (r.contratto?.prezziOfferti) {
    const ok = await openModal({ title: "Tornare all'offerta a ribasso?", message: 'I prezzi offerti scritti finora si perdono: vale il ribasso % sul totale dei lavori.', actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Passa al ribasso', variant: 'accent', value: true }] })
    if (ok !== true) return
  }
  const v = await finestra("Ribasso d'asta", `${campo('ribasso', 'Ribasso %', r.contratto?.ribassoPct != null ? String(r.contratto.ribassoPct).replace('.', ',') : '', 'inputmode="decimal" style="width:140px"')}
    <p class="lv-nota">Si deduce sul totale dei lavori di ogni SAL; gli oneri della sicurezza non lo subiscono.</p>`, 'Salva')
  if (!v) return
  const n = leggiNumeroTesto(v.ribasso || '0')
  if (n == null || !Number.isFinite(n)) { toast('Ribasso non valido'); return }
  aggiorna((l) => impostaRibasso(l, r.id, n))
}

async function lvNuovoSal(): Promise<void> {
  const v = await finestra('Nuovo stato di avanzamento', `
    <p class="lv-nota">Si misura l'<b>eseguito a tutto il SAL</b>, voce per voce del contratto, nella stessa griglia del computo. Un SAL dopo il primo riparte dalle misure del precedente.</p>
    ${campo('data', 'Data del SAL', oggi())}`, 'Apri il SAL')
  if (!v) return
  let id = ''
  aggiorna((l) => { const s = nuovoSal(l, v.data || oggi()); id = s.id; return s.lavoro })
  if (id) { vista.mostra = L.avanzamenti.length > 1 ? 'misurate' : 'tutte'; apri(id) }
}

async function lvEmetti(): Promise<void> {
  const a = av(); if (!a) return
  const cre = a.tipo === 'cre'
  const cf = cre ? contoFinale(L) : null
  const testo = cre
    ? `Il certificato si <b>approva</b>: il lavoro è chiuso. Conto finale € ${fmt(cf?.netto ?? 0)}, credito residuo dell'impresa € ${fmt(cf?.credito ?? 0)}.`
    : a.tipo === 'salFinale'
      ? 'Lo stato finale si <b>chiude</b>: da qui è in sola lettura, e viene il certificato di regolare esecuzione.'
      : 'Il SAL si <b>chiude</b>: da qui è in sola lettura, e si può aprire il successivo, che riparte dalle sue misure.'
  // le voci oltre il contratto si contabilizzano, ma lo si dice prima di emettere
  const ecc = cre ? [] : vociEccedenti(L, a)
  const avviso = ecc.length ? `<p class="lv-nota lv-eccede"><b>${ecc.length} voc${ecc.length === 1 ? 'e supera' : 'i superano'} la quantità di contratto</b>: si possono contabilizzare, ma la quantità si ridetermina solo con una perizia di variante.</p>
    <ul class="lv-nota">${ecc.slice(0, 12).map((e) => `<li class="lv-eccede"><b>${esc(e.codice)}</b> ${esc(e.descrizione)} — eseguito ${fmt(e.eseguito)} su ${fmt(e.contratto)} ${esc(e.um)}</li>`).join('')}${ecc.length > 12 ? `<li>… e altre ${ecc.length - 12}</li>` : ''}</ul>` : ''
  const v = await finestra(cre ? 'Approvazione del certificato di regolare esecuzione' : `Emissione del ${titoloAvanzamento(a)}`, `
    <p class="lv-nota">${testo}</p>${avviso}
    ${campo('data', cre ? 'Data di approvazione' : 'Data di emissione', oggi())}`, cre ? 'Approva' : 'Emetti')
  if (!v) return
  if (!aggiorna((l) => emetti(l, a.id, v.data || oggi()), cre ? 'CRE approvato: il lavoro è chiuso' : `${titoloAvanzamento(a)} emesso`)) return
  // la firma: l'impronta degli atti come sono stati emessi (se poi si riapre e si cambia, il registro degli atti lo dice)
  const m = contabilitaMotore(L)
  if (m && !cre) {
    const h = await improntaSal(m.appalto, m.partite, m.sals, a.n, m.liste)
    if (h) aggiorna((l) => firmaAvanzamento(l, a.id, h))
  }
}

/** Tutti i nuovi prezzi della perizia aperta: soggetti, non soggetti, come da contratto. */
async function lvRibassoNp(): Promise<void> {
  const r = rev(); if (!r || r.stato !== 'aperta') return
  const n = r.articoli.filter((a) => a.origine === 'np' || a.origine === 'analisi').length
  if (!n) { toast('Nessun nuovo prezzo in questa revisione'); return }
  const v = await finestra('Ribasso sui nuovi prezzi', `
    <p class="lv-nota">${n} nuov${n === 1 ? 'o prezzo' : 'i prezzi'} in ${esc(sigla(r.numero))}. Col vecchio regolamento i NP, valutati al lordo, erano soggetti a ribasso (DPR 207/2010, art. 163); col D.Lgs. 36/2023 i NP determinati per analisi non lo sono automaticamente (parere MIT 3545/2025). Vale quello che dice il contratto. La scelta si cambia anche voce per voce, con ✎.</p>
    ${scelta('ribasso', 'Tutti i nuovi prezzi', [['', `come da contratto: ${regolaRibasso()}`], ['si', 'soggetti a ribasso'], ['no', 'non soggetti a ribasso']], '')}`, 'Applica')
  if (!v) return
  aggiorna((l) => impostaRibassoNp(l, r.id, v.ribasso === 'si' ? true : v.ribasso === 'no' ? false : undefined), 'Ribasso sui nuovi prezzi aggiornato')
}

async function lvNuovaPerizia(): Promise<void> {
  const v0 = vigente(L)
  if (!v0) { toast('Una perizia cambia un contratto: prima si stipula il contratto'); return }
  const v = await finestra('Perizia di variante', `
    <p class="lv-nota">Una revisione nuova, copiata dal contratto vigente (${sigla(v0.numero)}): si cambiano le quantità e si aggiungono i nuovi prezzi. Approvata, i SAL successivi ne portano prezzi e numero; quelli già emessi restano com'erano.</p>
    <div class="lv-righe">
      ${campo('numero', 'Revisione n.', numeroProposto(L), 'inputmode="numeric" style="width:80px"')}
      ${campo('data', 'Data', oggi())}
    </div>
    ${campo('nome', 'Nome', '', 'placeholder="es. Perizia di variante n. 1"')}`, 'Crea la perizia')
  if (!v) return
  let id = ''
  aggiorna((l) => { const p = nuovaPerizia(l, { data: v.data || oggi(), numero: Number(v.numero), nome: v.nome.trim() || undefined }); id = p.id; return p.lavoro })
  if (id) { vista.mostra = 'tutte'; apri(id) }
}

async function lvSalFinale(): Promise<void> {
  const v = await finestra('Stato finale dei lavori', `
    <p class="lv-nota">L'ultimo avanzamento: si misura tutto l'eseguito, ripartendo dalle misure dell'ultimo SAL. Dopo non si aprono altri SAL; viene il certificato di regolare esecuzione.</p>
    ${campo('data', 'Data', oggi())}`, 'Apri lo stato finale')
  if (!v) return
  let id = ''
  aggiorna((l) => { const f = nuovoSalFinale(l, v.data || oggi()); id = f.id; return f.lavoro })
  if (id) { vista.mostra = 'tutte'; apri(id) }
}

async function lvCre(): Promise<void> {
  const v = await finestra('Certificato di regolare esecuzione', `
    <p class="lv-nota">Certifica lo stato finale: le misure si leggono, il conto finale dice il credito residuo dell'impresa.</p>
    ${campo('data', 'Data', oggi())}`, 'Crea il CRE')
  if (!v) return
  let id = ''
  aggiorna((l) => { const c = nuovoCre(l, v.data || oggi()); id = c.id; return c.lavoro })
  if (id) { vista.mostra = 'tutte'; apri(id) }
}

function lvSalQta(voceId: string, testo: string): void {
  const a = av(); if (!a) return
  const t = String(testo).trim()
  const n = !t ? undefined : /[+*/x:()]/i.test(t) ? leggiCampo(t).valore ?? NaN : leggiNumeroTesto(t)
  if (n != null && !Number.isFinite(n)) { toast('Quantità non valida'); render(); return }
  aggiorna((l) => modificaRigaAvanzamento(l, a.id, voceId, { quantita: n ?? undefined }))
}
function lvSalQuota(voceId: string, testo: string): void {
  const a = av(); if (!a) return
  const n = String(testo).trim() ? leggiNumeroTesto(testo) : undefined
  if (n != null && !Number.isFinite(n)) { toast('Quota non valida'); render(); return }
  aggiorna((l) => modificaRigaAvanzamento(l, a.id, voceId, { quotaPct: n ?? undefined }))
}
/* Il sotto-computo dei lavori a corpo */
function lvScNuova(voceId: string): void {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  aggiorna((l) => impostaSottoComputo(l, r.id, voceId, [...(v.sottoComputo || []), { id: `sc-${Date.now().toString(36)}`, descrizione: '', qty: 1, prezzo: 0 }]))
}
function lvSc(voceId: string, i: number, k: string, testo: string): void {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v?.sottoComputo?.[i]) return
  const t = String(testo).trim()
  let val: unknown = t
  if (k === 'qty' || k === 'prezzo') { const n = t ? leggiNumeroTesto(t) : null; if (n != null && !Number.isFinite(n)) { toast('Numero non valido'); render(); return } val = n }
  aggiorna((l) => impostaSottoComputo(l, r.id, voceId, v.sottoComputo!.map((x, j) => (j === i ? { ...x, [k]: val } : x))))
}
function lvScTogli(voceId: string, i: number): void {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  aggiorna((l) => impostaSottoComputo(l, r.id, voceId, (v.sottoComputo || []).filter((_, j) => j !== i)))
}
function lvScEseg(voceId: string, sottoId: string, testo: string): void {
  const a = av(); if (!a) return
  const t = String(testo).trim()
  const n = t ? leggiNumeroTesto(t) : null
  if (n != null && !Number.isFinite(n)) { toast('Numero non valido'); render(); return }
  aggiorna((l) => eseguitoSotto(l, a.id, voceId, sottoId, n))
}

async function lvDatiSal(): Promise<void> {
  const a = av(); if (!a || a.stato !== 'bozza') return
  if (a.tipo === 'cre') {
    // nel CRE la nota è la relazione sul conto finale del direttore dei lavori
    const v = await finestra('Relazione sul conto finale', `<label class="lv-f"><span>Il testo della relazione (va nella stampa)</span><textarea name="note" rows="10">${esc(a.note || '')}</textarea></label>`, 'Salva')
    if (v) aggiorna((l) => datiAvanzamento(l, a.id, { note: v.note.trim() || undefined }))
    return
  }
  const v = await finestra(`Dati del ${titoloAvanzamento(a)}`, `
    ${campo('detrazioni', 'Detrazioni a tutto il SAL €', a.detrazioni ? fmt(a.detrazioni) : '', 'inputmode="decimal" style="width:160px"')}
    <p class="lv-nota">Lavorazioni non conformi o in contestazione: l'importo si toglie dal contabilizzato del certificato (progressivo: vale a tutto il SAL).</p>
    <label class="lv-f"><span>Note</span><textarea name="note" rows="3">${esc(a.note || '')}</textarea></label>`, 'Salva')
  if (!v) return
  const n = v.detrazioni.trim() ? leggiNumeroTesto(v.detrazioni) : 0
  if (n == null || !Number.isFinite(n)) { toast('Importo non valido'); return }
  aggiorna((l) => datiAvanzamento(l, a.id, { detrazioni: n || undefined, note: v.note.trim() || undefined }))
}
function lvMostra(m: string): void { vista.mostra = m === 'tutte' ? 'tutte' : m === 'variate' ? 'variate' : m === 'eccedenti' ? 'eccedenti' : 'misurate'; render() }

/* ── Comandi: le voci ─────────────────────────────────────────────────── */

function articoloDi(r: Revisione, v: Voce): Articolo { return r.articoli.find((a) => a.id === v.articolo)! }

/** La regola del contratto sui nuovi prezzi, in chiaro. */
function regolaRibasso(): string {
  const c = contratto(L)
  if (!c) return 'ribassato'
  if (c.contratto?.prezziOfferti) { const rr = ribassoRisultante(c); return `prezzi unitari, nessun ribasso${rr != null ? ` (risultante ${fmt(rr)}% se soggetto)` : ''}` }
  return `ribassato del ${fmt(c.contratto?.ribassoPct ?? 0, 4)}%`
}

/** Le voci di un elenco di struttura, con «nessuna» in testa e il valore attuale anche se non è più in struttura. */
function opzioniStruttura(voci: { valore: string; etichetta: string }[], attuale: string | undefined, nessuna: string): [string, string][] {
  const out: [string, string][] = [['', `— ${nessuna} —`], ...voci.map((x): [string, string] => [x.valore, x.etichetta])]
  if (attuale && !voci.some((x) => x.valore === attuale)) out.push([attuale, attuale])
  return out
}
async function finestraVoce(r: Revisione, a: Partial<Articolo>, v: Partial<Voce>, titolo: string): Promise<{ art: Partial<Articolo>; voce: Partial<Voce> } | null> {
  const usi = a.id ? r.voci.filter((x) => x.articolo === a.id).length : 0
  // la scelta del ribasso serve ai nuovi prezzi (o a un articolo già segnato), dove c'è un contratto
  const sc = scelteStruttura(r)
  const conRibasso = !!contratto(L) && r.tipo !== 'computo' && !a.sicurezza && (a.origine === 'np' || a.origine === 'analisi' || a.soggettoRibasso != null)
  const x = await finestra(titolo, `
    <div class="lv-righe">
      ${campo('codice', 'Codice', a.codice || '', 'style="width:140px"')}
      ${campo('um', 'U.M.', a.um || '', 'style="width:70px"')}
      ${campo('prezzo', 'Prezzo €', a.prezzo != null ? fmt(a.prezzo) : '', 'inputmode="decimal" style="width:110px"')}
    </div>
    ${campo('descrizione', 'Descrizione', a.descrizione || '')}
    <label class="lv-f"><span>Descrizione estesa</span><textarea name="estesa" rows="4">${esc(a.estesa || '')}</textarea></label>
    <div class="lv-righe">
      ${scelta('categoria', 'Categoria', opzioniStruttura(sc.categorie, v.categoria, 'nessuna categoria'), v.categoria || '')}
      ${scelta('wbs', 'WBS', opzioniStruttura(sc.wbs, v.wbs, 'nessuna WBS'), v.wbs || '')}
    </div>
    <p class="lv-nota">Categorie e nodi WBS si scelgono dall'elenco: si creano e si ordinano nella pagina «Categorie e WBS» (sidebar, DATI DEL LAVORO).</p>
    <div class="lv-righe">${spunta('sicurezza', 'Oneri della sicurezza (non soggetti a ribasso)', !!a.sicurezza)}${spunta('corpo', 'Lavoro a corpo', !!v.corpo)}</div>
    ${conRibasso ? scelta('ribasso', "Ribasso d'asta", [
      ['', `come da contratto: ${regolaRibasso()}`],
      ['si', 'soggetto a ribasso'],
      ['no', 'non soggetto a ribasso'],
    ], a.soggettoRibasso === true ? 'si' : a.soggettoRibasso === false ? 'no' : '') : ''}
    ${a.storico?.length ? `<p class="lv-nota"><b>Storico del prezzo</b>${a.prezzoListino != null ? ` — listino € ${fmt(a.prezzoListino)}` : ''}</p><ul class="lv-nota">${a.storico.map((x) => `<li>${esc(x.data)}: ${x.da != null ? '€ ' + fmt(x.da) : '—'} → ${x.a != null ? '€ ' + fmt(x.a) : '—'}${x.nota ? ` (${esc(x.nota)})` : ''}</li>`).join('')}</ul>` : ''}
    ${usi > 1 ? `<p class="lv-nota">Codice, descrizione, unità e prezzo sono dell'<b>articolo</b>: valgono per tutte le ${usi} voci che lo usano.</p>` : ''}
  `, 'Salva')
  if (!x) return null
  const prezzo = x.prezzo.trim() ? leggiNumeroTesto(x.prezzo) : null
  return {
    art: {
      codice: x.codice.trim(), descrizione: x.descrizione.trim(), estesa: x.estesa.trim() || undefined, um: x.um.trim(), prezzo: prezzo != null && Number.isFinite(prezzo) ? prezzo : null, sicurezza: !!x.sicurezza || undefined,
      ...(conRibasso ? { soggettoRibasso: x.ribasso === 'si' ? true : x.ribasso === 'no' ? false : undefined } : {}),
    },
    voce: { categoria: x.categoria.trim() || undefined, wbs: x.wbs.trim() || undefined, corpo: !!x.corpo || undefined },
  }
}

/** Misurare un articolo nel SAL di una contabilità senza computo: entra nel contratto, e si apre la sua misura. */
function misuraNelSalLibero(art: Omit<Articolo, 'id'>, voce: Partial<Voce> = {}): void {
  const a = av(); if (!a) return
  let voceId = ''
  const ok = aggiorna((l) => {
    const x = voceNelContrattoLibero(l, a.id, art, { ...(voce.categoria ? { categoria: voce.categoria } : {}) })
    voceId = x.voce
    const riga = rigaDi(avanzamento(x.lavoro, a.id), x.voce)
    return riga.misure.length ? x.lavoro : modificaRigaAvanzamento(x.lavoro, a.id, x.voce, { misure: [{ descrizione: '', quantita: 0 }] })
  })
  if (ok && voceId) {
    apriMisure(voceId); _fuocoDopo = `mis|${voceId}|0:descrizione`; render()
    toast(`${art.codice || art.descrizione || 'Voce'}: scrivi le misure`)
    requestAnimationFrame(() => document.querySelector(`[data-voce="${CSS.escape(voceId)}"]`)?.scrollIntoView({ block: 'center' }))
  }
}

async function lvVoceLibera(): Promise<void> {
  const sal = av()
  if (sal && contratto(L)?.contratto?.libero) {
    const x = await finestraVoce(revDiAv(sal), { origine: 'manuale' }, {}, 'Voce nuova (entra nel contratto)')
    if (x) misuraNelSalLibero({ codice: '', descrizione: '', um: '', prezzo: null, origine: 'manuale', ...x.art } as Omit<Articolo, 'id'>, x.voce)
    return
  }
  const r = rev(); if (!r || !modificabile(L, r.id)) return
  const np = r.tipo === 'perizia'
  const x = await finestraVoce(r, { origine: np ? 'np' : 'manuale' }, {}, np ? 'Nuovo prezzo' : 'Voce nuova')
  if (!x) return
  let voceId = ''
  aggiorna((l) => {
    const a = aggiungiArticolo(l, r.id, { codice: '', descrizione: '', um: '', prezzo: null, origine: np ? 'np' : 'manuale', ...x.art } as Omit<Articolo, 'id'>)
    const v = aggiungiVoce(a.lavoro, r.id, { articolo: a.id })
    voceId = v.id
    // nasce con una riga di misura vuota: si scrive subito, senza cercare il comando
    return modificaVoce(v.lavoro, r.id, v.id, { ...x.voce, misure: [{ descrizione: '', quantita: 0 }] })
  })
  if (voceId) { apriMisure(voceId); _fuocoDopo = `mis|${voceId}|0:descrizione`; render() }
}

async function lvModificaVoce(voceId: string): Promise<void> {
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  const a = articoloDi(r, v)
  const x = await finestraVoce(r, a, v, `${a.codice || 'Voce'} — modifica`)
  if (!x) return
  aggiorna((l) => modificaVoce(modificaArticolo(l, r.id, a.id, x.art), r.id, v.id, x.voce))
}

function lvSetQta(voceId: string, testo: string): void {
  const r = rev(); if (!r) return
  const t = String(testo).trim()
  const n = !t ? undefined : /[+*/x:()]/i.test(t) ? leggiCampo(t).valore ?? NaN : leggiNumeroTesto(t)
  if (n != null && !Number.isFinite(n)) { toast('Quantità non valida'); render(); return }
  aggiorna((l) => modificaVoce(l, r.id, voceId, { quantita: n ?? undefined }))
}
function lvSetPrezzo(artId: string, testo: string): void {
  const r = rev(); if (!r) return
  const n = String(testo).trim() ? leggiNumeroTesto(testo) : null
  if (n != null && !Number.isFinite(n)) { toast('Prezzo non valido'); render(); return }
  aggiorna((l) => modificaArticolo(l, r.id, artId, { prezzo: n }))
}
function lvDuplica(voceId: string): void { const r = rev(); if (r) aggiorna((l) => duplicaVoce(l, r.id, voceId).lavoro) }
function lvElimina(voceId: string): void { const r = rev(); if (r) aggiorna((l) => eliminaVoce(l, r.id, voceId), 'Voce tolta dal computo') }

/* ── Comandi: le misure ───────────────────────────────────────────────── */

/**
 * Le misure di una voce nella tappa aperta: quelle del computo in una
 * revisione, quelle a tutto il SAL in un avanzamento. Stessa tabella, stessi
 * tasti; cambia solo dove si scrivono.
 */
function misureDi(voceId: string): { v: { misure: MisurazioneRiga[]; quantita?: number }; salva: (l: Lavoro, patch: { misure: MisurazioneRiga[]; quantita?: undefined }) => Lavoro } | null {
  const a = av()
  if (a) {
    if (!revDiAv(a).voci.some((x) => x.id === voceId)) return null
    const riga: RigaAvanzamento = rigaDi(a, voceId)
    return { v: riga, salva: (l, patch) => modificaRigaAvanzamento(l, a.id, voceId, patch) }
  }
  const r = rev(); if (!r) return null
  const v = r.voci.find((x) => x.id === voceId)
  return v ? { v, salva: (l, patch) => modificaVoce(l, r.id, voceId, patch) } : null
}
function lvMisSet(voceId: string, i: number, c: string, testo: string): void {
  const x = misureDi(voceId); if (!x) return
  const misure = x.v.misure.map((m) => ({ ...m, ...(m.formule ? { formule: { ...m.formule } } : {}) }))
  const riga = misure[i]; if (!riga) return
  if (c === 'descrizione') riga.descrizione = testo
  else if (impostaCampo(riga, c as Fattore, testo).errore) { toast('Numero o formula non valida'); render(); return }
  aggiorna((l) => x.salva(l, { misure }))
}
function lvMisAggiungi(voceId: string, segno = 1): void {
  const x = misureDi(voceId); if (!x) return
  const nuova = segno < 0 ? { descrizione: 'a dedurre', n: -1, quantita: 0 } : { descrizione: '', quantita: 0 }
  _fuocoDopo = `mis|${voceId}|${x.v.misure.length}:descrizione`
  // la prima riga di dettaglio parte dalla quantità che c'era, per non perderla
  const base = !x.v.misure.length && x.v.quantita ? [{ descrizione: 'quantità di partenza', l1: x.v.quantita, quantita: x.v.quantita }] : []
  if (base.length) _fuocoDopo = `mis|${voceId}|1:descrizione`
  aggiorna((l) => x.salva(l, { misure: [...base, ...x.v.misure, nuova], quantita: undefined }))
}
function lvMisDuplica(voceId: string, i: number): void {
  const x = misureDi(voceId); if (!x) return
  const misure = [...x.v.misure]; misure.splice(i + 1, 0, JSON.parse(JSON.stringify(misure[i])))
  aggiorna((l) => x.salva(l, { misure }))
}
function lvMisElimina(voceId: string, i: number): void {
  const x = misureDi(voceId); if (!x) return
  aggiorna((l) => x.salva(l, { misure: x.v.misure.filter((_, j) => j !== i) }))
}
/* ── Vedi voce, copia e incolla, misure da un'altra voce, ordine ──────── */

async function lvMisVediVoce(voceId: string, i: number): Promise<void> {
  const r = rev(); if (!r) return
  const x = misureDi(voceId); const m = x?.v.misure[i]; if (!x || !m) return
  const altre = r.voci.filter((v) => v.id !== voceId).map((v): [string, string] => { const a = articoloDi(r, v); return [v.id, `${a.codice || '—'} ${a.descrizione.slice(0, 60)} (${fmt(quantitaVoce(v))} ${a.um})`] })
  if (!altre.length) { toast('Non ci sono altre voci da richiamare'); return }
  const v = await finestra('Vedi voce', `
    <p class="lv-nota">La quantità della voce scelta entra come <b>L1</b> di questa riga, e la segue quando cambia; gli altri fattori la moltiplicano (es. par.ug. 0,5 per la metà).</p>
    ${scelta('voce', 'Voce richiamata', [['', '— nessuna (togli il richiamo)'], ...altre], m.vediVoce || '')}`, 'Applica')
  if (!v) return
  const misure = x.v.misure.map((y, j) => (j === i ? { ...y, ...(v.voce ? { vediVoce: v.voce } : {}), ...(!v.voce ? { vediVoce: undefined } : {}) } : y))
  aggiorna((l) => x.salva(l, { misure }))
}
/** Incollare righe da Excel in un campo delle misure: diventano righe di misura. */
function lvMisIncolla(ev: ClipboardEvent, voceId: string, i: number): void {
  const testo = ev.clipboardData?.getData('text/plain') || ''
  if (!/[\t\n]/.test(testo.trim())) return   // un numero solo si incolla nel campo, come sempre
  const nuove = testoAMisure(testo); if (!nuove.length) return
  ev.preventDefault()
  const x = misureDi(voceId); if (!x) return
  const misure = [...x.v.misure]
  const vuota = (m?: MisurazioneRiga): boolean => !!m && !m.descrizione && !m.quantita && m.l1 == null && m.l2 == null && m.h == null
  misure.splice(vuota(misure[i]) ? i : i + 1, vuota(misure[i]) ? 1 : 0, ...nuove)
  aggiorna((l) => x.salva(l, { misure, quantita: undefined }), `${nuove.length} righe incollate`)
}
function lvMisCopia(voceId: string): void { const x = misureDi(voceId); if (x?.v.misure.length) copia(misureATesto(x.v.misure)); else toast('Nessuna misura da copiare') }
async function lvMisIncollaTutte(voceId: string): Promise<void> {
  let testo = ''
  try { testo = await navigator.clipboard.readText() } catch { toast('Non riesco a leggere gli appunti: incolla con Ctrl/⌘+V in un campo delle misure'); return }
  const nuove = testoAMisure(testo); if (!nuove.length) { toast('Negli appunti non ci sono righe di misura'); return }
  const x = misureDi(voceId); if (!x) return
  apriMisure(voceId)
  aggiorna((l) => x.salva(l, { misure: [...x.v.misure, ...nuove], quantita: undefined }), `${nuove.length} righe incollate`)
}
/** Misure da un'altra voce: di questo computo, o del progetto aperto in «Altro progetto». */
async function lvMisDaVoce(voceId: string): Promise<void> {
  const r = rev(); if (!r) return
  const opz: [string, string][] = []
  for (const v of r.voci) if (v.id !== voceId && v.misure.length) { const a = articoloDi(r, v); opz.push([`q:${v.id}`, `${a.codice || '—'} ${a.descrizione.slice(0, 50)} · ${v.misure.length} righe`]) }
  const altro = pz.altro ? pz.altro.lavoro.revisioni.find((x) => x.id === pz.altro!.rev) : null
  if (altro) for (const v of altro.voci) if (v.misure.length) { const a = altro.articoli.find((y) => y.id === v.articolo); opz.push([`a:${v.id}`, `[${pz.altro!.nome}] ${a?.codice || '—'} ${(a?.descrizione || '').slice(0, 40)} · ${v.misure.length} righe`]) }
  if (!opz.length) { toast("Nessuna voce con misure: apri un altro progetto nella scheda «Altro progetto» dell'elenco prezzi per prenderle da lì"); return }
  const v = await finestra("Misure da un'altra voce", `${scelta('da', 'Voce', opz)}${scelta('modo', 'Le righe', [['aggiungi', 'si aggiungono a quelle che ci sono'], ['sostituisci', 'prendono il posto di quelle che ci sono']], 'aggiungi')}`, 'Copia')
  if (!v) return
  const src = v.da.startsWith('q:') ? r.voci.find((x) => x.id === v.da.slice(2)) : altro?.voci.find((x) => x.id === v.da.slice(2))
  const x = misureDi(voceId); if (!src || !x) return
  const righe = copiaRighe(src.misure).map((m) => { const { vediVoce: _v, ...resto } = m; return resto })
  apriMisure(voceId)
  aggiorna((l) => x.salva(l, { misure: v.modo === 'sostituisci' ? righe : [...x.v.misure, ...righe], quantita: undefined }), `${righe.length} righe copiate`)
}
function lvMisSposta(voceId: string, i: number, delta: number): void {
  const x = misureDi(voceId); if (!x) return
  const misure = copiaRighe(x.v.misure)
  const j = spostaRiga(misure, i, delta); if (j === i) return
  _fuocoDopo = `mis|${voceId}|${j}:descrizione`
  aggiorna((l) => x.salva(l, { misure }))
}
function lvVoceSposta(voceId: string, delta: number): void {
  const r = rev(); if (!r) return
  const i = r.voci.findIndex((v) => v.id === voceId)
  const j = i + delta; if (i < 0 || j < 0 || j >= r.voci.length) return
  const primaDi = delta < 0 ? r.voci[j].id : (r.voci[j + 1]?.id ?? null)
  aggiorna((l) => spostaVoce(l, r.id, voceId, primaDi))
}
let _trascinata = ''
function lvDragVoce(ev: DragEvent, voceId: string): void { _trascinata = voceId; ev.dataTransfer?.setData('text/plain', voceId); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'; (ev.currentTarget as HTMLElement).classList.add('is-trascinata') }
function lvDragSopra(ev: DragEvent): void { if (_trascinata) { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move' } }
function lvDragFine(ev: DragEvent): void { (ev.currentTarget as HTMLElement).classList.remove('is-trascinata'); _trascinata = '' }
function lvDropVoce(ev: DragEvent, sopra: string): void {
  ev.preventDefault()
  const r = rev(); const id = _trascinata; _trascinata = ''
  if (!r || !id || id === sopra) return
  // sopra la metà alta della riga: prima; sotto: dopo
  const box = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  const dopo = ev.clientY > box.top + box.height / 2
  const k = r.voci.findIndex((v) => v.id === sopra)
  const primaDi = dopo ? (r.voci.filter((v) => v.id !== id)[r.voci.filter((v) => v.id !== id).findIndex((v) => v.id === sopra) + 1]?.id ?? null) : sopra
  if (k < 0) return
  aggiorna((l) => spostaVoce(l, r.id, id, primaDi))
}

/** Invio: la riga sotto (o una nuova, in fondo). Esc: chiude le misure. */
function lvMisTasti(ev: KeyboardEvent, voceId: string, i: number, c: string): void {
  const x = misureDi(voceId); if (!x) return
  const el = ev.target as HTMLInputElement
  const vai = (j: number): void => {
    const dest = el.closest('tbody')?.querySelector(`[data-voce="${CSS.escape(voceId)}"] [data-mis-input="${j}:${c}"]`)
    if (dest instanceof HTMLInputElement) { ev.preventDefault(); el.blur(); dest.focus(); dest.select() }
  }
  // Esc: lascia il campo com'era
  if (ev.key === 'Escape') { ev.preventDefault(); el.value = el.defaultValue; _fuocoDopo = null; el.blur(); return }
  // come in un foglio di calcolo: frecce su e giù, la stessa colonna nella riga accanto
  if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && !ev.altKey && !ev.ctrlKey && !ev.metaKey) { vai(i + (ev.key === 'ArrowUp' ? -1 : 1)); return }
  // Alt+↑↓ sposta la riga, Ctrl+D la duplica, Ctrl+Canc la toglie
  if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && ev.altKey) { ev.preventDefault(); lvMisSet(voceId, i, c, el.value); lvMisSposta(voceId, i, ev.key === 'ArrowUp' ? -1 : 1); return }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); lvMisSet(voceId, i, c, el.value); _fuocoDopo = `mis|${voceId}|${i + 1}:${c}`; lvMisDuplica(voceId, i); return }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); _fuocoDopo = `mis|${voceId}|${Math.max(0, i - 1)}:${c}`; lvMisElimina(voceId, i); return }
  if (ev.key !== 'Enter') return
  ev.preventDefault()
  const ultima = i === x.v.misure.length - 1
  lvMisSet(voceId, i, c, el.value)
  // Invio: la stessa colonna nella riga sotto; dall'ultima riga, una riga nuova
  if (ultima) lvMisAggiungi(voceId)
  else { _fuocoDopo = `mis|${voceId}|${i + 1}:${c}`; render() }
}
function lvToggleMisure(voceId: string): void {
  if (misureAVista(vista, voceId)) { vista.aperte.delete(voceId); vista.chiuse?.add(voceId) } else apriMisure(voceId)
  render()
}
/** Il foglio con le misure, o solo le voci (una riga ciascuna). */
function lvEspandiTutte(): void {
  vista.soloVoci = !vista.soloVoci
  vista.aperte.clear(); vista.chiuse?.clear()
  render()
}
function lvCerca(testo: string): void { vista.q = testo; render() }
function lvOrdine(m: string): void { vista.ordine = (['manuale', 'categorie', 'wbs'].includes(m) ? m : 'manuale') as Vista['ordine']; render() }

/* ── Il tasto destro su una voce ──────────────────────────────────────── */

/** Nei campi di testo resta il menu del sistema: copia, incolla, correttore. */
const menuNativo = (ev: MouseEvent): boolean => !!(ev.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"]')

function titoloCorrente(): string {
  const a = av(); if (a) return titoloAvanzamento(a)
  const r = rev(); return r ? `${r.tipo === 'perizia' ? (r.nome || 'Perizia') : r.tipo === 'contratto' ? 'Contratto' : 'Computo'} ${sigla(r.numero)}` : ''
}

/** Tasto destro su un punto qualunque della pagina: le azioni della tappa aperta. */
function lvMenuPagina(ev: MouseEvent): void {
  if (menuNativo(ev) || !corrente) return
  const azioni = azioniTappa(L, corrente)
  if (!azioni.length) return
  ev.preventDefault()
  menuDaAzioni(ev.clientX, ev.clientY, azioni.filter((v) => v === 'sep' || !v.comando.startsWith('t:apri:')), titoloCorrente())
}

/** In fondo a ogni menu di riga: le azioni della tappa, a un clic. */
const azioniDellaTappa = (ev: MouseEvent): VoceMenu => ({
  etichetta: `${titoloCorrente()}: azioni…`, titolo: 'Consegna, stampe, import e le altre azioni di questa tappa',
  azione: () => { if (corrente) menuDaAzioni(ev.clientX, ev.clientY, azioniTappa(L, corrente).filter((v) => v === 'sep' || !v.comando.startsWith('t:apri:')), titoloCorrente()) },
})

/** Tasto destro su una voce: i suoi comandi, dove si è. */
function lvMenuVoce(ev: MouseEvent, voceId: string): void {
  if (menuNativo(ev)) return
  ev.preventDefault(); ev.stopPropagation()
  const aperta = misureAVista(vista, voceId)
  const misure: VoceMenu = { etichetta: aperta ? '▾ Nascondi le misure' : '▸ Mostra le misure', azione: () => lvToggleMisure(voceId) }
  const copiaMis: VoceMenu = { etichetta: '⧉ Copia le misure', titolo: 'Si incollano in un\'altra voce o in Excel', azione: () => lvMisCopia(voceId) }
  const a = av()
  if (a) {
    const r = revDiAv(a)
    const v = r.voci.find((x) => x.id === voceId); if (!v) return
    const ar = articoloDi(r, v)
    const scrive = a.stato === 'bozza' && a.tipo !== 'cre'
    const riga = rigaDi(a, voceId)
    apriMenuContestuale(ev.clientX, ev.clientY, [
      ...(v.corpo ? [] : [misure]),
      ...(scrive && !v.corpo ? [
        { etichetta: '＋ Riga di misura', azione: () => { apriMisure(voceId); lvMisAggiungi(voceId, 1) } },
        { etichetta: '− Riga in detrazione', azione: () => { apriMisure(voceId); lvMisAggiungi(voceId, -1) } },
        copiaMis,
        { etichetta: '⎘ Incolla le misure', titolo: 'Righe copiate da Excel o da un\'altra voce', azione: () => void lvMisIncollaTutte(voceId) },
        ...(!riga.misure.length ? [{ etichetta: '= Eseguito come da contratto', titolo: `Scrive l'eseguito a tutto il SAL uguale alla quantità di contratto (${fmt(quantitaVoce(v))} ${ar.um})`, azione: () => aggiorna((l) => modificaRigaAvanzamento(l, a.id, voceId, { quantita: quantitaVoce(v) })) }] : []),
        ...(misurataRiga(riga) ? [{ etichetta: "✕ Azzera l'eseguito", pericolo: true, azione: () => aggiorna((l) => modificaRigaAvanzamento(l, a.id, voceId, { misure: [], quantita: undefined, quotaPct: undefined })) }] : []),
      ] : []),
      'sep',
      { etichetta: "≡ Mostra nell'elenco prezzi", azione: () => mostraNelPannello(ar.codice) },
      { etichetta: '⧉ Copia il codice', azione: () => copia(ar.codice) },
      'sep',
      azioniDellaTappa(ev),
    ], { titolo: ar.codice || ar.descrizione })
    return
  }
  const r = rev(); if (!r) return
  const v = r.voci.find((x) => x.id === voceId); if (!v) return
  const ar = articoloDi(r, v)
  const scrive = r.stato === 'aperta'
  apriMenuContestuale(ev.clientX, ev.clientY, [
    misure,
    ...(scrive ? [
      { etichetta: '✎ Modifica la voce…', azione: () => void lvModificaVoce(voceId) },
      { etichetta: '＋ Riga di misura', azione: () => { apriMisure(voceId); lvMisAggiungi(voceId, 1) } },
      { etichetta: '− Riga in detrazione', azione: () => { apriMisure(voceId); lvMisAggiungi(voceId, -1) } },
      { etichetta: '⧉ Ripeti la voce', azione: () => lvDuplica(voceId) },
      'sep' as const,
      { etichetta: '⇣ Misure da un\'altra voce…', azione: () => void lvMisDaVoce(voceId) },
      { etichetta: '⎘ Incolla le misure', titolo: 'Righe copiate da Excel o da un\'altra voce', azione: () => void lvMisIncollaTutte(voceId) },
      ...(vista.ordine === 'manuale' ? [
        { etichetta: '↑ Sposta su', azione: () => lvVoceSposta(voceId, -1) },
        { etichetta: '↓ Sposta giù', azione: () => lvVoceSposta(voceId, 1) },
      ] : []),
    ] : []),
    { etichetta: '★ Salva nella libreria', titolo: 'La descrizione della voce, da riusare in altri lavori', azione: () => lvLibSalvaVoce(voceId) },
    ...(scrive && ar.origine !== 'np' && r.tipo !== 'contratto' ? [{ etichetta: '◆ Rendi nuovo prezzo (NP)', titolo: 'L\'articolo diventa NP.nn e conserva il codice da cui nasce', azione: () => lvRendiNP(voceId) }] : []),
    ...(ar.codice ? [{ etichetta: '⇄ Confronta nei prezzari', azione: () => void lvConfrontaCodice(ar.codice) }] : []),
    ...(v.misure.length ? [{ etichetta: '⧉ Copia le misure', titolo: 'Negli appunti, da incollare in Excel o in un\'altra voce', azione: () => lvMisCopia(voceId) }] : []),
    'sep',
    { etichetta: "≡ Mostra nell'elenco prezzi", azione: () => mostraNelPannello(ar.codice) },
    { etichetta: '⧉ Copia il codice', azione: () => copia(ar.codice) },
    ...(scrive ? ['sep' as const, { etichetta: `✕ Togli ${r.tipo === 'perizia' ? 'dalla perizia' : 'dal computo'}`, pericolo: true, azione: () => lvElimina(voceId) }] : []),
    'sep',
    azioniDellaTappa(ev),
  ], { titolo: ar.codice || ar.descrizione })
}

const misurataRiga = (r: RigaAvanzamento): boolean => r.misure.length > 0 || (r.quantita ?? 0) !== 0 || (r.quotaPct ?? 0) !== 0

/** Tasto destro su una riga di misura: inserire, duplicare, togliere proprio lì. */
function lvMisMenu(ev: MouseEvent, voceId: string, i: number): void {
  if (menuNativo(ev)) return
  const x = misureDi(voceId); if (!x) return
  const scrive = av() ? av()!.stato === 'bozza' && av()!.tipo !== 'cre' : rev()?.stato === 'aperta'
  ev.preventDefault(); ev.stopPropagation()
  const m = x.v.misure[i]
  apriMenuContestuale(ev.clientX, ev.clientY, [
    ...(scrive ? [
      { etichetta: '＋ Riga sotto', azione: () => lvMisInserisci(voceId, i, 1) },
      { etichetta: '− Riga in detrazione sotto', azione: () => lvMisInserisci(voceId, i, -1) },
      { etichetta: '⧉ Duplica la riga', azione: () => lvMisDuplica(voceId, i) },
      { etichetta: '↑ Sposta su', azione: () => lvMisSposta(voceId, i, -1) },
      { etichetta: '↓ Sposta giù', azione: () => lvMisSposta(voceId, i, 1) },
      ...(!av() ? [{ etichetta: '↪ Vedi voce…', titolo: 'L1 = la quantità di un\'altra voce', azione: () => void lvMisVediVoce(voceId, i) }] : []),
    ] : []),
    ...(m ? [{ etichetta: '⧉ Copia la quantità', titolo: 'Negli appunti, con la virgola', azione: () => copia(fmt(m.quantita ?? 0)) }] : []),
    ...(scrive ? ['sep' as const, { etichetta: '✕ Elimina la riga', pericolo: true, azione: () => lvMisElimina(voceId, i) }] : []),
  ], { titolo: m?.descrizione ? m.descrizione : `Riga ${i + 1}` })
}

/** Una riga di misura nuova subito sotto la i-esima (in detrazione col segno meno). */
function lvMisInserisci(voceId: string, i: number, segno = 1): void {
  const x = misureDi(voceId); if (!x) return
  const nuova = segno < 0 ? { descrizione: 'a dedurre', n: -1, quantita: 0 } : { descrizione: '', quantita: 0 }
  const misure = [...x.v.misure]; misure.splice(i + 1, 0, nuova)
  _fuocoDopo = `mis|${voceId}|${i + 1}:descrizione`
  aggiorna((l) => x.salva(l, { misure }))
}

/** Tasto destro su una riga dell'elenco prezzi: i suoi comandi, e gli appunti. */
function lvPzMenu(ev: MouseEvent, el: HTMLElement): void {
  ev.preventDefault(); ev.stopPropagation()
  const cod = el.dataset.codice || '', des = el.dataset.descrizione || ''
  const prendi = el.querySelector<HTMLButtonElement>('.lv-pz-cmd.ehb-btn')
  const modifica = el.querySelector<HTMLButtonElement>('.lv-pz-cmd.ehb-icon-btn')
  apriMenuContestuale(ev.clientX, ev.clientY, [
    ...(prendi ? [{ etichetta: av() ? '＋ Nel libretto, con le misure aperte' : '＋ Nella tappa aperta', azione: () => prendi.click() }] : []),
    ...(modifica ? [{ etichetta: "✎ Modifica l'articolo…", azione: () => modifica.click() }] : []),
    ...(prendi || modifica ? ['sep' as const] : []),
    { etichetta: '⧉ Copia il codice', azione: () => copia(cod) },
    { etichetta: '⧉ Copia la descrizione', azione: () => copia(des) },
    ...(cod ? [{ etichetta: '⇄ Confronta nei prezzari', titolo: 'Lo stesso codice in tutti i prezzari del programma', azione: () => void lvConfrontaCodice(cod) }] : []),
  ], { titolo: cod || des })
}

function copia(testo: string): void {
  void navigator.clipboard?.writeText(testo).then(() => toast('Copiato negli appunti'), () => toast('Non riesco a scrivere negli appunti'))
}

/** Apre l'elenco prezzi a destra, sulla scheda della tappa, cercando il codice. */
function mostraNelPannello(codice: string): void {
  pz.aperto = true; pz.scheda = 'progetto'; pz.soloNp = false; pz.q = codice; render()
}

/* ── I dati del lavoro ────────────────────────────────────────────────── */

/** I dati del lavoro: una pagina, come «Contratto, tempi e pagamenti» (non più una finestra). */
function lvApriDati(): void { apri('dati') }
/** Un dato del lavoro scritto nella sua pagina: si salva uscendo dal campo. */
function lvDato(chiave: string, valore: string): void {
  if (!CAMPI_DATI_GENERALI.some((c) => c.chiave === chiave)) return
  aggiorna((l) => impostaDati(l, { [chiave]: String(valore).trim() }))
}

/* ── Import XPWE ──────────────────────────────────────────────────────── */

async function lvImportaXpwe(): Promise<void> {
  let r = rev()
  // nella perizia si importa la variante preparata con un altro programma
  if (r?.tipo === 'perizia') {
    if (r.stato !== 'aperta') { toast('La perizia è approvata: per importare, riaprila o fanne una nuova'); return }
    _xpwePerizia = true
    ;($('lv-file') as HTMLInputElement | null)?.click()
    return
  }
  if (contratto(L)) { toast('Il contratto c\'è già: un computo nuovo è una perizia. Importa nella perizia (sidebar, CONTABILITÀ)'); return }
  if (!r || r.tipo !== 'computo') {
    const id = await lvNuovoComputo()
    if (!id) return
    r = rev()
  }
  if (!r || !modificabile(L, r.id)) { toast('La revisione è consegnata: per importare, fanne una nuova'); return }
  ;($('lv-file') as HTMLInputElement | null)?.click()
}
/* ── Una contabilità XPWE nei SAL (un lavoro avviato con un altro programma) ── */

let _xpweNeiSal = false
let _xpwePerizia = false
let _xpweConfronto: string | null = null

/** Confronta un avanzamento con una contabilità XPWE (nello stato finale in bozza, anche sostituisce). */
function lvConfrontaXpwe(): void {
  const a = av(); if (!a) return
  _xpweConfronto = a.id
  ;($('lv-file') as HTMLInputElement | null)?.click()
}

async function confrontaFile(avId: string, nome: string, misure: MisuraDatata[]): Promise<void> {
  const a = L.avanzamenti.find((x) => x.id === avId); if (!a) return
  if (!misure.length) { toast('Il file non contiene misure'); return }
  if (a.tipo === 'salFinale' && a.stato === 'bozza') {
    const v = await finestra(`Stato finale e ${nome}`, `
      <p class="lv-nota">${misure.length} misure nel file, di tutte le date. Si abbinano alle voci del contratto con lo stesso codice e prezzo.</p>
      ${scelta('azione', 'Che cosa fare', [['confronta', 'Confronta i totali, senza cambiare niente'], ['sostituisci', 'Lo stato finale prende le misure del file (quelle di adesso si perdono)']], 'confronta')}`, 'Continua')
    if (!v) return
    if (v.azione === 'sostituisci') {
      let esito: ReturnType<typeof statoFinaleDaXpwe> | null = null
      const ok = aggiorna((l) => { esito = statoFinaleDaXpwe(l, avId, misure); return esito.lavoro })
      if (!ok || !esito) return
      const e = esito as ReturnType<typeof statoFinaleDaXpwe>
      vista.mostra = 'misurate'; render()
      toast(`Stato finale dal file: ${e.voci} voci misurate${e.scartate.length ? ` · ${e.scartate.length} misure lasciate fuori` : ''}`)
      if (e.scartate.length) await mostraConfronto(nome, null, e.scartate)
      return
    }
  }
  const c = confrontaConXpwe(L, avId, misure)
  await mostraConfronto(nome, c, c.scartate, titoloAvanzamento(a))
}

async function mostraConfronto(nome: string, c: ReturnType<typeof confrontaConXpwe> | null, scartate: { codice: string; descrizione: string; motivo: string }[], titolo = ''): Promise<void> {
  const body = document.createElement('div')
  body.className = 'lv-form lv-confronto'
  const diff = c ? Math.round((c.lordoFile - c.lordoQuadra) * 100) / 100 : 0
  body.innerHTML = (c ? `
    <p class="lv-nota">Importi lordi ai prezzi ${esc(titolo ? `del ${titolo}` : '')}, prima del ribasso; i lavori a corpo non si confrontano (nel file non c'è la quota).</p>
    <table class="lv-cfr"><tbody>
      <tr><th>Quadra</th><td>€ ${fmt(c.lordoQuadra)}</td></tr>
      <tr><th>${esc(nome)}</th><td>€ ${fmt(c.lordoFile)}</td></tr>
      <tr class="${diff ? 'is-diff' : 'is-ok'}"><th>Differenza</th><td>${diff ? `${diff > 0 ? '+' : '−'} € ${fmt(Math.abs(diff))}` : '✓ nessuna'}</td></tr>
    </tbody></table>
    ${c.diverse.length ? `<p class="lv-nota"><b>${c.diverse.length} voc${c.diverse.length === 1 ? 'e diversa' : 'i diverse'}</b> su ${c.righe.length}:</p>
    <div class="lv-cfr-scorre"><table class="lv-cfr"><thead><tr><th>Codice</th><th>Designazione</th><th>Quadra</th><th>File</th><th>Differenza</th></tr></thead><tbody>
      ${c.diverse.map((x) => `<tr><td class="lv-cfr-cod">${esc(x.codice)}</td><td>${esc(x.descrizione)}</td><td>${fmt(x.quadra)} ${esc(x.um)}</td><td>${fmt(x.file)} ${esc(x.um)}</td><td>${x.file - x.quadra > 0 ? '+' : '−'} € ${fmt(Math.abs(x.importoFile - x.importoQuadra))}</td></tr>`).join('')}
    </tbody></table></div>` : `<p class="lv-nota">Le ${c.righe.length} voci misurate coincidono.</p>`}` : '')
    + (scartate.length ? `<p class="lv-nota"><b>Nel file ma non confrontate</b>:</p><ul class="lv-nota">${scartate.map((x) => `<li><b>${esc(x.codice || '—')}</b>${x.descrizione ? ` ${esc(x.descrizione)}` : ''} — ${esc(x.motivo)}</li>`).join('')}</ul>` : '')
  await openModal({ title: c ? `Confronto con ${nome}` : 'Misure lasciate fuori', body, actions: [{ label: 'Chiudi', variant: 'accent', value: true }] })
}

/** Dalla sidebar: la perizia in bozza, o una nuova, e poi il file. */
async function lvImportaXpwePerizia(): Promise<void> {
  let p = L.revisioni.find((r) => r.tipo === 'perizia' && r.stato === 'aperta')
  if (!p) {
    await lvNuovaPerizia()
    p = L.revisioni.find((r) => r.tipo === 'perizia' && r.stato === 'aperta')
    if (!p) return
  } else apri(p.id)
  _xpwePerizia = true
  ;($('lv-file') as HTMLInputElement | null)?.click()
}

async function importaFilePerizia(nome: string, voci: VoceComputo[]): Promise<void> {
  const p = rev()
  if (!p || p.tipo !== 'perizia' || p.stato !== 'aperta') { toast('Apri la perizia in bozza'); return }
  if (!voci.length) { toast('Il file non contiene voci'); return }
  const v = await finestra(`Perizia da ${nome}`, `
    <p class="lv-nota">${voci.length} voci. Ogni voce si abbina all'articolo del contratto con lo stesso codice e prezzo; quello che il contratto non ha entra come <b>nuovo prezzo (NP)</b>, e anche un codice di contratto a un prezzo diverso, perché in perizia i prezzi di contratto non cambiano.</p>
    ${scelta('modo', 'Le voci del file', [['sostituisci', 'sono la perizia intera: prendono il posto delle voci attuali'], ['aggiungi', 'si aggiungono alle voci attuali']], 'sostituisci')}
    <p class="lv-nota">Le voci abbinate restano le stesse (i SAL le ritrovano). Una voce già contabilizzata in un SAL emesso non si toglie, anche se il file non la ha.</p>`, 'Importa')
  if (!v) return
  let esito: ReturnType<typeof importaPerizia> | null = null
  const ok = aggiorna((l) => { esito = importaPerizia(l, p.id, voci.map(daXpwe), v.modo === 'aggiungi' ? 'aggiungi' : 'sostituisci'); return esito.lavoro })
  if (!ok || !esito) return
  const e = esito as ReturnType<typeof importaPerizia>
  vista.mostra = 'variate'; render()
  const msg = `${e.aggiornate} voci aggiornate, ${e.nuove} nuove${e.tolte ? `, ${e.tolte} tolte` : ''}`
  if (!e.np.length && !e.tenute.length) { toast(msg); return }
  const body = document.createElement('div')
  body.className = 'lv-form'
  body.innerHTML = `<p class="lv-nota">${esc(msg)}.</p>
    ${e.np.length ? `<p class="lv-nota"><b>Nuovi prezzi</b> (da concordare col verbale):</p><ul class="lv-nota">${e.np.map((x) => `<li><b>${esc(x.codice || '—')}</b> ${esc(x.descrizione)}${x.prezzoDiverso != null ? ` — nel contratto a € ${fmt(x.prezzoDiverso)}: controlla che sia davvero un prezzo nuovo` : ''}</li>`).join('')}</ul>` : ''}
    ${e.tenute.length ? `<p class="lv-nota"><b>Tenute</b> perché già contabilizzate (il file non le ha):</p><ul class="lv-nota">${e.tenute.map((x) => `<li><b>${esc(x.codice)}</b> ${esc(x.descrizione)} — nel SAL n. ${x.sal}</li>`).join('')}</ul>` : ''}`
  await openModal({ title: 'Perizia importata', body, actions: [{ label: 'Ho capito', variant: 'accent', value: true }] })
}

/** Si può importare: contratto stipulato, niente SAL finale, nessun SAL in bozza che non sia l'ultimo. */
function importSalPossibile(): boolean {
  return !!vigente(L) && !L.avanzamenti.some((a) => a.tipo !== 'sal')
}

function lvImportaXpweSal(): void {
  if (!vigente(L)) { toast('Prima si stipula il contratto: le misure si abbinano alle sue voci'); return }
  if (!importSalPossibile()) { toast('Dopo il SAL finale non si importano altri SAL'); return }
  _xpweNeiSal = true
  ;($('lv-file') as HTMLInputElement | null)?.click()
}

async function importaContabilita(nome: string, misure: MisuraDatata[]): Promise<void> {
  if (!misure.length) { toast('Il file non contiene misure'); return }
  const emessi = L.avanzamenti.filter((a) => a.stato === 'emesso').sort((a, b) => a.ordine - b.ordine)
  const ultimoEmesso = emessi[emessi.length - 1]
  let giorni = 30
  let dal = ''
  // la proposta si rivede finché il raggruppamento non va bene
  for (;;) {
    const gruppi = proponiGruppi(misure, giorni)
    const bozza = L.avanzamenti.find((a) => a.stato === 'bozza')
    const primoN = bozza ? bozza.n : (ultimoEmesso?.n ?? 0) + 1
    const righe = gruppi.map((g, i) => `<li><b>SAL n. ${primoN + i}</b>${i === gruppi.length - 1 ? ' (resta in bozza)' : ' (emesso)'} — ${g.date.length ? `${esc(g.date[0])}${g.date.length > 1 ? ` → ${esc(g.date[g.date.length - 1])}` : ''}` : 'senza data'} · ${g.misure} misur${g.misure === 1 ? 'a' : 'e'}</li>`).join('')
    const v = await finestra(`Contabilità da ${nome}`, `
      <p class="lv-nota">${misure.length} misure datate. Le date vicine vanno nello stesso SAL; ogni misura si abbina alla voce del contratto vigente con lo stesso codice e prezzo e si aggiunge alle sue misure, che restano progressive. Quello che il contratto non ha si elenca, non si importa.</p>
      <ul class="lv-nota">${righe}</ul>
      <div class="lv-righe">
        ${campo('giorni', 'SAL nuovo dopo giorni', giorni, 'inputmode="numeric" style="width:110px"')}
        ${campo('dal', 'Solo le misure dal', dal, `placeholder="gg/mm/aaaa" style="width:130px"`)}
      </div>
      ${ultimoEmesso ? `<p class="lv-nota">C'è già il SAL n. ${ultimoEmesso.n} emesso (${esc(ultimoEmesso.data)}): se il file contiene anche quelle misure, scrivi da che data importare, o si conterebbero due volte.</p>` : ''}
      ${bozza ? `<p class="lv-nota">Il primo gruppo va nel SAL n. ${bozza.n}, in bozza.</p>` : ''}`, 'Importa')
    if (!v) return
    const g = Math.max(0, Math.round(Number(v.giorni) || 0))
    const d = (v.dal || '').trim()
    // cambiati i giorni o la data: si rifà la proposta e la si mostra di nuovo
    if (g === giorni && d === dal) break
    giorni = g; dal = d
  }
  let esito: ReturnType<typeof importaMisureSal> | null = null
  const ok = aggiorna((l) => { esito = importaMisureSal(l, misure, { giorni, ...(dal ? { dal } : {}) }); return esito.lavoro })
  if (!ok || !esito) return
  const e = esito as ReturnType<typeof importaMisureSal>
  const ultimo = e.sal[e.sal.length - 1]
  if (ultimo) { vista.mostra = 'misurate'; apri(ultimo) }
  const msg = `${e.abbinate} misure in ${e.sal.length} SAL${e.saltate ? ` · ${e.saltate} saltate (prima del ${dal})` : ''}`
  if (!e.scartate.length) { toast(msg); return }
  const body = document.createElement('div')
  body.className = 'lv-form'
  body.innerHTML = `<p class="lv-nota">${esc(msg)}. Queste misure non sono entrate: il contratto non ha la voce (serve una perizia, con i suoi nuovi prezzi) o è a corpo (si scrive la quota %).</p>
    <ul class="lv-nota">${e.scartate.map((x) => `<li><b>${esc(x.codice)}</b>${x.descrizione ? ` ${esc(x.descrizione)}` : ''} — ${esc(x.motivo)}</li>`).join('')}</ul>`
  await openModal({ title: 'Importate, con qualche misura lasciata fuori', body, actions: [{ label: 'Ho capito', variant: 'accent', value: true }] })
}

async function fileXpwe(input: HTMLInputElement): Promise<void> {
  const f = input.files?.[0]; input.value = ''
  if (_xpweConfronto) {
    const id = _xpweConfronto; _xpweConfronto = null
    if (!f) return
    try { await confrontaFile(id, f.name, xpweToVoci(parseXpwe(await f.text()))) }
    catch (e) { toast('File XPWE non leggibile: ' + ((e as Error).message || e)) }
    return
  }
  if (_xpwePerizia) {
    _xpwePerizia = false
    if (!f) return
    try { await importaFilePerizia(f.name, xpweToVoci(parseXpwe(await f.text()))) }
    catch (e) { toast('File XPWE non leggibile: ' + ((e as Error).message || e)) }
    return
  }
  if (_xpweNeiSal) {
    _xpweNeiSal = false
    if (!f) return
    try { await importaContabilita(f.name, xpweToVoci(parseXpwe(await f.text()))) }
    catch (e) { toast('File XPWE non leggibile: ' + ((e as Error).message || e)) }
    return
  }
  const r = rev(); if (!f || !r) return
  try {
    const doc = parseXpwe(await f.text())
    const voci = xpweToVoci(doc)
    if (!voci.length) { toast('Il file non contiene voci di computo'); return }
    aggiorna((l) => {
      let x = caricaVoci(l, r.id, voci.map(daXpwe))
      const dg = (doc as { datiGenerali?: unknown }).datiGenerali
      if (dg && !l.dati.oggetto) x = impostaDati(x, normalizzaDatiGenerali(dg))
      return x
    }, `${voci.length} voci importate da ${f.name} in ${sigla(r.numero)}`)
  } catch (e) { toast('File XPWE non leggibile: ' + ((e as Error).message || e)) }
}

/* ── Stampe ───────────────────────────────────────────────────────────── */

/** Le voci di una revisione nella forma che leggono i moduli di stampa. */
function vociPerStampa(r: Revisione): VoceComputo[] {
  const art = new Map(r.articoli.map((a) => [a.id, a]))
  return r.voci.map((v) => {
    const a = art.get(v.articolo)!
    return {
      codice: a.codice, desc_short: a.descrizione, declaratoria: a.estesa || a.descrizione, um: a.um, prezzo: a.prezzo ?? 0,
      qty: quantitaVoce(v), ...(v.misure.length ? { misurazioni: v.misure } : {}),
      ...(v.categoria ? { categoria: v.categoria } : {}), ...(v.wbs ? { wbs: v.wbs } : {}),
      ...(a.sicurezza ? { sicurezza: true } : {}), ...(v.corpo ? { corpo: true } : {}), ...(a.origine === 'np' || a.origine === 'analisi' ? { np: a.origine === 'np' } : {}),
      ...(a.origine === 'analisi' ? { analisiPrezzi: true } : {}), ...(a.codiceOrig ? { codiceOrig: a.codiceOrig } : {}),
      ...(a.incMdo != null ? { incMdo: a.incMdo } : {}),
    }
  })
}
const DOC_STAMPA: Record<string, string> = {
  'computo-metrico': 'Computo metrico estimativo', 'elenco-prezzi': 'Elenco prezzi unitari', 'stima-lavori': 'Stima dei lavori',
  'incidenza-manodopera': 'Incidenza della manodopera', 'incidenza-sicurezza': 'Incidenza della sicurezza',
  'elenco-np': 'Elenco dei nuovi prezzi', 'verbale-np-computo': 'Verbale dei nuovi prezzi',
  'quadro-economico': 'Quadro economico', 'lista-lavorazioni': 'Lista delle lavorazioni e forniture', 'quadro-offerte': 'Quadro comparativo delle offerte',
}
/** I file che escono dalla revisione: si salvano, non si stampano. */
const FILE_REVISIONE: Record<string, string> = { 'computo-excel': 'Computo in Excel', 'computo-xpwe': 'Computo in XPWE', 'analisi-excel': 'Fascicolo delle analisi in Excel' }
/* ── Le stampe della contabilità: le fa il motore della Contabilità ──────── */

/** Le stampe di ogni tipo di tappa contabile (le stesse dell'albero). */
const DOC_CONTABILI: Record<string, [string, string][]> = {
  sal: [['fascicolo', 'Atti del SAL — fascicolo unico'], ['libretto', 'Libretto delle misure'], ['registro', 'Registro di contabilità'], ['sommario', 'Sommario del registro'], ['sal', 'Stato di avanzamento lavori'], ['certificato', 'Certificato di pagamento'],
    ['consuntivo-pdf', 'Computo consuntivo'], ['sottocomputi', 'Libretto dei sotto-computi (lavori a corpo)'], ['situazione', 'Situazione contabile'], ['confronto', 'Confronto progetto / eseguito'], ['consuntivo', 'Computo consuntivo (atto della contabilità)'],
    ['sal-excel', 'SAL in Excel (file)'], ['registro-excel', 'Registro in Excel (file)'], ['sommario-excel', 'Sommario in Excel (file)']],
  salFinale: [['libretto', 'Libretto delle misure'], ['registro', 'Registro di contabilità'], ['stato-finale', 'Stato finale dei lavori'], ['conto-finale', 'Conto finale'],
    ['consuntivo-pdf', 'Computo consuntivo'], ['confronto', 'Confronto progetto / eseguito'], ['consuntivo', 'Computo consuntivo (atto della contabilità)'], ['penale', 'Ritardo e penale'], ['situazione', 'Situazione contabile']],
  cre: [['consuntivo-pdf', 'Computo consuntivo'], ['relazione-conto-finale', 'Relazione sul conto finale'], ['svincolo', 'Svincolo della ritenuta di garanzia'], ['penale', 'Ritardo e penale'], ['cre', 'Certificato di regolare esecuzione']],
  perizia: [['fascicolo-perizia', 'Atti della perizia — fascicolo unico'], ['perizia', 'Perizia di variante'], ['quadro-comparativo', 'Quadro comparativo'], ['verbale-np', 'Verbale di concordamento nuovi prezzi'], ['elenco-np', 'Elenco dei nuovi prezzi'], ['atto-sottomissione', 'Atto di sottomissione'], ['computo-metrico', 'Computo metrico di perizia']],
}

type Prodotto = { pdf: Uint8Array; pagine: number } | { html: string }

/** Un documento contabile per la tappa aperta (avanzamento o perizia), o null se non c'è. */
async function documentoContabile(tipo: string): Promise<{ titolo: string; genera: () => Promise<Prodotto>; bozza?: string } | null> {
  const m = contabilitaMotore(L)
  if (!m) return null
  const lib = async (): Promise<unknown> => { await loadPdfLib(); return (window as unknown as { PDFLib: unknown }).PDFLib }
  const pdf = (x: { bytes: Uint8Array; pagine: number }): Prodotto => ({ pdf: x.bytes, pagine: x.pagine })
  const a = av()
  if (a) {
    const elenco = DOC_CONTABILI[a.tipo] || []
    const nome = elenco.find(([t]) => t === tipo)?.[1]
    if (!nome) return null
    const n = a.tipo === 'cre' ? (L.avanzamenti.find((x) => x.tipo === 'salFinale')?.n ?? a.n) : a.n
    const sal = m.sals.find((x) => x.numero === n)
    const bozza = a.stato === 'bozza' ? `il ${titoloAvanzamento(a)} non è ancora ${a.tipo === 'cre' ? 'approvato' : 'emesso'}` : undefined
    const titolo = `${nome} — ${titoloAvanzamento(a)}`
    const g: Record<string, () => Promise<Prodotto>> = {
      libretto: async () => pdf(await librettoPdf(await lib(), m.appalto, m.partite, sal!)),
      registro: async () => pdf(await registroPdf(await lib(), m.appalto, m.partite, m.sals, n, m.liste)),
      sommario: async () => pdf(await sommarioPdf(await lib(), m.appalto, m.partite, m.sals, n, m.liste)),
      sal: async () => ({ html: salHTML(m.appalto, m.partite, m.sals, n, m.liste, m.verbali, a.data) }),
      certificato: async () => ({ html: certificatoHTML(m.appalto, m.partite, m.sals, n, m.liste) }),
      'stato-finale': async () => pdf(await statoFinalePdf(await lib(), m.appalto, m.partite, m.sals, m.liste)),
      'conto-finale': async () => ({ html: contoFinaleHTML(m.appalto, m.partite, m.sals, m.verbali, m.liste, m.riserve) }),
      'relazione-conto-finale': async () => ({ html: relazioneFinaleHTML(m.appalto, m.partite, m.sals, m.riserve, a.tipo === 'cre' ? a.note : L.avanzamenti.find((x) => x.tipo === 'cre')?.note, m.verbali, m.liste) }),
      sottocomputi: async () => {
        if (!corpiConSottoComputo(m.partite, n).length) throw new Error('Nessun lavoro a corpo con sotto-computo in questo SAL')
        return { html: librettoSottoComputiHTML(m.appalto, m.partite, sal!) }
      },
      'consuntivo-pdf': async () => {
        const voci = vociConsuntivo(L, a.id)
        if (!voci.length) throw new Error('Niente di contabilizzato in questo SAL')
        const st = strutturaDi(revDiAv(a))
        return pdf(await computoPdf(await lib(), voci, L.dati as Record<string, never>, { titolo: 'COMPUTO CONSUNTIVO', wbsNodi: st.wbsNodi, descrizione: leggiPreferenzeStampa().descrizione === 'ridotta' ? 'ridotta' : 'estesa' }))
      },
      situazione: async () => pdf(await situazioneContabilePdf(await lib(), m.appalto, m.partite, m.sals, m.liste)),
      confronto: async () => pdf(await confrontoProgettoEseguitoPdf(await lib(), m.appalto, m.partite, m.sals, n, m.liste)),
      consuntivo: async () => ({ html: consuntivoHTML(m.appalto, m.partite, m.sals, n, m.liste) }),
      penale: async () => {
        const t = tempiMotore(m.appalto, m.verbali, oggi())
        return { html: stampaSemplice(m, 'Ritardo e penale', penaleHTML(penale(m.appalto, m.partite, t), t)) }
      },
      svincolo: async () => {
        const res = calcolaSalMotore(m.appalto, m.partite, m.sals, n, m.liste, m.perizie)
        return { html: stampaSemplice(m, 'Svincolo della ritenuta di garanzia', svincoloHTML(statoSvincolo(m.appalto, res?.ritenuta ?? 0))) }
      },
      // il SAL è un fascicolo: libretto, registro, sommario, SAL e certificato in un documento, nell'ordine del codice
      fascicolo: async () => {
        const pv = partiteVigenti(m.partite, m.perizie, n)
        return { html: fondiAtti([
          librettoHTML(m.appalto, pv, sal!, m.liste, m.consegne, undefined, m.sals),
          ...(corpiConSottoComputo(m.partite, n).length ? [librettoSottoComputiHTML(m.appalto, m.partite, sal!)] : []),
          registroHTML(m.appalto, pv, m.sals, m.riserve, m.liste, m.consegne, oggiISO()),
          sommarioHTML(m.appalto, pv, m.sals, n, m.liste),
          salHTML(m.appalto, m.partite, m.sals, n, m.liste, m.verbali, a.data),
          certificatoHTML(m.appalto, m.partite, m.sals, n, m.liste),
        ]) }
      },
    }
    if (!g[tipo] || ((tipo === 'libretto') && !sal)) return null
    return { titolo, genera: g[tipo], bozza }
  }
  const r = rev()
  if (r?.tipo === 'perizia') {
    const k = L.revisioni.filter((x) => x.tipo === 'perizia').sort((x, y) => x.ordine - y.ordine).findIndex((x) => x.id === r.id)
    const pz = m.perizie[k]
    const nome = DOC_CONTABILI.perizia.find(([t]) => t === tipo)?.[1]
    if (!pz || !nome || tipo === 'computo-metrico') return null
    const npDi = m.partite.filter((p) => p.np?.periziaN === pz.numero)
    const g: Record<string, () => Promise<Prodotto>> = {
      'fascicolo-perizia': async () => ({ html: fondiAtti([
        periziaHTML(m.appalto, m.partite, pz), quadroComparativoHTML(m.appalto, m.partite, pz),
        elencoNuoviPrezziHTML(m.appalto, npDi), attoSottomissioneHTML(m.appalto, m.partite, pz),
      ]) }),
      perizia: async () => ({ html: periziaHTML(m.appalto, m.partite, pz) }),
      'quadro-comparativo': async () => pdf(await quadroComparativoPdf(await lib(), m.appalto, m.partite, pz)),
      'verbale-np': async () => ({ html: verbaleHTML(m.appalto, { id: `vnp-${r.id}`, tipo: 'nuoviprezzi', data: r.data }, npDi) }),
      'elenco-np': async () => ({ html: elencoNuoviPrezziHTML(m.appalto, npDi) }),
      'atto-sottomissione': async () => ({ html: attoSottomissioneHTML(m.appalto, m.partite, pz) }),
    }
    return g[tipo] ? { titolo: `${nome} — ${sigla(r.numero)}`, genera: g[tipo], ...(r.stato === 'aperta' ? { bozza: 'la perizia non è ancora approvata' } : {}) } : null
  }
  return null
}

/** Un atto fatto di una sezione (penale, svincolo): nello stesso foglio degli altri. */
function stampaSemplice(m: NonNullable<ReturnType<typeof contabilitaMotore>>, titolo: string, corpo: string): string {
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(m.appalto), kicker: kickerDi(m.appalto, titolo), title: titolo,
    sub: `alla data del ${oggi()}`, headMeta: headMetaDi(m.appalto), bodyHTML: corpo,
    footer: { fields: footerFieldsDi(m.appalto), disc: 'D.Lgs. 36/2023 e Allegato II.14.', page: titolo },
  })
}

/** Gli Excel dell'avanzamento: SAL, registro, sommario. */
async function salvaExcelContabile(tipo: string): Promise<boolean> {
  const a = av(); const m = contabilitaMotore(L); if (!a || !m) return false
  const n = a.n
  const aoa = tipo === 'sal-excel' ? salAOA(m.appalto, m.partite, m.sals, n, m.liste) : tipo === 'registro-excel' ? registroAOA(m.appalto, m.partite, m.sals, m.liste) : tipo === 'sommario-excel' ? sommarioAOA(m.appalto, m.partite, m.sals, n, m.liste) : null
  if (!aoa) return false
  await loadXLSX()
  const X = (window as unknown as { XLSX: { utils: { book_new: () => unknown; aoa_to_sheet: (a: unknown[][]) => unknown; book_append_sheet: (wb: unknown, ws: unknown, n: string) => void }; write: (wb: unknown, o: Record<string, unknown>) => ArrayBuffer } }).XLSX
  const wb = X.utils.book_new()
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa as unknown[][]), tipo.replace('-excel', ''))
  salvaFile(`${tipo.replace('-excel', '')}-${a.n}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }))
  toast('Salvato')
  return true
}

/** La contabilità in formato aperto: uno zip di JSON, CSV e un leggimi, leggibile anche senza Quadra. */
async function lvFormatoAperto(): Promise<void> {
  const m = motoreOAvviso(); if (!m) return
  const file = pacchettoAperto({ appalto: m.appalto, partite: m.partite, sals: m.sals, economia: m.liste, consegne: m.consegne, riserve: m.riserve, verbali: m.verbali, giornale: m.giornale })
  await loadJSZip()
  const JSZip = (window as unknown as { JSZip: new () => { file: (p: string, c: string) => void; generateAsync: (o: { type: string }) => Promise<Blob> } }).JSZip
  const z = new JSZip()
  for (const f of file) z.file(f.nome, f.testo)
  salvaFile(`contabilita-${(String(L.dati.oggetto || 'lavoro')).replace(/[^\w-]+/g, '-').slice(0, 40)}.zip`, await z.generateAsync({ type: 'blob' }))
  toast(`Formato aperto: ${file.length} file nello zip`)
}

async function stampaContabile(tipo: string, formato = 'anteprima'): Promise<boolean> {
  if (tipo.endsWith('-excel') && av()) return salvaExcelContabile(tipo)
  if (tipo === 'cre') { toast('Il certificato di regolare esecuzione non ha ancora una stampa: c\'è la relazione sul conto finale'); return true }
  const d = await documentoContabile(tipo)
  if (!d) return false
  const nomeFile = d.titolo.replace(/[^\w.àèéìòù-]+/gi, '-')
  try {
    const out = await d.genera()
    // un atto di una tappa chiusa è un atto prodotto: entra nel registro degli atti, con la sua impronta
    if (!d.bozza) void registraAtto(tipo, d.titolo, 'html' in out ? out.html : undefined)
    if ((formato === 'docx' || formato === 'odt') && 'html' in out) { await salvaEditabile(out.html, nomeFile, formato); return true }
    if (formato === 'docx' || formato === 'odt') toast('Questo atto esce solo in PDF: si apre l\'anteprima')
    if ('pdf' in out) {
      anteprimaPdf(out.pdf, {
        titolo: d.titolo, nomeFile, nota: `${out.pagine} pagin${out.pagine === 1 ? 'a' : 'e'}${d.bozza ? ` · BOZZA: ${d.bozza}` : ''}`,
        rifai: async () => { const x = await d.genera(); return 'pdf' in x ? x.pdf : new Uint8Array() },
      })
    } else {
      // l'HTML segna la bozza sulla carta: un atto non emesso non si confonde con uno vero
      const html = d.bozza ? marcaBozza(out.html, d.bozza) : out.html
      anteprimaHTML(applicaStileStampa(html, leggiPreferenzeStampa().stile), {
        titolo: d.titolo, nomeFile, estensione: 'html',
        rifai: async () => applicaStileStampa(html, leggiPreferenzeStampa().stile),
      })
    }
  } catch (e) { toast('Errore nella stampa: ' + ((e as Error).message || e)) }
  return true
}

/** Registra un atto prodotto: tipo, SAL, data della tappa, impronta dell'HTML. */
async function registraAtto(tipo: string, label: string, html?: string): Promise<void> {
  const a = av()
  const data = a ? (a.emessoIl || a.data) : (rev()?.chiusaIl || rev()?.data || oggi())
  const impronta = html ? await improntaTesto(html) : null
  L = registraConsegna(L, { tipo, label, data, ...(a ? { salNumero: a.n } : {}), ...(impronta ? { impronta } : {}) })
  pubblica()
}
/** Un atto in Word o OpenDocument, da ritoccare. */
async function salvaEditabile(html: string, nome: string, formato: 'docx' | 'odt'): Promise<void> {
  await loadJSZip()
  const JSZip = (window as unknown as { JSZip: never }).JSZip
  salvaFile(`${nome}.${formato}`, await esportaEditabile(html, formato, JSZip))
  toast(`${nome}.${formato}: salvato`)
}

async function stampaDocumento(tipo: string, formato = 'anteprima'): Promise<void> {
  if (FILE_REVISIONE[tipo] && rev()) { await salvaFileRevisione(tipo); return }
  if (tipo === 'registro-bianco') { await stampaRegistroBianco(); return }
  if (tipo === 'dati-contratto') { const m = motoreOAvviso(); if (m) stampaHtml('Dati del contratto', datiContrattoHTML(m.appalto, m.partite)); return }
  if (tipo === 'copertina') { const m = motoreOAvviso(); if (m) stampaHtml('Copertina', frontespizioHTML(m.appalto, m.partite)); return }
  if (av() || (rev()?.tipo === 'perizia' && tipo !== 'computo-metrico' && tipo !== 'elenco-prezzi' && tipo !== 'stima-lavori')) {
    if (!(await stampaContabile(tipo, formato))) toast('Questa stampa non è disponibile per questa tappa')
    return
  }
  const r = rev(); if (!r) return
  if (!DOC_STAMPA[tipo]) { toast('Questa stampa non è ancora disponibile'); return }
  if (!r.voci.length) { toast('La revisione non ha voci da stampare'); return }
  await loadPdfLib()
  const lib = (window as unknown as { PDFLib: unknown }).PDFLib
  const genera = async (): Promise<{ bytes: Uint8Array; pagine: number }> => {
    const voci = vociPerStampa(r), dg = L.dati as Record<string, never>
    const np = voci.filter((v) => v.np || v.analisiPrezzi)
    if (tipo === 'elenco-prezzi') return elencoPrezziPdf(lib, voci, dg)
    if (tipo === 'stima-lavori') return stimaLavoriPdf(lib, voci, dg)
    if (tipo === 'incidenza-manodopera') return incidenzaManodoperaPdf(lib, voci, dg, { wbsNodi: strutturaDi(r).wbsNodi })
    if (tipo === 'incidenza-sicurezza') return incidenzaSicurezzaPdf(lib, voci, dg)
    if (tipo === 'elenco-np') { if (!np.length) throw new Error('Questa revisione non ha nuovi prezzi'); return elencoPrezziPdf(lib, np, dg, { titolo: 'ELENCO DEI NUOVI PREZZI' }) }
    if (tipo === 'verbale-np-computo') { if (!np.length) throw new Error('Questa revisione non ha nuovi prezzi'); return verbaleNuoviPrezziPdf(lib, np, dg) }
    if (tipo === 'lista-lavorazioni') return listaLavorazioniPdf(lib, voci, dg)
    if (tipo === 'quadro-economico') { const imp = importiRevisione(r); return quadroEconomicoPdf(lib, calcolaQE(normalizzaQE(r.qe), imp.lavori, imp.sicurezza), dg) }
    if (tipo === 'quadro-offerte') { if (!(r.offerte || []).length) throw new Error('Nessuna offerta registrata su questa revisione: «⌸ Offerte…»'); return quadroComparativoOffertePdf(lib, voci, r.offerte!, dg) }
    return computoPdf(lib, voci, dg, { descrizione: leggiPreferenzeStampa().descrizione === 'ridotta' ? 'ridotta' : 'estesa', wbsNodi: strutturaDi(r).wbsNodi })
  }
  try {
    const out = await genera()
    anteprimaPdf(out.bytes, {
      titolo: `${DOC_STAMPA[tipo]} — ${sigla(r.numero)}`, nomeFile: `${DOC_STAMPA[tipo]}-${sigla(r.numero)}`.replace(/\s+/g, '-'),
      nota: `${out.pagine} pagin${out.pagine === 1 ? 'a' : 'e'}`, rifai: async () => (await genera()).bytes,
    })
  } catch (e) { toast('Errore nella stampa: ' + ((e as Error).message || e)) }
}
/** Un file della revisione: Excel, XPWE, fascicolo delle analisi. */
async function salvaFileRevisione(tipo: string): Promise<void> {
  const r = rev(); if (!r) return
  const voci = vociPerStampa(r)
  const xlsx = async (): Promise<{ utils: { book_new: () => unknown; aoa_to_sheet: (a: unknown[][]) => Record<string, unknown>; book_append_sheet: (wb: unknown, ws: unknown, n: string) => void }; write: (wb: unknown, o: Record<string, unknown>) => ArrayBuffer }> => { await loadXLSX(); return (window as unknown as { XLSX: never }).XLSX }
  try {
    if (tipo === 'computo-xpwe') {
      salvaFile(`computo-${sigla(r.numero)}.xpwe`, buildXpwe(voci, { datiGenerali: normalizzaDatiGenerali(L.dati) as never, sorgente: 'Quadra' }), 'application/xml')
    } else if (tipo === 'computo-excel') {
      const X = await xlsx()
      const wb = X.utils.book_new()
      const ws = X.utils.aoa_to_sheet(computoMetricoAOA(voci.map((v) => ({ codice: v.codice, descrizione: v.desc_short || v.declaratoria || '', categoria: v.categoria, um: v.um || '', quantita: v.qty ?? 0, prezzoUnitario: v.prezzo ?? 0 }))))
      X.utils.book_append_sheet(wb, ws, 'Computo')
      salvaFile(`computo-${sigla(r.numero)}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }))
    } else if (tipo === 'analisi-excel') {
      const tutte = analisiDi(L)
      if (!tutte.length) { toast('Nessuna analisi prezzi nel lavoro'); return }
      const X = await xlsx()
      const wb = X.utils.book_new()
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(fascicoloIndiceAOA(tutte)), 'Indice')
      tutte.forEach((a, i) => X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(analisiPrezziAOA(a)), fascicoloSheetName(a, i)))
      salvaFile(fascicoloFileName(), X.write(wb, { type: 'array', bookType: 'xlsx' }))
    } else return
    toast(`${FILE_REVISIONE[tipo]}: salvato`)
  } catch (e) { toast('Non riesco a salvare: ' + ((e as Error).message || e)) }
}

async function lvStampa(): Promise<void> {
  const a = av()
  const r = rev()
  const elenco: [string, string][] = a ? (DOC_CONTABILI[a.tipo] || [])
    : r?.tipo === 'perizia' ? DOC_CONTABILI.perizia
    : r?.tipo === 'contratto' ? [...Object.entries(DOC_STAMPA), ['registro-bianco', 'Registro di contabilità in bianco, da vidimare'] as [string, string], ['copertina', 'Copertina della contabilità'] as [string, string], ['dati-contratto', 'Dati del contratto'] as [string, string]]
    : [...Object.entries(DOC_STAMPA), ...Object.entries(FILE_REVISIONE).map(([k, v]): [string, string] => [k, `${v} (file)`])]
  if (!a && !r) return
  const titolo = a ? titoloAvanzamento(a) : sigla(r!.numero)
  const v = await finestra(`Stampa — ${titolo}`, `
    <p class="lv-nota">Le stampe di questa tappa. Si guardano in anteprima, dove si sceglie anche l'aspetto del foglio.${(a && a.stato === 'bozza') || (r?.tipo === 'perizia' && r.stato === 'aperta') ? ' La tappa non è ancora chiusa: le stampe escono marcate come <b>bozza</b>.' : ''}</p>
    ${scelta('tipo', 'Documento', elenco)}
    ${a || r?.tipo === 'perizia' ? scelta('formato', 'Formato', [['anteprima', 'Anteprima (stampa o PDF)'], ['docx', 'Word (.docx), da ritoccare'], ['odt', 'OpenDocument (.odt), da ritoccare']], 'anteprima') : ''}
  `, 'Continua')
  if (v) await stampaDocumento(v.tipo, v.formato || 'anteprima')
}

function lvAiuto(): void {
  void openModal({ title: 'Come si lavora qui', message: 'Ogni tappa del lavoro si apre in questa schermata, dalla sidebar. Le voci si aggiungono con «＋ Voce libera» o importando un XPWE; sotto ogni voce ci sono le sue misure, come nel foglio di computo: si scrivono cella per cella (par.ug., lung., larg., H/peso; Tab = cella accanto, Invio = riga sotto, segno meno = detrazione, anche formule come 2x3,5) e la riga SOMMANO porta quantità, prezzo e importo. «☰ Solo voci» nella barra nasconde le misure. Il tasto destro su una voce apre i suoi comandi. Quando la revisione è pronta si consegna: da lì si legge e non si modifica; per cambiarla si fa una revisione nuova.', actions: [{ label: 'Chiudi', variant: 'accent', value: true }] })
}

/* ── Il pannello prezzi ───────────────────────────────────────────────── */

function lvPzApri(scheda?: SchedaPrezzi): void { pz.aperto = true; if (scheda && scheda !== pz.scheda) { pz.scheda = scheda; pz.q = ''; trova() } render() }
function lvPzChiudi(): void { pz.aperto = false; render() }
function lvPzScheda(s: SchedaPrezzi): void { pz.scheda = s; pz.q = ''; pz.soloNp = false; if (s === 'prezzario' && !pz.prezzario) void scegliIniziale(); render() }
function lvPzSoloNp(on: boolean): void { pz.soloNp = on; render() }
let _pzT: number | undefined
function lvPzCerca(testo: string): void {
  pz.q = testo
  if (pz.scheda !== 'prezzario') { render(); return }
  clearTimeout(_pzT)
  _pzT = window.setTimeout(() => { trova(); render() }, 160)
}
const MAX_SFOGLIA = 200
function trova(): void {
  const base = filtraPrezzario(pz.righe, pz.filtri)
  pz.trovate = pz.q.trim() ? cercaNelPrezzario(base, pz.q, 80) : base.slice(0, MAX_SFOGLIA)
}
/** Un filtro del prezzario (vuoto = tolti tutti); scegliendo più in alto si azzera quello sotto. */
function lvPzFiltro(campo: string, valore: string): void {
  if (!campo) pz.filtri = {}
  else {
    const f = { ...(pz.filtri || {}), [campo]: valore || undefined }
    if (campo === 'disciplina') { delete f.sistema; delete f.settore }
    if (campo === 'sistema') delete f.settore
    pz.filtri = f
  }
  trova(); render()
}

async function aggiornaPrezzari(): Promise<void> {
  try { pz.prezzari = await prezzariDisponibili() } catch { pz.prezzari = [] }
}
/** Il prezzario da cui si parte: l'ultimo usato in questo lavoro, o nel programma. */
async function scegliIniziale(): Promise<void> {
  if (!pz.prezzari.length) await aggiornaPrezzari()
  const ult = L.prezzari.at(-1)?.id
  const ricordato = ultimoPrezzario()
  const id = [ult, ricordato ? `arc:${ricordato}` : null].find((x) => x && pz.prezzari.some((p) => p.id === x)) || pz.prezzari[0]?.id
  if (id) await lvPzScegli(id)
}
async function lvPzScegli(id: string): Promise<void> {
  if (!id) return
  if (!pz.prezzari.length) await aggiornaPrezzari()
  pz.prezzario = id; pz.righe = []; pz.trovate = []; pz.filtri = {}; pz.stato = 'Carico il prezzario…'
  render()
  try {
    const righe = await caricaPrezzario(id)
    if (pz.prezzario !== id) return
    pz.righe = righe
    pz.stato = `${righe.length.toLocaleString('it-IT')} voci${pz.q ? '' : ' · le prime in ordine di codice, oppure cerca'}`
    trova()
  } catch (e) { pz.stato = 'Prezzario non caricabile: ' + ((e as Error).message || e) }
  render()
}

/** Una voce nuova nella revisione aperta, da un articolo che viene da fuori. */
function prendi(a: Omit<Articolo, 'id'>, prezzario?: { id: string; nome: string; regione?: string; anno?: string }): void {
  // su una pagina di analisi, la voce diventa una riga dell'analisi
  if (av() && contratto(L)?.contratto?.libero) {
    if (prezzario) aggiorna((l) => registraPrezzario(l, prezzario))
    misuraNelSalLibero(a)
    return
  }
  const ap = apAperta()
  if (ap) {
    const tipo = tipoDaVoce({ um: a.um, descrizione: a.descrizione })
    aggiorna((l) => aggiungiRigaAnalisi(l, ap.id, {
      tipo, descrizione: a.descrizione, um: a.um, quantita: 1, prezzoUnitario: a.prezzo ?? 0,
      ...(a.codice ? { fonte: { codice: a.codice, regione: prezzario?.regione || prezzario?.nome || '', anno: prezzario?.anno || '' } } : {}),
    }), `${a.codice || 'Voce'} nell'analisi (${tipo}): scrivi la quantità`)
    return
  }
  const r = rev()
  if (!r) { toast('Apri prima una revisione (o creane una dalla sidebar)'); return }
  let voceId = ''
  const ok = aggiorna((l) => {
    let x = prezzario ? registraPrezzario(l, prezzario) : l
    // in perizia un articolo che il contratto non ha è un nuovo prezzo
    const v = voceDaArticolo(x, r.id, r.tipo === 'perizia' ? { ...a, origine: 'np', codiceOrig: a.codiceOrig || a.codice } : a)
    voceId = v.id
    // la voce nasce con una riga di misura vuota, aperta: si misura subito
    x = modificaVoce(v.lavoro, r.id, v.id, { misure: [{ descrizione: '', quantita: 0 }] })
    return x
  })
  if (ok) {
    apriMisure(voceId); _fuocoDopo = `mis|${voceId}|0:descrizione`; render()
    toast(`${a.codice || 'Voce'} ${r.tipo === 'perizia' ? 'nella perizia' : 'nel computo'}: scrivi le misure`)
    requestAnimationFrame(() => document.querySelector(`[data-voce="${CSS.escape(voceId)}"]`)?.scrollIntoView({ block: 'center' }))
  }
}
function lvPzVoceDaArticolo(artId: string): void {
  const a = av()
  if (a) {
    // nel SAL l'articolo di contratto c'è già: si porta la sua voce nel libretto, con le misure aperte
    const v = revDiAv(a).voci.find((x) => x.articolo === artId); if (!v) return
    apriMisure(v.id)
    const riga = rigaDi(a, v.id)
    if (a.stato === 'bozza' && !riga.misure.length && !v.corpo) { _fuocoDopo = `mis|${v.id}|0:descrizione`; aggiorna((l) => modificaRigaAvanzamento(l, a.id, v.id, { misure: [{ descrizione: '', quantita: 0 }] })) }
    else render()
    requestAnimationFrame(() => document.querySelector(`[data-voce="${CSS.escape(v.id)}"]`)?.scrollIntoView({ block: 'center' }))
    return
  }
  const r = rev(); if (!r) return
  let voceId = ''
  const ok = aggiorna((l) => {
    const v = aggiungiVoce(l, r.id, { articolo: artId }); voceId = v.id
    return modificaVoce(v.lavoro, r.id, v.id, { misure: [{ descrizione: '', quantita: 0 }] })
  })
  if (ok) { apriMisure(voceId); _fuocoDopo = `mis|${voceId}|0:descrizione`; render() }
}
async function lvPzModificaArticolo(artId: string): Promise<void> {
  const r = rev(); if (!r) return
  const a = r.articoli.find((x) => x.id === artId); if (!a) return
  const x = await finestraVoce(r, a, {}, `${a.codice || 'Articolo'} — modifica`)
  if (x) aggiorna((l) => modificaArticolo(l, r.id, artId, x.art))
}
function lvPzDaPrezzario(i: number): void {
  const x = pz.trovate[i]; if (!x) return
  const p = pz.prezzari.find((y) => y.id === pz.prezzario)
  prendi({
    codice: x.codice || '', descrizione: (x.desc_short || x.declaratoria || '').trim(),
    ...(x.declaratoria && x.declaratoria !== x.desc_short ? { estesa: x.declaratoria } : {}),
    um: x.um || '', prezzo: Number.isFinite(x.prezzo) ? x.prezzo : null, origine: 'prezzario', ...(pz.prezzario ? { prezzario: pz.prezzario } : {}),
    ...(x.ru ? { incMdo: x.ru } : {}),
  }, p ? { id: p.id, nome: p.nome, ...(p.regione ? { regione: p.regione } : {}), ...(p.anno ? { anno: p.anno } : {}) } : undefined)
}

/* Un altro lavoro, aperto da file: se ne prendono gli articoli. */
function lvPzApriAltro(): void { ($('lv-file-ehub') as HTMLInputElement | null)?.click() }
async function fileAltro(input: HTMLInputElement): Promise<void> {
  const f = input.files?.[0]; input.value = ''
  if (!f) return
  try {
    const b = parseProgettoQuadra(await f.text())
    const altro = (b.tools as Record<string, unknown>).lavoro as Lavoro | undefined
    if (!altro || altro.versione !== 1) { toast('Il file non contiene un lavoro di questo programma'); return }
    pz.altro = { nome: b.name || f.name.replace(/\.[^.]+$/, ''), lavoro: altro, rev: altro.revisioni.at(-1)?.id || '' }
    pz.scheda = 'altro'; pz.q = ''; pz.aperto = true; render()
  } catch (e) { toast('File non leggibile: ' + ((e as Error).message || e)) }
}
function lvPzRevAltro(id: string): void { if (pz.altro) { pz.altro.rev = id; render() } }
function lvPzDaAltro(artId: string): void {
  const src = pz.altro?.lavoro.revisioni.find((x) => x.id === pz.altro!.rev)
  const a = src?.articoli.find((x) => x.id === artId); if (!a) return
  const { id: _id, ...copia } = a
  void _id
  prendi(copia)
}

/* Un prezzario in XPWE (elenco prezzi): entra nell'archivio del programma. */
function lvPzImportaXpwe(): void { ($('lv-file-pz') as HTMLInputElement | null)?.click() }
async function filePrezzario(input: HTMLInputElement): Promise<void> {
  const f = input.files?.[0]; input.value = ''
  if (!f) return
  toast(`Leggo ${f.name}…`)
  try {
    // XML (prezzari regionali), XPWE, Excel (FVG, listini, prezzari editoriali), CSV (Cratere): gli stessi lettori della pipeline
    const p = await leggiPrezzarioFile(f, async () => { await loadXLSX(); return (window as unknown as { XLSX: LibXlsx }).XLSX })
    await salvaPrezzario({ filename: f.name, format: p.formato, regione: p.regione, anno: p.anno, tipo: p.tipo, rows: p.rows, salvato: Date.now() })
    ricordaUltimo(f.name)
    await aggiornaPrezzari()
    if (corrente?.startsWith('§prezzario')) await lvPpScegli(`arc:${f.name}`)
    else { pz.scheda = 'prezzario'; pz.aperto = true; await lvPzScegli(`arc:${f.name}`) }
    toast(`${f.name}: ${p.rows.length.toLocaleString('it-IT')} voci (${p.regione}${p.anno ? ' ' + p.anno : ''}), nell'archivio del programma`)
  } catch (e) { toast('Prezzario non leggibile: ' + ((e as Error).message || e)) }
}

/* ── Il prezzario a tutta pagina (prezzario-pagina.ts) ──────────────────
   Le voci sono le stesse in memoria del pannello (caricaPrezzario le tiene
   in cache): una correzione qui si vede anche là. Quelle dell'archivio si
   riscrivono in IndexedDB poco dopo l'ultima modifica. */
let _pp = nuovoStatoPrezzario()

/** Dove porta «＋»: la revisione aperta (computo o perizia), detta in chiaro. */
function destinazionePrezzario(): string | null {
  const r = revAperta()
  return r ? `${r.tipo === 'perizia' ? 'perizia' : 'computo'} ${sigla(r.numero)}` : null
}
/** Apre la pagina sul prezzario dell'ultima volta (o il primo del programma). */
async function lvPpApri(): Promise<void> {
  if (!pz.prezzari.length) await aggiornaPrezzari()
  const ult = L.prezzari.at(-1)?.id, ricordato = ultimoPrezzario()
  const id = _pp.id || [ult, ricordato ? `arc:${ricordato}` : null].find((x) => x && pz.prezzari.some((p) => p.id === x)) || pz.prezzari[0]?.id
  if (id) await lvPpScegli(id)
  else { corrente = '§prezzario'; pz.aperto = false; render(); pubblica() }
}
async function lvPpScegli(id: string): Promise<void> {
  if (!id) return
  if (!pz.prezzari.length) await aggiornaPrezzari()
  _pp = { ...nuovoStatoPrezzario(), id, stato: 'Carico il prezzario…' }
  corrente = `§prezzario:${id}`; pz.aperto = false
  render(); pubblica()
  try {
    const righe = await caricaPrezzario(id)
    if (_pp.id !== id) return
    _pp = { ..._pp, righe, stato: '' }
  } catch (e) { _pp = { ..._pp, stato: 'Prezzario non caricabile: ' + ((e as Error).message || e) } }
  if (corrente === `§prezzario:${id}`) render()
}
let _ppT: number | undefined
function lvPpCerca(testo: string): void {
  clearTimeout(_ppT)
  _ppT = window.setTimeout(() => { _pp = { ..._pp, q: testo, mostra: BLOCCO }; render() }, 200)
}
function lvPpFiltro(campo: string, valore: string): void {
  let f = { ..._pp.filtri }
  if (!campo) f = {}
  else {
    f = { ...f, [campo]: valore || undefined }
    if (campo === 'disciplina') { delete f.sistema; delete f.settore }
    if (campo === 'sistema') delete f.settore
  }
  _pp = { ..._pp, filtri: f, mostra: BLOCCO }; render()
}
function lvPpAltre(): void { _pp = { ..._pp, mostra: _pp.mostra + BLOCCO }; render() }

/** Il prezzario aperto si scrive solo se è dell'archivio. */
function ppArchivio(): string | null {
  const f = _pp.id ? fileArchivio(_pp.id) : null
  if (!f) { toast('Il prezzario installato si consulta: «✎ Copia modificabile» per cambiarlo'); return null }
  return f
}
let _ppSalva: number | undefined
function ppSalva(): void {
  const f = _pp.id ? fileArchivio(_pp.id) : null; if (!f) return
  const righe = _pp.righe
  clearTimeout(_ppSalva)
  _ppSalva = window.setTimeout(() => {
    aggiornaRighePrezzario(f, righe).catch((e) => toast('Prezzario non salvato: ' + ((e as Error).message || e)))
  }, 500)
}
const numeroPp = (t: string): number | null => {
  const x = String(t).trim(); if (!x) return 0
  const n = /[+*/x:()]/i.test(x) ? leggiCampo(x).valore ?? NaN : leggiNumeroTesto(x)
  return n != null && Number.isFinite(n) ? n : null
}
function lvPpSet(i: number, campo: string, valore: string): void {
  if (!ppArchivio()) return
  const r = _pp.righe[i]; if (!r) return
  if (campo === 'prezzo' || campo === 'ru') {
    const n = numeroPp(valore)
    if (n == null) { toast('Numero non valido'); render(); return }
    r[campo] = n
  } else if (campo === 'codice' || campo === 'um') r[campo] = String(valore).trim()
  else if (campo === 'desc_short') {
    const v = String(valore).trim()
    if (!r.declaratoria || r.declaratoria === r.desc_short) r.declaratoria = v
    r.desc_short = v
  } else return
  ppSalva()
}
/** Una riga vuota del prezzario, con tutti i campi (si scrivono poi nella tabella). */
function rigaVuota(): PriceRow {
  return { codice: '', declaratoria: '', desc_short: '', um: '', prezzo: 0, importo_netto: 0, ru: 0, liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina: '', sistema: '', attivita: '', settore: '', keywords: '', tipologia: '', regione: '', anno: '' } as PriceRow
}
function lvPpNuova(): void {
  if (!ppArchivio()) return
  _pp.righe.push(rigaVuota())
  const i = _pp.righe.length - 1
  _pp = { ..._pp, q: '', filtri: {}, mostra: Math.max(_pp.mostra, _pp.righe.length) }
  ppSalva(); render()
  requestAnimationFrame(() => {
    const inp = document.querySelector<HTMLInputElement>(`#pp-${i}-codice input`)
    inp?.scrollIntoView({ block: 'center' }); inp?.focus()
  })
}
function lvPpTogli(i: number): void {
  if (!ppArchivio()) return
  const r = _pp.righe[i]; if (!r) return
  _pp.righe.splice(i, 1)
  ppSalva(); render()
  toast(`${r.codice || 'Voce'} tolta dal prezzario`)
}
async function lvPpVoce(i: number): Promise<void> {
  const r = _pp.righe[i]; if (!r) return
  const scrive = !!(_pp.id && fileArchivio(_pp.id))
  if (!scrive) {
    await finestra(r.codice || 'Voce', `<p><b>${esc(r.desc_short || '')}</b></p>${r.declaratoria && r.declaratoria !== r.desc_short ? `<p class="lv-nota">${esc(r.declaratoria)}</p>` : ''}
      <p class="lv-nota">${esc(r.um)} · € ${fmt(r.prezzo)}${r.ru ? ` · manodopera ${fmt(r.ru, 2)}%` : ''}</p>
      ${[r.disciplina, r.sistema, r.settore].filter(Boolean).length ? `<p class="lv-nota">${esc([r.disciplina, r.sistema, r.settore].filter(Boolean).join(' › '))}</p>` : ''}`, 'Chiudi')
    return
  }
  const x = await finestra(`${r.codice || 'Voce'} — modifica`, `
    <div class="lv-righe">
      ${campo('codice', 'Codice', r.codice || '', 'style="width:160px"')}
      ${campo('um', 'U.M.', r.um || '', 'style="width:70px"')}
      ${campo('prezzo', 'Prezzo €', fmt(r.prezzo), 'inputmode="decimal" style="width:110px"')}
      ${campo('ru', 'Manodopera %', r.ru ? fmt(r.ru, 2) : '', 'inputmode="decimal" style="width:110px"')}
    </div>
    ${campo('desc_short', 'Descrizione', r.desc_short || '')}
    <label class="lv-f"><span>Descrizione estesa (declaratoria)</span><textarea name="declaratoria" rows="6">${esc(r.declaratoria || '')}</textarea></label>`, 'Salva')
  if (!x) return
  const prezzo = numeroPp(x.prezzo), ru = numeroPp(x.ru)
  if (prezzo == null || ru == null) { toast('Numero non valido'); return }
  Object.assign(r, { codice: x.codice.trim(), um: x.um.trim(), prezzo, ru, desc_short: x.desc_short.trim(), declaratoria: x.declaratoria.trim() || x.desc_short.trim() })
  ppSalva(); render()
}
/** «＋»: la voce entra nella revisione aperta (computo o perizia), e si resta sul prezzario. */
function lvPpPrendi(i: number): void {
  const x = _pp.righe[i]; if (!x) return
  const r = revAperta(); if (!r) { toast('Nessun computo o perizia aperti in cui portare la voce'); return }
  const p = pz.prezzari.find((y) => y.id === _pp.id)
  const a: Omit<Articolo, 'id'> = {
    codice: x.codice || '', descrizione: (x.desc_short || x.declaratoria || '').trim(),
    ...(x.declaratoria && x.declaratoria !== x.desc_short ? { estesa: x.declaratoria } : {}),
    um: x.um || '', prezzo: Number.isFinite(x.prezzo) ? x.prezzo : null, origine: 'prezzario', ...(_pp.id ? { prezzario: _pp.id } : {}),
    ...(x.ru ? { incMdo: x.ru } : {}),
  }
  aggiorna((l) => {
    const y = p ? registraPrezzario(l, { id: p.id, nome: p.nome, ...(p.regione ? { regione: p.regione } : {}), ...(p.anno ? { anno: p.anno } : {}) }) : l
    return voceDaArticolo(y, r.id, r.tipo === 'perizia' ? { ...a, origine: 'np', codiceOrig: a.codice } : a).lavoro
  }, `${a.codice || 'Voce'} nel ${r.tipo === 'perizia' ? 'la perizia' : 'computo'} ${sigla(r.numero)}`)
}
/** Copia di un prezzario installato nell'archivio: lì si può modificare. */
async function lvPpCopia(): Promise<void> {
  const p = pz.prezzari.find((y) => y.id === _pp.id); if (!p || !_pp.righe.length) return
  const x = await finestra('Copia modificabile', `<p class="lv-nota">Il prezzario installato resta com'è: la copia va nell'archivio del programma su questo computer, e si modifica quella. Le voci sono ${_pp.righe.length.toLocaleString('it-IT')}.</p>
    ${campo('nome', 'Nome della copia', `${p.nome} (studio)`)}`, 'Crea la copia')
  if (!x) return
  const base = x.nome.trim() || `${p.nome} (copia)`
  const esistenti = new Set(pz.prezzari.filter((y) => y.origine === 'archivio').map((y) => y.filename))
  let nome = base, k = 2
  while (esistenti.has(nome)) nome = `${base} ${k++}`
  try {
    await salvaPrezzario({ filename: nome, format: 'copia', regione: p.regione ?? x.nome, anno: p.anno, tipo: p.categoria, rows: _pp.righe.map((r) => ({ ...r })), salvato: Date.now() })
    await aggiornaPrezzari()
    await lvPpScegli(`arc:${nome}`)
    toast(`«${nome}»: copia nell'archivio, ora si modifica`)
  } catch (e) { toast('Copia non riuscita: ' + ((e as Error).message || e)) }
}
async function lvPpTogliPrezzario(): Promise<void> {
  const f = ppArchivio(); if (!f) return
  const ok = await openModal({ title: 'Togliere il prezzario dall\'archivio?', message: `«${f}» non sarà più tra i prezzari del programma su questo computer. Le voci già portate nei lavori restano, con il loro prezzo.`, actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Togli', variant: 'accent', value: true }] })
  if (ok !== true) return
  await togliPrezzario(f)
  if (pz.prezzario === _pp.id) { pz.prezzario = null; pz.righe = []; pz.trovate = [] }
  _pp = nuovoStatoPrezzario()
  await aggiornaPrezzari()
  await lvPpApri()
}

/* ── Il dialogo con l'hub ─────────────────────────────────────────────── */

onHubMessage((hm) => {
  const m = hm as unknown as Record<string, unknown>
  if (m.type === 'hub:set-theme') document.documentElement.setAttribute('data-theme', String(m.theme))
  applySuiteAesthetics(m as HubToTool)
  if (m.type === 'hub:set-company') impostaStudioStampe((m.company as { name?: string } | null)?.name)
  if (m.type === 'hub:collect-state') sendToHub({ type: 'app:full-state', appId: 'lavoro', state: L } as never)
  if (m.type === 'hub:restore-state' && m.state) {
    const s = m.state as Lavoro
    if (s && s.versione === 1) { L = s; corrente = null; apri(L.revisioni.at(-1)?.id ?? null) }
  }
  if (m.type === 'hub:vai-a' && m.fase) apri(String(m.fase))
  if (m.type === 'hub:apri-documento' && m.fase && m.tipo) { apri(String(m.fase)); void stampaDocumento(String(m.tipo)) }
  if (m.type === 'hub:comando') {
    const c = String(m.comando)
    if (c.startsWith('t:')) eseguiAzioneTappa(c)
    else if (c === 'nuovo-computo') void lvNuovoComputo()
    else if (c === 'importa-xpwe') void lvImportaXpwe()
    else if (c === 'importa-xpwe-sal') lvImportaXpweSal()
    else if (c === 'nuova-analisi') void lvApNuova()
    else if (c === 'contabilita-libera') void lvContabilitaLibera()
    else if (c === 'contabilita-xpwe') void lvContabilitaXpwe()
    else if (c === 'libreria') void lvLibInserisci()
    else if (c === 'formato-aperto') void lvFormatoAperto()
    else if (c === 'fascicolo-analisi') lvApFascicolo()
    else if (c === 'importa-xpwe-perizia') void lvImportaXpwePerizia()
    else if (c === 'carica-prezzario') void lvPpApri()
    else if (c === 'promuovi') void lvPromuovi()
    else if (c === 'nuovo-sal') void lvNuovoSal()
    else if (c === 'sal-finale') void lvSalFinale()
    else if (c === 'perizia') void lvNuovaPerizia()
    else if (c === 'cre') void lvCre()
  }
})

Object.assign(window, {
  lvNuovoComputo, lvNuovaDaQuesta, lvDescrivi, lvConsegna, lvRiapri, lvVoceLibera, lvModificaVoce, lvSetQta, lvSetPrezzo,
  lvDuplica, lvElimina, lvMisSet, lvMisAggiungi, lvMisDuplica, lvMisElimina, lvMisTasti, lvToggleMisure, lvEspandiTutte,
  lvCerca, lvOrdine, lvMenuVoce, lvPromuovi, lvRibasso, lvNuovoSal, lvEmetti, lvNuovaPerizia, lvSalFinale, lvCre, lvImportaXpweSal, lvConfrontaXpwe, lvPrezziUnitari, lvSetOfferto, lvRibassoNp, lvMenuPagina, lvMisMenu, lvPzMenu,
  lvContabilitaLibera, lvContabilitaXpwe, lvImportoPattuito, lvPzFiltro, lvVariaPrezzi, lvPrezziDaPrezzario, lvRendiNP, lvConfrontaCodice, lvLibSalvaVoce, lvLibSalvaAnalisi, lvLibInserisci, lvStrRinomina, lvStrElimina, lvStrSposta, lvStrNuova, lvWbsCodice, lvWbsDescr, lvWbsNuovo, lvWbsElimina, lvModSalva, lvModApplica,
  lvMisVediVoce, lvMisIncolla, lvMisCopia, lvMisIncollaTutte, lvMisDaVoce, lvMisSposta, lvVoceSposta, lvDragVoce, lvDragSopra, lvDragFine, lvDropVoce,
  lvAq, lvAqMax, lvAqNuovo, lvAqApp, lvAqTogli, lvScNuova, lvSc, lvScTogli, lvScEseg, lvDatiSal, lvCtCF, lvFattNuova, lvFatt, lvFattTogli, lvFattStampa, lvRegistroAttiStampa, lvQE, lvQESic, lvQENuova, lvQETogli, lvOffNuova, lvOff, lvOffPrezzi, lvOffTogli, lvOffContratto, lvStampaRev,
  lvPpScegli, lvPpCerca, lvPpFiltro, lvPpAltre, lvPpSet, lvPpNuova, lvPpTogli, lvPpVoce, lvPpPrendi, lvPpCopia, lvPpTogliPrezzario,
  lvElRev, lvElFiltro, lvElCerca, lvElSet, lvElModifica, lvElNP, lvElTogli, lvElNuovo, lvElPannello,
  lvApNuova, lvAp, lvApRigaNuova, lvApRiga, lvApRigaTogli, lvApApplica, lvApDuplica, lvApTogli, lvApAggiorna, lvApStampa, lvApFascicolo, lvMenuAnalisi,
  lvGioNuovo, lvGio, lvGioTogli, lvGioStampa, lvAttoNuovo, lvAtto, lvAttoTogli, lvAttoStampa, lvRisNuova, lvRis, lvRisTogli, lvRisStampa,
  lvEcoNuova, lvEco, lvEcoTogli, lvEcoRigaNuova, lvEcoRiga, lvEcoRigaTogli, lvEcoStampa, lvScadStampa, lvCt, lvSospNuova, lvSosp, lvSospTogli, lvProrogaNuova, lvProroga, lvProrogaTogli, lvApri: (id: string) => apri(id), lvSalQta, lvSalQuota, lvMostra, lvApriDati, lvDato, lvImportaXpwe, lvStampa, lvAiuto,
  lvFileXpwe: fileXpwe,
  lvPzApri, lvPzChiudi, lvPzScheda, lvPzSoloNp, lvPzCerca, lvPzScegli, lvPzVoceDaArticolo, lvPzModificaArticolo, lvPzDaPrezzario,
  lvPzApriAltro, lvPzRevAltro, lvPzDaAltro, lvPzImportaXpwe, lvFileAltro: fileAltro, lvFilePrezzario: filePrezzario,
  /** Per i test e la console: il lavoro com'è adesso. */
  lvStato: () => ({ lavoro: L, corrente }),
})

impostaStileStampaPdf(() => leggiPreferenzeStampa().stile)
bindThemeShortcut(() => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', t)
  sendToHub({ type: 'app:theme', theme: t } as never)
})
render()
pubblica()
void aggiornaPrezzari().then(() => render())
try { window.parent.postMessage({ type: 'app:ready' }, '*') } catch { /* fuori da iframe */ }
