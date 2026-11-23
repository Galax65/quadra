/* Contabilità — shell del tool. Contabilità dei lavori pubblici che EVOLVE nel tempo:
   il workspace è una cronologia di cantiere. A sinistra si avanza nei giorni e si
   tengono anagrafica e computo; al centro la catena documentale come timeline di
   schede datate; a destra lo storico dei documenti prodotti.
   Le schede APRONO UN EDITOR: solo il primo libretto delle misure è generato in
   automatico dal computo, gli altri atti si editano durante il cantiere. Engine
   puro in ./engine/. */
import { impostaStudioStampe, impostaStileStampaPdf } from '../../shared/stampa/registro-pdf'
import { sendToHub, onHubMessage, loadXLSX, loadJSZip, loadPdfLib, bindThemeShortcut, applySuiteAesthetics, type HubToTool } from '../../shared'
import { htmlDocToSimpleDoc, buildSimpleDocxParts, DOCX_MIME, buildOdtParts, ODT_MIME, ODT_MIMETYPE_ENTRY } from '../../shared/doc'
import { bindGuideShortcut, toggleGuide } from '../../shared/ui/components'
import { registerGuide } from '../../shared/ui/guide'
import { BETA_GUIDE } from './data/guida'
import { sommaMisurazioni, type MisurazioneRiga } from '../../shared/compositore/misurazioni'
import { impostaCampo, leggiCampo, misureATesto, testoAMisure, copiaRighe, spostaRiga, type Fattore } from '../../shared/compositore/misure-edit'
import { leggiNumeroCampo, leggiNumeroTesto } from '../../shared/campo-numero'
import { spostaElemento } from '../../shared/ordine-computo'
import { misureTabellaHtml, valoreModificabile, valoreMostrato, type CampoMisura } from '../../shared/compositore/misure-tabella'
import { stampeDelComputo, stampeDellaContabilita, stampeHTML, type VoceStampa } from '../../shared/stampe/catalogo'
import { caricaPrezzario, categoriaDiRiga, cercaNelPrezzario, nomePrezzario, prezzariDisponibili, type PrezzarioDisponibile } from './prezzario'
import type { PriceRow } from '../computo/engine/types'
import { initAnalytics } from '../../shared/analytics'
import { importoQta } from '../../shared/importo'
import {
  importaComputo, ribassoPct, round2, totaleContrattuale, totaleContrattualeLavori, importoContrattualePartita,
  datiMancanti,
  eseguitoPartita, calcolaSals, voceVisibileInSal, voceSoppressaInSal,
  librettoPdf, registroPdf, sommarioPdf, quadroComparativoPdf,
  confrontoProgettoEseguitoPdf, confrontoProgettoEseguitoHtml, statoFinalePdf, statoFinaleHtml, situazioneContabilePdf, situazioneContabileHtml,
  proponiSal, contabilitaDaVoci, periziaDaVoci,
  partiteVigenti, quadroComparativo, allineaQuotaCorpo, quadroComparativoHTML, periziaApprovata, parametriRevisione, statoAccordoQuadro,
  frontespizioHTML, giornaleHTML, vociGiornale, librettoHTML, registroHTML, sommarioHTML, salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML,
  verbaleHTML, nuovoVerbale, VERBALE_LABEL, VERBALE_ART, VERBALE_DESC, VERBALE_TIPI,
  listaEconomiaHTML, nuovaLista, valorizzaLista,
  salAOA, registroAOA, sommarioAOA, aoaColWidths,
  nuoviPrezzi, codiceNP, schedaNP, assimila, prezzoNP, STATO_NP, ORIGINE_NP, elencoNuoviPrezziHTML,
  improntaSal, improntaTesto, improntaCorta, verificaSal, ALGO_IMPRONTA, ESITO_LABEL, registroAttiHTML,
  pacchettoAperto, righeDi,
  ordineIscrizione, paginaIniziale, atoContinua, statoRiserva, RISERVA_LABEL, GIORNI_ESPLICITAZIONE,
  scadenze, scadenzeUrgenti, SCADENZA_LABEL, scadenziarioHTML, GIORNI_CERTIFICATO, GIORNI_PAGAMENTO,
  anteprimaAggiunta, preparaAggiunta, ripartisciPerTariffa, salDiDestinazione, chiaveVoce,
  attoSottomissioneHTML, formaAtto, FORMA_LABEL,
  ammissibilitaSemplificata, inSemplificata, vistoFatturaHTML, totaliFatture, corrispondenza, SOGLIA_SEMPLIFICATA,
  registroInBiancoPdf, registroInBiancoHtml,
  quotaDaSottoComputo, quotaAttestata, sottoComputoCongelato, haSottoComputo, totaleSottoComputo, eseguitoSottoComputo, eseguitoVoceSotto, importoVoceSotto, quadraturaSottoComputo, avanzamentoDi, librettoSottoComputiHTML, corpiConSottoComputo,
  GIORNI_FIRMA_CONTO_FINALE, riserveAperte, importoRiserveAperte, OPZIONI_ATTO_DEFAULT,
} from './engine'
import type { Appalto, Partita, Sal, RigaSal, RigaGiornale, Riserva, Consegna, StatoBeta, Modalita, Verbale, VerbaleTipo, ListaEconomia, RigaOperaio, RigaMezzo, RigaProvvista, Perizia, StatoNuovoPrezzo, Verifica, Continuita, FirmaEsecutore, EsitoRiserva, Scadenza, Fattura, VoceSottoComputo, OpzioniAtto } from './engine'
import type { VoceImport } from './engine/import'
import { parseXpwe, xpweToVoci, buildXpwe, type VoceComputo } from '../../shared/xpwe/xpwe'
import { barraVoci, type AzioneBarra } from '../../shared/ui/barra-voci'
import { FASE_PERIZIA, FASE_SAL, OPZ_ORDINE, OPZ_VISTA, filtraVoci, grigliaHtml, piedeFaseHtml, rigaDettaglioHtml, testataAzioniHtml, testataTitoloHtml, type Cella, type RigaGriglia, type RigaVoce, type VistaVoci } from '../../shared/griglia'
import type { ModoOrdine } from '../../shared/ordine-computo'
import { TITOLO_RAMO, capitoloDi, type AzioneAlbero, contrattoVigente, inVigoreAlla, siglaRevisione, tipoRevisioneComputo, type FogliaAtto, type RamoLavoro, type Revisione } from '../../shared/revisioni'
import { descriviContratto, type AttoContratto } from '../../shared/contratto'
import { anteprimaPdf, anteprimaHTML } from '../../shared/ui/anteprima-pdf'
import { marcaBozza } from '../../shared/doc/doc'
import { applicaStileStampa, STILE_STAMPA_DEFAULT } from '../../shared/doc/stile-stampa'
import { leggiPreferenzeStampa, salvaPreferenzeStampa, PREFERENZE_STAMPA_DEFAULT, type PreferenzeStampa } from '../../shared/stampe/preferenze'
import { computoPdf, type OpzioniComputoPdf } from '../../shared/stampa/computo-pdf'
import { vociConsuntive, consuntivoHTML } from './engine/consuntivo'
import { periziaHTML } from './engine/perizia-atto'
import { elencoPrezziTabellaHTML, righeElencoHTML, type VoceElenco } from '../../shared/elenco-prezzi/tabella'
import { oggiISO, isoToIt, itToISO, addDaysISO, addDaysIt } from '../../shared/date-it'
import type { DatiGenerali } from '../../shared/dati-generali'

initAnalytics()

const DRAFT_KEY = 'beta:draft:v1'

interface FaseProgetto { id?: string; nome?: string; fase?: string; data?: string; totale?: number }
interface MiuCart { name?: string; items?: VoceImport[]; datiGenerali?: Partial<DatiGenerali>; revisioni?: FaseProgetto[]; contratto?: AttoContratto | null }
interface State {
  appalto: Appalto
  partite: Partita[]
  sals: Sal[]
  giornale: RigaGiornale[]
  riserve: Riserva[]
  relazione: string
  verbali: Verbale[]
  economia: ListaEconomia[]
  fatture: Fattura[]
  /** Quanti fogli stampare nel registro in bianco da far vidimare. */
  fogliRegistro: number
  consegne: Consegna[]
  dataCorrenteISO: string
  miuCart: MiuCart | null
  importMode: Modalita
  editor: { fase: string; tipo: string } | null
}

const emptyAppalto = (): Appalto => ({ oggetto: '', ente: { denominazione: '' }, impresa: { denominazione: '' }, modalita: 'misura', ivaPct: 10 })

/* ── Date: modello del tempo (ISO interno yyyy-mm-dd ↔ display gg/mm/aaaa) ── */
const todayISO = oggiISO

const S: State = {
  appalto: emptyAppalto(), partite: [], sals: [], giornale: [], riserve: [], relazione: '', verbali: [], economia: [], consegne: [], fatture: [], fogliRegistro: 20,
  dataCorrenteISO: todayISO(), miuCart: null, importMode: 'misura', editor: null,
}

/* ── Utility ── */
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const eur = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' as unknown as boolean }))
const pctFmt = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 5 }) + '%')
/* Nei campi i numeri si scrivono e si leggono all'italiana (virgola decimale),
   come nel computo: «60,59» e non «60.59». Si accettano anche le formule. */
const numIn = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '' : String(n).replace('.', ','))
/* Un campo di testo in cui si scrive un numero: separatori di sistema, a meno
   che non ci sia una formula (nelle misure si scrive «3,00*2»), e allora
   decide il valutatore delle formule. */
const leggiNum = (v: string): number | null =>
  /[+*/x:()]/i.test(String(v ?? '')) ? leggiCampo(v).valore : leggiNumeroTesto(v)
/** Valore di un campo <input type="number">: canonico, punto decimale (vedi shared/campo-numero). */
const leggiNumero = leggiNumeroCampo
const numFmt = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: 3 }))
/** Voci del libretto espanse (misure di dettaglio visibili) — stato effimero dell'editor. */
const libExpanded = new Set<string>()
/* La vista del libretto è quella del Computo: ricerca, ordine, espandi/collassa.
   Stesse parole, stessi comandi, stesso posto. */
let _libQ = ''
/* Vista e ordinamento delle voci: gli stessi del computo, perché la schermata è
   la stessa (shared/griglia). Valgono per il libretto di ogni SAL e per la perizia. */
type OrdineVoci = ModoOrdine
let _libVista: VistaVoci = 'tabella'
let _libSolo: 'misurate' | 'tutte' = 'misurate'
let _pzSolo: 'variate' | 'tutte' = 'tutte'
let _libOrdine: OrdineVoci = 'categorie'
const uid = (): string => Math.random().toString(36).slice(2, 9)
const $ = (id: string): HTMLElement | null => document.getElementById(id)
const val = (id: string): string => ($(id) as HTMLInputElement | null)?.value ?? ''

let _toastT: number | undefined
function toast(msg: string, ms = 2800): void { const el = $('toast'); if (!el) return; el.textContent = msg; el.hidden = false; clearTimeout(_toastT); _toastT = window.setTimeout(() => { el.hidden = true }, ms) }

/* ── Tema ── */
function applyTheme(t: string): void { document.documentElement.setAttribute('data-theme', t); const b = $('btnTheme'); if (b) b.textContent = t === 'dark' ? '☀' : '☾' }
function toggleTheme(): void { const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark'; applyTheme(next); sendToHub({ type: 'app:theme', theme: next }) }

/* ── Bus ── */
onHubMessage((m: Record<string, unknown>) => {
  if (m.type === 'hub:set-theme') { applyTheme(m.theme as string); if (m.palette) document.documentElement.setAttribute('data-palette', m.palette as string) }
  applySuiteAesthetics(m as HubToTool)
  if (m.type === 'hub:project-state' && m.source === 'pricelist') {
    const proj = m.project as MiuCart | undefined
    S.miuCart = proj && ((proj.items && proj.items.length) || (proj.revisioni && proj.revisioni.length) || proj.contratto?.voci?.length) ? proj : null
    /* Le fasi di progetto aprono la catena: l'albero in sidebar deve vederle
       arrivare, altrimenti PFTE ed esecutivo restano fuori dalla cronologia
       finché non si tocca qualcos'altro. */
    renderLeft(); renderTimeline(); pubblicaDatiLavoro()
  }
  if (m.type === 'hub:collect-state') sendToHub({ type: 'app:full-state', appId: 'contabilita', state: serialize() })
  if (m.type === 'hub:restore-state' && m.state) { hydrate(m.state as Partial<StatoBeta>); renderAll() }
  if (m.type === 'hub:set-company') impostaStudioStampe((m.company as { name?: string } | null)?.name)
  /* L'ALBERO IN SIDEBAR È LA NAVIGAZIONE: un ramo apre la fase, una foglia apre
     direttamente l'atto. Senza questo, cliccare una revisione lanciava lo
     strumento e basta — si finiva sempre sulla stessa schermata. */
  if (m.type === 'hub:vai-a' && m.fase) vaiA(String(m.fase))
  if (m.type === 'hub:apri-documento' && m.fase && m.tipo) openEditor(String(m.fase), String(m.tipo))
  if (m.type === 'hub:comando') {
    const c = String(m.comando)
    if (c === 'nuovo-sal') nuovoSalOggi()
    else if (c === 'nuova-perizia') nuovaPerizia()
    else if (c === 'importa-computo') openImport()
    else if (c.startsWith('elimina-perizia-')) delPerizia(Number(c.slice(16)))
    else if (c.startsWith('elimina-sal-')) delSal(Number(c.slice(12)))
  }
})

/* ── Persistenza ── */
/* Le fatture esistono solo nella contabilità semplificata: un progetto che non
   le usa non si porta dietro una chiave vuota. */
function serialize(): StatoBeta {
  const st: StatoBeta = { v: 1, appalto: S.appalto, partite: S.partite, sals: S.sals, giornale: S.giornale, riserve: S.riserve, relazione: S.relazione, verbali: S.verbali, economia: S.economia, consegne: S.consegne }
  if (S.fatture.length) st.fatture = S.fatture
  return st
}
function hydrate(st: Partial<StatoBeta> | null): void {
  if (!st) return
  S.appalto = { ...emptyAppalto(), ...(st.appalto || {}) }
  S.partite = Array.isArray(st.partite) ? st.partite : []
  S.sals = Array.isArray(st.sals) ? st.sals : []
  S.giornale = Array.isArray(st.giornale) ? st.giornale : []
  S.riserve = Array.isArray(st.riserve) ? st.riserve : []
  S.relazione = typeof st.relazione === 'string' ? st.relazione : ''
  S.verbali = Array.isArray(st.verbali) ? st.verbali : []
  S.economia = Array.isArray(st.economia) ? st.economia : []
  S.fatture = Array.isArray(st.fatture) ? st.fatture : []
  // i SAL ancora aperti riprendono la quota dal sotto-computo: è lì che vive
  for (const sal of S.sals) {
    if (sal.firmato) continue
    for (const p of S.partite) if (haSottoComputo(p)) allineaQuotaSotto(sal.numero, p.id)
  }
  S.consegne = Array.isArray(st.consegne) ? st.consegne : []
  S.importMode = S.appalto.modalita === 'corpo' ? 'corpo' : 'misura'
  S.dataCorrenteISO = itToISO(S.appalto.dataInizio) || S.dataCorrenteISO
}
/* Filosofia della suite: lo stato di lavoro vive SOLO nella
   sessione (RAM) + nel file di Progetto (.ehub, via collect-state/restore-state);
   NON viene persistito in localStorage. Così «Nuovo progetto» (che ricarica l'hub)
   riparte davvero da zero, senza far riemergere la contabilità di un altro lavoro.
   saveDraft resta come hook di modifica (no-op sulla persistenza). */
function saveDraft(): void {
  /* Lo stato non si persiste fuori sessione (vedi nota sopra), ma i DATI DEL
     LAVORO sì: viaggiano subito verso gli altri strumenti, che così scrivono le
     stesse intestazioni senza che nessuno ridigiti niente. */
  pubblicaDatiLavoro()
}
/* All'avvio azzera l'eventuale residuo localStorage di sessioni/versioni precedenti
   (Contabilità prima salvava una bozza): niente contabilità di un altro progetto. */
function clearDraftResidue(): void { try { localStorage.removeItem(DRAFT_KEY) } catch { /* off */ } }

/* ── Catena documentale: fasi datate ────────────────────────────────────── */
interface DocDesc { tipo: string; label: string; art: string; desc: string; gen: () => string; needsPartite: boolean; /** Atto che compare solo quando serve (es. l'elenco NP se ci sono nuovi prezzi). */ soloSe?: () => boolean; /** PDF «da registro» (pagine numerate, riporti), se previsto. */ pdf?: () => Promise<{ bytes: Uint8Array; pagine: number }>
  /** Schermata DI LAVORO: ci si scrive dentro. Senza questo è un'anteprima di
   *  stampa, copia esatta dell'atto che verrà emesso, e non si modifica. */
  lavoro?: boolean }
interface Fase { key: string; titolo: string; dataIt: string; salNumero?: number; docs: DocDesc[] }

/** Fase di un verbale/comunicazione del DL: evento datato con un solo atto. */
function verbaleFase(a: Appalto, v: Verbale): Fase {
  const titolo = `${VERBALE_LABEL[v.tipo]}${v.numero != null ? ` n. ${v.numero}` : ''}`
  return { key: `verb-${v.id}`, titolo, dataIt: v.data || '', docs: [
    { tipo: `verbale:${v.id}`, label: VERBALE_LABEL[v.tipo], art: VERBALE_ART[v.tipo], desc: VERBALE_DESC[v.tipo], needsPartite: false, gen: () => verbaleHTML(a, v, S.partite) },
  ] }
}
function fasi(): Fase[] {
  const a = S.appalto
  const avvio: Fase = { key: 'avvio', titolo: 'Avvio dei lavori', dataIt: a.dataInizio || '', docs: [
    { tipo: 'datiappalto', label: 'Dati del lavoro', art: '', desc: 'Stazione appaltante, impresa, contratto, termini, economia: i dati che vanno in testa a tutte le stampe.', needsPartite: false, gen: () => frontespizioHTML(a, S.partite) },
    { tipo: 'copertina', label: 'Copertina', art: 'Frontespizio', desc: 'Ente, oggetto, parti, quadro economico.', needsPartite: false, gen: () => frontespizioHTML(a, S.partite) },
    { tipo: 'giornale', label: 'Giornale dei lavori', art: 'art. 12', desc: 'Diario di cantiere, da compilare.', needsPartite: false, gen: () => giornaleHTML(a, S.giornale, S.sals, S.verbali, S.riserve) },
    { tipo: 'registrobianco', label: 'Registro in bianco da vidimare', art: 'art. 2215 c.c.', desc: `Fogli numerati e vuoti da bollare prima dell'inizio dei lavori (oggi ${S.fogliRegistro}).`, needsPartite: false, pdf: async () => registroInBiancoPdf(await pdfLib(), a, S.fogliRegistro), gen: () => registroInBiancoHtml(a, S.fogliRegistro) },
    { tipo: 'scadenziario', label: 'Scadenziario dei termini', art: 'artt. 7, 17, 125', desc: 'Che cosa scade e quando: certificati, pagamenti, anticipazione, riserve, conto finale.', needsPartite: false, gen: () => scadenziarioHTML(a, scadenzeDelLavoro(), isoToIt(S.dataCorrenteISO)) },
    { tipo: 'registroatti', label: 'Registro degli atti prodotti', art: 'art. 12 c. 10', desc: 'Atti stampati, sigilli dei SAL firmati e verifica delle impronte.', needsPartite: false, gen: () => registroAttiHTML(a, S.consegne, S.sals, _verifiche) },
  ] }
  // Le fasi centrali — SAL e verbali — sono eventi DATATI, ordinati cronologicamente
  // (i non datati in coda). Avvio resta in testa, ultimazione/conto finale in coda.
  const mid: Fase[] = []
  for (const sal of S.sals) {
    const listeSal = S.economia.filter((l) => (l.salNumero ?? 1) === sal.numero)
    const listeDocs: DocDesc[] = listeSal.map((l) => ({
      tipo: `lista:${l.id}`, label: `Lista in economia n. ${l.numero ?? ''}`.trim(), art: 'art. 181', desc: 'Operai, mezzi e provviste su ordine del DL.', needsPartite: false, gen: () => listaEconomiaHTML(a, l),
    }))
    mid.push({ key: `sal-${sal.numero}`, titolo: `Stato di avanzamento n. ${sal.numero}`, dataIt: sal.data || '', salNumero: sal.numero, docs: [
      // il libretto NON pretende un computo: una contabilità può nascere da zero,
      // le voci si creano qui (libere o dall'elenco prezzi) come in un computo
      /* SI MISURA IN UN POSTO SOLO. Le misure si inseriscono qui, e i cinque
         atti qui sotto sono ANTEPRIME esatte di ciò che verrà emesso: stesse
         misure, stessi prezzi, visti una volta sola. Prima il libretto, il
         registro e il SAL erano tre schermate di lavoro che mostravano le
         stesse righe in tre modi, e non si capiva quale facesse testo. */
      { tipo: 'misure', label: 'Misurazioni', art: '', desc: 'Le misure e le quantità eseguite in questo SAL: si scrivono qui, una volta sola.', needsPartite: false, lavoro: true, gen: () => librettoHTML(a, pvAl(sal.numero), sal, S.economia, S.consegne, opzAtto()) },
      { tipo: 'datisal', label: 'Dati del SAL', art: '', desc: 'Detrazioni, revisione prezzi, note, riserve e firme, date del certificato.', needsPartite: false, lavoro: true, gen: () => salHTML(a, S.partite, S.sals, sal.numero, S.economia, S.verbali, sal.data) },
      { tipo: 'libretto', label: 'Libretto delle misure', art: 'art. 13', desc: 'Misure e quantità eseguite (i prezzi stanno nel registro).', needsPartite: false, pdf: async () => librettoPdf(await pdfLib(), a, S.partite, sal, continuita('libretto', sal.numero)), gen: () => librettoHTML(a, pvAl(sal.numero), sal, S.economia, S.consegne, opzAtto()) },
      { tipo: 'sottocomputi', label: 'Libretto dei sotto-computi', art: 'art. 12', desc: "Da dove viene la percentuale di ogni corpo d'opera: le lavorazioni eseguite.", needsPartite: true, soloSe: () => corpiConSottoComputo(pvAl(sal.numero), sal.numero).length > 0, gen: () => librettoSottoComputiHTML(a, pvAl(sal.numero), sal) },
      { tipo: 'registro', label: 'Registro di contabilità', art: 'art. 14', desc: 'Credito progressivo e riserve.', needsPartite: true, pdf: async () => registroPdf(await pdfLib(), a, S.partite, S.sals, sal.numero, S.economia, continuita('registro', sal.numero)), gen: () => registroHTML(a, pvAl(sal.numero), S.sals, S.riserve, S.economia, S.consegne, S.dataCorrenteISO, opzAtto()) },
      { tipo: 'sommario', label: 'Sommario', art: 'art. 15', desc: 'Sintesi per categorie omogenee; in PDF voce per voce con richiamo alle pagine del registro.', needsPartite: true, pdf: async () => sommarioPdf(await pdfLib(), a, S.partite, S.sals, sal.numero, S.economia), gen: () => sommarioHTML(a, pvAl(sal.numero), S.sals, sal.numero, S.economia, opzAtto()) },
      { tipo: 'sal', label: `SAL n. ${sal.numero}`, art: 'art. 16', desc: 'Cascata dell\'importo, ritenuta 0,5%.', needsPartite: true, gen: () => salHTML(a, S.partite, S.sals, sal.numero, S.economia, S.verbali, sal.data) },
      { tipo: 'elencoNP', label: 'Elenco dei nuovi prezzi', art: 'art. 5 c. 7', desc: 'Lavorazioni non in contratto: derivazione, ribasso, iter.', needsPartite: true, soloSe: () => nuoviPrezzi(S.partite).length > 0, gen: () => elencoNuoviPrezziHTML(a, S.partite) },
    { tipo: 'certificato', label: 'Certificato di pagamento', art: 'art. 17', desc: 'Atto del RUP, credito in lettere.', needsPartite: true, gen: () => certificatoHTML(a, S.partite, S.sals, sal.numero, S.economia) },
      { tipo: 'consuntivo', label: 'Computo consuntivo', art: '', desc: "La contabilità letta come un computo: quantità eseguite, prezzi di contratto, categorie. Per il controllo del DL, non è un atto.", needsPartite: true, pdf: async () => computoPdf(await pdfLib(), vociConsuntive(a, S.partite, S.sals, sal.numero, S.economia), { oggetto: a.oggetto, committente: a.ente.denominazione, impresa: a.impresa?.denominazione, data: sal.data }, opzComputo()), gen: () => consuntivoHTML(a, S.partite, S.sals, sal.numero, S.economia, opzAtto()) },
      { tipo: 'confronto', label: 'Confronto progetto / eseguito', art: '', desc: 'Quantità e importi di contratto contro l\'eseguito, voce per voce.', needsPartite: true, pdf: async () => confrontoProgettoEseguitoPdf(await pdfLib(), a, S.partite, S.sals, sal.numero, S.economia), gen: () => confrontoProgettoEseguitoHtml(a, S.partite, S.sals, sal.numero, S.economia) },
      { tipo: 'situazione', label: 'Situazione contabile', art: '', desc: 'Contratto, avanzamento, certificati emessi e residui in una pagina.', needsPartite: true, pdf: async () => situazioneContabilePdf(await pdfLib(), a, S.partite, S.sals.filter((x) => x.numero <= sal.numero), S.economia), gen: () => situazioneContabileHtml(a, S.partite, S.sals.filter((x) => x.numero <= sal.numero), S.economia) },
      ...listeDocs,
    ] })
  }
  // La perizia è una TAPPA del lavoro, non una finestra: sta nella cronologia
  // alla sua data, con il suo quadro comparativo e i suoi nuovi prezzi.
  for (const pz of a.perizie || []) {
    const n = pz.numero
    mid.push({ key: `perizia-${n}`, titolo: `Perizia di variante n. ${n}`, dataIt: pz.data || '', docs: [
      { tipo: 'variante', label: 'Computo di variante', art: '', desc: 'Le quantità di perizia e i nuovi prezzi: si scrivono qui, una volta sola.', needsPartite: true, lavoro: true, gen: () => periziaHTML(a, S.partite, pz) },
      { tipo: 'perizia', label: `Perizia di variante n. ${n}`, art: 'art. 120', desc: "L'atto: motivazione, che cosa cambia, quadro economico di raffronto, nuovi prezzi, firme.", needsPartite: true, gen: () => periziaHTML(a, S.partite, pz) },
      { tipo: 'comparativo', label: 'Quadro comparativo', art: 'art. 120', desc: `Contratto vigente e perizia a confronto, voce per voce, dal SAL n. ${pz.dalSal}.`, needsPartite: true, pdf: async () => quadroComparativoPdf(await pdfLib(), a, S.partite, pz), gen: () => quadroComparativoHTML(a, S.partite, pz) },
      { tipo: 'elencoNP', label: 'Elenco dei nuovi prezzi della perizia', art: 'art. 5 c. 7', desc: 'Lavorazioni introdotte da questa perizia: derivazione, ribasso, iter.', needsPartite: true, soloSe: () => S.partite.some((x) => x.np?.periziaN === n), gen: () => elencoNuoviPrezziHTML(a, S.partite.filter((x) => x.np?.periziaN === n)) },
      // l'atto che accompagna la perizia: sottomissione entro il quinto, aggiuntivo oltre
      { tipo: 'sottomissione', label: FORMA_LABEL[formaAtto(S.partite, a, pz)], art: 'art. 5 c. 6 · art. 120 c. 9', desc: formaAtto(S.partite, a, pz) === 'aggiuntivo' ? 'Oltre il quinto: serve un accordo, non un atto imposto.' : "L'esecutore si obbliga agli stessi patti e prezzi, o dissente motivatamente.", needsPartite: true, gen: () => attoSottomissioneHTML(a, S.partite, pz) },
    ] })
  }
  for (const v of S.verbali) mid.push(verbaleFase(a, v))
  // Le fatture sono tappe datate come i verbali: ognuna porta il visto del DL.
  for (const f of S.fatture) {
    mid.push({ key: `fatt-${f.id}`, titolo: `Fattura n. ${f.numero || '—'}`, dataIt: f.data || '', docs: [
      { tipo: `fattura:${f.id}`, label: 'Visto del DL sulla fattura', art: 'art. 12 c. 11-bis', desc: 'Verifica della corrispondenza fra fatturato ed eseguito, e visto.', needsPartite: false, gen: () => vistoFatturaHTML(a, f, S.partite, S.sals, S.fatture, S.economia) },
    ] })
  }
  const sortKey = (f: Fase): string => itToISO(f.dataIt) || '9999-99-99'
  /* A parità di data l'ordine è quello dei fatti, non quello di inserimento: una
     perizia che vale dal SAL n ha cambiato il contratto PRIMA di quel SAL, quindi
     gli sta davanti; il SAL aperto dopo la perizia viene subito dopo di essa. */
  const ordine = (f: Fase): number => {
    if (f.salNumero) return f.salNumero * 10
    const pn = /^perizia-(\d+)$/.exec(f.key)?.[1]
    if (pn) { const pz = perziaByN(Number(pn)); return (pz?.dalSal ?? 1) * 10 - 1 }
    return 0
  }
  mid.sort((x, y) => sortKey(x).localeCompare(sortKey(y)) || ordine(x) - ordine(y))
  const chiusura: Fase = { key: 'chiusura', titolo: 'Ultimazione e conto finale', dataIt: '', docs: [
    { tipo: 'statofinale', label: 'Stato finale dei lavori', art: 'art. 18', desc: 'Quantità finali valorizzate, certificati emessi e credito residuo.', needsPartite: true, pdf: async () => statoFinalePdf(await pdfLib(), a, S.partite, S.sals, S.economia), gen: () => S.sals.length ? statoFinaleHtml(a, S.partite, S.sals, S.economia) : '<p>Nessun SAL registrato.</p>' },
    { tipo: 'contofinale', label: 'Conto finale', art: 'art. 18', desc: 'Riepilogo finale e credito residuo.', needsPartite: true, gen: () => contoFinaleHTML(a, S.partite, S.sals, S.verbali, S.economia, S.riserve, S.dataCorrenteISO) },
    { tipo: 'relazione', label: 'Relazione finale', art: 'art. 18', desc: 'Vicende, riserve e allegati.', needsPartite: true, gen: () => relazioneFinaleHTML(a, S.partite, S.sals, S.riserve, S.relazione, S.verbali, S.economia, S.dataCorrenteISO) },
  ] }
  return [avvio, ...mid, chiusura]
}
function findDoc(faseKey: string, tipo: string): { f: Fase; d: DocDesc } | null {
  const f = fasi().find((x) => x.key === faseKey); if (!f) return null
  const d = f.docs.find((x) => x.tipo === tipo); if (!d) return null
  return { f, d }
}
function consegnaDi(tipo: string, salNumero?: number): Consegna | undefined { return S.consegne.find((c) => c.tipo === tipo && c.salNumero === salNumero) }
/* ── UN SOLO REGISTRO, PAGINE CHE CONTINUANO ──────────────────────────────
   Libretto e registro non ricominciano da pagina 1 a ogni SAL: sono fogli
   dello stesso registro vidimato, e la numerazione va avanti (art. 14 All.
   II.14; art. 2215 c.c.). Le pagine già emesse le sa lo storico degli atti:
   se mancano, la numerazione riparte da 1 e nessun atto dichiara un «segue»
   che non può dimostrare. */
function continuita(tipo: string, salN: number): Continuita {
  return { paginaIniziale: paginaIniziale(S.consegne, tipo, salN), continua: atoContinua(S.consegne, tipo, salN) }
}
/** Partite col contratto vigente al SAL n (perizie di variante applicate). */
function pvAl(n: number): Partita[] { return partiteVigenti(S.partite, S.appalto.perizie, n) }
function salById(n?: number): Sal | undefined { return S.sals.find((s) => s.numero === n) }
function rigaFor(sal: Sal, pid: string): RigaSal { let r = sal.righe.find((x) => x.partitaId === pid); if (!r) { r = { partitaId: pid }; sal.righe.push(r) } return r }

/* ── Render: pannello sinistro ──────────────────────────────────────────── */
function renderLeft(): void {
  const a = S.appalto
  const app = $('bAppSummary')
  /* L'oggetto e la stazione appaltante sono già nella testata del cruscotto:
     ripeterli qui sotto era la stessa informazione due volte nella stessa
     schermata. Qui restano i dati che MANCANO, che è ciò che si viene a
     cercare. */
  if (app) app.innerHTML = (a.oggetto || a.ente.denominazione
    ? (a.cig ? `<div class="b-sumrow"><span>CIG</span><b>${esc(a.cig)}</b></div>` : '')
    : '<div class="b-muted">Nessun dato inserito. Comincia da «Dati del lavoro».</div>') + datiMancantiHTML()
  const comp = $('bComputoSummary')
  /* Il ponte col Computo non deve essere muto: se di là c'è un computo (meglio
     ancora, promosso a contratto col suo ribasso), qui si dice e si prende con
     un clic. Prima c'era scritto «nessun computo importato» e l'unico pulsante
     apriva un file: il collegamento c'era ma non si vedeva. */
  const pronto = S.miuCart?.items?.length ? S.miuCart.items.length : 0
  const ribPronto = S.miuCart ? ribassoDaApplicare(S.miuCart.datiGenerali) : null
  /* Il pannello dice il CONTRATTO, non la somma di tutto ciò che è in elenco:
     i nuovi prezzi di una perizia in bozza stanno a parte, perché contratto non
     sono finché quella perizia non è approvata. */
  const inBozza = new Set((S.appalto.perizie || []).filter((z) => !periziaApprovata(z)).map((z) => z.numero))
  const npBozza = S.partite.filter((p) => p.np?.periziaN != null && inBozza.has(p.np.periziaN))
  const inContratto = S.partite.length - npBozza.length
  if (comp) comp.innerHTML = S.partite.length
    ? `<div class="b-sumrow"><span>Voci di contratto</span><b>${inContratto}</b></div><div class="b-sumrow"><span>Totale lavori</span><b>${eur(totaleContrattualeLavori(S.partite).totale)}</b></div>`
      + (npBozza.length ? `<div class="b-sumrow b-muted"><span>Nuovi prezzi in perizia (bozza)</span><b>${npBozza.length}</b></div>` : '')
      + (pronto ? `<div class="b-muted" style="font-size:var(--fs-xs);margin-top:6px">Nello strumento Computo ci sono ${pronto} voci${ribPronto != null ? ` (ribasso ${pctFmt(ribPronto)})` : ''}. <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="importMiu()">Portale qui</button></div>` : '')
    : pronto
      ? `<div class="b-sumrow"><span>Pronto nel Computo</span><b>${pronto} voci</b></div>${ribPronto != null ? `<div class="b-sumrow"><span>Ribasso d'asta</span><b>${pctFmt(ribPronto)}</b></div>` : ''}
         <button class="ehb-btn ehb-btn--accent-soft b-block" style="margin-top:8px" onclick="importMiu()" title="Prende il computo dallo strumento Computo e lo usa come contratto di questo lavoro">⇩ Usa come contratto</button>`
      : '<div class="b-muted">Nessun computo. Importalo da un file, oppure fallo nel Computo e promuovilo a contratto: comparirà qui.</div>'
  const cur = $('bDataCorrente') as HTMLInputElement | null; if (cur) cur.value = isoToIt(S.dataCorrenteISO)
  const curCal = $('bDataCorrenteCal') as HTMLInputElement | null; if (curCal) curCal.value = S.dataCorrenteISO || ''
  // il pulsante delle fatture esiste solo dove la contabilità è semplificata
  const bf = $('bBtnFattura') as HTMLButtonElement | null
  if (bf) bf.hidden = !inSemplificata(S.appalto, S.partite)
  const fl = $('bFasiList')
  if (fl) fl.innerHTML = fasi().map((f) => {
    const doneN = f.docs.filter((d) => consegnaDi(d.tipo, f.salNumero)).length
    return `<button class="b-fase-link${doneN > 0 && doneN === f.docs.length ? ' is-done' : ''}" onclick="scrollFase('${f.key}')"><span class="b-fase-link__dot"></span>${esc(f.titolo)}<span class="b-fase-link__d">${esc(f.dataIt || '—')}</span></button>`
  }).join('')
}

/* ── OPZIONI DI STAMPA DEGLI ATTI ─────────────────────────────────────────
   Quanto testo portare in stampa e se mostrare le date dei rilevamenti. Non è
   un dato del lavoro ma una preferenza di chi stampa: sta nel programma, non
   nel file di progetto. */
let _pref: PreferenzeStampa = leggiPreferenzeStampa()
/* I PDF degli atti (libretto, registro…) rispettano le stesse impostazioni: il
   motore le legge ogni volta da qui, anche dopo un cambio fatto nell'anteprima. */
impostaStileStampaPdf(() => leggiPreferenzeStampa().stile)
/** Le opzioni degli atti sono una vista delle preferenze di stampa del programma. */
const opzAtto = (): OpzioniAtto => ({
  descrizione: _pref.descrizione === 'compatta' ? 'parziale' : _pref.descrizione,
  date: _pref.date,
  righeIniziali: _pref.righeMax,
  righeFinali: _pref.righeFinali,
})
function setOpzAtto(campo: 'descrizione' | 'date' | 'righeIniziali' | 'righeFinali', v: string): void {
  if (campo === 'date') _pref = { ..._pref, date: v === 'si' }
  else if (campo === 'descrizione') _pref = { ..._pref, descrizione: v === 'parziale' ? 'compatta' : (v as PreferenzeStampa['descrizione']) }
  else _pref = { ..._pref, [campo === 'righeIniziali' ? 'righeMax' : 'righeFinali']: Math.max(0, Math.min(40, Math.floor(Number(v) || 0))) }
  salvaPreferenzeStampa(_pref); reopenEditor()
  if ($('bStampaOpz')) apriImpostazioniStampa()
}

/* ── IMPOSTAZIONI DI STAMPA ───────────────────────────────────────────────
   Foglio, margini, carattere, testata, cartiglio e quanto testo delle voci.
   Stanno nelle preferenze di stampa del programma, le stesse del computo: una
   stampa di progetto e un atto contabile escono con lo stesso foglio. */
function setStile(campo: string, v: string): void {
  let st = { ..._pref.stile }
  if (campo.startsWith('margine.')) {
    const lato = campo.slice(8) as 'sopra' | 'sotto' | 'sinistra' | 'destra'
    st = { ...st, margini: { ...(st.margini || {}), [lato]: Math.max(0, Math.min(60, Number(v) || 0)) } }
  } else if (campo === 'corpo') st = { ...st, corpo: Math.max(6, Math.min(16, Number(v) || 10)) }
  else if (campo === 'intestazione' || campo === 'piede') st = { ...st, [campo]: v === 'si' }
  else st = { ...st, [campo]: v }
  _pref = { ..._pref, stile: st }
  salvaPreferenzeStampa(_pref)
  apriImpostazioniStampa()
}
/** Torna all'impianto standard (doc/stile-stampa.ts): A4, margini 15 e 20 a sinistra, lineare 10 pt. */
function ripristinaStile(): void {
  _pref = { ...PREFERENZE_STAMPA_DEFAULT, stile: { ...STILE_STAMPA_DEFAULT } }
  salvaPreferenzeStampa(_pref); apriImpostazioniStampa(); reopenEditor()
}
function apriImpostazioniStampa(): void {
  const _stile = _pref.stile
  const m = { ...STILE_STAMPA_DEFAULT.margini, ...(_stile.margini || {}) }
  const sel = (campo: string, val: string | undefined, voci: Array<[string, string]>): string =>
    `<select onchange="setStile('${campo}',this.value)">${voci.map(([v, et]) => `<option value="${v}"${val === v ? ' selected' : ''}>${esc(et)}</option>`).join('')}</select>`
  const si_no = (campo: string, on: boolean): string => sel(campo, on ? 'si' : 'no', [['si', 'sì'], ['no', 'no']])
  const d = opzAtto().descrizione ?? OPZIONI_ATTO_DEFAULT.descrizione
  modal(`<div class="b-modal__h" id="bStampaOpz">Impostazioni di stampa</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">Valgono per <b>tutte le stampe</b>, di progetto e di contabilità, in anteprima e in stampa definitiva. Sono preferenze di chi stampa: restano nel programma, non nel file del lavoro, e non cambiano gli importi né il contenuto contabile.</p>
      <p class="b-muted" style="margin:0 0 8px">Si cambiano anche dall'anteprima di ogni stampa («Aa Aspetto»), guardando il foglio. I PDF escono <b>PDF/A-2b</b>, il formato da conservazione, sempre con il carattere lineare incorporato.</p>
      <fieldset class="b-fieldset"><legend>Foglio</legend><div class="b-grid">
        <label class="b-field"><span>Formato</span>${sel('formato', _stile.formato || 'A4', [['A4', 'A4'], ['A3', 'A3'], ['Letter', 'Letter'], ['Legal', 'Legal']])}</label>
        <label class="b-field"><span>Orientamento</span>${sel('orientamento', _stile.orientamento || 'verticale', [['verticale', 'verticale'], ['orizzontale', 'orizzontale']])}</label>
        ${fld('Margine sopra (mm)', m.sopra, "setStile('margine.sopra',this.value)", 'number')}
        ${fld('Margine sotto (mm)', m.sotto, "setStile('margine.sotto',this.value)", 'number')}
        ${fld('Margine sinistro (mm)', m.sinistra, "setStile('margine.sinistra',this.value)", 'number')}
        ${fld('Margine destro (mm)', m.destra, "setStile('margine.destra',this.value)", 'number')}</div>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Testo</legend><div class="b-grid">
        <label class="b-field"><span>Carattere</span>${sel('carattere', _stile.carattere || 'sans', [['sans', 'lineare (Arimo)'], ['serif', 'graziato'], ['mono', 'monospazio']])}</label>
        ${fld('Corpo (punti)', _stile.corpo ?? STILE_STAMPA_DEFAULT.corpo, "setStile('corpo',this.value)", 'number')}</div>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Testata e cartiglio</legend><div class="b-grid">
        <label class="b-field"><span>Intestazione (ente e titolo)</span>${si_no('intestazione', _stile.intestazione !== false)}</label>
        <label class="b-field"><span>Piè di pagina</span>${si_no('piede', _stile.piede !== false)}</label></div>
        <p class="b-muted" style="margin:6px 0 0">Togliere la testata serve per stampare su carta intestata già prestampata. Il piè di pagina porta i campi dell'atto e la dichiarazione di legge: toglierlo è una scelta, non un dettaglio.</p>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Descrizione delle voci</legend><div class="b-grid">
        <label class="b-field"><span>Quanto testo</span><select onchange="setOpzAtto('descrizione',this.value)">
          <option value="ridotta"${d === 'ridotta' ? ' selected' : ''}>solo la descrizione breve</option>
          <option value="parziale"${d === 'parziale' ? ' selected' : ''}>inizio e fine della declaratoria</option>
          <option value="estesa"${d === 'estesa' ? ' selected' : ''}>declaratoria intera</option></select></label>
        ${d === 'parziale' ? fld('Prime righe', _pref.righeMax, "setOpzAtto('righeIniziali',this.value)", 'number') : ''}
        ${d === 'parziale' ? fld('Ultime righe', _pref.righeFinali, "setOpzAtto('righeFinali',this.value)", 'number') : ''}
        <label class="b-field"><span>Date dei rilevamenti (libretto)</span><select onchange="setOpzAtto('date',this.value)"><option value="si"${_pref.date !== false ? ' selected' : ''}>sì</option><option value="no"${_pref.date === false ? ' selected' : ''}>no</option></select></label></div>
        <p class="b-muted" style="margin:6px 0 0">Il taglio avviene su parola intera e dichiara l'omissione con […]: un atto non può far credere che la descrizione finisca lì. Le stesse righe valgono nel computo.</p>
      </fieldset>
    </div>
    <div class="b-modal__foot">
      <button class="ehb-btn ehb-btn--ghost" onclick="ripristinaStile()" title="A4 verticale, margini 15 mm e 20 a sinistra (rilegatura), lineare 10 pt, testata e piè di pagina">↺ Impianto standard</button>
      <button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal();reopenEditor()">Fatto</button>
    </div>`, true)
}

/** Opzioni per le stampe in forma di computo, dalle stesse preferenze. */
function opzComputo(): OpzioniComputoPdf {
  return {
    descrizione: _pref.descrizione, righeMax: _pref.righeMax, righeFinali: _pref.righeFinali,
    conRidotta: _pref.conRidotta, rigaWbs: _pref.rigaWbs, riepilogo: _pref.riepilogo, raggruppa: 'categorie',
  }
}

/** Comandi delle opzioni, accanto ai pulsanti di stampa dell'atto. */
function opzAttoHTML(tipo: string): string {
  const d = opzAtto().descrizione ?? OPZIONI_ATTO_DEFAULT.descrizione
  const sel = (v: string, et: string): string => `<option value="${v}"${d === v ? ' selected' : ''}>${et}</option>`
  const date = tipo === 'libretto'
    ? `<label class="b-opz" title="La data del rilevamento accanto alla tariffa">date
        <select onchange="setOpzAtto('date',this.value)"><option value="si"${_pref.date !== false ? ' selected' : ''}>sì</option><option value="no"${_pref.date === false ? ' selected' : ''}>no</option></select></label>`
    : ''
  // foglio, margini e carattere stanno nella finestra di stampa, con tutto il
  // resto: qui restano solo le scelte che cambiano ciò che si legge a schermo
  return `<span class="b-opzgrp" title="Quanto testo portare in stampa">
    <label class="b-opz">descrizione
      <select onchange="setOpzAtto('descrizione',this.value)">${sel('ridotta', 'breve')}${sel('parziale', 'inizio e fine')}${sel('estesa', 'intera')}</select>
    </label>${date}</span>`
}

/* ── DATI DEL CONTRATTO MANCANTI ──────────────────────────────────────────
   Un libretto importato non porta il ribasso d'asta, l'IVA, l'arrotondamento:
   sono dati del contratto. Se restano vuoti gli importi liquidati sono
   sbagliati, non incompleti — quindi si vedono qui, sempre, finché non ci sono. */
function datiMancantiHTML(): string {
  if (!S.partite.length) return ''
  const m = datiMancanti(S.appalto, S.partite)
  if (!m.length) return ''
  const critici = m.filter((x) => x.critico)
  const altri = m.filter((x) => !x.critico)
  const voce = (x: { cosa: string; perche: string }): string => `<li><b>${esc(x.cosa)}</b>: ${esc(x.perche)}</li>`
  return `<div class="b-mancanti${critici.length ? ' is-critico' : ''}">
    <div class="b-mancanti__h">${critici.length ? 'Dati del contratto che falsano gli importi' : 'Dati del contratto da completare'}</div>
    <ul class="b-mancanti__l">${critici.map(voce).join('')}${altri.map(voce).join('')}</ul>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft b-block" onclick="chiediDatiContratto()">Completa i dati del contratto</button>
  </div>`
}

/** Modale focalizzata sui dati economici del contratto: quelli che cambiano gli importi. */
function chiediDatiContratto(): void {
  const a = S.appalto
  const m = datiMancanti(a, S.partite)
  modal(`<div class="b-modal__h">Dati del contratto</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">La contabilità importata porta misure e prezzi, non le condizioni del contratto. Questi sono i dati che determinano gli importi da liquidare: finché mancano, gli atti lo dichiarano.</p>
      ${m.length ? `<ul class="b-mancanti__l">${m.map((x) => `<li><b>${esc(x.cosa)}</b>: ${esc(x.perche)}</li>`).join('')}</ul>` : '<p class="b-avviso b-avviso--ok">I dati essenziali del contratto risultano inseriti.</p>'}
      <fieldset class="b-fieldset"><legend>Condizioni economiche (netto IVA)</legend><div class="b-grid">
        ${fld('Base d\'asta', a.baseAsta, "setAppNum('baseAsta',this.value)", 'number', '0,00')}
        ${fld('Importo offerto', a.importoOfferta, "setAppNum('importoOfferta',this.value)", 'number', '0,00')}
        ${fld('Ribasso d\'asta %', a.ribassoPct, "setAppNum('ribassoPct',this.value)", 'number', 'es. 5,086')}
        ${fld('IVA %', a.ivaPct, "setAppNum('ivaPct',this.value)", 'number', 'es. 0, 10, 22')}
        ${fld('Arrotonda il certificato a € (per difetto)', a.arrotondamentoCertificato, "setAppNum('arrotondamentoCertificato',this.value)", 'number', 'es. 100')}
        ${fld('Oneri sicurezza non compresi nelle voci', a.oneriSicurezza, "setAppNum('oneriSicurezza',this.value)", 'number', '0,00')}</div>
        <label class="b-check"><input type="checkbox" ${a.prezziUnitari ? 'checked' : ''} onchange="setPrezziUnitari(this.checked)"><span><b>Offerta a prezzi unitari</b>: i prezzi delle partite sono già quelli offerti e il ribasso non si applica di nuovo.</span></label>
        <p class="b-muted" style="margin:6px 0 0">Il ribasso si applica ai soli lavori: i costi della sicurezza non lo subiscono. Se i costi della sicurezza sono già una voce del computo, lascia a zero il campo qui sopra.</p>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Contratto e tempi</legend><div class="b-grid">
        ${fld('N. contratto / repertorio', a.numeroContratto, "setApp('numeroContratto',this.value)", 'text', 'es. 2311')}
        ${fld('Data stipula', a.dataStipula, "setApp('dataStipula',this.value)", 'text', 'gg/mm/aaaa')}
        ${fld('Data consegna lavori', a.dataConsegna, "setApp('dataConsegna',this.value)", 'text', 'gg/mm/aaaa')}
        ${fld('Giorni utili per l\'ultimazione', a.giorniUtili, "setAppNum('giorniUtili',this.value)", 'number', 'es. 100')}
        ${fld('Art. capitolato per il pagamento', a.articoloCapitolato, "setApp('articoloCapitolato',this.value)", 'text', 'es. 2.18')}</div>
      </fieldset>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="openDati()">Tutti i dati dell\'appalto</button><button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal();renderAll()">Fatto</button></div>`, true)
}

/* ── Render: timeline centrale ──────────────────────────────────────────── */
function faseStato(f: Fase): 'done' | 'current' | '' { const iso = itToISO(f.dataIt); if (!iso) return ''; return iso < S.dataCorrenteISO ? 'done' : iso === S.dataCorrenteISO ? 'current' : '' }
function renderTimeline(): void {
  const el = $('bTimeline'); if (!el) return
  el.innerHTML = lineaHTML() + primiPassiHTML() + fasi().map((f) => {
    const stato = faseStato(f)
    const cards = f.docs.filter((d) => !d.soloSe || d.soloSe()).map((d) => {
      const prodotto = !!consegnaDi(d.tipo, f.salNumero)
      const disabled = d.needsPartite && !S.partite.length
      const piede = disabled ? '<span class="b-card__wait">serve il computo</span>'
        : prodotto ? '<span class="b-card__done">✓ prodotto</span>' : '<span class="b-card__go">✎ Modifica</span>'
      return `<button class="b-card${prodotto ? ' is-done' : ''}" ${disabled ? 'disabled' : ''} onclick="openEditor('${f.key}','${d.tipo}')" title="${disabled ? 'Importa prima il computo: questo atto valorizza le partite' : `Apri e modifica «${esc(d.label)}»`}">
        <span class="b-card__t"><span class="b-card__n">${esc(d.label)}</span>${d.art ? `<span class="b-card__art">${esc(d.art)}</span>` : ''}</span>
        <span class="b-card__d">${esc(d.desc)}</span>
        ${piede}
      </button>`
    }).join('')
    const excel = f.salNumero != null ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportExcel('sal',${f.salNumero})">⬇ SAL .xlsx</button><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="exportExcel('sommario',${f.salNumero})">⬇ Sommario .xlsx</button></div>` : ''
    return `<div class="b-fase ${stato === 'done' ? 'is-done' : ''} ${stato === 'current' ? 'is-current' : ''}" id="fase-${f.key}"><span class="b-fase__node"></span>
      <div class="b-fase__h"><span class="b-fase__t">${esc(f.titolo)}</span>${f.dataIt ? `<span class="b-fase__date">${esc(f.dataIt)}</span>` : ''}${stato === 'current' ? '<span class="b-fase__badge">oggi</span>' : ''}${f.salNumero && S.partite.length ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost b-fase__stampa" onclick="stampaAttiSal(${f.salNumero})" title="Produce insieme libretto, registro, sommario, SAL e certificato di pagamento">⎙ Atti del SAL</button>` : ''}</div>
      <div class="b-cards">${cards}</div>${excel}</div>`
  }).join('') + avantiHTML()
}

/* ── CHE COSA VIENE DOPO ──────────────────────────────────────────────────
   Finito un avanzamento, i passi possibili sono due: il SAL successivo e la
   perizia di variante. Erano comandi del pannello di sinistra, che sparisce
   quando si apre un atto a tutta pagina: chi aveva appena firmato il SAL non
   li trovava. Stanno in fondo alla catena documentale, dove si guarda. */
function avantiHTML(): string {
  if (!S.sals.length && !S.partite.length) return ''
  const ultimo = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
  const bozze = (S.appalto.perizie || []).filter((p) => !periziaApprovata(p))
  return `<div class="b-avanti">
    <div class="b-avanti__h">E adesso</div>
    <div class="b-avanti__r">
      <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="nuovoSalOggi()" title="${ultimo && !salFirmato(ultimo) ? `Il SAL n. ${ultimo} non è ancora firmato: puoi aprire il successivo, ma gli importi del precedente possono ancora cambiare` : 'Apre il libretto dell\'avanzamento successivo alla data corrente del cantiere'}">＋ Stato di avanzamento n. ${ultimo + 1}</button>
      <button class="ehb-btn ehb-btn--sm" onclick="nuovaPerizia()" title="Nuove quantità e nuovi prezzi dal SAL successivo: quadro comparativo, elenco dei nuovi prezzi, atto di sottomissione">＋ Perizia di variante${bozze.length ? ` n. ${Math.max(...(S.appalto.perizie || []).map((p) => p.numero)) + 1}` : ''}</button>
      ${(S.appalto.perizie || []).length ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="openPerizie()">Tutte le perizie…</button>` : ''}
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="openNuovoVerbale()" title="Verbali e comunicazioni del direttore dei lavori">＋ Verbale / atto del DL</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="openImport()" title="Aggiunge voci da un computo o da una contabilità: si sceglie dove vanno le misure">⭳ Importa voci</button>
    </div>
    <p class="b-avanti__n">${ultimo && !salFirmato(ultimo) ? `Il SAL n. ${ultimo} è ancora aperto: finché non lo firmi i suoi importi possono cambiare. ` : ''}${bozze.length
      ? `Perizia n. ${bozze.map((p) => p.numero).join(', n. ')} in bozza: finché non è approvata non cambia il contratto.`
      : `Il prossimo avanzamento parte dalle quantità già contabilizzate; una perizia vale dal SAL n. ${ultimo + 1} in poi e lascia intatti gli avanzamenti firmati.`}</p>
  </div>`
}
/* ── La linea del tempo del lavoro ────────────────────────────────────────
   Una barra sola, sempre visibile: contratto, SAL, perizie, chiusura. È il filo
   che tiene insieme progetto ed esecuzione — si vede dove si è e si salta dove
   serve, senza rifare il giro dalla catena documentale. */
/* ── LA CATENA DELLE REVISIONI ────────────────────────────────────────────
   La cronologia del lavoro in una fila sola: i computi di progetto congelati
   nel Computo, il contratto, le perizie, gli avanzamenti. Ogni avanzamento
   dichiara DA QUALE revisione legge i prezzi — ed è la regola che tiene in
   piedi tutto il resto: contratto fino alla perizia approvata, poi contratto
   più nuovi prezzi. Vedi src/shared/revisioni.ts. */
function catenaRevisioni(): Revisione[] {
  const a = S.appalto
  const out: Revisione[] = []
  const push = (r: Omit<Revisione, 'n'>): void => { out.push({ ...r, n: out.length }) }
  // i computi di progetto, come li ha congelati il Computo
  for (const r of (S.miuCart?.revisioni || [])) {
    // il tipo dalla FASE memorizzata, il nome per come la si è chiamata (e rinominata)
    const tipo = tipoRevisioneComputo(r.fase, r.nome)
    push({ tipo, etichetta: String(r.nome || r.fase || 'Progetto').replace(/^./, (c) => c.toUpperCase()), dataIt: r.data || undefined, stato: 'approvata', })
  }
  // il contratto: l'esecutivo con il ribasso o i prezzi offerti
  const rib = ribassoDelContratto()
  push({
    tipo: 'contratto', etichetta: 'Contratto', dataIt: a.dataStipula || undefined, fase: 'avvio', tool: 'contabilita',
    stato: S.partite.length ? 'approvata' : 'bozza', voci: S.partite.length,
    importo: S.partite.length ? totaleContrattualeLavori(S.partite).totale : null,
  })
  void rib
  // perizie e avanzamenti, nell'ordine dei fatti: una perizia che vale dal SAL
  // n sta prima di quel SAL, perché il contratto l'ha cambiato prima
  const perizieDal = (n: number): void => {
    for (const pz of (a.perizie || []).filter((p) => (p.dalSal ?? 1) === n).sort((x, y) => x.numero - y.numero)) {
      push({ tipo: 'perizia', etichetta: `Perizia n. ${pz.numero}`, dataIt: pz.data || undefined, fase: `perizia-${pz.numero}`, tool: 'contabilita',
        stato: periziaApprovata(pz) ? 'approvata' : 'bozza', voci: pz.voci?.length || 0 })
    }
  }
  for (const sal of [...S.sals].sort((x, y) => x.numero - y.numero)) {
    perizieDal(sal.numero)
    const vig = inVigoreAlla(out.map((r, i) => ({ ...r, n: i })), out.length)
    push({ tipo: 'sal', etichetta: `SAL n. ${sal.numero}`, dataIt: sal.data || undefined, fase: `sal-${sal.numero}`, tool: 'contabilita',
      stato: sal.firmato ? 'approvata' : 'bozza', leggeDa: vig?.n, voci: sal.righe.length })
  }
  // le perizie che valgono da un SAL non ancora aperto stanno in coda, dove accadranno
  const ultimo = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
  for (const pz of (a.perizie || []).filter((p) => (p.dalSal ?? 1) > ultimo).sort((x, y) => x.numero - y.numero)) {
    push({ tipo: 'perizia', etichetta: `Perizia n. ${pz.numero}`, dataIt: pz.data || undefined, fase: `perizia-${pz.numero}`, tool: 'contabilita',
      stato: periziaApprovata(pz) ? 'approvata' : 'bozza', voci: pz.voci?.length || 0 })
  }
  const cf = a.contoFinale?.dataCompilazione
  if (cf) {
    const vig = contrattoVigente(out)
    push({ tipo: 'contofinale', etichetta: 'Conto finale', dataIt: cf, fase: 'chiusura', tool: 'contabilita', stato: a.contoFinale?.dataFirma ? 'approvata' : 'bozza', leggeDa: vig?.n })
  }
  return out
}

function lineaDelLavoro(): { key: string; etichetta: string; nota: string; stato: 'fatto' | 'corrente' | 'futuro'; salN?: number }[] {
  const a = S.appalto
  const out: { key: string; etichetta: string; nota: string; stato: 'fatto' | 'corrente' | 'futuro'; salN?: number }[] = []
  // PRIMA del contratto c'è il progetto: le fasi congelate nel Computo (PFTE,
  // definitivo, esecutivo…) sono tappe del lavoro quanto i SAL, e la catena
  // documentale non comincia alla firma del contratto.
  for (const r of (S.miuCart?.revisioni || [])) {
    const et = (r.fase || r.nome || 'Fase').toString()
    out.push({ key: `fase-${r.id || et}`, etichetta: et.charAt(0).toUpperCase() + et.slice(1), nota: [r.nome && r.nome !== et ? r.nome : '', r.data || ''].filter(Boolean).join(' · ') || 'progetto', stato: 'fatto' })
  }
  const rib = ribassoDelContratto()
  out.push({
    key: 'avvio',
    etichetta: 'Contratto',
    nota: S.partite.length ? `${S.partite.length} voci${rib != null && Number.isFinite(rib) ? ` · −${pctFmt(rib)}` : a.prezziUnitari ? ' · prezzi offerti' : ''}` : 'nessun computo',
    stato: S.partite.length ? 'fatto' : 'corrente',
  })
  // Una perizia che vale dal SAL n sta FRA il SAL n−1 e il SAL n: è lì che ha
  // cambiato il contratto. Metterle tutte in testa farebbe credere che valgano
  // da prima del primo avanzamento.
  const perizieDal = (n: number): void => {
    for (const pz of (S.appalto.perizie || []).filter((p) => (p.dalSal ?? 1) === n).sort((a2, b2) => a2.numero - b2.numero)) {
      const ok = periziaApprovata(pz)
      out.push({ key: `perizia-${pz.numero}`, etichetta: `Perizia ${pz.numero}`, nota: ok ? `dal SAL ${pz.dalSal}` : `bozza · dal SAL ${pz.dalSal}`, stato: ok ? 'fatto' : 'corrente' })
    }
  }
  const sals = S.sals.slice().sort((x, y) => x.numero - y.numero)
  const ultimoSal = sals.length ? sals[sals.length - 1].numero : 0
  for (const sal of sals) {
    perizieDal(sal.numero)
    const chiuso = salFirmato(sal.numero)
    out.push({ key: `sal-${sal.numero}`, salN: sal.numero, etichetta: `SAL ${sal.numero}`, nota: chiuso ? `firmato · ${sal.data || ''}` : (sal.data || 'aperto'), stato: chiuso ? 'fatto' : 'corrente' })
  }
  // perizie che valgono da un avanzamento non ancora aperto: in coda, dove accadranno
  for (const pz of (S.appalto.perizie || []).filter((p) => (p.dalSal ?? 1) > ultimoSal).sort((a2, b2) => a2.numero - b2.numero)) {
    const ok = periziaApprovata(pz)
    out.push({ key: `perizia-${pz.numero}`, etichetta: `Perizia ${pz.numero}`, nota: ok ? `dal SAL ${pz.dalSal}` : `bozza · dal SAL ${pz.dalSal}`, stato: ok ? 'fatto' : 'corrente' })
  }
  const ultim = S.verbali.find((v) => v.tipo === 'ultimazione')?.data
  out.push({ key: 'chiusura', etichetta: 'Conto finale', nota: ultim || 'a fine lavori', stato: ultim ? 'corrente' : 'futuro' })
  return out
}
function lineaHTML(attivo?: string): string {
  const tappe = lineaDelLavoro()
  return `<nav class="b-linea" aria-label="Linea del tempo del lavoro">${tappe.map((t) => `
    <button class="b-tappa is-${t.stato}${attivo === t.key ? ' is-attiva' : ''}" onclick="vaiA('${t.key}')" title="${esc(t.etichetta)} — ${esc(t.nota)}">
      <span class="b-tappa__t">${esc(t.etichetta)}</span><span class="b-tappa__n">${esc(t.nota)}</span>
    </button>`).join('<span class="b-linea__sep"></span>')}</nav>`
}
/** Salta a una tappa: il SAL apre il suo libretto, il resto scorre alla fase. */
function vaiA(key: string): void {
  if (key.startsWith('fase-')) { toast('È una fase del progetto: si apre nel Computo, in «Revisioni»'); return }
  /* Una tappa si apre DOVE SI LAVORA — le misurazioni — non sulla sua prima
     anteprima di stampa. */
  const f = fasi().find((x) => x.key === key)
  const lavoro = f?.docs.find((d) => d.lavoro && (!d.soloSe || d.soloSe()))
  if (f && lavoro) { openEditor(f.key, lavoro.tipo); return }
  chiudiPagina(); scrollFase(key === 'chiusura' ? 'chiusura' : 'avvio')
}

/* Striscia dei primi passi: compare finché mancano anagrafica o computo, e dice
   dove si è. Sparisce da sola quando il lavoro è avviato. */
function primiPassiHTML(): string {
  const a = S.appalto
  const fattoDati = !!(a.oggetto || a.ente.denominazione)
  const fattoComputo = S.partite.length > 0
  const fattoSal = S.sals.length > 0
  if (fattoDati && fattoComputo && fattoSal) return ''
  const passo = (n: number, testo: string, fatto: boolean, corrente: boolean, azione: string): string =>
    `<button class="b-step${fatto ? ' is-done' : ''}${corrente ? ' is-current' : ''}" onclick="${azione}"><span class="b-step__n">${fatto ? '✓' : n}</span>${testo}</button>`
  return `<div class="b-steps" title="I primi passi di una contabilità">
    ${passo(1, 'Dati appalto', fattoDati, !fattoDati, 'openDati()')}
    ${passo(2, 'Importa il computo (o parti da zero)', fattoComputo, fattoDati && !fattoComputo, 'openImport()')}
    ${passo(3, 'Apri il primo SAL', fattoSal, fattoDati && fattoComputo && !fattoSal, 'nuovoSalOggi()')}
  </div>`
}
function scrollFase(key: string): void { $(`fase-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

/* ── Render: pannello destro (documenti prodotti) ───────────────────────── */
function renderConsegne(): void {
  const el = $('bConsegne'); if (!el) return
  if (!S.consegne.length) { el.innerHTML = '<div class="b-empty">Nessun documento ancora prodotto. Apri una scheda, compila e usa «Stampa».</div>'; return }
  el.innerHTML = [...S.consegne].sort((x, y) => y.ts - x.ts).map((c) => `<button class="b-consegna" onclick="riapri('${c.id}')" title="Riapri il documento"><span class="b-consegna__t">${esc(c.label)}</span><span class="b-consegna__m"><span>${esc(c.data || '—')}</span><span>${new Date(c.ts).toLocaleDateString('it-IT')}</span></span></button>`).join('')
}
/* Ridisegna TUTTO quello che è a schermo, pagina aperta compresa: dopo un
   import le misure comparivano solo cambiando schermata e tornando indietro,
   perché l'atto aperto non veniva ridisegnato. */
function renderAll(): void {
  if (!S.editor) disegnaCruscotto()
  // le sintesi si riempiono sempre: il cruscotto le ospita, ma esistono anche
  // quando a schermo c'è un atto aperto
  renderLeft(); renderScadenze(); renderConsegne()
  if (S.editor) reopenEditor()
  saveDraft()
}

/* ── SCADENZE DI LEGGE ─────────────────────────────────────────────────────
   I termini non si ricordano a memoria e non si ricalcolano a mano: il
   programma conosce gli atti, quindi conosce le date da cui decorrono. Qui si
   mostrano, con i ritardi in testa; cliccando si va al punto del lavoro dove
   l'adempimento si compie. Un termine che non si può calcolare resta scritto,
   con il dato che manca: è un'informazione, non un vuoto da nascondere. */
function scadenzeDelLavoro(): Scadenza[] {
  return scadenze({ appalto: S.appalto, sals: S.sals, riserve: S.riserve, verbali: S.verbali, consegne: S.consegne }, S.dataCorrenteISO)
}
function renderScadenze(): void {
  const box = $('bScadenze'); if (!box) return
  const l = scadenzeDelLavoro()
  if (!l.length) { box.innerHTML = '<div class="b-muted">Nessun termine da sorvegliare: compaiono con il primo SAL, l\'anticipazione o una riserva.</div>'; return }
  const urg = scadenzeUrgenti(l)
  const riga = (x: Scadenza): string => `<button class="b-scad is-${x.stato}" onclick="vaiAScadenza('${esc(x.id)}')" title="${esc(x.norma)}">
    <div class="b-scad__t">${esc(x.cosa)}</div>
    <div class="b-scad__d">${x.entro ? `${esc(SCADENZA_LABEL[x.stato])} · ${x.stato === 'fatto' ? '' : 'entro il '}${esc(x.entro)} — ` : ''}${esc(x.nota)}</div>
  </button>`
  // in testa solo ciò che chiede attenzione; il resto sotto, più sbiadito
  box.innerHTML = (urg.length ? urg : l.slice(0, 3)).map(riga).join('')
    + (l.length > (urg.length || 3) ? (() => {
      const resto = l.filter((x) => !(urg.length ? urg : l.slice(0, 3)).includes(x))
      return `<details class="b-scad-altro"><summary class="b-muted">${resto.length === 1 ? 'Un altro termine' : `Altri ${resto.length} termini`}</summary>${resto.map(riga).join('')}</details>`
    })() : '')
}
/** Dalla scadenza al punto del lavoro in cui si assolve. */
function vaiAScadenza(id: string): void {
  const x = scadenzeDelLavoro().find((s) => s.id === id); if (!x) return
  if (id === 'contofinale') { vaiA('chiusura'); return }
  if (x.salNumero == null) { openDati(); return }
  // una scadenza si risolve scrivendo: porta dove si scrive, non all'anteprima
  openEditor(`sal-${x.salNumero}`, 'datisal')
}

/* ── Guida: sezione del manuale unico condiviso (apribile con F1) ─────────── */
function toggleGuida(): void { toggleGuide('beta') }

/* ── Modali generiche ───────────────────────────────────────────────────── */
function closeModal(): void {
  const h = $('bModalHost'); if (h) h.innerHTML = ''
  if (!document.body.classList.contains('is-pagina')) { S.editor = null; return }
  // una scheda aperta SOPRA la pagina (elenco prezzi, storno…) si chiude e basta
}
/* Quando l'editor si rimonta dopo una modifica (riga aggiunta, spostata, incollata)
   la scheda deve restare dov'era: si salva e si ripristina lo scorrimento. */
let _tieniScroll = false
function modal(inner: string, wide = false): void {
  const h = $('bModalHost'); if (!h) return
  const y = _tieniScroll ? ($('bModalHost')?.querySelector('.b-modal__scroll') as HTMLElement | null)?.scrollTop ?? 0 : 0
  h.innerHTML = `<div class="ehb-modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="ehb-modal ${wide ? 'b-modal-wide' : ''}" role="dialog" aria-modal="true">${inner}</div></div>`
  if (y) { const ora = h.querySelector('.b-modal__scroll') as HTMLElement | null; if (ora) ora.scrollTop = y }
}
const fld = (label: string, v: string | number | null | undefined, oninput: string, type = 'text', ph = ''): string => `<label class="b-field"><span>${esc(label)}</span><input type="${type}"${type === 'number' ? ' step="any"' : ''} value="${esc(v == null ? '' : String(v))}" placeholder="${esc(ph)}" oninput="${oninput}"></label>`

/* ── Misure di progetto → libretto ────────────────────────────────────────
   Contabilizzare un lavoro progettato non è riscriverne le misure: sono già nel
   computo. Si prendono quelle eseguite — tutte, o una per una — e poi si
   correggono con quello che il cantiere ha fatto davvero. */
type SchedaCassetto = 'contratto' | 'progetto' | 'prezzario' | 'altro'

/* I prezzari a disposizione: l'archivio del programma sta su IndexedDB, quindi si
   legge una volta (all'avvio e quando serve) e si tiene qui per disegnare senza
   attese. È lo STESSO scaffale del Computo: un prezzario importato di là si trova
   anche qui. */
let _prezzari: PrezzarioDisponibile[] = []
async function aggiornaPrezzari(ridisegna = false): Promise<void> {
  try { _prezzari = await prezzariDisponibili() } catch { _prezzari = [] }
  if (ridisegna) { if (_cassetto) disegnaCassetto(); if (_voceEdit) disegnaVoceEdit() }
}
/* ── UN ALTRO LAVORO COME SORGENTE ────────────────────────────────────────
   Capita di avere la voce buona in un altro lavoro fatto con Quadra: si apre
   quel file in SOLA LETTURA, lo si cerca come un prezzario e si pesca quello
   che serve. Il file sorgente non viene mai scritto e non si mescola con il
   lavoro aperto: entra solo ciò che si sceglie, una voce alla volta. */
let _sorgente: { nome: string; voci: VoceImport[] } | null = null
/** Apre un file .quadra o .xpwe come sorgente di voci. */
function apriSorgente(): void {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = '.quadra,.xpwe,.xml'
  inp.onchange = () => { const f = inp.files?.[0]; if (f) void leggiSorgente(f) }
  inp.click()
}
async function leggiSorgente(f: File): Promise<void> {
  try {
    const testo = await f.text()
    let voci: VoceImport[] = []
    if (/^\s*[{[]/.test(testo)) {
      /* Progetto Quadra. Dentro ci sono i tool, con le chiavi di oggi
         (computo, contabilita) o quelle dei file di ieri (miu-price-list,
         beta-contabilita): si accettano entrambe, un file del mese scorso si
         apre come uno di oggi. Si preferisce l'elenco della contabilità, che
         porta prezzi di contratto e quantità di progetto; in mancanza, le voci
         composte del computo. */
      const j = JSON.parse(testo) as Record<string, unknown>
      const tools = (j.tools || j) as Record<string, unknown>
      const perChiave = (re: RegExp): Record<string, unknown> | null => {
        for (const [k, v] of Object.entries(tools)) if (re.test(k) && v && typeof v === 'object') return v as Record<string, unknown>
        return null
      }
      const cont = perChiave(/contabilit/i)
      const comp = perChiave(/computo|price-list|miu/i)
      const partite = (cont?.partite || (j as { partite?: Partita[] }).partite) as Partita[] | undefined
      const items = (comp?.items || (j as { items?: VoceImport[] }).items) as VoceImport[] | undefined
      if (partite?.length) {
        voci = partite.filter((p) => !p.soppressaSal).map((p) => ({
          codice: p.codice, desc_short: p.descrizione, declaratoria: p.declaratoria, um: p.um,
          prezzo: p.prezzoContratto ?? p.prezzoUnitario ?? null, qty: p.qtyProgetto ?? null,
          categoria: p.categoria, ...(p.wbs ? { wbs: p.wbs } : {}),
        }))
      } else if (items?.length) voci = items
      else if (comp?.custom) {
        // formato interno del Computo: le voci composte stanno in «custom»
        const custom = comp.custom as [string, { codice?: string; desc_short?: string; declaratoria?: string; um?: string; prezzo?: number | null }][]
        const qty = (comp.qty || {}) as Record<string, { qty?: number | null }>
        const cat = (comp.categoria || {}) as Record<string, string>
        const wbs = (comp.wbs || {}) as Record<string, string>
        voci = (Array.isArray(custom) ? custom : []).map(([k, it]) => ({
          codice: it.codice, desc_short: it.desc_short, declaratoria: it.declaratoria, um: it.um,
          prezzo: it.prezzo ?? null, qty: qty[k]?.qty ?? null,
          categoria: cat[k], ...(wbs[k] ? { wbs: wbs[k] } : {}),
        }))
      }
    } else {
      const doc = parseXpwe(testo)
      voci = xpweToVoci(doc)
    }
    if (!voci.length) { toast('In quel file non ho trovato voci'); return }
    _sorgente = { nome: f.name, voci }
    if (_cassetto) { _cassetto.scheda = 'altro'; _cassetto.q = ''; disegnaCassetto() }
    toast(`«${f.name}» aperto come sorgente: ${voci.length} voci, in sola lettura`)
  } catch (e) { toast('File non leggibile: ' + ((e as Error)?.message || e)) }
}
/** Porta nel lavoro una voce pescata dal lavoro sorgente. */
function addDaSorgente(i: number): void {
  if (!_cassetto || !_sorgente) return
  const q = _cassetto.q.trim().toLowerCase()
  const voci = _sorgente.voci.filter((v) => !q || ((v.codice || '') + ' ' + (v.desc_short || v.declaratoria || '')).toLowerCase().includes(q))
  const v = voci[i]; if (!v) return
  const ctx = _cassetto.ctx
  const pzDest = periziaDiCtx(ctx)
  if (pzDest && periziaApprovata(pzDest)) { toast('Perizia approvata: non si aggiungono voci'); return }
  const salN = pzDest ? pzDest.dalSal : Number(ctx)
  if (!pzDest && salBloccato(salN)) { toast('Il SAL è firmato: non si aggiungono voci'); return }
  const esito = preparaAggiunta([v], S.partite, { introdottaSal: salN, conMisure: false, nuovoId: uid })
  if (!esito.nuove.length) { toast('Quella voce è già in elenco'); return }
  S.partite.push(...esito.nuove)
  const p = esito.nuove[0]
  if (!_cassetto.soloElenco) {
    if (pzDest) pzDest.voci = [...(pzDest.voci || []), { partitaId: p.id, misurazioni: [{ descrizione: '', quantita: 0 }] }]
    else { const sal = salById(salN); if (sal) { const riga = rigaFor(sal, p.id); riga.misurazioni = [{ descrizione: '', quantita: 0 }]; riga.quantitaProgressiva = null } }
    libExpanded.add(p.id)
  }
  saveDraft(); renderLeft()
  if (_cassetto.soloElenco) disegnaElencoPrezzi(); else reopenEditor()
  disegnaCassetto()
  toast(`«${esc(p.codice)}» presa da «${_sorgente.nome}»`)
}

let _cassetto: { ctx: Contesto; scheda: SchedaCassetto; pid?: string; q: string; trovate: PriceRow[]; slug: string; righe: PriceRow[]; stato: string; soloElenco?: boolean } | null = null

/** Apre il cassetto su una scheda; `pid` serve solo alla scheda «progetto». */
function apriCassetto(ctx: Contesto, scheda: SchedaCassetto, pid?: string, soloElenco = false): void {
  const lista = _prezzari
  void aggiornaPrezzari(true) // l'archivio può essere cambiato nel frattempo
  /* Anche in perizia il cassetto è quello di sempre: contratto, prezzario, un
     altro lavoro. Solo la scheda «progetto» ha bisogno di una voce aperta, ed è
     lì che si ripiega quando si chiedono le misure di progetto senza voce. */
  const sch: SchedaCassetto = scheda === 'progetto' && !(pid ?? _cassetto?.pid) ? 'contratto' : scheda
  _cassetto = { ctx, scheda: sch, pid: pid ?? _cassetto?.pid, q: '', trovate: [], slug: _cassetto?.slug || lista[0]?.id || '', righe: _cassetto?.righe || [], stato: '', soloElenco }
  disegnaCassetto()
  if (sch === 'prezzario' && _cassetto.slug && !_cassetto.righe.length) void caricaNelCassetto(_cassetto.slug)
}
function apriMisureProgetto(ctx: Contesto, pid: string): void { apriCassetto(ctx, 'progetto', pid) }
function openPrezzario(ctx: Contesto): void { apriCassetto(ctx, 'prezzario') }
function schedaCassetto(scheda: string): void { if (_cassetto) apriCassetto(_cassetto.ctx, scheda as SchedaCassetto, _cassetto.pid) }
function chiudiCassetto(): void {
  _cassetto = null
  const d = $('bDrawer'); if (d) { d.hidden = true; d.innerHTML = '' }
  document.body.classList.remove('is-cassetto')
}
async function caricaNelCassetto(slug: string): Promise<void> {
  if (!_cassetto) return
  _cassetto.slug = slug; _cassetto.righe = []; _cassetto.trovate = []; _cassetto.stato = 'Carico il prezzario…'
  disegnaCassetto()
  try {
    const righe = await caricaPrezzario(slug)
    if (!_cassetto || _cassetto.slug !== slug) return
    _cassetto.righe = righe
    _cassetto.stato = `${righe.length.toLocaleString('it-IT')} voci`
    // appena caricato è già sfogliabile: non si aspetta che qualcuno cerchi
    _cassetto.trovate = _cassetto.q ? cercaNelPrezzario(righe, _cassetto.q) : righe.slice(0, MAX_SFOGLIA)
  } catch (e) { if (_cassetto) _cassetto.stato = 'Prezzario non caricabile: ' + ((e as Error)?.message || e) }
  disegnaCassetto()
}
function setPrezzario(slug: string): void { void caricaNelCassetto(slug) }
/** Quante voci si sfogliano senza ricerca: abbastanza per orientarsi. */
const MAX_SFOGLIA = 300

function cercaCassetto(q: string): void {
  if (!_cassetto) return
  _cassetto.q = q
  /* UN PREZZARIO SI SFOGLIA, non solo si interroga: senza ricerca si vedono le
     prime voci in ordine di codice. Un elenco che resta bianco finché non si
     indovina la parola giusta costringe a sapere già che cosa si cerca. */
  if (_cassetto.scheda === 'prezzario') {
    _cassetto.trovate = !_cassetto.righe.length ? []
      : q.trim() ? cercaNelPrezzario(_cassetto.righe, q)
        : _cassetto.righe.slice(0, MAX_SFOGLIA)
  }
  const el = $('bCassettoLista'); if (el) el.innerHTML = listaCassettoHTML()
}

/** L'ELENCO PREZZI DEL LAVORO: le voci che questo lavoro conosce già. */
function vociDelLavoro(): Partita[] {
  const q = (_cassetto?.q || '').trim().toLowerCase()
  const voci = S.partite.filter((p) => p.codice.trim() || p.descrizione.trim())
  if (!q) return voci
  const parole = q.split(/\s+/)
  return voci.filter((p) => { const t = (p.codice + ' ' + p.descrizione).toLowerCase(); return parole.every((w) => t.includes(w)) })
}
/* Nuovo prezzo: una voce che il contratto non ha. Si dice NP solo se un contratto
   c'è: in una contabilità nata da zero sono tutte voci «del lavoro», non NP. */
const contrattoPresente = (): boolean => S.partite.some((x) => x.prezzoContratto != null)
const eNuovoPrezzo = (p: Partita): boolean => !!p.np || (p.prezzoContratto == null && p.qtyProgetto == null && contrattoPresente())
const etichettaNP = (p: Partita): string => (!eNuovoPrezzo(p) ? ''
  : `<span class="b-np is-${p.np?.stato || 'bozza'}" title="Nuovo prezzo${p.np ? ` n. ${p.np.numero} · ${STATO_NP[p.np.stato]}` : ''}: non è in contratto, va concordato e approvato">NP${p.np && p.np.stato !== 'bozza' ? ' ✓' : ''}</span>`)

function listaCassettoHTML(): string {
  if (!_cassetto) return ''
  const { ctx, scheda, pid } = _cassetto
  const salN = Number(ctx)
  const bloccato = ctxSoloLettura(ctx)
  if (scheda === 'contratto') {
    const voci = vociDelLavoro()
    if (!voci.length) return `<div class="b-empty">${_cassetto.q ? 'Nessuna voce trovata.' : 'Nessuna voce: creale qui sotto o dal prezzario.'}</div>`
    return voci.map((p) => {
      const inLibretto = voceVisibileInSal(p, salN) && !p.soppressaSal
      const prezzo = p.modalita === 'corpo' ? p.importoContrattuale : (p.prezzoContratto ?? p.prezzoUnitario)
      return `<div class="b-pmis"${bloccato ? '' : ` draggable="true" ondragstart="voceDragStart(event,'${p.id}')" ondragend="misDragEnd()" oncontextmenu="menuPrezzo(event,'${p.id}',${ctxLit(ctx)})"`} title="${inLibretto ? 'Già nel libretto: portala di nuovo per misurarla a parte' : 'Portala nel libretto'}">
        <span class="b-pmis__d">${esc(p.codice || '—')} ${etichettaNP(p)}<span class="b-pmis__f">${esc(p.descrizione.slice(0, 70))}</span></span>
        <span class="b-pmis__q">${eur(prezzo)}${p.um ? `<span class="b-pmis__um">/${esc(p.um)}</span>` : ''}</span>
        ${bloccato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="portaNelLibretto(${salN},'${p.id}')" title="${inLibretto ? 'La voce è già nel libretto: la ripete, con misure proprie' : 'Porta la voce nel libretto, al suo prezzo di contratto'}">${inLibretto ? '⧉ Ripeti' : '＋ Misura'}</button>${p.np ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="assimilaVoce(${salN},'${p.id}')" title="Crea un NUOVO PREZZO partendo da questa voce (art. 120 c. 7): stesso prezzo di partenza, descrizione da adattare. Non serve per contabilizzare una voce già in contratto.">≈ Nuovo prezzo</button>`}`}
      </div>`
    }).join('')
  }
  if (scheda === 'progetto') {
    const p = pid ? S.partite.find((x) => x.id === pid) : undefined
    const mp = p?.misurazioniProgetto || []
    if (!p) return '<div class="b-empty">Apri «▸ misure» su una voce: qui compaiono le misure con cui è stata computata in progetto.</div>'
    if (!mp.length) return `<div class="b-empty">«${esc(p.codice)}» non ha misure di progetto (quantità secca o voce nata in contabilità).</div>`
    const gia = misureDelLibretto(ctx, p.id)
    const fattori = (m: MisurazioneRiga): string => [m.n, m.l1, m.l2, m.h].map((x) => (x == null ? '' : numIn(x))).filter(Boolean).join(' × ') || '—'
    return mp.map((m, i) => {
      const presa = gia.some((g) => stessaMisura(g, m))
      return `<div class="b-pmis${presa ? ' is-presa' : ''}"${bloccato ? '' : ` draggable="true" ondragstart="progDragStart(event,'${p.id}',${i})" ondragend="misDragEnd()"`} title="${presa ? 'Già nel libretto' : 'Trascinala nella tabella delle misure'}">
        <span class="b-pmis__d">${esc(m.descrizione || '(senza designazione)')}<span class="b-pmis__f">${esc(fattori(m))}</span></span>
        <span class="b-pmis__q">${numFmt(m.quantita || 0)}</span>
        ${bloccato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="prendiMisuraProgetto(${ctxLit(ctx)},'${p.id}',${i})" title="Porta la riga in fondo alle misure">＋</button>`}
      </div>`
    }).join('') + (bloccato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost b-block" style="margin-top:6px" onclick="prendiMisureProgetto(${ctxLit(ctx)},'${p.id}')">↧ Prendi tutte (${mp.length})</button>`)
  }
  if (scheda === 'altro') {
    if (!_sorgente) return `<div class="b-empty">Nessun lavoro aperto come sorgente.<br><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="apriSorgente()">⭍ Apri un altro lavoro…</button><br><span class="b-muted" style="font-size:var(--fs-xs)">file .quadra o .xpwe — oppure trascinalo qui</span></div>`
    const q = _cassetto.q.trim().toLowerCase()
    const voci = _sorgente.voci.filter((v) => !q || ((v.codice || '') + ' ' + (v.desc_short || v.declaratoria || '')).toLowerCase().includes(q))
    if (!voci.length) return `<div class="b-empty">Nessuna voce trovata in «${esc(_sorgente.nome)}».</div>`
    return voci.slice(0, 400).map((v, i) => `<div class="b-pmis" title="${esc(v.declaratoria || v.desc_short || '')}">
        <span class="b-pmis__d">${esc(v.codice || '—')}<span class="b-pmis__f">${esc((v.desc_short || v.declaratoria || '').slice(0, 70))}</span></span>
        <span class="b-pmis__q">${v.prezzo == null ? '' : eur(v.prezzo)}${v.um ? `<span class="b-pmis__um">/${esc(v.um)}</span>` : ''}</span>
        ${bloccato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="addDaSorgente(${i})" title="Porta la voce in questo lavoro">＋ Prendi</button>`}
      </div>`).join('') + `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost b-block" style="margin-top:6px" onclick="apriSorgente()">⭍ Cambia lavoro sorgente</button>`
  }
  const ris = _cassetto.trovate
  if (!ris.length) return `<div class="b-empty">${_cassetto.q ? 'Nessuna voce trovata.' : 'Scegli un prezzario qui sopra: le sue voci compaiono qui.'}</div>`
  const coda = !_cassetto.q.trim() && _cassetto.righe.length > ris.length
    ? `<div class="b-muted" style="font-size:var(--fs-xs);padding:8px 2px">Prime ${ris.length} di ${_cassetto.righe.length} voci — cerca per trovare le altre.</div>`
    : ''
  return ris.map((r, i) => `<div class="b-pmis" title="${esc(r.declaratoria || r.desc_short)}">
      <span class="b-pmis__d">${esc(r.codice)}<span class="b-pmis__f">${esc((r.desc_short || r.declaratoria).slice(0, 70))}</span></span>
      <span class="b-pmis__q">${eur(r.prezzo)}${r.um ? `<span class="b-pmis__um">/${esc(r.um)}</span>` : ''}</span>
      ${bloccato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="addDaPrezzario(${i})" title="Entra come NUOVO PREZZO: non è una voce di contratto">＋ Nuovo prezzo</button>`}
    </div>`).join('') + coda
}

function disegnaCassetto(): void {
  const d = $('bDrawer'); if (!d) return
  if (!_cassetto) { chiudiCassetto(); return }
  const { ctx, scheda, pid } = _cassetto
  const pz = periziaDiCtx(ctx)
  const p = pid ? S.partite.find((x) => x.id === pid) : undefined
  const lista = _prezzari
  const rib = ribassoDelContratto()
  const perElenco = !!_cassetto.soloElenco
  const note: Record<SchedaCassetto, string> = {
    contratto: perElenco
      ? `Le voci già in elenco. Per aggiungerne una nuova passa alla scheda <b>Prezzario</b>.`
      : `Le voci che questo lavoro conosce: si contabilizza <b>a questi prezzi</b>. Trascinane una nel libretto o usa ＋.`,
    progetto: p ? `Come «${esc(p.codice)}» è stata computata in progetto${p.qtyProgetto != null ? `: <b>${numFmt(p.qtyProgetto)} ${esc(p.um || '')}</b>` : ''}. Trascina una riga nelle misure: resta correggibile, il progetto non si tocca.` : 'Misure di progetto della voce aperta.',
    prezzario: perElenco
      ? `La voce scelta entra <b>nell'elenco prezzi</b>, senza misure: si misurerà quando serve, in un libretto${rib != null ? `. Se non è in contratto è un nuovo prezzo, col ribasso del ${pctFmt(rib)} già applicato` : ''}.`
      : `Serve per i <b>nuovi prezzi</b>: una voce non in contratto entra come NP${rib != null ? `, con il ribasso contrattuale del ${pctFmt(rib)} già applicato` : ''}.`,
    altro: `Un <b>altro lavoro</b> come sorgente: apri un file Quadra o un XPWE e pescane le voci. Il file resta dov'è, in sola lettura — non si mescola con questo lavoro: entra solo quello che scegli.`,
  }
  const tab = (k: SchedaCassetto, testo: string): string =>
    `<button class="b-tab${scheda === k ? ' is-on' : ''}" onclick="schedaCassetto('${k}')">${testo}</button>`
  d.innerHTML = `<div class="b-drawer__h">
      <div class="b-drawer__t">${pz ? 'Misure di progetto' : perElenco ? 'Prezzari del programma' : 'Elenco prezzi del lavoro'}<span>${pz ? `perizia n. ${pz.numero}${periziaApprovata(pz) ? ' · approvata, sola lettura' : ''}` : perElenco ? "la voce entra nell'elenco prezzi" : `SAL n. ${Number(ctx)}${salFirmato(Number(ctx)) ? ' · firmato, sola lettura' : ''}`}</span></div>
      <button class="ehb-icon-btn" onclick="chiudiCassetto()" title="Chiudi il cassetto">✕</button>
    </div>
    <!-- LE SORGENTI DEI PREZZI, sempre nello stesso ordine e con lo stesso
         nome: quello del lavoro (di contratto, una volta firmato), il
         prezzario regionale, e un altro progetto da cui pescare. -->
    <div class="b-tabs">${tab('contratto', S.partite.length ? 'Di contratto' : 'Del lavoro')}${pid ? tab('progetto', 'Misure') : ''}${tab('prezzario', 'Regionale')}${tab('altro', 'Altro progetto')}</div>
    <div class="b-drawer__body">
      <p class="b-drawer__nota">${note[scheda]}</p>
      ${scheda === 'prezzario' && lista.length > 1 ? `<select class="b-drawer__sel" onchange="setPrezzario(this.value)">${lista.map((x) => `<option value="${esc(x.id)}"${x.id === _cassetto!.slug ? ' selected' : ''}>${esc(nomePrezzario(x))}${x.origine === 'archivio' ? '' : ' · installato'}</option>`).join('')}</select>` : ''}
      ${scheda === 'prezzario' && !lista.length ? '<p class="b-muted">Nessun prezzario nell\'archivio del programma. Caricane uno dal Computo (si trova anche qui) oppure scrivi il nuovo prezzo a mano.</p>' : `<input type="search" class="b-drawer__q" value="${esc(_cassetto.q)}" placeholder="${scheda === 'progetto' ? 'misure della voce' : 'codice o parole'}" oninput="cercaCassetto(this.value)" ${scheda === 'progetto' ? 'disabled' : ''} autocomplete="off">`}
      ${scheda === 'prezzario' && _cassetto.stato ? `<div class="b-muted" style="font-size:var(--fs-xs);margin:4px 0">${esc(_cassetto.stato)}</div>` : ''}
      <div id="bCassettoLista">${listaCassettoHTML()}</div>
    </div>`
  d.hidden = false
  document.body.classList.add('is-cassetto')
}

/** Ribasso contrattuale: dichiarato o risultante (base − offerta). */
function ribassoDelContratto(): number | null {
  const a = S.appalto
  if (a.prezziUnitari) return null // i prezzi sono già quelli offerti
  return a.ribassoPct != null ? a.ribassoPct : ribassoPct(a.baseAsta, a.importoOfferta)
}

/** Porta nel libretto una voce dell'elenco prezzi del lavoro (o la ripete). */
function portaNelLibretto(salN: number, pid: string): void {
  if (salBloccato(salN)) { toast('Il SAL è firmato: non si aggiungono voci'); return }
  const s = salById(salN); if (!s) return
  const p = S.partite.find((x) => x.id === pid)
  // se la voce è già nel libretto di questo SAL, «portarla» significa RIPETERLA
  if (p && voceVisibileInSal(p, salN) && !p.soppressaSal) { duplicaVoce(pid, salN); disegnaCassetto(); return }
  // una voce nata in un SAL successivo, portata qui, comincia da QUESTO SAL
  if (p && (p.introdottaSal ?? 1) > salN) p.introdottaSal = salN
  const r = rigaFor(s, pid); r.misurazioni = r.misurazioni || [{ descrizione: '', quantita: 0 }]; r.quantitaProgressiva = null
  libExpanded.add(pid)
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
  toast('Voce portata nel libretto')
}

/** Due misure sono «la stessa» se coincidono designazione e fattori: serve a dire
    quali righe di progetto sono già nel libretto, non ad accorparle. */
function stessaMisura(a: MisurazioneRiga, b: MisurazioneRiga): boolean {
  const f = (m: MisurazioneRiga): string => [m.descrizione || '', m.n ?? '', m.l1 ?? '', m.l2 ?? '', m.h ?? '', m.quantita ?? ''].join('|')
  return f(a) === f(b)
}
function misureDelLibretto(ctx: Contesto, pid: string): MisurazioneRiga[] {
  return contenitoreMisure(ctx, pid)?.misurazioni || []
}

/* ── Trascinamento delle misure ───────────────────────────────────────────
   Come nel computo: una riga si prende e si posa dove serve (anche in un'altra
   voce). Dal cassetto si trascinano le misure di progetto, che entrano come
   copie nel punto in cui le si lascia. */
let _voceTrascina: string | null = null
let _misTrascina: { ctx: Contesto; pid: string; idx: number } | null = null
let _progTrascina: { pid: string; i: number } | null = null

function misDragStart(ev: DragEvent, ctx: Contesto, pid: string, idx: number): void {
  ev.stopPropagation()
  _misTrascina = { ctx, pid, idx }; _progTrascina = null
  try { ev.dataTransfer?.setData('text/misura', `${pid}#${idx}`); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move' } catch { /* browser senza dataTransfer */ }
}
/* Dal cassetto si trascina anche una VOCE dell'elenco prezzi: si posa fra le voci
   del libretto, dove serve. */
function voceDragStart(ev: DragEvent, pid: string): void {
  ev.stopPropagation()
  _voceTrascina = pid; _misTrascina = null; _progTrascina = null
  try { ev.dataTransfer?.setData('text/voce', pid); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy' } catch { /* senza dataTransfer */ }
}
function voceDragOver(ev: DragEvent, el: HTMLElement): void {
  if (!_voceTrascina) return
  ev.preventDefault(); ev.stopPropagation()
  el.classList.add('cm-drop-after')
}
function voceDragLeave(el: HTMLElement): void { el.classList.remove('cm-drop-after') }
function voceDrop(ev: DragEvent, salN: number, pidDopo: string, el: HTMLElement): void {
  el.classList.remove('cm-drop-after')
  if (!_voceTrascina) return
  ev.preventDefault(); ev.stopPropagation()
  const pid = _voceTrascina
  _voceTrascina = null
  const prima = S.partite.length
  portaNelLibretto(salN, pid)
  // la voce (o la sua ripetizione, se c'era già) si posa subito dopo quella su cui l'ho lasciata
  const quale = S.partite.length > prima ? S.partite[S.partite.length - 1] : S.partite.find((x) => x.id === pid)
  if (quale && quale.id !== pidDopo) {
    const da = S.partite.indexOf(quale)
    if (da >= 0) { S.partite.splice(da, 1); const a = S.partite.findIndex((x) => x.id === pidDopo); S.partite.splice(a + 1, 0, quale) }
  }
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
}
function progDragStart(ev: DragEvent, pid: string, i: number): void {
  ev.stopPropagation()
  _progTrascina = { pid, i }; _misTrascina = null
  try { ev.dataTransfer?.setData('text/misura-progetto', `${pid}#${i}`); if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy' } catch { /* idem */ }
}
function misDragEnd(): void {
  _misTrascina = null; _progTrascina = null; _voceTrascina = null
  document.querySelectorAll('.cm-drop-before,.cm-drop-after').forEach((el) => el.classList.remove('cm-drop-before', 'cm-drop-after'))
}
const _dopoMeta = (ev: DragEvent, el: HTMLElement): boolean => { const r = el.getBoundingClientRect(); return ev.clientY > r.top + r.height / 2 }
function misDragOver(ev: DragEvent, el: HTMLElement): void {
  if (!_misTrascina && !_progTrascina) return
  ev.preventDefault(); ev.stopPropagation()
  const dopo = _dopoMeta(ev, el)
  el.classList.toggle('cm-drop-after', dopo); el.classList.toggle('cm-drop-before', !dopo)
}
function misDragLeave(el: HTMLElement): void { el.classList.remove('cm-drop-before', 'cm-drop-after') }
function misDrop(ev: DragEvent, ctx: Contesto, pid: string, idx: number, el: HTMLElement): void {
  ev.preventDefault(); ev.stopPropagation()
  const dopo = _dopoMeta(ev, el)
  el.classList.remove('cm-drop-before', 'cm-drop-after')
  if (ctxBloccato(ctx)) { misDragEnd(); return }
  if (_progTrascina) {
    const p = S.partite.find((x) => x.id === _progTrascina!.pid)
    const m = p?.misurazioniProgetto?.[_progTrascina.i]
    if (m) {
      const r = contenitoreMisure(ctx, pid, true); if (!r) { misDragEnd(); return }
      const righe = r.misurazioni || []
      const copia = copiaRigaProgetto(m)
      righe.splice(idx + (dopo ? 1 : 0), 0, copia)
      r.misurazioni = righe.filter((x) => x === copia || !segnaposto(x))
      allineaMisure(ctx, r)
      toast('Misura di progetto presa nel punto scelto')
    }
  } else if (_misTrascina) {
    const sorg = contenitoreMisure(_misTrascina.ctx, _misTrascina.pid)
    if (!sorg?.misurazioni?.[_misTrascina.idx]) { misDragEnd(); return }
    const dest = contenitoreMisure(ctx, pid, true); if (!dest) { misDragEnd(); return }
    const listaDest = sorg === dest ? sorg.misurazioni : (dest.misurazioni || [])
    const r = spostaElemento(sorg.misurazioni, _misTrascina.idx, listaDest, idx, dopo)
    sorg.misurazioni = r.sorgente; dest.misurazioni = r.destinazione
    allineaMisure(ctx, dest); allineaMisure(_misTrascina.ctx, sorg)
  }
  misDragEnd()
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
}

/* Righe-segnaposto: quella vuota e quella «da computo» creata da «dettaglia»
   (quantità secca senza fattori). Quando arrivano misure vere, si fanno da parte. */
function segnaposto(m: MisurazioneRiga): boolean {
  if (!m.descrizione && !m.quantita) return true
  return m.descrizione === 'da computo' && m.n == null && m.l2 == null && m.h == null
}
/** Copia di una riga di progetto: la misura è nuova, il progetto resta intatto. */
function copiaRigaProgetto(m: MisurazioneRiga): MisurazioneRiga {
  const { vediVoce: _vv, ...resto } = m as MisurazioneRiga & { vediVoce?: string }
  return { ...resto, ...(m.formule ? { formule: { ...m.formule } } : {}) }
}
function aggiungiAlLibretto(ctx: Contesto, pid: string, righe: MisurazioneRiga[]): void {
  if (ctxBloccato(ctx)) return
  const r = contenitoreMisure(ctx, pid, true); if (!r) return
  r.misurazioni = (r.misurazioni || []).filter((m) => !segnaposto(m)).concat(righe.map(copiaRigaProgetto))
  allineaMisure(ctx, r)
  libExpanded.add(pid)
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
}
function prendiMisuraProgetto(ctx: Contesto, pid: string, i: number): void {
  const p = S.partite.find((x) => x.id === pid); const m = p?.misurazioniProgetto?.[i]
  if (!m) return
  aggiungiAlLibretto(ctx, pid, [m])
  toast('Riga presa dal computo di progetto')
}
function prendiMisureProgetto(ctx: Contesto, pid: string): void {
  const p = S.partite.find((x) => x.id === pid); const mp = p?.misurazioniProgetto || []
  if (!mp.length) return
  const gia = misureDelLibretto(ctx, pid)
  const nuove = mp.filter((m) => !gia.some((g) => stessaMisura(g, m)))
  if (!nuove.length) { toast('Sono già tutte nelle misure'); return }
  aggiungiAlLibretto(ctx, pid, nuove)
  toast(`${nuove.length} ${nuove.length === 1 ? 'misura presa' : 'misure prese'} dal computo di progetto${nuove.length < mp.length ? ' (le altre c\'erano già)' : ''}`)
}

/* ── Nuovi prezzi dal prezzario (scheda «Prezzario» del cassetto) ───────── */
function addDaPrezzario(i: number): void {
  if (!_cassetto) return
  const r = _cassetto.trovate[i]; if (!r) return
  /* Una perizia È il posto dove nascono i nuovi prezzi: si pesca la voce dal
     prezzario (regionale o privato) e diventa un NP di QUESTA perizia, con il
     ribasso contrattuale applicato. Prima di qui si veniva rimandati al
     libretto del SAL, che è il posto sbagliato. */
  const pzDest = periziaDiCtx(_cassetto.ctx)
  if (pzDest && periziaApprovata(pzDest)) { toast('Perizia approvata: non si aggiungono voci'); return }
  const salN = pzDest ? pzDest.dalSal : Number(_cassetto.ctx)
  if (!pzDest && salBloccato(salN)) { toast('Il SAL è firmato: non si aggiungono voci'); return }
  // Se l'articolo È GIÀ IN CONTRATTO, in contabilità vale il prezzo di contratto,
  // non quello di listino di oggi: il prezzario serve a trovare la voce, non a
  // riprezzarla. Un articolo che in contratto non c'è è un NUOVO PREZZO.
  const inContratto = S.partite.find((x) => x.codice.trim() === (r.codice || '').trim() && x.prezzoContratto != null)
  /* NUOVO PREZZO desunto dal prezzario. Entra in elenco al suo valore di
     listino, come le voci di contratto: il ribasso contrattuale a cui è
     assoggettato (All. II.14 art. 5 c. 7) si deduce poi sul totale dei lavori
     del SAL, insieme a tutto il resto. La scheda del NP registra comunque
     quale ribasso gli si applica, perché l'atto deve dirlo. */
  const rib = ribassoDelContratto()
  const listino = r.prezzo > 0 ? r.prezzo : null
  const prezzo = inContratto ? inContratto.prezzoContratto ?? null : listino
  const fonte = _prezzari.find((x) => x.id === _cassetto?.slug)
  const np = inContratto ? undefined : schedaNP({
    partite: S.partite, origine: 'prezzario', ribassoPct: rib,
    base: { codice: (r.codice || '').trim(), descrizione: (r.desc_short || '').trim(), prezzo: listino, fonte: fonte ? nomePrezzario(fonte) : 'prezzario' },
    periziaN: pzDest?.numero ?? periziaCorrente()?.numero ?? null,
  })
  const p: Partita = {
    id: uid(), modalita: 'misura',
    // un nuovo prezzo prende il SUO codice (NP.01…): è così che si riconosce e si stampa a parte
    codice: np ? codiceNP(np.numero) : (r.codice || '').trim(),
    descrizione: (r.desc_short || r.declaratoria || r.codice).trim(),
    ...(r.declaratoria && r.declaratoria.trim() !== (r.desc_short || '').trim() ? { declaratoria: r.declaratoria.trim() } : {}),
    um: r.um, categoria: inContratto?.categoria ?? categoriaDiRiga(r), prezzoUnitario: prezzo,
    ...(inContratto ? { prezzoContratto: inContratto.prezzoContratto ?? null } : {}),
    ...(np ? { np } : {}),
    qtyProgetto: null, introdottaSal: salN,
  }
  S.partite.push(p)
  // dall'elenco prezzi la voce entra SOLO in elenco: si misura quando serve, in
  // un libretto o in un computo. Dal libretto, invece, nasce già con la sua riga.
  if (!_cassetto.soloElenco) {
    if (pzDest) {
      // in perizia la voce nasce con la sua riga di variante, pronta da misurare
      pzDest.voci = [...(pzDest.voci || []), { partitaId: p.id, misurazioni: [{ descrizione: '', quantita: 0 }] }]
    } else {
      const s = salById(salN)
      if (s) { const riga = rigaFor(s, p.id); riga.misurazioni = [{ descrizione: '', quantita: 0 }]; riga.quantitaProgressiva = null }
    }
    libExpanded.add(p.id)
  }
  // il libretto è la pagina dietro la scheda: si aggiorna subito, così la voce
  // appena scelta è già lì quando si chiude l'elenco prezzi
  saveDraft(); renderLeft()
  if (_cassetto.soloElenco) disegnaElencoPrezzi(); else reopenEditor()
  disegnaCassetto()
  toast(inContratto
    ? `«${p.codice}» aggiunta al prezzo di contratto ${eur(p.prezzoUnitario)}${listino != null && Math.abs(listino - (p.prezzoUnitario ?? 0)) >= 0.005 ? ` (a listino oggi ${eur(listino)})` : ''}`
    : `${p.codice} (${esc(r.codice)}): nuovo prezzo ${eur(prezzo)}${rib != null && listino != null ? ` = ${eur(listino)} − ${pctFmt(rib)}` : ''} · da concordare`)
}

/* ── Dati appalto ───────────────────────────────────────────────────────── */
/* I DATI DEL LAVORO SONO UN DOCUMENTO, non una finestra di configurazione:
   stanno nell'albero come gli altri, si aprono a tutta pagina e si compilano
   con calma. La stessa forma serve anche al vecchio richiamo modale. */
function datiAppaltoCorpo(): string {
  const a = S.appalto
  const logoBox = a.ente.logo
    ? `<div class="b-logo"><img src="${esc(a.ente.logo)}" alt="logo"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="removeLogo()">Rimuovi logo</button></div>`
    : `<div class="b-logo"><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="pickLogo()">↥ Carica logo ente</button><span class="b-muted">Compare in testa a tutti i documenti.</span></div>`
  return `    <div class="b-cols2">
      <fieldset class="b-fieldset"><legend>Stazione appaltante</legend>${logoBox}
        ${fld('Denominazione', a.ente.denominazione, "setEnte('denominazione',this.value)", 'text', 'Comune di …')}
        ${fld('Indirizzo', a.ente.indirizzo, "setEnte('indirizzo',this.value)")}
        ${fld('Codice fiscale', a.ente.codiceFiscale, "setEnte('codiceFiscale',this.value)")}</fieldset>
      <fieldset class="b-fieldset"><legend>Impresa esecutrice</legend>
        ${fld('Ragione sociale', a.impresa.denominazione, "setImpresa('denominazione',this.value)")}
        ${fld('Sede', a.impresa.indirizzo, "setImpresa('indirizzo',this.value)")}
        ${fld('P.IVA', a.impresa.partitaIva, "setImpresa('partitaIva',this.value)")}
        ${fld('C.F.', a.impresa.codiceFiscale, "setImpresa('codiceFiscale',this.value)")}</fieldset>
    </div>
    <fieldset class="b-fieldset"><legend>Appalto</legend><div class="b-grid">
      ${fld('Oggetto dei lavori', a.oggetto, "setApp('oggetto',this.value)")}
      ${fld('Comune / località', a.comune, "setApp('comune',this.value)")}${fld('Provincia', a.provincia, "setApp('provincia',this.value)", 'text', 'UD')}
      ${fld('CUP', a.cup, "setApp('cup',this.value)")}${fld('CIG', a.cig, "setApp('cig',this.value)")}
      ${fld('RUP', a.rup, "setApp('rup',this.value)")}${fld(a.tipologia && a.tipologia !== 'lavori' ? "Direttore dell'esecuzione" : 'Direttore dei Lavori', a.direttoreLavori, "setApp('direttoreLavori',this.value)")}
      ${fld('Data consegna lavori', a.dataInizio, "setApp('dataInizio',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('N. contratto / repertorio', a.numeroContratto, "setApp('numeroContratto',this.value)", 'text', 'es. 123/2024')}
      ${fld('Data stipula', a.dataStipula, "setApp('dataStipula',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Art. capitolato (certificato)', a.articoloCapitolato, "setApp('articoloCapitolato',this.value)")}
      ${fld('Progettista', a.progettista, "setApp('progettista',this.value)")}${fld('Coordinatore sicurezza (esecuzione)', a.cse, "setApp('cse',this.value)")}
      ${fld('Prezzario di riferimento', a.prezzario, "setApp('prezzario',this.value)", 'text', 'es. Prezzario regionale FVG 2026/1')}</div>
      <p class="b-muted" style="margin:6px 0 0">Questi sono <b>i dati del lavoro</b>, non solo della contabilità: gli stessi che il Computo chiama «dati generali». Si scrivono una volta sola, da qui o da là, e vanno in testa a tutte le stampe dei due strumenti.</p></fieldset>
    <fieldset class="b-fieldset"><legend>Dati generali (testata di SAL e certificato)</legend><div class="b-grid">
      ${fld('Registrato a', a.registrazione?.luogo, "setRegistrazione('luogo',this.value)", 'text', 'ufficio del registro')}
      ${fld('Registrazione — data', a.registrazione?.data, "setRegistrazione('data',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Registrazione — n.', a.registrazione?.numero, "setRegistrazione('numero',this.value)", 'text', 'n.')}
      ${fld('Data offerta', a.dataOfferta, "setApp('dataOfferta',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Data verbale di consegna', a.dataConsegna, "setApp('dataConsegna',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Giorni utili per l\'ultimazione', a.giorniUtili, "setAppNum('giorniUtili',this.value)", 'number', 'es. 100')}
      ${fld('Data utile per l\'ultimazione', a.dataUltimazionePrevista, "setApp('dataUltimazionePrevista',this.value)", 'text', 'gg/mm/aaaa (auto)')}
      ${fld('Nuova data di ultimazione', a.nuovaDataUltimazione, "setApp('nuovaDataUltimazione',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Somme a disposizione', a.sommeADisposizione, "setAppNum('sommeADisposizione',this.value)", 'number', '0,00')}
      ${fld('Importo per la manodopera', a.importoManodopera, "setAppNum('importoManodopera',this.value)", 'number', '0,00')}
      ${fld('Penale per il ritardo (per mille al giorno)', a.penalePerMille, "setAppNum('penalePerMille',this.value)", 'number', 'da 0,3 a 1')}</div>
      <p class="b-muted" style="margin:6px 0 0">Sospensioni, riprese e proroghe non si scrivono qui: si contano dai verbali redatti nella cronologia, ed è da lì che esce il termine vigente e l'eventuale ritardo.</p></fieldset>
    <fieldset class="b-fieldset"><legend>Chiusura: collaudo e svincolo della ritenuta</legend><div class="b-grid">
      <label class="b-field"><span>Atto di chiusura</span><select onchange="setCollaudo('tipo',this.value)">
        <option value="collaudo"${(a.collaudo?.tipo || 'collaudo') === 'collaudo' ? ' selected' : ''}>certificato di collaudo</option>
        <option value="cre"${a.collaudo?.tipo === 'cre' ? ' selected' : ''}>certificato di regolare esecuzione</option></select></label>
      ${fld('Data del certificato', a.collaudo?.data, "setCollaudo('data',this.value)", 'text', 'gg/mm/aaaa')}
      ${fld('Approvato dalla stazione appaltante il', a.collaudo?.dataApprovazione, "setCollaudo('dataApprovazione',this.value)", 'text', 'gg/mm/aaaa')}
      <label class="b-field"><span>DURC regolare</span><select onchange="setDurc(this.value)">
        <option value="no"${a.durc?.regolare === true ? '' : ' selected'}>no / non verificato</option>
        <option value="si"${a.durc?.regolare === true ? ' selected' : ''}>sì</option></select></label></div>
      <p class="b-muted" style="margin:6px 0 0">La ritenuta dello 0,50% si svincola solo in liquidazione finale, dopo l'approvazione dell'atto di chiusura e con DURC regolare (art. 125 c. 2). Finché manca una delle due condizioni il conto finale lo dichiara.</p></fieldset>
    <fieldset class="b-fieldset"><legend>Economia (netto IVA)</legend><div class="b-grid">
      ${fld('Base d\'asta', a.baseAsta, "setAppNum('baseAsta',this.value)", 'number', '0,00')}
      ${fld('Importo offerto', a.importoOfferta, "setAppNum('importoOfferta',this.value)", 'number', '0,00')}
      ${fld('Ribasso % (opz.)', a.ribassoPct, "setAppNum('ribassoPct',this.value)", 'number', 'auto')}
      ${fld('Oneri sicurezza', a.oneriSicurezza, "setAppNum('oneriSicurezza',this.value)", 'number', '0,00')}
      ${fld('IVA %', a.ivaPct, "setAppNum('ivaPct',this.value)", 'number', '10')}
      ${fld('Anticipazione % (art. 125)', a.anticipazionePct, "setAppNum('anticipazionePct',this.value)", 'number', 'es. 20')}
      ${fld('Arrotonda il certificato a € (per difetto)', a.arrotondamentoCertificato, "setAppNum('arrotondamentoCertificato',this.value)", 'number', 'es. 100')}</div>
      <label class="b-check"><input type="checkbox" ${a.prezziUnitari ? 'checked' : ''} onchange="setPrezziUnitari(this.checked)"><span><b>Offerta a prezzi unitari</b>: i prezzi delle partite sono quelli offerti, il ribasso è solo risultante e non si applica di nuovo nel SAL.</span></label>
      <div id="bDatiRiep" class="b-panel__body" style="margin-top:8px">${riepilogoHTML()}</div></fieldset>
    <fieldset class="b-fieldset"><legend>Tipologia e clausole</legend><div class="b-grid">
      <label class="b-field"><span>Oggetto del contratto</span><select onchange="setTipologia(this.value)">
        ${(['lavori', 'servizi', 'forniture'] as const).map((t) => `<option value="${t}"${(a.tipologia || 'lavori') === t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
      <label class="b-field"><span>Accordo quadro (art. 59)</span><select onchange="setAccordoQuadro(this.value==='si')"><option value="no"${a.accordoQuadro ? '' : ' selected'}>No</option><option value="si"${a.accordoQuadro ? ' selected' : ''}>Sì</option></select></label>
      ${a.accordoQuadro ? fld('Importo massimo dell\'accordo', a.accordoQuadro.importoMassimo, "setAqMassimo(this.value)", 'number', '0,00') : ''}
      <label class="b-field"><span>Revisione prezzi (art. 60)</span><select onchange="setRevisione('attiva',this.value)"><option value="no"${a.revisione?.attiva ? '' : ' selected'}>Non attiva</option><option value="si"${a.revisione?.attiva ? ' selected' : ''}>Attiva</option></select></label>
      ${a.revisione?.attiva ? `${fld('Indice di base', a.revisione.indiceBase, "setRevisione('indiceBase',this.value)", 'number', 'es. 112,4')}
        ${fld('Indice utilizzato', a.revisione.descrizioneIndice, "setRevisione('descrizioneIndice',this.value)", 'text', 'Indice sintetico di progetto (ISTAT)')}
        ${fld('Soglia %', a.revisione.sogliaPct, "setRevisione('sogliaPct',this.value)", 'number', String(parametriRevisione(a).sogliaPct))}
        ${fld('Quota riconosciuta %', a.revisione.quotaPct, "setRevisione('quotaPct',this.value)", 'number', String(parametriRevisione(a).quotaPct))}` : ''}</div>
      ${a.accordoQuadro ? `<div class="b-panel__body" style="margin-top:8px">${accordoQuadroHTML()}</div>` : ''}
      <p class="b-muted" style="margin:6px 0 0">Revisione: lavori soglia 3% e 90% dell'eccedenza; servizi e forniture 5% e 80% (art. 60 e All. II.2-bis, dopo il D.Lgs. 209/2024). L'indice del periodo si scrive in ogni SAL.</p>
      ${semplificataHTML()}</fieldset>
`
}
function openDati(): void {
  modal(`<div class="b-modal__h">Dati dell'appalto</div>
    <div class="b-modal__scroll">
${datiAppaltoCorpo()}
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal()">Fatto</button></div>`, true)
}
function riepilogoHTML(): string { const a = S.appalto; const rib = a.ribassoPct != null ? a.ribassoPct : ribassoPct(a.baseAsta, a.importoOfferta); return `<div class="b-sumrow"><span>Ribasso</span><b>${rib == null ? '—' : pctFmt(rib)}</b></div><div class="b-sumrow"><span>Totale contrattuale</span><b>${eur(totaleContrattuale(a, S.partite))}</b></div>` }
function refreshRiep(): void { const b = $('bDatiRiep'); if (b) b.innerHTML = riepilogoHTML() }
function setCollaudo(f: 'tipo' | 'data' | 'dataApprovazione', v: string): void {
  S.appalto.collaudo = { ...(S.appalto.collaudo || {}), [f]: v.trim() || undefined }
  saveDraft(); renderOra()
}
function setDurc(v: string): void {
  S.appalto.durc = { ...(S.appalto.durc || {}), regolare: v === 'si' }
  saveDraft(); renderOra()
}
function setRegistrazione(f: 'luogo' | 'data' | 'numero', v: string): void {
  S.appalto.registrazione = { ...(S.appalto.registrazione || {}), [f]: v.trim() || undefined }
  saveDraft(); renderOra()
}
function setApp(f: keyof Appalto, v: string): void { (S.appalto as unknown as Record<string, string>)[f] = v; if (f === 'dataInizio') { const iso = itToISO(v); if (iso) S.dataCorrenteISO = iso } saveDraft(); renderOra() }
function setPrezziUnitari(on: boolean): void { S.appalto.prezziUnitari = on; saveDraft(); refreshRiep(); renderLeft() }
/* I numeri si scrivono all'italiana anche qui: «12,35» è un ribasso valido. */
function setAppNum(f: keyof Appalto, v: string): void { (S.appalto as unknown as Record<string, number | null>)[f] = leggiNumero(v); saveDraft(); refreshRiep(); renderLeft(); renderTimeline() }
/* La testata del cruscotto porta oggetto e stazione appaltante: cambiarli deve
   vedersi subito, non al prossimo giro. */
function setEnte(f: string, v: string): void { (S.appalto.ente as unknown as Record<string, string>)[f] = v; saveDraft(); if (!S.editor) disegnaCruscotto(); else renderLeft() }
function setImpresa(f: string, v: string): void { (S.appalto.impresa as unknown as Record<string, string>)[f] = v; saveDraft() }
function pickLogo(): void { $('bLogoFile')?.click() }
function removeLogo(): void { delete S.appalto.ente.logo; saveDraft(); openDati() }
function onLogoFile(e: Event): void { const inp = e.target as HTMLInputElement; const file = inp.files && inp.files[0]; inp.value = ''; if (!file) return; const r = new FileReader(); r.onload = () => { S.appalto.ente.logo = String(r.result); saveDraft(); openDati(); toast('Logo caricato') }; r.readAsDataURL(file) }

/* ── Import del computo ─────────────────────────────────────────────────── */
function openImport(): void {
  const m = S.importMode
  const avviato = lavoroAvviato()
  modal(`<div class="b-modal__h">${avviato ? 'Importa altre voci' : 'Importa il computo metrico'}</div>
    ${avviato ? `<p class="b-avviso">Il lavoro è già avviato: quello che importi <b>si aggiunge</b>. Gli articoli nuovi entrano nell'elenco prezzi, quelli già presenti tengono il prezzo di contratto, e le misure del file puoi versarle in un libretto aperto o in una perizia in bozza. Prima di procedere vedrai che cosa cambia.</p>` : ''}
    <p class="b-muted" style="margin:0 0 12px">Il computo diventa l'insieme delle partite contabili. A misura conserva le righe di misura; a corpo aggrega per categoria in corpi d'opera con le aliquote. Se nel Computo ci sono voci segnate <b>a corpo</b> o un'<b>offerta a prezzi unitari</b> aggiudicata, l'import va voce per voce e ne tiene conto (appalto misto, prezzi offerti). Con l'import viene predisposto il <b>primo libretto</b>, già valorizzato dal computo.</p>
    <div class="b-import-mode">Contabilizza come:
      <label><input type="radio" name="bimp" value="misura"${m !== 'corpo' ? ' checked' : ''} onchange="setImportMode('misura')"> a misura</label>
      <label><input type="radio" name="bimp" value="corpo"${m === 'corpo' ? ' checked' : ''} onchange="setImportMode('corpo')"> a corpo</label></div>
    <div class="b-import-btns">
      <button class="ehb-btn" onclick="importMiu()" ${S.miuCart ? '' : 'disabled'} title="${S.miuCart?.contratto ? esc('Il contratto promosso nel Computo: ' + descriviContratto(S.miuCart.contratto)) : 'Il computo in corso nello strumento Computo (non ancora promosso a contratto)'}">${S.miuCart?.contratto ? '⇩ Importa il contratto promosso nel Computo' : '⇩ Usa il computo dello strumento Computo'}</button>
      <button class="ehb-btn" onclick="pickXpwe()">⇪ Importa un file XPWE</button>
      <button class="ehb-btn ehb-btn--ghost" onclick="partiDaZero()" title="Nessun computo: apri il primo SAL e crea le voci nel libretto, come in un computo">⊕ Parti da zero (senza computo)</button>
      ${_contabFile ? `<button class="ehb-btn ehb-btn--ghost" onclick="importaComeComputo()" title="Tiene solo voci, prezzi e quantità del file di contabilità e le usa come contratto: la storia dei SAL importata viene sostituita dal primo libretto">↺ Usa «${esc(_contabFile.nome)}» come computo</button>` : ''}
      ${S.partite.length ? '<button class="ehb-btn ehb-btn--ghost" onclick="svuotaComputo()">Svuota le partite importate</button>' : ''}</div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Chiudi</button></div>`)
}
function setImportMode(v: string): void { S.importMode = v === 'corpo' ? 'corpo' : 'misura'; S.appalto.modalita = S.importMode; saveDraft() }
/** Seed del PRIMO libretto: le quantità/quote del SAL 1 sono valorizzate dal computo. */
/** Riversa nel libretto TUTTE le quantità di progetto: si fa solo a richiesta
 *  («↻ Dal computo»), mai da soli — vedi ingest(). */
function seedPrimoLibretto(sal: Sal): void {
  sal.righe = S.partite.map((p) => p.modalita === 'corpo' ? { partitaId: p.id, quotaPct: 100 } : { partitaId: p.id, quantitaProgressiva: p.qtyProgetto ?? 0 })
}
function ingest(voci: VoceImport[], label: string, ribassoPct?: number | null): void {
  /* IL RIBASSO SI APPLICA UNA VOLTA SOLA, ALLA FINE. La contabilità si tiene
     ai PREZZI DI ELENCO del progetto esecutivo andato in appalto: è a quei
     prezzi che si scrivono registro e libretto, ed è sul totale dei lavori del
     SAL che si deduce il ribasso d'asta (la sicurezza non lo subisce). Qui i
     prezzi NON si toccano: il ribasso si registra nei dati dell'appalto e lo
     applica la cascata del SAL. L'unica eccezione è l'offerta a PREZZI
     UNITARI, dove ogni prezzo è già quello offerto e non c'è nulla da dedurre. */
  const perVoce = voci.some((v) => v.corpo || v.prezzoOfferto != null)
  S.partite = importaComputo(voci, perVoce ? 'misura' : S.importMode)
  if (ribassoPct != null && ribassoPct > 0 && !voci.some((v) => v.prezzoOfferto != null)) S.appalto.ribassoPct = ribassoPct
  if (perVoce) {
    const corpo = S.partite.some((p) => p.modalita === 'corpo'), misura = S.partite.some((p) => p.modalita === 'misura')
    S.appalto.modalita = corpo && misura ? 'misto' : corpo ? 'corpo' : 'misura'
  }
  if (voci.some((v) => v.prezzoOfferto != null)) {
    // offerta a prezzi unitari: base di gara e importo offerto dalle voci, ribasso solo risultante
    const sogg = voci.filter((v) => !v.sicurezza)
    S.appalto.prezziUnitari = true
    S.appalto.baseAsta = round2(sogg.reduce((s, v) => s + importoQta(v.qty, v.prezzo, v.um), 0))
    S.appalto.importoOfferta = round2(sogg.reduce((s, v) => s + importoQta(v.qty, v.prezzoOfferto ?? v.prezzo, v.um), 0))
    S.appalto.ribassoPct = null
  } else S.appalto.prezziUnitari = false
  /* IL COMPUTO È IL CONTRATTO, NON LA CONTABILITÀ. Dal computo entrano gli
     ARTICOLI — elenco prezzi, quantità di progetto, misure di progetto come
     riferimento — e nient'altro: il primo libretto nasce VUOTO. Le quantità
     eseguite le scrive il direttore dei lavori, voce per voce, prendendo se
     vuole le misure di progetto dal cassetto («▸ misure» → Progetto, oppure
     «↻ Dal computo» per riversarle tutte di proposito). Riempire il libretto
     da solo significherebbe contabilizzare l'intero appalto al primo SAL. */
  S.sals = [{ numero: 1, data: isoToIt(S.dataCorrenteISO), righe: [] }]
  saveDraft(); closeModal(); renderAll()
  toast(`${voci.length} voci importate ${label}: sono l'elenco prezzi di contratto, ai prezzi di progetto${S.appalto.ribassoPct ? ` (il ribasso del ${pctFmt(S.appalto.ribassoPct)} si deduce nel SAL)` : ''}. Il primo libretto è vuoto — le misure si scrivono lì.`)
}
function pickXpwe(): void { $('bXpweFile')?.click() }
/* ── SCAMBIO DATI, UGUALE OVUNQUE ─────────────────────────────────────────
   «Importa XPWE» e «Esporta XPWE» stanno nello stesso posto su ogni schermata
   che è un computo (libretto, perizia, computo di progetto). Cambia solo DOVE
   finiscono le voci: la schermata da cui parti è la destinazione proposta. */
let _importCtxPref: Contesto | null = null
function pickXpweIn(ctx: Contesto): void { _importCtxPref = ctx; pickXpwe() }
/** Esporta in XPWE quello che la schermata mostra: l'eseguito di un SAL, o il
 *  contratto vigente dopo una perizia. Stesso comando, stesso posto. */
function esportaXpweCtx(ctx: Contesto): void {
  const a = S.appalto
  let voci: VoceComputo[] = []
  let nome = 'computo'
  if (typeof ctx === 'number') {
    voci = vociConsuntive(a, S.partite, S.sals, ctx, S.economia)
    nome = `contabilita-sal-${ctx}`
  } else {
    const n = Number(/^pz(\d+)$/.exec(String(ctx))?.[1] || 0)
    const pz = perziaByN(n)
    if (!pz) { toast('Perizia non trovata'); return }
    voci = partiteVigenti(S.partite, (S.appalto.perizie || []).filter((p) => p.numero <= n), Number.MAX_SAFE_INTEGER)
      .filter((p) => (p.introdottaSal ?? 1) <= pz.dalSal || p.np?.periziaN === n)
      .map((p) => ({ codice: p.codice, desc_short: p.descrizione, declaratoria: p.declaratoria, um: p.um, prezzo: p.prezzoUnitario ?? undefined, qty: p.qtyProgetto ?? null, categoria: p.categoria, sicurezza: p.sicurezza, np: !!p.np, corpo: p.modalita === 'corpo' }))
    nome = `perizia-${n}`
  }
  if (!voci.length) { toast('Non c\'è ancora nulla da esportare in questa schermata'); return }
  const xml = buildXpwe(voci, { sorgente: 'Quadra', datiGenerali: { oggetto: a.oggetto, committente: a.ente?.denominazione, impresa: a.impresa?.denominazione } })
  void scaricaBlob(new Blob([xml], { type: 'application/xml' }), `${nome}.xpwe`)
  toast(`Esportate ${voci.length} voci in ${nome}.xpwe`)
}
/** Una domanda secca prima di un'azione che non si disfa. */
let _confermaAzione: (() => void) | null = null
function conferma(titolo: string, spiega: string, azione: () => void): void {
  _confermaAzione = azione
  modal(`<div class="b-modal__h">${esc(titolo)}</div>
    <div class="b-modal__scroll"><p class="b-muted">${esc(spiega)}</p></div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button>
      <button class="ehb-btn ehb-btn--accent-soft" onclick="eseguiConferma()">Procedi</button></div>`)
}
function eseguiConferma(): void { const f = _confermaAzione; _confermaAzione = null; closeModal(); if (f) f() }

/* ── LAVORARE SU PIÙ VOCI INSIEME ─────────────────────────────────────────
   Su un computo di centotrenta voci, fare una cosa alla volta è una pena:
   eliminare dieci righe sbagliate, dare una categoria a un intero capitolo,
   numerare la WBS di un lotto. Si spuntano le righe e si agisce sulla
   selezione. La selezione vale per la schermata aperta — libretto o perizia —
   e si azzera quando si cambia tappa. */
const libSel = new Set<string>()
let _ultimaSel: string | null = null
function libSelToggle(pid: string, on: boolean, estendi = false): void {
  if (estendi && _ultimaSel) {
    // Maiusc: dalla precedente a questa, com'è d'uso in ogni elenco
    const ids = [...document.querySelectorAll<HTMLInputElement>('.b-selbox')].map((e) => e.dataset.pid || '')
    const a = ids.indexOf(_ultimaSel), b = ids.indexOf(pid)
    if (a >= 0 && b >= 0) for (const id of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) on ? libSel.add(id) : libSel.delete(id)
  } else on ? libSel.add(pid) : libSel.delete(pid)
  _ultimaSel = pid
  reopenEditor()
}
function libSelTutte(on: boolean): void {
  libSel.clear()
  if (on) for (const e of document.querySelectorAll<HTMLInputElement>('.b-selbox')) if (e.dataset.pid) libSel.add(e.dataset.pid)
  reopenEditor()
}
/** La riga dei comandi sulla selezione: compare solo quando c'è una selezione. */
function barraSelezioneHTML(ctx: Contesto): string {
  if (!libSel.size) return ''
  const n = libSel.size
  return `<div class="b-selbar"><b>${n}</b> voc${n === 1 ? 'e selezionata' : 'i selezionate'}
    <span class="b-selbar__g">
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="selCategoria()" title="Assegna la stessa categoria a tutte le voci selezionate">☰ Categoria…</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="selWbs()" title="Assegna lo stesso codice WBS alle voci selezionate">⌗ WBS…</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="copiaVociSelezionate()" title="Copia le voci scelte: si incollano in un altro lavoro aperto in un'altra finestra (⌘C)">⧉ Copia</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="selElimina(${JSON.stringify(ctx)})" title="Elimina le voci non ancora contabilizzate e storna quelle che lo sono: una per una, con la stessa regola di sempre">🗑 Elimina / storna</button>
    </span>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="libSelTutte(false)">Deseleziona</button></div>`
}
/* IL TASTO DESTRO, come nel computo. Sulla riga apre il menù delle azioni di
   gruppo: se la riga non era selezionata diventa lei la selezione, altrimenti
   il menù agisce su tutte quelle spuntate. Maiusc/Ctrl sul clic aggiungono alla
   selezione senza passare dalla casella. */
function rigaMenu(ev: MouseEvent, pid: string, ctx: Contesto): void {
  ev.preventDefault()
  if (!libSel.has(pid)) { libSel.clear(); libSel.add(pid); _ultimaSel = pid; reopenEditor() }
  apriMenuVoci(ev.pageX, ev.pageY, ctx)
}
function rigaClick(ev: MouseEvent, pid: string): void {
  if (!(ev.shiftKey || ev.metaKey || ev.ctrlKey)) return
  const t = ev.target as HTMLElement
  if (t.closest('button') || t.closest('input') || t.closest('select') || t.closest('a')) return
  ev.preventDefault()
  libSelToggle(pid, !libSel.has(pid), ev.shiftKey)
}
/* TASTO DESTRO DOVUNQUE: su una riga di misura, su una voce dell'elenco prezzi,
   su una tappa dell'albero. Ogni operazione si fa da dove si è, non cercando
   il pulsante giusto in una barra lontana. */
function menuGenerico(ev: MouseEvent, titolo: string, voci: { t: string; cmd: string; danger?: boolean }[]): void {
  ev.preventDefault(); ev.stopPropagation()
  chiudiMenuVoci()
  const m = document.createElement('div')
  m.id = 'bCtxVoci'; m.className = 'b-ctx'
  m.innerHTML = `<div class="b-ctx__hint">${esc(titolo)}</div>` + voci.map((v) =>
    v.t === '-' ? '<div class="b-ctx__sep"></div>'
      : `<div class="b-ctx__i${v.danger ? ' b-ctx__i--danger' : ''}" onclick="chiudiMenuVoci();${v.cmd}">${esc(v.t)}</div>`).join('')
  document.body.appendChild(m)
  m.style.left = Math.max(8, Math.min(ev.pageX, window.innerWidth - 240)) + 'px'
  m.style.top = Math.max(8, Math.min(ev.pageY, window.innerHeight - 240)) + 'px'
  setTimeout(() => document.addEventListener('mousedown', chiudiMenuVoci, { once: true }), 0)
}

function menuMisura(ev: MouseEvent, ctx: Contesto, pid: string, i: number): void {
  if (ctxBloccato(ctx)) return
  const c = ctxLit(ctx)
  menuGenerico(ev, `Riga di misura ${i + 1}`, [
    { t: '＋ Riga sotto', cmd: `addMisura(${c},'${pid}',false)` },
    { t: '− Riga in detrazione', cmd: `addMisura(${c},'${pid}',true)` },
    { t: '⧉ Duplica', cmd: `duplicaMisura(${c},'${pid}',${i})` },
    { t: '-', cmd: '' },
    { t: '🗑 Elimina la riga', cmd: `delMisura(${c},'${pid}',${i})`, danger: true },
  ])
}

/** Tasto destro su una voce dell'elenco prezzi del lavoro. */
function menuPrezzo(ev: MouseEvent, pid: string, ctx: Contesto): void {
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const c = ctxLit(ctx)
  const salN = typeof ctx === 'number' ? ctx : (periziaDiCtx(ctx)?.dalSal ?? 1)
  menuGenerico(ev, `${p.codice || '(senza codice)'}`, [
    { t: '＋ Misura questa voce', cmd: `portaNelLibretto(${salN},'${pid}')` },
    ...(p.np ? [] : [{ t: '≈ Nuovo prezzo da questa', cmd: `assimilaVoce(${salN},'${pid}')` }]),
    { t: '-', cmd: '' },
    { t: "🗑 Togli dall'elenco prezzi", cmd: `delVoceElenco('${pid}',${c})`, danger: true },
  ])
}

/** Toglie una voce dall'elenco prezzi del lavoro, se non è contabilizzata. */
function delVoceElenco(pid: string, ctx: Contesto): void {
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const usata = S.sals.some((sal) => sal.righe.some((r) => r.partitaId === pid
    && ((r.misurazioni?.length || 0) > 0 || r.quantitaProgressiva != null)))
  if (usata) { toast('La voce è già contabilizzata: eliminala dal libretto dove è misurata'); return }
  if (!confirm(`Togliere «${p.codice || p.descrizione.slice(0, 40)}» dall'elenco prezzi del lavoro?`)) return
  S.partite = S.partite.filter((x) => x.id !== pid)
  saveDraft(); renderAll(); if (_cassetto) disegnaCassetto()
  void ctx
  toast('Voce tolta dall\'elenco prezzi')
}

function chiudiMenuVoci(): void { document.getElementById('bCtxVoci')?.remove() }
function apriMenuVoci(x: number, y: number, ctx: Contesto): void {
  chiudiMenuVoci()
  const n = libSel.size
  const m = document.createElement('div')
  m.id = 'bCtxVoci'; m.className = 'b-ctx'
  m.innerHTML = `<div class="b-ctx__hint">${n} voc${n === 1 ? 'e selezionata' : 'i selezionate'}</div>
    <div class="b-ctx__i" onclick="chiudiMenuVoci();selCategoria()">☰ Assegna categoria…</div>
    <div class="b-ctx__i" onclick="chiudiMenuVoci();selWbs()">⌗ Assegna WBS…</div>
    <div class="b-ctx__i" onclick="chiudiMenuVoci();libEspandi(true)">▾ Apri le misure</div>
    <div class="b-ctx__sep"></div>
    <div class="b-ctx__i" onclick="chiudiMenuVoci();libSelTutte(false)">Deseleziona</div>
    <div class="b-ctx__sep"></div>
    <div class="b-ctx__i b-ctx__i--danger" onclick="chiudiMenuVoci();selElimina(${JSON.stringify(ctx)})">🗑 Elimina / storna</div>`
  document.body.appendChild(m)
  m.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px'
  m.style.top = Math.max(8, Math.min(y, window.innerHeight - 240)) + 'px'
  setTimeout(() => document.addEventListener('mousedown', chiudiMenuVoci, { once: true }), 0)
}
/* ── COPIARE VOCI FRA DUE FINESTRE ────────────────────────────────────────
   Due lavori affiancati (File → Nuova finestra) e le voci si passano con
   Copia/Incolla: si selezionano, ⌘C, si va nell'altra finestra e ⌘V. Fra due
   finestre separate il trascinamento non arriva a destinazione — il sistema lo
   consegna solo dentro la finestra da cui parte — mentre gli appunti ci
   passano, e sono lo stesso gesto di sempre. Dentro la stessa schermata il
   trascinamento continua a funzionare. */
const MARCA_VOCI = 'quadra/voci@1'

function copiaVociSelezionate(): void {
  const voci = vociSelezionate()
  if (!voci.length) { toast('Nessuna voce selezionata'); return }
  const payload = {
    marca: MARCA_VOCI,
    da: S.appalto.oggetto || 'Quadra',
    voci: voci.map((p) => ({
      codice: p.codice, desc_short: p.descrizione, declaratoria: p.declaratoria,
      um: p.um, prezzo: p.prezzoContratto ?? p.prezzoUnitario ?? null,
      qty: p.qtyProgetto ?? null, categoria: p.categoria, ...(p.wbs ? { wbs: p.wbs } : {}),
    })),
  }
  const testo = JSON.stringify(payload)
  void navigator.clipboard?.writeText(testo)
    .then(() => toast(`${voci.length} voc${voci.length === 1 ? 'e copiata' : 'i copiate'}: incollale nell'altra finestra con ⌘V`))
    .catch(() => toast('Gli appunti non sono disponibili in questo contesto'))
}

async function incollaVoci(ctx: Contesto): Promise<void> {
  let testo = ''
  try { testo = await navigator.clipboard.readText() } catch { toast('Non riesco a leggere gli appunti'); return }
  let dati: { marca?: string; da?: string; voci?: VoceImport[] } | null = null
  try { dati = JSON.parse(testo) } catch { dati = null }
  if (!dati || dati.marca !== MARCA_VOCI || !dati.voci?.length) { toast('Negli appunti non ci sono voci di Quadra'); return }
  apriSceltaImport(dati.voci, `appunti${dati.da ? ` · ${dati.da}` : ''}`, null, ctx)
}

/* ── AGGIORNAMENTO PREZZI A PARITÀ DI TARIFFA ─────────────────────────────
   Si pescano voci da un computo vecchio perché è più veloce che cercarle nel
   prezzario; poi i prezzi si riallineano al listino di oggi, articolo per
   articolo, confrontando il CODICE (la tariffa). Regola non negoziabile: un
   prezzo DI CONTRATTO non si tocca — quello è pattuito. Si aggiornano le voci
   che contratto non sono: i nuovi prezzi delle perizie ancora in bozza. */
let _aggPrezzi: { slug: string; righe: { p: Partita; nuovo: number; delta: number }[]; escluse: Set<string> } | null = null

async function apriAggiornaPrezzi(): Promise<void> {
  const lista = _prezzari
  if (!lista.length) { toast('Nessun prezzario nel programma: caricane uno dal Computo'); return }
  await calcolaAggiornamento(_aggPrezzi?.slug || lista[0].id)
}
async function calcolaAggiornamento(slug: string): Promise<void> {
  toast('Confronto i prezzi con il prezzario…')
  const righe = await caricaPrezzario(slug)
  const perCodice = new Map(righe.filter((r) => r.prezzo > 0).map((r) => [r.codice.trim().toUpperCase(), r]))
  const inBozza = new Set((S.appalto.perizie || []).filter((z) => !periziaApprovata(z)).map((z) => z.numero))
  const candidate = S.partite.filter((p) => p.np?.periziaN != null && inBozza.has(p.np.periziaN) && p.modalita !== 'corpo')
  const trovate: { p: Partita; nuovo: number; delta: number }[] = []
  for (const p of candidate) {
    const r = perCodice.get(p.codice.trim().toUpperCase())
    if (!r) continue
    const ora = p.prezzoUnitario ?? 0
    if (Math.abs(r.prezzo - ora) < 0.005) continue
    trovate.push({ p, nuovo: r.prezzo, delta: ora > 0 ? ((r.prezzo - ora) / ora) * 100 : 0 })
  }
  _aggPrezzi = { slug, righe: trovate, escluse: new Set() }
  disegnaAggiornaPrezzi(candidate.length)
}
function disegnaAggiornaPrezzi(candidate: number): void {
  const a = _aggPrezzi; if (!a) return
  const lista = _prezzari
  const righe = a.righe.map((x) => `<label class="b-opt">
      <input type="checkbox" ${a.escluse.has(x.p.id) ? '' : 'checked'} onchange="toggleAggPrezzo('${x.p.id}',this.checked)">
      <span><b>${esc(x.p.codice)}</b> <span class="b-muted">${esc(x.p.descrizione.slice(0, 64))}</span>
        <small>${eur(x.p.prezzoUnitario ?? 0)} → <b>${eur(x.nuovo)}</b> · ${x.delta > 0 ? '+' : ''}${numFmt(x.delta)}%</small></span></label>`).join('')
  modal(`<div class="b-modal__h">Aggiorna i prezzi dal prezzario</div>
    <div class="b-modal__scroll">
      <p class="b-muted">Si confrontano i <b>codici</b> (la tariffa) con il prezzario scelto e si riallineano i prezzi. I <b>prezzi di contratto non si toccano</b>: sono pattuiti. Si aggiornano i nuovi prezzi delle perizie ancora in bozza — qui ce ne sono ${candidate}.</p>
      ${lista.length > 1 ? `<label class="b-field"><span>Prezzario</span><select onchange="cambiaPrezzarioAgg(this.value)">${lista.map((x) => `<option value="${esc(x.id)}"${x.id === a.slug ? ' selected' : ''}>${esc(nomePrezzario(x))}</option>`).join('')}</select></label>` : ''}
      ${a.righe.length ? `<fieldset class="b-fieldset"><legend>${a.righe.length} prezz${a.righe.length === 1 ? 'o cambiato' : 'i cambiati'}</legend>${righe}</fieldset>`
        : '<p class="b-avviso">Nessuna differenza: i prezzi aggiornabili sono già allineati a questo prezzario (o i codici non vi compaiono).</p>'}
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button>
      ${a.righe.length ? '<button class="ehb-btn ehb-btn--accent-soft" onclick="applicaAggiornaPrezzi()">Aggiorna i prezzi scelti</button>' : ''}</div>`, true)
}
function toggleAggPrezzo(pid: string, on: boolean): void {
  if (!_aggPrezzi) return
  if (on) _aggPrezzi.escluse.delete(pid); else _aggPrezzi.escluse.add(pid)
}
function cambiaPrezzarioAgg(slug: string): void { void calcolaAggiornamento(slug) }
function applicaAggiornaPrezzi(): void {
  const a = _aggPrezzi; if (!a) return
  const fonte = _prezzari.find((x) => x.id === a.slug)
  let n = 0
  for (const x of a.righe) {
    if (a.escluse.has(x.p.id)) continue
    x.p.prezzoUnitario = x.nuovo
    if (x.p.np) x.p.np = { ...x.p.np, base: { ...(x.p.np.base || {}), prezzo: x.nuovo, fonte: fonte ? nomePrezzario(fonte) : 'prezzario' } }
    n++
  }
  _aggPrezzi = null
  closeModal(); saveDraft(); renderAll()
  toast(n ? `${n} prezz${n === 1 ? 'o aggiornato' : 'i aggiornati'} dal prezzario, a parità di tariffa` : 'Nessun prezzo aggiornato')
}

/** Da dove viene un nuovo prezzo, detto come lo direbbe l'atto. */
function derivazioneNP(p: Partita): string {
  const np = p.np; if (!np) return '—'
  const fonte = np.base?.fonte
  const cod = np.base?.codice
  if (fonte && !/voce di contratto/i.test(fonte)) return cod ? `${fonte} · ${cod}` : fonte
  return cod ? `${ORIGINE_NP[np.origine] || ''} da ${cod}` : ORIGINE_NP[np.origine] || '—'
}
function vociSelezionate(): Partita[] { return S.partite.filter((p) => libSel.has(p.id)) }
function selCategoria(): void {
  const voci = vociSelezionate(); if (!voci.length) return
  const cats = [...new Set(S.partite.map((p) => p.categoria).filter(Boolean))] as string[]
  modal(`<div class="b-modal__h">Categoria di ${voci.length} voci</div>
    <div class="b-modal__scroll">
      <p class="b-muted">La categoria raggruppa le voci a schermo e nel sommario per categorie omogenee. Vuoto = nessuna categoria.</p>
      <label class="b-field"><span>Categoria</span><input id="bSelCat" list="bSelCatL" value="${esc(voci[0].categoria || '')}" placeholder="es. OPERE EDILI · SCAVI">
        <datalist id="bSelCatL">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button>
      <button class="ehb-btn ehb-btn--accent-soft" onclick="applicaSelCampo('categoria')">Assegna</button></div>`, true)
}
function selWbs(): void {
  const voci = vociSelezionate(); if (!voci.length) return
  modal(`<div class="b-modal__h">WBS di ${voci.length} voci</div>
    <div class="b-modal__scroll">
      <p class="b-muted">Codice WBS gerarchico, es. <b>01.02</b>. Con <b>01.02.*</b> le voci selezionate prendono 01.02.01, 01.02.02, … nell'ordine in cui stanno a schermo.</p>
      <label class="b-field"><span>WBS</span><input id="bSelWbs" value="${esc(voci[0].wbs || '')}" placeholder="01.02 oppure 01.02.*"></label>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button>
      <button class="ehb-btn ehb-btn--accent-soft" onclick="applicaSelCampo('wbs')">Assegna</button></div>`, true)
}
function applicaSelCampo(campo: 'categoria' | 'wbs'): void {
  const v = ($(campo === 'wbs' ? 'bSelWbs' : 'bSelCat') as HTMLInputElement | null)?.value?.trim() || ''
  const voci = vociSelezionate()
  const progressivo = campo === 'wbs' && v.endsWith('.*')
  const radice = progressivo ? v.slice(0, -2) : v
  voci.forEach((p, i) => {
    const valore = progressivo ? `${radice}.${String(i + 1).padStart(2, '0')}` : radice
    if (valore) p[campo] = valore; else delete p[campo]
  })
  closeModal(); saveDraft(); renderAll(); reopenEditor()
  toast(`${campo === 'wbs' ? 'WBS' : 'Categoria'} assegnata a ${voci.length} voc${voci.length === 1 ? 'e' : 'i'}`)
}
function selElimina(ctx: Contesto): void {
  const voci = vociSelezionate(); if (!voci.length) return
  const salN = typeof ctx === 'number' ? ctx : (periziaDiCtx(ctx)?.dalSal ?? salDiDestinazione(S.sals))
  conferma(`Elimino o storno ${voci.length} voc${voci.length === 1 ? 'e' : 'i'}?`,
    'Le voci non ancora contabilizzate si eliminano; quelle già contabilizzate si stornano al SAL corrente e restano a verbale negli atti precedenti. È la stessa regola della singola voce, applicata in fila.',
    () => {
      const prima = S.partite.length
      for (const p of voci) delVoceSilenziosa(p.id, salN)
      const tolte = prima - S.partite.length
      libSel.clear(); saveDraft(); renderAll(); reopenEditor()
      toast(`${tolte} voc${tolte === 1 ? 'e eliminata' : 'i eliminate'}${voci.length - tolte ? ` · ${voci.length - tolte} stornat${voci.length - tolte === 1 ? 'a' : 'e'} al SAL ${salN}` : ''}`)
    })
}
/** I tre modi di aggiungere una voce: identici su computo, libretto e perizia. */
function azioniVoce(ctx: Contesto, bloccata = false): AzioneBarra[] {
  // la voce entra DOVE SI STA LAVORANDO: nel libretto se si è nel libretto,
  // nella perizia se si è in perizia. Prima finiva sempre nel SAL.
  const c = JSON.stringify(ctx)
  const salN = typeof ctx === 'number' ? ctx : (periziaDiCtx(ctx)?.dalSal ?? salDiDestinazione(S.sals))
  /* «Voce dal prezzario» non è più un pulsante: il prezzario sta sempre aperto
     nella colonna di destra, e la voce entra da lì. Restano i due casi che il
     pannello non copre: la riga vuota da misurare subito e il nuovo prezzo. */
  return [
    /* Il pannello dei prezzi si chiude, quindi si deve poter RIAPRIRE: un
       pannello che sparisce per sempre al primo ✕ è una trappola. */
    { etichetta: _cassetto ? '≡ Prezzi ✓' : '≡ Prezzi', titolo: _cassetto ? 'Il pannello dei prezzi è aperto a destra' : 'Riapri il pannello dei prezzi a destra', onclick: `apriCassetto(${ctxLit(c)}, 'contratto')` },
    { etichetta: '＋ Voce libera', titolo: "Riga vuota su cui fissare subito la misura: l'articolo si assegna dopo", onclick: `addVoceLibera(${salN})`, disabilitata: bloccata },
    { etichetta: '＋ Nuovo prezzo…', titolo: 'Un prezzo non di contratto è un nuovo prezzo: prende un codice NP stabile', onclick: `apriNuovoPrezzo(${salN})`, stile: 'ghost', disabilitata: bloccata },
  ]
}
/* ── STRUTTURA ────────────────────────────────────────────────────────────
   Categorie e WBS delle voci: le stesse due chiavi con cui il computo
   raggruppa, qui modificabili voce per voce. Non è una vista nuova: è il
   pannello che alimenta «ORDINA → Categorie / WBS». */
function apriStruttura(): void {
  const voci = S.partite.filter((p) => !p.soppressaSal)
  if (!voci.length) { toast('Non ci sono ancora voci da strutturare'); return }
  const cats = new Map<string, number>()
  for (const p of voci) { const k = p.categoria || 'Senza categoria'; cats.set(k, (cats.get(k) || 0) + 1) }
  const righe = voci.map((p) => `<tr>
    <td class="b-mono">${esc(p.codice)}</td>
    <td><span class="b-desc-clamp" title="${esc(p.descrizione)}">${esc(p.descrizione)}</span></td>
    <td><input value="${esc(p.categoria || '')}" placeholder="Categoria" list="bStrutturaCat" onchange="setStrutturaVoce('${p.id}','categoria',this.value)" style="width:180px"></td>
    <td><input value="${esc(p.wbs || '')}" placeholder="01.02" onchange="setStrutturaVoce('${p.id}','wbs',this.value)" style="width:96px"></td>
  </tr>`).join('')
  modal(`<div class="b-modal__h">Struttura del lavoro — ${voci.length} voci in ${cats.size} categori${cats.size === 1 ? 'a' : 'e'}</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">Categoria e WBS decidono come le voci si raggruppano a schermo («ORDINA») e nelle stampe (sommario per categorie omogenee). Si possono lasciare vuote.</p>
      <datalist id="bStrutturaCat">${[...cats.keys()].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="b-tablewrap"><table class="b-etable"><thead><tr><th>Codice</th><th>Designazione</th><th>Categoria</th><th>WBS</th></tr></thead><tbody>${righe}</tbody></table></div>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal()">Chiudi</button></div>`, true)
}
function setStrutturaVoce(id: string, campo: 'categoria' | 'wbs', v: string): void {
  const p = S.partite.find((x) => x.id === id); if (!p) return
  const t = v.trim()
  if (t) p[campo] = t; else delete p[campo]
  saveDraft(); renderAll()
}
/** Gli strumenti del lavoro: stessa terna, stessa posizione, su ogni schermata. */
function azioniStrumenti(): AzioneBarra[] {
  return [
    /* «Stampe» qui non c'è: il comando di stampa è UNO, in testata. Averne due
       significava due elenchi diversi per la stessa operazione. */
    { etichetta: '⧗ Revisioni', titolo: 'Le versioni del contratto: le perizie di variante e che cosa hanno cambiato', onclick: 'openPerizie()', stile: 'ghost' },
    { etichetta: '☰ Struttura', titolo: 'Categorie e WBS delle voci: come si raggruppano a schermo e in stampa', onclick: 'apriStruttura()', stile: 'ghost' },
    { etichetta: '⟳ Prezzi', titolo: 'Aggiorna i prezzi dal prezzario, a parità di tariffa: i prezzi di contratto non si toccano', onclick: 'apriAggiornaPrezzi()', stile: 'ghost' },
  ]
}
/** Gli stessi due comandi, nello stesso ordine, per qualunque schermata. */
function azioniDati(ctx: Contesto, bloccata = false): AzioneBarra[] {
  return [
    { etichetta: '⇩ Importa XPWE', titolo: bloccata ? 'Atto chiuso: non si importa più qui' : 'Importa voci e misure da un file XPWE dentro questa schermata', onclick: `pickXpweIn(${JSON.stringify(ctx)})`, stile: 'ghost', disabilitata: bloccata },
    { etichetta: '⇧ Esporta XPWE', titolo: 'Esporta in XPWE quello che questa schermata contiene', onclick: `esportaXpweCtx(${JSON.stringify(ctx)})`, stile: 'ghost' },
  ]
}
/** Import di un computo XPWE: voci, righe di misura e categorie; i dati
 *  generali (oggetto, committente) completano l'appalto solo se ancora vuoti. */
async function onXpweFile(e: Event): Promise<void> {
  const inp = e.target as HTMLInputElement; const file = inp.files && inp.files[0]; inp.value = ''
  if (!file) return
  let doc
  try { doc = parseXpwe(await file.text()) } catch (err) { toast('File XPWE non leggibile: ' + ((err as Error)?.message || err)); return }
  const voci = xpweToVoci(doc)
  if (!voci.length) { toast('Il file XPWE non contiene voci di computo'); return }
  completaAppalto(doc.datiGenerali)
  if (doc.avvisi.length) console.warn('[XPWE] ' + doc.avvisi.join('\n'))
  // Decide il FILE: una contabilità con misure datate entra come contabilità (resta da
  // scegliere solo come ripartire le date nei SAL). Senza date non c'è storia da
  // ricostruire: entra come computo, come qualunque altro XPWE.
  if (doc.tipoDocumento === 2 && voci.some((v) => v.dataMis) && !lavoroAvviato()) { apriImportContabilita(voci as VoceImport[], file.name); return }
  if (lavoroAvviato()) { apriSceltaImport(voci as VoceImport[], file.name); return }
  ingest(voci as VoceImport[], `da ${file.name}${doc.avvisi.length ? ` (${doc.avvisi.length} avvisi)` : ''}`)
}
let _contabPending: { voci: VoceImport[]; nome: string; mappa: Map<string, number> } | null = null
/* Ultima contabilità importata: resta a disposizione per il comando «usa come computo»,
   che è una scelta successiva (e rara), non una domanda da fare al momento dell'import. */
let _contabFile: { voci: VoceImport[]; nome: string } | null = null
/* ── UNA CONTABILITÀ IMPORTATA È UN SOLO LAVORO ───────────────────────────
   Le misure di un libretto portano ciascuna la propria data: è la colonna
   «DATA» degli atti, non un indice di avanzamento. Dividere i SAL per data
   significa trasformare un SAL con misure di sei giornate in sei SAL — che è
   quello che succedeva, e faceva quadrare i conti con nessuno. Il valore
   normale è dunque UNO: le date restano dove devono stare, sulle righe. Chi ha
   davvero più SAL nel file li separa a mano, qui. */
function apriImportContabilita(voci: VoceImport[], nome: string): void {
  const date = [...new Set(voci.map((v) => v.dataMis || '').filter(Boolean))]
  const mappa = new Map<string, number>(date.map((d) => [d, 1]))
  _contabPending = { voci, nome, mappa }
  _contabFile = { voci, nome }
  disegnaImportContabilita()
}
function disegnaImportContabilita(): void {
  if (!_contabPending) return
  const { voci, mappa } = _contabPending
  const conta = new Map<string, number>()
  for (const v of voci) if (v.dataMis) conta.set(v.dataMis, (conta.get(v.dataMis) || 0) + 1)
  const date = [...mappa.keys()]
  const quanti = new Set([...mappa.values()]).size
  const righe = date.map((d) => `<tr><td class="b-mono">${esc(d)}</td><td class="b-num">${conta.get(d) || 0}</td>
    <td><input type="number" min="1" step="1" value="${mappa.get(d)}" style="width:70px" onchange="setDataSalImport('${esc(d)}',this.value)"></td></tr>`).join('')
  modal(`<div class="b-modal__h">Contabilità da XPWE: ${voci.length} misure in ${date.length} giornate</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">Il file è una contabilità (libretto delle misure) e viene importato come tale. ${S.partite.length ? 'Le voci si abbinano al computo già importato (stesso codice e prezzo); le altre diventano voci nuove.' : 'Non c\'è ancora un computo di progetto: le voci diventano partite a misura senza quantità di contratto (puoi importare prima il computo di progetto).'}</p>
      <p class="b-avviso${quanti === 1 ? ' b-avviso--ok' : ''}">${quanti === 1
        ? `Tutte le misure vanno nel <b>SAL n. 1</b>, e ciascuna conserva la sua data nel libretto. È quasi sempre quello che serve: le date delle misure sono giornate di rilievo, non avanzamenti.`
        : `Stai dividendo le misure in <b>${quanti} SAL</b>. Fallo solo se il file contiene davvero più stati di avanzamento già emessi: ogni SAL è progressivo e comprende le misure dei precedenti.`}</p>
      <details${quanti > 1 ? ' open' : ''}><summary class="b-muted">Dividere in più SAL (${date.length} giornate di rilievo)</summary>
        <div class="b-tablewrap" style="margin-top:8px"><table class="b-etable"><thead><tr><th>Data delle misure</th><th class="b-num">Voci</th><th>SAL n.</th></tr></thead><tbody>${righe}</tbody></table></div>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" style="margin-top:6px" onclick="proponiSalPerData()">Proponi una divisione per date vicine</button>
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" style="margin-top:6px" onclick="tuttoUnSalImport()">Rimetti tutto nel SAL 1</button>
      </details>
      ${S.sals.length ? '<p class="b-muted" style="margin:8px 0 0">I SAL già presenti saranno sostituiti da quelli della contabilità importata.</p>' : ''}
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="confermaImportContabilita()">Importa la contabilità</button></div>`, true)
}
/** Il file è sì una contabilità, ma la si vuole come computo di partenza. */
function importaComeComputo(): void {
  const p = _contabPending || _contabFile; if (!p) return
  _contabPending = null
  ingest(p.voci, `da ${p.nome} (quantità contabilizzate come contratto)`)
}

/** Riporta la proposta «una data, un SAL» del motore (date vicine insieme). */
function proponiSalPerData(): void {
  if (!_contabPending) return
  _contabPending.mappa = proponiSal(_contabPending.voci.map((v) => v.dataMis || ''))
  disegnaImportContabilita()
}
function setDataSalImport(d: string, v: string): void {
  const n = Math.max(1, Math.floor(Number(v) || 1))
  _contabPending?.mappa.set(d, n)
  disegnaImportContabilita() // l'avviso in testa deve dire quanti SAL stanno nascendo
}
function tuttoUnSalImport(): void {
  if (!_contabPending) return
  for (const d of [..._contabPending.mappa.keys()]) _contabPending.mappa.set(d, 1)
  disegnaImportContabilita()
}

function confermaImportContabilita(): void {
  if (!_contabPending) return
  const p = _contabPending; _contabPending = null
  // numeri di SAL compatti (1, 2, 3…) nell'ordine scelto
  const ordine = [...new Set([...p.mappa.values()])].sort((a, b) => a - b)
  const mappa = new Map([...p.mappa.entries()].map(([d, n]) => [d, ordine.indexOf(n) + 1]))
  const e = contabilitaDaVoci(p.voci, S.partite, mappa)
  S.partite = e.partite; S.sals = e.sals
  saveDraft(); closeModal(); renderAll()
  toast(`Contabilità importata: ${e.sals.length} SAL, ${e.abbinate} voci abbinate al computo, ${e.nuove} nuove${e.senzaData ? `, ${e.senzaData} senza data (nel primo SAL)` : ''}`)
  // Il tracciato non porta le condizioni del contratto: chiederle subito è l'unico
  // modo perché gli importi del primo certificato siano quelli giusti.
  if (datiMancanti(S.appalto, S.partite).some((x) => x.critico)) chiediDatiContratto()
}
/** I dati generali del progetto completano i dati d'appalto ancora vuoti (mai sovrascritti). */
/* ── I DATI DEL LAVORO STANNO IN UN POSTO SOLO ────────────────────────────
   Oggetto, luogo, CUP/CIG, committente, RUP, progettista, DL, impresa e il
   contratto (ribasso o prezzi offerti) sono gli STESSI dati per il Computo e
   per la Contabilità: si compilano una volta e viaggiano. Finora andavano solo
   dal Computo in qua; adesso anche di qua in là, così chi corregge il CIG nella
   contabilità non se lo ritrova vecchio nelle stampe del computo. */
function datiLavoro(): Partial<DatiGenerali> {
  const a = S.appalto
  return {
    oggetto: a.oggetto || '', cup: a.cup || '', cig: a.cig || '',
    committente: a.ente.denominazione || '', indirizzoCommittente: a.ente.indirizzo || '',
    rup: a.rup || '', direttoreLavori: a.direttoreLavori || '', impresa: a.impresa.denominazione || '',
    comune: a.comune || '', provincia: a.provincia || '', progettista: a.progettista || '',
    cse: a.cse || '', prezzario: a.prezzario || '',
    ...(a.ribassoPct != null || a.prezziUnitari || a.dataStipula
      ? { contratto: { ribassoPct: a.ribassoPct ?? null, prezziOfferti: !!a.prezziUnitari, data: a.dataStipula || '' } }
      : {}),
  }
}
/** Rende pubblici i dati del lavoro: il Computo li riceve e li completa. */
/* L'ALBERO DEL LAVORO per la sidebar dell'hub: la catena delle revisioni fa da
   spina dorsale, e a ogni tappa si appendono i suoi atti. Le fasi che la catena
   non conosce (i verbali del DL, la chiusura prima che il conto finale esista)
   entrano lo stesso: la sidebar deve poter arrivare ovunque. */
/* Che cosa dice un ramo senza aprirlo: a quali prezzi lavora e quanto vale.
   Sono le due domande con cui si sbaglia una contabilità. */
function statiDelRamo(r: Revisione): { etichetta: string; valore: string }[] {
  const out: { etichetta: string; valore: string }[] = []
  if (r.leggeDa != null) out.push({ etichetta: 'Prezzi', valore: siglaRevisione(r.leggeDa) })
  if (r.tipo === 'contratto') out.push({ etichetta: 'Prezzi', valore: `${siglaRevisione(r.n)} (propri)` })
  // da quale computo e come: il contratto è un atto, e si dice da dove viene
  if (r.tipo === 'contratto' && S.miuCart?.contratto) out.push({ etichetta: S.partite.length ? 'Promosso da' : 'Da importare', valore: descriviContratto(S.miuCart.contratto) })
  if (r.importo != null) out.push({ etichetta: 'Importo', valore: eur(r.importo) })
  if (r.tipo === 'sal') {
    const sal = S.sals.find((x) => `sal-${x.numero}` === r.fase)
    if (sal) {
      const res = calcolaSals(S.appalto, S.partite, S.sals.filter((x) => x.numero <= sal.numero), S.economia)
      const ult = res[res.length - 1]
      if (ult) out.push({ etichetta: 'Contabilizzato', valore: eur(round2(ult.lavoriEseguiti + ult.oneriSicurezzaEseguiti)) })
    }
  }
  return out
}

/** Il comando che elimina una tappa, se è ancora eliminabile. */
function eliminabile(r: Revisione): string {
  const pz = /^perizia-(\d+)$/.exec(r.fase || '')
  if (pz && !periziaApprovata(perziaByN(Number(pz[1])) || { approvata: false } as Perizia)) return `elimina-perizia-${pz[1]}`
  const sal = /^sal-(\d+)$/.exec(r.fase || '')
  if (sal) {
    const n = Number(sal[1])
    const ultimo = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
    if (n === ultimo && !salFirmato(n)) return `elimina-sal-${n}`
  }
  return ''
}

/* Un SAL si elimina solo se è l'ultimo e non è firmato: i SAL sono una catena
   progressiva, togliere quello di mezzo lascerebbe i successivi a partire da
   quantità che non esistono più. */
function delSal(n: number): void {
  const ultimo = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
  if (n !== ultimo) { toast('Si elimina solo l\'ultimo SAL: i precedenti reggono quelli dopo'); return }
  if (salFirmato(n)) { toast('Il SAL è firmato: si riapre, non si elimina'); return }
  if (!confirm(`Eliminare il SAL n. ${n} e le sue misure?`)) return
  S.sals = S.sals.filter((x) => x.numero !== n)
  if (S.editor?.fase === `sal-${n}`) chiudiPagina()
  saveDraft(); renderAll()
  toast(`SAL n. ${n} eliminato`)
}

function alberoDelLavoro(): RamoLavoro[] {
  const catena = catenaRevisioni()
  const elenco = fasi()
  const perFase = new Map(elenco.map((f) => [f.key, f]))
  const attiDi = (key: string): FogliaAtto[] => {
    const f = perFase.get(key); if (!f) return []
    return f.docs.filter((d) => !d.soloSe || d.soloSe()).map((d) => ({ tipo: d.tipo, label: d.label, ...(d.art ? { art: d.art } : {}), ...(d.lavoro ? { lavoro: true } : {}) }))
  }
  const usate = new Set<string>()
  const a = S.appalto
  const rami: RamoLavoro[] = []
  // in cima i dati del lavoro: si compilano una volta e valgono per tutto
  rami.push({
    fase: 'avvio', etichetta: 'Dati generali', capitolo: 'lavoro', tool: 'contabilita',
    apre: 'datiappalto', atti: [],
    stati: [
      { etichetta: 'Prezzario in uso', valore: a.prezzario || 'nessuno' },
      { etichetta: 'Contratto', valore: a.prezziUnitari ? 'a prezzi unitari' : (a.modalita === 'corpo' ? 'a corpo' : 'a misura') + (ribassoDelContratto() ? ` · ribasso ${String(ribassoDelContratto()).replace('.', ',')}%` : '') },
    ],
  })
  for (const r of catena) {
    /* Le revisioni congelate dal Computo restano nella catena (danno i numeri:
       il contratto è la rev. dopo l'ultima), ma il ramo lo pubblica il Computo,
       che è chi le tiene e le apre: l'hub unisce i due alberi. */
    if (!r.fase && r.tool == null && ['pfte', 'definitivo', 'esecutivo'].includes(r.tipo)) continue
    const fase = r.fase || ''
    if (fase) usate.add(fase)
    rami.push({
      fase, etichetta: r.etichetta, dataIt: r.dataIt, stato: r.stato, rev: r.n,
      ...(r.leggeDa != null ? { leggeDa: r.leggeDa } : {}),
      capitolo: capitoloDi(r.tipo), tool: r.tool || 'contabilita',
      nota: r.voci ? `${r.voci} voci` : undefined,
      stati: statiDelRamo(r),
      /* Una tappa aperta per sbaglio si cancella da dov'è: nell'albero. Una
         firmata no — quella è un atto, e si riapre, non si butta. */
      elimina: eliminabile(r) || undefined,
      atti: attiDi(fase),
    })
  }
  /* L'ALBERO CRESCE COL LAVORO. La chiusura compare quando c'è una contabilità
     da chiudere: prima, un ramo «Ultimazione e conto finale» su un lavoro senza
     nemmeno un SAL prometteva documenti che nessuno può ancora produrre. */
  for (const f of elenco) {
    if (usate.has(f.key) || f.key === 'avvio') continue
    if (f.key === 'chiusura' && !S.sals.length) continue
    rami.push({
      fase: f.key, etichetta: f.titolo, dataIt: f.dataIt || undefined,
      capitolo: f.key === 'chiusura' ? 'chiusura' : 'contabilita', tool: 'contabilita',
      atti: attiDi(f.key),
    })
  }
  return rami
}

/* Il lavoro cresce DALL'ALBERO: è lì che si vede dove si è, quindi è lì che si
   aggiunge la tappa dopo. Niente pulsanti sparsi in altre schermate. */
function azioniDellAlbero(): AzioneAlbero[] {
  const out: AzioneAlbero[] = []
  if (!S.partite.length) {
    /* «Importa» per cominciare da zero è una contraddizione: sono due strade
       diverse e vanno dette come sono. */
    /* Il computo si importa nel Computo (che chiede la fase); qui si importa il
       CONTRATTO: quello promosso nel Computo, o un file XPWE di contratto. */
    out.push({ capitolo: 'contabilita', etichetta: '⇩ Importa il contratto…', comando: 'importa-computo', titolo: 'Il contratto promosso nel Computo, o un computo di contratto in XPWE' })
    out.push({ capitolo: 'contabilita', etichetta: '＋ Comincia da zero', comando: 'nuovo-sal', titolo: 'Apre il primo SAL senza contratto: le voci le crei misurando, dal prezzario a destra' })
    out.push({ capitolo: 'perizia', etichetta: '＋ Nuova perizia', comando: 'nuova-perizia', titolo: 'Una perizia di variante si può aprire anche prima del primo SAL' })
    return out
  }
  const n = S.sals.length
  out.push({ capitolo: 'contabilita', etichetta: n ? `＋ SAL n. ${n + 1}` : '＋ Avvia il primo SAL', comando: 'nuovo-sal' })
  out.push({ capitolo: n ? 'perizia' : 'contabilita', etichetta: '＋ Nuova perizia', comando: 'nuova-perizia', titolo: 'Una perizia di variante: stessi prezzi di contratto, più i nuovi prezzi' })
  return out
}

function pubblicaDatiLavoro(): void {
  sendToHub({ type: 'app:project-update', appId: 'contabilita', project: {
    datiGenerali: datiLavoro(),
    // la catena delle revisioni: la sidebar dell'hub la mostra come cronologia
    revisioni: catenaRevisioni(),
    // l'albero delle tappe con i loro atti: è la navigazione della sidebar
    albero: alberoDelLavoro(),
    azioniAlbero: azioniDellAlbero(),
    sals: S.sals.map((x) => ({ numero: x.numero, firmato: !!x.firmato })),
    partite: S.partite.map((p) => ({ id: p.id })),
    appalto: { perizie: S.appalto.perizie || [] },
    ts: Date.now(),
  } })
}

function completaAppalto(dg: Partial<DatiGenerali> | undefined): void {
  if (!dg) return
  const a = S.appalto
  const se = (cur: string | undefined, v: string | undefined): string | undefined => (cur && cur.trim()) ? cur : (v && v.trim()) || cur
  a.oggetto = se(a.oggetto, dg.oggetto) ?? ''
  a.cup = se(a.cup, dg.cup); a.cig = se(a.cig, dg.cig)
  a.rup = se(a.rup, dg.rup); a.direttoreLavori = se(a.direttoreLavori, dg.direttoreLavori)
  a.comune = se(a.comune, dg.comune); a.provincia = se(a.provincia, dg.provincia)
  a.progettista = se(a.progettista, dg.progettista); a.cse = se(a.cse, dg.cse)
  a.prezzario = se(a.prezzario, dg.prezzario)
  a.ente.denominazione = se(a.ente.denominazione, dg.committente) ?? ''
  a.ente.indirizzo = se(a.ente.indirizzo, dg.indirizzoCommittente)
  a.impresa.denominazione = se(a.impresa.denominazione, dg.impresa) ?? ''
  // Il Computo può aver PROMOSSO il computo a contratto: porta con sé il ribasso
  // (o la nota che i prezzi sono già quelli offerti) e la data del contratto.
  const c = (dg as { contratto?: { ribassoPct?: number | null; prezziOfferti?: boolean; data?: string } }).contratto
  if (c) {
    if (c.prezziOfferti) a.prezziUnitari = true
    else if (c.ribassoPct != null && a.ribassoPct == null) a.ribassoPct = c.ribassoPct
    if (c.data && !a.dataStipula) a.dataStipula = c.data
  }
}
/** Ribasso da applicare ai prezzi che arrivano dal Computo (una volta sola). */
function ribassoDaApplicare(dg: Partial<DatiGenerali> | undefined): number | null {
  const c = (dg as { contratto?: { ribassoPct?: number | null; prezziOfferti?: boolean } } | undefined)?.contratto
  if (!c || c.prezziOfferti) return null
  return c.ribassoPct != null && c.ribassoPct > 0 ? c.ribassoPct : null
}
/* ── IMPORTARE IN UN LAVORO GIÀ AVVIATO ───────────────────────────────────
   Non tutti i lavori cominciano dal computo di progetto. Capita di ereditare
   una contabilità già in corso — SAL emessi, atti firmati — e di doverla
   portare dentro per proseguire; capita che arrivi dopo un pezzo di computo, o
   le voci di una perizia. In quei casi importare non può voler dire
   cancellare: le voci nuove si aggiungono all'elenco prezzi, quelle che
   l'elenco ha già si riconoscono dal codice e tengono il loro prezzo di
   contratto. Chi importa vede PRIMA che cosa succederà. */
let _aggiunta: { voci: VoceImport[]; nome: string; rib?: number | null; ctx: Contesto; conMisure: boolean; escluse: Set<number>; q: string; modo: 'aggiungi' | 'pulito'; periziaIntera?: boolean } | null = null

const lavoroAvviato = (): boolean => S.partite.length > 0 || S.sals.some((x) => x.firmato || x.righe.length > 0)

/** I contenitori in cui le misure importate possono entrare: i SAL aperti e le perizie non approvate. */
function destinazioniImport(): { ctx: Contesto; label: string }[] {
  const out: { ctx: Contesto; label: string }[] = []
  for (const s of [...S.sals].sort((a, b) => a.numero - b.numero)) {
    if (s.firmato) continue
    out.push({ ctx: s.numero, label: `Libretto del SAL n. ${s.numero}${s.data ? ' del ' + s.data : ''}` })
  }
  for (const pz of S.appalto.perizie || []) {
    if (periziaApprovata(pz)) continue
    out.push({ ctx: `pz${pz.numero}`, label: `Perizia di variante n. ${pz.numero} (dal SAL ${pz.dalSal})` })
  }
  return out
}

function apriSceltaImport(voci: VoceImport[], nome: string, rib?: number | null, ctxPref?: Contesto): void {
  if (ctxPref != null) _importCtxPref = ctxPref
  const dest = destinazioniImport()
  const pref = _importCtxPref != null && dest.some((d) => String(d.ctx) === String(_importCtxPref)) ? _importCtxPref : null
  _importCtxPref = null
  _aggiunta = { voci, nome, rib, ctx: pref ?? dest[0]?.ctx ?? salDiDestinazione(S.sals), conMisure: true, escluse: new Set(), q: '', modo: 'aggiungi' }
  disegnaSceltaImport()
}
function disegnaSceltaImport(): void {
  if (!_aggiunta) return
  const { voci, nome } = _aggiunta
  const a = anteprimaAggiunta(vociScelte(), S.partite)
  const dest = destinazioniImport()
  const firmati = S.sals.filter((x) => x.firmato).length
  const opz = dest.map((d) => `<option value="${esc(String(d.ctx))}"${String(d.ctx) === String(_aggiunta!.ctx) ? ' selected' : ''}>${esc(d.label)}</option>`).join('')
  const scelte = vociScelte().length
  modal(`<div class="b-modal__h">«${esc(nome)}»: ${voci.length} voci nel file${scelte !== voci.length ? ` · ${scelte} selezionate` : ''} — il lavoro è già avviato</div>
    <div class="b-modal__scroll">
      <fieldset class="b-fieldset"><legend>Come importare</legend>
        <label class="b-opt"><input type="radio" name="imp-modo" value="aggiungi"${_aggiunta.modo === 'aggiungi' ? ' checked' : ''} onchange="setModoImport('aggiungi')"><span><b>Aggiungi a quello che c'è</b><small>le voci nuove entrano in elenco, quelle già presenti non si duplicano; gli atti firmati non si toccano. Ci sono già ${S.partite.length} articol${S.partite.length === 1 ? 'o' : 'i'}${firmati ? ` e ${firmati} SAL firmat${firmati === 1 ? 'o' : 'i'}` : ''}.</small></span></label>
        <label class="b-opt${firmati ? ' is-off' : ''}"><input type="radio" name="imp-modo" value="pulito"${_aggiunta.modo === 'pulito' ? ' checked' : ''}${firmati ? ' disabled' : ''} onchange="setModoImport('pulito')"><span><b>Cancella tutto e importa pulito</b><small>${firmati ? 'non disponibile: ci sono SAL firmati, e un atto firmato non si cancella' : 'butta via elenco prezzi, libretti e SAL di questo lavoro e riparte da questo file: importazione completa, senza residui'}</small></span></label>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Che cosa contiene il file</legend>
        <div class="b-grid">
          <div class="b-panel__body"><div class="b-sumrow"><span>Articoli nuovi per l'elenco</span><b>${a.nuove}</b></div>
            <div class="b-sumrow"><span>Già in elenco (stesso codice)</span><b>${a.gia}</b></div>
            <div class="b-sumrow"><span>Voci che portano misure</span><b>${a.conMisure}</b></div></div>
        </div>
        ${a.completabili ? `<p class="b-avviso"><b>${a.completabili} voci</b> già in elenco non hanno la quantità di contratto (il lavoro viene da un file di contabilità): questo file gliela dà. Il contratto vigente smette di essere zero e la perizia torna a confrontarsi con qualcosa.</p>` : ''}
        ${a.prezziDiversi.length ? `<p class="b-avviso">${a.prezziDiversi.length} voc${a.prezziDiversi.length === 1 ? 'e ha' : 'i hanno'} nel file un prezzo diverso da quello già in elenco: <b>resta il prezzo di contratto</b> — un file importato dopo non riscrive il contratto. ${esc(a.prezziDiversi.slice(0, 4).map((x) => `${x.codice}: ${eur(x.inElenco)} → ${eur(x.nelFile)}`).join(' · '))}${a.prezziDiversi.length > 4 ? ' …' : ''}</p>` : ''}
      </fieldset>
      ${_aggiunta.modo === 'pulito' ? `<p class="b-muted">Si importa <b>tutto il file</b>: ${_aggiunta.voci.length} voci con le loro misure, in un lavoro nuovo. Non c'è niente da scegliere, perché non resta niente con cui convivere.</p>` : `
      <fieldset class="b-fieldset"><legend>Quali voci importare</legend>
        <div class="b-grid">
          <label class="b-field"><span>Filtra l'elenco del file</span><input value="${esc(_aggiunta.q)}" placeholder="codice o descrizione" oninput="filtraImport(this.value)"></label>
          <div class="b-rowact" style="align-items:flex-end;justify-content:flex-start;gap:6px">
            <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="segnaImport(true)">Tutte</button>
            <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="segnaImport(false)">Nessuna</button>
          </div>
        </div>
        <div id="bImpLista" class="b-implista">${listaImportHTML()}</div>
      </fieldset>
      <fieldset class="b-fieldset"><legend>Dove vanno le misure</legend>
        ${periziaDiCtx(_aggiunta.ctx) ? `<label class="b-opt"><input type="checkbox" ${_aggiunta.periziaIntera !== false ? 'checked' : ''} onchange="setPeriziaIntera(this.checked)"><span><b>La perizia è tutta in questo file</b><small>è un computo di variante completo: le voci di contratto che non vi compaiono non si fanno più e vanno a zero — è da lì che nascono i <b>minori lavori</b>. Togli il segno se il file porta solo alcune voci da aggiungere.</small></span></label>` : ''}
        <p class="b-muted" style="margin:0 0 8px">${periziaDiCtx(_aggiunta.ctx)
          ? 'In una <b>perizia</b> le voci nuove sono <b>nuovi prezzi</b> di quella variante e la quantità del file è quantità di perizia: il contratto vigente non si muove finché la perizia non è approvata.'
          : 'Nel <b>libretto di un SAL</b> entrano le <b>misure eseguite</b>. Le voci che mancano si aggiungono all\'elenco prezzi <b>senza diventare contratto</b>: il contratto si pattuisce, non si misura.'}</p>
        ${dest.length
          ? `<div class="b-grid">
              <label class="b-field"><span>Contenitore</span><select onchange="setDestImport(this.value)">${opz}</select></label>
            </div>
            <label class="b-check"><input type="checkbox" ${_aggiunta.conMisure ? 'checked' : ''} onchange="setMisureImport(this.checked)"> <span>porta anche le misure del file nel contenitore scelto (altrimenti entrano solo gli articoli in elenco prezzi)</span></label>`
          : `<p class="b-avviso">Non c'è nessun libretto aperto né perizia in bozza: gli articoli entrerebbero <b>solo nell'elenco prezzi</b>.</p>`}
        <div class="b-rowact" style="justify-content:flex-start;gap:6px;margin-top:8px">
          <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="periziaPerImport()" title="Un computo di variante si versa in una perizia: la crea adesso, in bozza, dal SAL successivo all'ultimo, e la imposta come destinazione">＋ Crea una perizia di variante e usala come destinazione</button>
        </div>
      </fieldset>`}
    </div>
    <div class="b-modal__foot">
      <button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button>
      <button class="ehb-btn ehb-btn--accent-soft" onclick="confermaImport()">${_aggiunta.modo === 'pulito' ? '↺ Cancella e importa' : '⭳ Aggiungi al lavoro'}</button>
    </div>`, true)
}
/** Le voci del file, una per riga, con la spunta: si importa anche solo un pezzo. */
function listaImportHTML(): string {
  if (!_aggiunta) return ''
  const { voci, escluse, q } = _aggiunta
  const filtro = q.trim().toLowerCase()
  const gia = new Map(S.partite.map((p) => [chiaveVoce(p.codice, p.descrizione), p]))
  const righe = voci.map((v, i) => ({ v, i }))
    .filter(({ v }) => !filtro || ((v.codice || '') + ' ' + (v.desc_short || v.declaratoria || '')).toLowerCase().includes(filtro))
  if (!righe.length) return '<p class="b-muted">Nessuna voce corrisponde al filtro.</p>'
  return righe.map(({ v, i }) => {
    const presente = gia.has(chiaveVoce(v.codice, v.desc_short || v.declaratoria))
    return `<label class="b-check"><input type="checkbox" ${escluse.has(i) ? '' : 'checked'} onchange="toggleImport(${i}, this.checked)">
      <span><b>${esc(v.codice || '—')}</b> ${esc((v.desc_short || v.declaratoria || '').slice(0, 90))}${v.um ? ` · ${esc(v.um)}` : ''}${v.prezzo != null ? ` · ${eur(v.prezzo)}` : ''}${presente ? ' <span class="b-muted">· già in elenco</span>' : ''}${v.misurazioni?.length ? ` <span class="b-muted">· ${v.misurazioni.length} misure</span>` : ''}</span></label>`
  }).join('')
}
function vociScelte(): VoceImport[] {
  if (!_aggiunta) return []
  return _aggiunta.voci.filter((_, i) => !_aggiunta!.escluse.has(i))
}
function toggleImport(i: number, on: boolean): void { if (!_aggiunta) return; if (on) _aggiunta.escluse.delete(i); else _aggiunta.escluse.add(i) }
function segnaImport(tutte: boolean): void {
  if (!_aggiunta) return
  _aggiunta.escluse = tutte ? new Set() : new Set(_aggiunta.voci.map((_, i) => i))
  disegnaSceltaImport()
}
function filtraImport(q: string): void { if (!_aggiunta) return; _aggiunta.q = q; const b = $('bImpLista'); if (b) b.innerHTML = listaImportHTML() }
/* Un computo di variante arriva da fuori e non ha dove andare finché non esiste
   una perizia: la si crea qui, in bozza, senza uscire dall'import. */
function periziaPerImport(): void {
  if (!_aggiunta) return
  const n = perizie().length ? Math.max(...perizie().map((p) => p.numero)) + 1 : 1
  const ultimoSal = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
  perizie().push({ numero: n, data: isoToIt(S.dataCorrenteISO), dalSal: ultimoSal + 1, voci: [], approvata: false })
  _aggiunta.ctx = `pz${n}`
  _aggiunta.conMisure = true
  saveDraft(); disegnaSceltaImport()
  toast(`Perizia n. ${n} creata in bozza, dal SAL n. ${ultimoSal + 1}: le misure importate andranno lì`)
}
function setDestImport(v: string): void { if (!_aggiunta) return; _aggiunta.ctx = /^\d+$/.test(v) ? Number(v) : v }
function setMisureImport(on: boolean): void { if (!_aggiunta) return; _aggiunta.conMisure = on }
function setPeriziaIntera(v: boolean): void { if (_aggiunta) _aggiunta.periziaIntera = v }
function setModoImport(m: 'aggiungi' | 'pulito'): void { if (!_aggiunta) return; _aggiunta.modo = m; _tieniScroll = true; disegnaSceltaImport(); _tieniScroll = false }
/** Importa come scelto: aggiungendo, oppure azzerando prima il lavoro. */
function confermaImport(): void {
  if (!_aggiunta) return
  if (_aggiunta.modo !== 'pulito') { confermaAggiunta(); return }
  const { voci, nome, rib } = _aggiunta
  conferma('Cancello tutto e importo da capo?',
    `Elenco prezzi, libretti e SAL di questo lavoro vengono buttati via, e al loro posto entrano le ${voci.length} voci di «${nome}». Non si torna indietro.`,
    () => { _aggiunta = null; ingest(voci, `da ${nome}`, rib) })
}
function confermaAggiunta(): void {
  if (!_aggiunta) return
  const { nome, ctx, conMisure } = _aggiunta
  const voci = vociScelte()
  if (!voci.length) { toast('Nessuna voce selezionata'); return }
  const dest = destinazioniImport()
  const haDest = dest.some((d) => String(d.ctx) === String(ctx))
  const introdottaSal = typeof ctx === 'number' ? ctx : (periziaDiCtx(ctx)?.dalSal ?? salDiDestinazione(S.sals))
  /* Se si importa DENTRO UNA PERIZIA, le voci nuove non sono contratto: entrano
     come nuovi prezzi di quella perizia, e la quantità del file è quantità di
     variante. Prima finivano in contratto con la loro quantità di progetto, e
     il «contratto vigente» cresceva per una perizia ancora in bozza. */
  const pzDest = periziaDiCtx(ctx)
  // anche qui i prezzi restano quelli di elenco: il ribasso è una deduzione del SAL
  const esito = preparaAggiunta(voci, S.partite, { introdottaSal, conMisure: conMisure && haDest, nuovoId: uid, periziaN: pzDest?.numero ?? null, fuoriContratto: true })
  S.partite.push(...esito.nuove)

  /* CODICI RIPETUTI: lo stesso articolo può stare su più partite di contratto
     (misurazioni diverse della stessa voce). Le misure del file non sanno a
     quale delle gemelle appartengono e finivano tutte sulla prima trovata: una
     partita gonfiata, le altre a zero, maggiori e minori lavori inventati in
     coppie che si annullavano. Per quei codici il confronto si fa PER TARIFFA:
     la quantità totale del file si ripartisce sulle gemelle riempiendole fino
     alla loro quantità di contratto, e solo l'eccedenza (o la mancanza) diventa
     variazione. */
  const codDi = (c: string, d: string): string => chiaveVoce(c || '', (d || '').trim())
  const perCodice = new Map<string, Partita[]>()
  for (const p of S.partite) {
    const k = codDi(p.codice, p.descrizione)
    const l = perCodice.get(k); if (l) l.push(p); else perCodice.set(k, [p])
  }
  const gemelle = new Set<string>()
  for (const l of perCodice.values()) if (l.length > 1) for (const p of l) gemelle.add(p.id)

  let misurate = 0
  if (conMisure && haDest) {
    for (const m of esito.misure) {
      if (pzDest && gemelle.has(m.partitaId)) continue
      const c = contenitoreMisure(ctx, m.partitaId, true)
      if (!c) continue
      c.misurazioni = [...(c.misurazioni || []), ...m.righe]
      allineaMisure(ctx, c)
      misurate++
    }
    /* UN COMPUTO DI VARIANTE È IL NUOVO CONTRATTO, non un elenco di aggiunte.
       Ogni voce del file porta la QUANTITÀ DI PERIZIA della sua partita: quelle
       già in elenco comprese, e anche quando il file non porta il dettaglio
       delle misure ma solo la quantità. Senza questo si vedevano solo i maggiori
       lavori delle voci nuove, e i «minori» restavano a zero. */
    if (pzDest) {
      const conMis = new Set(esito.misure.filter((m) => !gemelle.has(m.partitaId)).map((m) => m.partitaId))
      const qFile = new Map<string, number>()
      for (const v of voci) {
        if (v.qty == null) continue
        const k = codDi(v.codice || '', v.desc_short || v.declaratoria || '')
        qFile.set(k, (qFile.get(k) || 0) + v.qty)
      }
      const toccate = new Set<string>()
      for (const [k, q] of qFile) {
        const l = perCodice.get(k); if (!l?.length) continue
        for (const p of l) toccate.add(p.id)
        if (l.some((p) => conMis.has(p.id))) continue
        const quote = ripartisciPerTariffa(l.map((p) => p.qtyProgetto), q)
        l.forEach((p, i) => {
          const c = contenitoreMisure(ctx, p.id, true)
          if (c && !c.misurazioni?.length) c.qty = quote[i]
        })
      }
      /* Se il file è TUTTA la variante, le voci di contratto che non vi
         compaiono non si fanno più: vanno a zero, ed è da lì che nascono i
         minori lavori. */
      if (_aggiunta?.periziaIntera !== false) {
        for (const p of partiteVigenti(S.partite, perizie().filter((z) => z.numero < pzDest.numero && periziaApprovata(z)), pzDest.dalSal)) {
          if (toccate.has(p.id) || p.modalita === 'corpo' || p.qtyProgetto == null) continue
          const c = contenitoreMisure(ctx, p.id, true)
          if (c && !c.misurazioni?.length && c.qty == null) c.qty = 0
        }
      }
    }
  }
  _aggiunta = null
  saveDraft(); closeModal(); renderAll()
  toast(`«${nome}»: ${esito.nuove.length} articol${esito.nuove.length === 1 ? 'o aggiunto' : 'i aggiunti'} all'elenco${esito.gia ? `, ${esito.gia} già present${esito.gia === 1 ? 'e' : 'i'}` : ''}${esito.completate ? ` · quantità di contratto completata su ${esito.completate} voc${esito.completate === 1 ? 'e' : 'i'}` : ''}${misurate ? ` · misure portate in ${misurate} voc${misurate === 1 ? 'e' : 'i'}` : ''}`)
}

function importMiu(): void {
  /* Se nel Computo c'è l'ATTO di contratto, si importa quello: il computo scelto,
     fotografato con il suo ribasso o i suoi prezzi offerti. Il computo di adesso
     può essere andato avanti — non è lui il contratto (shared/contratto.ts). */
  const atto = S.miuCart?.contratto
  if (atto && atto.voci?.length) {
    completaAppalto(S.miuCart!.datiGenerali)
    const rib = atto.prezziOfferti ? null : (atto.ribassoPct ?? null)
    if (atto.data && !S.appalto.dataStipula) S.appalto.dataStipula = atto.data
    if (atto.prezziOfferti) S.appalto.prezziUnitari = true
    const voci = atto.voci as VoceImport[]
    if (lavoroAvviato()) { apriSceltaImport(voci, `contratto (${descriviContratto(atto)})`, rib); return }
    ingest(voci, `dal contratto: ${descriviContratto(atto)}`, rib)
    toast(`Contratto importato: ${descriviContratto(atto)}`)
    return
  }
  if (!S.miuCart || !S.miuCart.items?.length) { toast('Nessun computo disponibile nello strumento Computo'); return }
  completaAppalto(S.miuCart.datiGenerali)
  const rib = ribassoDaApplicare(S.miuCart.datiGenerali)
  if (lavoroAvviato()) { apriSceltaImport(S.miuCart.items, 'computo dello strumento Computo', rib); return }
  ingest(S.miuCart.items, 'dallo strumento Computo', rib)
  if (rib) toast(`Computo promosso a contratto. I prezzi restano quelli di progetto: il ribasso del ${pctFmt(rib)} si deduce sul totale dei lavori di ogni SAL (la sicurezza non lo subisce)`)
}
function svuotaComputo(): void { S.partite = []; S.sals = []; saveDraft(); closeModal(); renderAll() }

/* ── Tempo ──────────────────────────────────────────────────────────────── */
/* La data corrente è il «quando» di tutto il programma: muovendola si muovono
   la cronologia e le scadenze di legge, che si leggono a quella data. */
function avanzaGiorni(n: number): void { S.dataCorrenteISO = addDaysISO(S.dataCorrenteISO, n); renderOra() }
function renderOra(): void { renderLeft(); renderTimeline(); renderScadenze() }
/** Data corrente digitata a mano (gg/mm/aaaa). Ignora input incompleti/invalidi. */
function setDataCorrenteIt(v: string): void { const iso = itToISO(v); if (!iso) { renderLeft(); return } S.dataCorrenteISO = iso; renderOra() }
/** Data corrente scelta dal calendario (input date nativo, formato ISO). */
function setDataCorrenteIso(v: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return; S.dataCorrenteISO = v; renderOra() }
function nuovoSalOggi(): void {
  // senza computo si può comunque aprire un SAL: le voci si creano nel libretto
  // (libere o dall'elenco prezzi), come in un computo che nasce da zero
  if (!S.partite.length && !S.appalto.oggetto && !S.appalto.ente.denominazione) toast('Contabilità da zero: le voci le crei nel libretto')
  const n = S.sals.length ? Math.max(...S.sals.map((s) => s.numero)) + 1 : 1
  // Due avanzamenti aperti insieme sono un equivoco: il nuovo parte dalle quantità
  // progressive del precedente, e se quello cambia ancora il nuovo parte da un
  // numero che non c'è più. Non si vieta — il cantiere va avanti anche mentre un
  // SAL aspetta una firma — ma si dice.
  const prec = salById(n - 1)
  if (prec && !prec.firmato && !confirm(`Il SAL n. ${n - 1} non è ancora firmato: i suoi importi possono cambiare, e il SAL n. ${n} parte proprio da quelle quantità.\n\nAprire lo stesso il SAL n. ${n}?`)) return
  // I SAL successivi al primo si EDITANO: partono dalle quote del SAL precedente (progressive), da aggiornare.
  const prev = S.sals.find((s) => s.numero === n - 1)
  // copia PROFONDA: le misure del SAL precedente sono un atto già prodotto, scriverci
  // sopra nel SAL nuovo non deve toccarle (altrimenti un libretto firmato cambierebbe)
  const righe: RigaSal[] = prev ? prev.righe.map((r) => ({ ...r, ...(r.misurazioni ? { misurazioni: r.misurazioni.map((m) => ({ ...m })) } : {}) })) : []
  S.sals.push({ numero: n, data: isoToIt(S.dataCorrenteISO), righe })
  // una perizia che entra in vigore con questo SAL: le quote a corpo riportate dal SAL
  // precedente si allineano ai nuovi importi (stesso maturato)
  for (const pz of perizie().filter((p) => p.dalSal === n)) allineaCorpiPerizia(pz.numero)
  saveDraft()
  /* Un SAL appena aperto si apre DOVE SI MISURA. Prima restituiva un libretto
     vuoto — l'anteprima di un atto che non ha ancora niente da dire — e
     invitava ad aprirlo «dalla timeline», che non esiste più. */
  openEditor(`sal-${n}`, 'misure')
  toast(`SAL n. ${n} al ${isoToIt(S.dataCorrenteISO)}: inserisci le misure.`)
}



/* ── CONTABILITÀ SEMPLIFICATA ──────────────────────────────────────────────
   Si può attivare solo dove la norma la consente: lavori sotto i 40.000 euro.
   Quando non è ammessa, l'interruttore resta spento e il programma dice
   perché, invece di lasciarla scegliere e produrre atti che non reggono. */
function semplificataHTML(): string {
  const am = ammissibilitaSemplificata(S.appalto, S.partite)
  const on = !!S.appalto.contabilitaSemplificata
  return `<div id="bSemplBox">
    <label class="b-check"><input type="checkbox" ${on ? 'checked' : ''} ${am.ammessa ? '' : 'disabled'} onchange="setSemplificata(this.checked)">
      <span><b>Contabilità semplificata</b> (art. 12 c. 11-bis All. II.14): per i lavori sotto ${eur(SOGLIA_SEMPLIFICATA)} il certificato di regolare esecuzione può essere sostituito dal <b>visto del DL sulle fatture</b>, previa verifica della corrispondenza fra lavoro svolto e fatturato.</span></label>
    ${am.ammessa
      ? (on ? `<p class="b-avviso b-avviso--ok">Attiva: importo contrattuale ${eur(am.importo)}. Dalla cronologia aggiungi le <b>fatture</b> e apponi il visto; gli atti lo dichiarano.</p>` : '')
      : `<p class="b-muted" style="font-size:var(--fs-xs)">${esc(am.motivo)}</p>`}
  </div>`
}
function setSemplificata(on: boolean): void {
  const am = ammissibilitaSemplificata(S.appalto, S.partite)
  if (on && !am.ammessa) { toast(am.motivo); return }
  S.appalto.contabilitaSemplificata = on || undefined
  saveDraft(); renderAll()
  const b = $('bSemplBox'); if (b) b.outerHTML = semplificataHTML()
}

/* ── Tipologia, revisione prezzi, accordo quadro ─────────────────────────────── */
function setTipologia(v: string): void { S.appalto.tipologia = v === 'servizi' || v === 'forniture' ? v : 'lavori'; saveDraft(); openDati() }
function setRevisione(campo: 'attiva' | 'indiceBase' | 'descrizioneIndice' | 'sogliaPct' | 'quotaPct', v: string): void {
  const rv = S.appalto.revisione = S.appalto.revisione || { attiva: false, indiceBase: null }
  if (campo === 'attiva') { rv.attiva = v === 'si'; saveDraft(); openDati(); return }
  if (campo === 'descrizioneIndice') rv.descrizioneIndice = v
  else (rv as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v.replace(',', '.'))
  saveDraft(); refreshRiep()
}
function setAccordoQuadro(si: boolean): void {
  S.appalto.accordoQuadro = si ? (S.appalto.accordoQuadro || { importoMassimo: null, applicativi: [] }) : undefined
  saveDraft(); openDati()
}
function setAqMassimo(v: string): void { if (S.appalto.accordoQuadro) { S.appalto.accordoQuadro.importoMassimo = v === '' ? null : Number(v); saveDraft(); const b = $('bAqBox'); if (b) b.outerHTML = accordoQuadroHTML() } }
function accordoQuadroHTML(): string {
  const st = statoAccordoQuadro(S.appalto); const aq = S.appalto.accordoQuadro
  if (!st || !aq) return ''
  const righe = aq.applicativi.map((c, i) => `<tr><td class="b-mono">n. ${c.numero}</td>
    <td><input value="${esc(c.data || '')}" placeholder="gg/mm/aaaa" oninput="setApplicativo(${i},'data',this.value)" style="width:100px"></td>
    <td><input value="${esc(c.oggetto || '')}" oninput="setApplicativo(${i},'oggetto',this.value)"></td>
    <td><input type="number" step="0.01" value="${c.importo || ''}" onchange="setApplicativo(${i},'importo',this.value)" style="width:120px"></td>
    <td><button class="ehb-icon-btn" onclick="delApplicativo(${i})" title="Togli">✕</button></td></tr>`).join('')
  return `<div id="bAqBox"><div class="b-sumrow"><span>Contratti applicativi</span><b>${eur(st.impegnato)} su ${eur(st.importoMassimo)}${st.utilizzoPct != null ? ` (${pctFmt(st.utilizzoPct)} %)` : ''}</b></div>
    <div class="b-sumrow"><span>Residuo dell'accordo quadro</span><b${st.superato ? ' style="color:var(--danger)"' : ''}>${eur(st.residuo)}${st.superato ? ' — importo massimo superato' : ''}</b></div>
    <div class="b-tablewrap"><table class="b-etable"><thead><tr><th>Contratto</th><th>Data</th><th>Oggetto</th><th>Importo</th><th></th></tr></thead><tbody>${righe}</tbody></table></div>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="addApplicativo()">＋ contratto applicativo</button></div>`
}
function addApplicativo(): void {
  const aq = S.appalto.accordoQuadro; if (!aq) return
  const n = aq.applicativi.length ? Math.max(...aq.applicativi.map((c) => c.numero)) + 1 : 1
  aq.applicativi.push({ numero: n, data: isoToIt(S.dataCorrenteISO), importo: 0 }); saveDraft(); const b = $('bAqBox'); if (b) b.outerHTML = accordoQuadroHTML()
}
function setApplicativo(i: number, campo: 'data' | 'oggetto' | 'importo', v: string): void {
  const c = S.appalto.accordoQuadro?.applicativi[i]; if (!c) return
  if (campo === 'importo') { c.importo = Number(v) || 0; saveDraft(); const b = $('bAqBox'); if (b) b.outerHTML = accordoQuadroHTML(); return }
  c[campo] = v; saveDraft()
}
function delApplicativo(i: number): void { const aq = S.appalto.accordoQuadro; if (!aq) return; aq.applicativi.splice(i, 1); saveDraft(); const b = $('bAqBox'); if (b) b.outerHTML = accordoQuadroHTML() }
function setSalIndice(n: number, v: string): void { if (salBloccato(n)) return; const sal = salById(n); if (!sal) return; sal.indiceRevisione = v === '' ? null : Number(v.replace(',', '.')); saveDraft(); refreshCascata(n) }

/* ── Perizie di variante (art. 120): nuove quantità / importi dal SAL indicato in poi,
   quadro comparativo, allineamento delle quote delle voci a corpo. ─────────────── */
function perizie(): Perizia[] { return (S.appalto.perizie = S.appalto.perizie || []) }
function perziaByN(n: number): Perizia | undefined { return perizie().find((p) => p.numero === n) }
function openPerizie(): void {
  if (!S.partite.length) { toast('Importa prima il computo'); return }
  const lista = perizie().slice().sort((a, b) => a.numero - b.numero).map((pz) => {
    const q = quadroComparativo(S.partite, S.appalto.perizie, pz)
    const ok = periziaApprovata(pz)
    return `<tr><td class="b-mono">n. ${pz.numero}</td><td>${esc(pz.data || '')}</td><td>${esc(pz.oggetto || '—')}</td><td>dal SAL ${pz.dalSal}</td>
      <td><span class="b-np is-${ok ? 'approvato' : 'bozza'}">${ok ? 'approvata' : 'in bozza'}</span></td>
      <td class="b-num">${q.differenza >= 0 ? '+' : '−'} ${eur(Math.abs(q.differenza))}</td>
      <td style="white-space:nowrap"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="editPerizia(${pz.numero})">Apri</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="stampaAttiPerizia(${pz.numero})" title="Il fascicolo della perizia: atto, quadro comparativo, nuovi prezzi, atto di sottomissione">⎙ Atti</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delPerizia(${pz.numero})" title="Elimina la perizia">✕</button></td></tr>`
  }).join('')
  modal(`<div class="b-modal__h">Perizie di variante</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">Una perizia cambia le quantità (voci a misura) e gli importi (voci a corpo) del contratto dal SAL indicato in poi; i SAL precedenti restano sul contratto di allora. I nuovi prezzi si aggiungono dalle Misurazioni del SAL e compaiono qui.</p>
      <div class="b-tablewrap"><table class="b-etable"><thead><tr><th>Perizia</th><th>Data</th><th>Oggetto</th><th>Vigenza</th><th>Stato</th><th class="b-num">Variazione</th><th></th></tr></thead>
      <tbody>${lista || '<tr><td colspan="7" class="b-muted">Nessuna perizia.</td></tr>'}</tbody></table></div>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="pickPeriziaXpwe()" title="Importa il computo di variante (XPWE): Quadra lo confronta col contratto e crea la perizia">⇩ Da XPWE…</button><button class="ehb-btn ehb-btn--accent-soft" onclick="nuovaPerizia()">＋ Nuova perizia</button><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Chiudi</button></div>`, true)
}
/** Perizia da un computo di variante XPWE: confronto voce per voce col contratto. */
function pickPeriziaXpwe(dentro?: number): void {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xpwe'
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return
    let voci: VoceImport[]
    try { voci = xpweToVoci(parseXpwe(await file.text())) as VoceImport[] } catch (err) { toast('File XPWE non leggibile: ' + ((err as Error)?.message || err)); return }
    if (!voci.length) { toast('Il file non contiene voci'); return }
    // Dentro una perizia già aperta il confronto si fa col contratto vigente e il
    // risultato SOSTITUISCE le voci di quella perizia: è il modo di allineare un
    // lavoro già avviato con un altro programma, senza perdere numero e data.
    const esistente = dentro != null ? perziaByN(dentro) : undefined
    if (esistente && periziaApprovata(esistente)) { toast('La perizia è approvata: non si importa più nulla'); return }
    const n = esistente?.numero ?? (perizie().length ? Math.max(...perizie().map((p) => p.numero)) + 1 : 1)
    const ultimoSal = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
    const dalSal = esistente?.dalSal ?? ultimoSal + 1
    const e = periziaDaVoci(S.partite, voci, n, dalSal)
    S.partite.push(...e.nuove)
    if (esistente) {
      esistente.voci = e.perizia.voci
      if (!esistente.oggetto) esistente.oggetto = `Da ${file.name}`
    } else {
      e.perizia.data = isoToIt(S.dataCorrenteISO); e.perizia.oggetto = `Da ${file.name}`
      perizie().push(e.perizia)
    }
    saveDraft(); renderAll(); editPerizia(n)
    toast(`Perizia n. ${n}: ${e.modificate} voci modificate, ${e.soppresse} soppresse, ${e.nuove.length} nuovi prezzi, ${e.invariate} invariate`)
  }
  inp.click()
}
function nuovaPerizia(): void {
  const n = perizie().length ? Math.max(...perizie().map((p) => p.numero)) + 1 : 1
  const ultimoSal = S.sals.length ? Math.max(...S.sals.map((x) => x.numero)) : 0
  perizie().push({ numero: n, data: isoToIt(S.dataCorrenteISO), dalSal: ultimoSal + 1, voci: [], approvata: false })
  // i nuovi prezzi già concordati ma ancora «in formazione» appartengono a questa perizia
  for (const p of S.partite) if (p.np && p.np.periziaN == null) p.np.periziaN = n
  saveDraft(); editPerizia(n)
}
function delPerizia(n: number): void {
  const pz = perziaByN(n); if (!pz) return
  if (S.sals.some((x) => x.firmato && x.numero >= pz.dalSal)) { toast('La perizia è già applicata in SAL firmati: non si elimina'); return }
  if (!confirm(`Eliminare la perizia n. ${n}?`)) return
  for (const p of S.partite) if (p.np?.periziaN === n) p.np.periziaN = null
  S.appalto.perizie = perizie().filter((p) => p.numero !== n)
  if (S.editor?.fase === `perizia-${n}`) chiudiPagina()
  saveDraft(); renderAll(); openPerizie()
}
/** Il quadro comparativo si apre come ogni altro atto: scheda del documento,
 *  anteprima, stampa. Nessuna scorciatoia diversa dalle altre. */
function docPerizia(n: number): void { openEditor(`perizia-${n}`, 'comparativo') }
function setPerizia(n: number, campo: 'data' | 'oggetto' | 'motivazione' | 'dalSal', v: string): void {
  const pz = perziaByN(n); if (!pz) return
  if (campo === 'dalSal') { const k = Math.max(1, Math.floor(Number(v) || 1)); pz.dalSal = k } else pz[campo] = v
  saveDraft(); refreshPeriziaTot(n)
}
function setVocePerizia(n: number, pid: string, v: string): void {
  const pz = perziaByN(n); if (!pz || periziaBloccata(pz)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const corpo = p.modalita === 'corpo'
  const val = leggiNum(v)
  const i = pz.voci.findIndex((x) => x.partitaId === pid)
  if (val == null) {
    // campo svuotato: la voce torna invariata (le misure, se c'erano, si eliminano da sé)
    if (i >= 0) pz.voci.splice(i, 1)
  } else if (i >= 0) {
    if (corpo) pz.voci[i].importo = val; else pz.voci[i].qty = val
  } else {
    pz.voci.push(corpo ? { partitaId: pid, importo: val } : { partitaId: pid, qty: val })
  }
  saveDraft(); refreshPeriziaTot(n)
}
function refreshPeriziaTot(n: number): void {
  const pz = perziaByN(n); const box = $('bPzTot'); if (!pz || !box) return
  const q = quadroComparativo(S.partite, S.appalto.perizie, pz)
  for (const r of q.righe) { const c = $(`bpz-d-${r.partita.id}`); if (c) c.textContent = r.differenza ? (r.differenza > 0 ? '+ ' : '− ') + eur(Math.abs(r.differenza)) : '—' }
  const variate = q.righe.filter((r) => Math.abs(r.differenza) >= 0.005).length
  box.innerHTML = piedeFaseHtml(FASE_PERIZIA, {
    variate, voci: q.righe.length, aumenti: q.aumenti, diminuzioni: q.diminuzioni,
    prima: q.totalePrima, dopo: q.totaleDopo, differenza: q.differenza,
    variazione: q.variazioneSuContrattoPct == null ? null : pctFmt(q.variazioneSuContrattoPct),
    oltreQuinto: q.oltreQuinto,
  }, eur)
}
/** La perizia si apre come tappa a tutta pagina (come il libretto): ci si lavora. */
function editPerizia(n: number): void {
  if (!perziaByN(n)) return
  closeModal(); renderAll()
  openEditor(`perizia-${n}`, 'perizia')
}
/* Stato della perizia: in bozza si lavora, approvata vale come contratto (e i
   suoi nuovi prezzi smettono di essere provvisori, art. 5 c. 7). */
function statoPeriziaHTML(pz: Perizia): string {
  const n = pz.numero
  const np = S.partite.filter((x) => x.np?.periziaN === n).length
  if (periziaApprovata(pz)) return `<div class="b-lock"><b>🔒 Perizia n. ${n} approvata${pz.dataApprovazione ? ' il ' + esc(pz.dataApprovazione) : ''}</b> — le nuove quantità valgono come contratto dal SAL n. ${pz.dalSal}${np ? ` · ${np} nuov${np === 1 ? 'o prezzo' : 'i prezzi'} approvat${np === 1 ? 'o' : 'i'}` : ''}.
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="riapriPerizia(${n})" title="Riporta la perizia in bozza per correggerla">Riporta in bozza…</button></div>`
  return `<div class="b-lock b-lock--open"><b>Perizia n. ${n} in bozza</b> — i suoi importi non sono ancora contratto e i suoi nuovi prezzi si contabilizzano in conto provvisorio${np ? ` (${np} in attesa)` : ''}.
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="approvaPerizia(${n})" title="Approvazione della stazione appaltante: dal SAL n. ${pz.dalSal} valgono le nuove quantità e i nuovi prezzi diventano definitivi">✓ Approva la perizia</button></div>`
}
function approvaPerizia(n: number): void {
  const pz = perziaByN(n); if (!pz) return
  const q = quadroComparativo(S.partite, S.appalto.perizie, pz)
  if (q.oltreQuinto && !confirm(`La variazione supera il quinto d'obbligo (${q.variazioneSuContrattoPct == null ? '—' : pctFmt(q.variazioneSuContrattoPct)}). Approvare comunque?`)) return
  pz.approvata = true
  pz.dataApprovazione = isoToIt(S.dataCorrenteISO)
  let k = 0
  for (const p of S.partite) if (p.np?.periziaN === n && p.np.stato !== 'approvato') { p.np.stato = 'approvato'; k++ }
  saveDraft(); renderAll(); reopenEditor()
  toast(`Perizia n. ${n} approvata${k ? ` · ${k} nuov${k === 1 ? 'o prezzo' : 'i prezzi'} definitiv${k === 1 ? 'o' : 'i'}` : ''}`)
}
function riapriPerizia(n: number): void {
  const pz = perziaByN(n); if (!pz) return
  if (S.sals.some((x) => x.firmato && x.numero >= pz.dalSal)) { toast(`La perizia è già applicata in SAL firmati (dal n. ${pz.dalSal}): sblocca prima quei SAL`); return }
  pz.approvata = false
  pz.dataApprovazione = ''
  for (const p of S.partite) if (p.np?.periziaN === n && p.np.stato === 'approvato') p.np.stato = 'concordato'
  saveDraft(); renderAll(); reopenEditor()
  toast(`Perizia n. ${n} riportata in bozza`)
}
/** Corpo della tappa «perizia»: dati, voci variate, quadro di sintesi. */
function editorPerizia(f: Fase): string {
  const n = Number(/^perizia-(\d+)$/.exec(f.key)?.[1] || 0)
  const pz = perziaByN(n); if (!pz) return '<p class="b-muted">Perizia non trovata.</p>'
  const ctx = `pz${n}`
  const bloccata = periziaApprovata(pz)
  const prima = partiteVigenti(S.partite, perizie().filter((p) => p.numero < n), Number.MAX_SAFE_INTEGER)
  const mod = new Map(pz.voci.map((v) => [v.partitaId, v]))
  const tuttePz = prima.filter((p) => (p.introdottaSal ?? 1) <= pz.dalSal)
  const qPz = _libQ.trim().toLowerCase()
  const cercatePz = filtraVoci(tuttePz, qPz, testoVoce)
  /* Una perizia si legge da quello che CAMBIA: le voci variate e i nuovi
     prezzi. Il contratto intero resta a un clic, per andare a toccare una voce
     che non è ancora stata variata. */
  const variataQui = (p: Partita): boolean => {
    if (p.qtyProgetto == null) return true // nuovo prezzo: è tutta variante
    const v = mod.get(p.id); if (!v) return false
    if ((v.misurazioni || []).length > 0) return true
    return v.qty != null && Math.abs(v.qty - p.qtyProgetto) > 1e-6
  }
  const visibiliPz = ordinaVoci(_pzSolo === 'variate' && !qPz ? cercatePz.filter(variataQui) : cercatePz)
  const rigaPz = (p: Partita): RigaVoce => {
    const m = mod.get(p.id)
    const corpo = p.modalita === 'corpo'
    const ignota = !corpo && p.qtyProgetto == null
    const attuale: Cella = corpo
      ? { tipo: 'numero', testo: eur(importoContrattualePartita(p)) }
      : ignota
        ? { tipo: 'numero', testo: '—', muto: true, titolo: 'Quantità di contratto non nota: questa voce viene da un file di contabilità, che non porta le quantità di progetto' }
        : { tipo: 'numero', testo: `${numFmt(p.qtyProgetto ?? 0)} ${p.um || ''}`.trim() }
    // La nuova quantità si MISURA come nel libretto e nel computo: stessa tabella,
    // stesse formule, stessi tasti. A corpo resta l'importo, che non si misura.
    const mis = m?.misurazioni || []
    const expanded = libExpanded.has(p.id)
    let nuova: Cella
    let toggle = ''
    if (corpo) {
      nuova = { tipo: 'campo', valore: numIn(m?.importo), prefisso: '€', segnaposto: 'nuovo importo', quando: 'input', comando: `setVocePerizia(${n},'${p.id}',this.value)`, titolo: 'Nuovo importo del corpo d\'opera' }
    } else if (mis.length) {
      nuova = { tipo: 'misurata', valore: numFmt(sommaMisurazioni(mis)), um: p.um || '', misure: mis.length, idValore: `bpzq-${p.id}` }
      toggle = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="toggleMisure('${p.id}')" title="${expanded ? 'Comprimi' : 'Apri'} le misure di perizia">${expanded ? '▾' : '▸'} misure</button>`
    } else {
      nuova = { tipo: 'campo', valore: numIn(m?.qty), segnaposto: 'nuova q.tà', um: p.um || '', quando: 'input', comando: `setVocePerizia(${n},'${p.id}',this.value)`, titolo: 'Nuova quantità contrattuale (virgola decimale, anche formule)',
        dopo: bloccata ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="dettagliaMisure('${ctx}','${p.id}')" title="Passa alle misure di dettaglio L×L×H×n, come nel libretto">▸ dettaglia</button>` }
    }
    return {
      classe: libSel.has(p.id) ? 'is-sel' : '',
      attributi: `oncontextmenu="rigaMenu(event,'${p.id}',${esc(JSON.stringify(ctx))})" onclick="rigaClick(event,'${p.id}')"`,
      sel: `<input type="checkbox" class="b-selbox" data-pid="${p.id}" ${libSel.has(p.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="libSelToggle('${p.id}',this.checked,event.shiftKey)" title="Seleziona la voce (Maiusc per un intervallo)">${toggle}`,
      celle: {
        codice: { tipo: 'codice', codice: p.codice, tono: p.np ? 'np' : undefined },
        designazione: { tipo: 'designazione', testo: p.descrizione, nota: corpo ? 'a corpo' : 'a misura' },
        confronto: attuale,
        quantita: nuova,
        differenza: { tipo: 'numero', testo: '', id: `bpz-d-${p.id}` },
      },
      dopo: !corpo && mis.length && expanded && _libVista === 'tabella'
        ? misureDettaglioHTML(ctx, p, { titolo: 'Misure di perizia (par.ug. × L1 × L2 × H)', totale: 'Nuova quantità di contratto' })
        : '',
    }
  }
  const righe: RigaGriglia[] = (_libVista === 'capitoli' || _libOrdine === 'categorie')
    ? [...raggruppa(visibiliPz)].flatMap(([titolo, gruppo]): RigaGriglia[] => [
        { tipo: 'gruppo', titolo, nota: `· ${gruppo.length} voc${gruppo.length === 1 ? 'e' : 'i'}` },
        ...gruppo.map(rigaPz),
      ])
    : visibiliPz.map(rigaPz)
  const vuotoPz = qPz ? 'Nessuna voce corrisponde alla ricerca.' : _pzSolo === 'variate' && tuttePz.length ? 'Questa perizia non ha ancora variato nessuna voce: importa il computo di variante (⇩ Importa XPWE) oppure passa a «Tutto il contratto» e cambia le quantità.' : 'Nessuna voce in contratto a questo avanzamento.'
  const nuoviDellaPerizia = S.partite.filter((p) => p.np?.periziaN === n)
  const listaNP = nuoviDellaPerizia.length
    ? `<div class="b-tablewrap" style="margin-top:12px"><table class="b-etable"><thead><tr><th>Nuovo prezzo</th><th>Designazione</th><th>Derivazione</th><th class="b-num">Prezzo</th><th>Iter</th></tr></thead><tbody>${nuoviDellaPerizia.map((p) => `<tr><td class="b-mono">${esc(p.codice)}</td>
        <td><span class="b-desc-clamp" title="${esc(p.descrizione)}">${esc(p.descrizione)}</span></td>
        <td>${esc(derivazioneNP(p))}</td>
        <td class="b-num">${eur(p.prezzoUnitario || 0)}</td>
        <td><span class="b-np is-${esc(p.np!.stato)}">${esc(STATO_NP[p.np!.stato])}</span></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="b-muted" style="margin:12px 0 0">Nessun nuovo prezzo su questa perizia: si aggiungono dalle Misurazioni del SAL («＋ Nuovo prezzo» nel pannello dei prezzi, o «≈ Nuovo prezzo» da una voce di contratto) e compaiono qui.</p>'
  const salK = salById(pz.dalSal)
  const allinea = !!salK && pz.voci.some((v) => v.importo != null)
  const apribiliPz = prima.filter((p) => (mod.get(p.id)?.misurazioni || []).length > 0)
  const tuttePzAperte = apribiliPz.length > 0 && apribiliPz.every((p) => libExpanded.has(p.id))
  const senzaContratto = prima.filter((p) => p.modalita === 'misura' && (p.introdottaSal ?? 1) <= pz.dalSal && p.qtyProgetto == null).length
  const avvisoContratto = senzaContratto
    ? `<p class="b-avviso">Su <b>${senzaContratto} voci</b> manca la quantità di contratto: il lavoro è stato importato da un file di <b>contabilità</b>, che non porta le quantità di progetto. Finché mancano, il «contratto vigente» resta vuoto e la perizia risulta tutta in aumento. Rimedi: importa il <b>computo di progetto</b> (⇩ Importa XPWE), oppure, dal pannello di import, «Usa come computo» il file di contabilità.</p>`
    : ''
  const corpo = `<div class="b-lib">${avvisoContratto}${barraVoci({
      cerca: { valore: _libQ, onInput: 'libFiltra(this.value)', placeholder: FASE_PERIZIA.cerca },
      viste: { valore: _libVista, opzioni: OPZ_VISTA, onclickTpl: "setLibVista('%v')" },
      ordine: { valore: _libOrdine, opzioni: OPZ_ORDINE, onclickTpl: "setLibOrdine('%v')" },
      mostra: { valore: qPz ? 'tutte' : _pzSolo, opzioni: FASE_PERIZIA.mostra!, onclickTpl: "setPzSolo('%v')" },
      espandi: apribiliPz.length && _libVista === 'tabella' ? { tutteAperte: tuttePzAperte, onclick: `libEspandi(${tuttePzAperte ? 'false' : 'true'})` } : undefined,
      aggiungi: azioniVoce(ctx, bloccata),
      dati: azioniDati(ctx, bloccata),
      strumenti: azioniStrumenti(),
      campi: '',
      extra: [
        ...(allinea ? [{ etichetta: `⇄ Allinea le quote a corpo del SAL n. ${pz.dalSal}`, titolo: `Ricalcola le quote % delle voci a corpo del SAL n. ${pz.dalSal} sui nuovi importi, lasciando invariato l'importo già maturato`, onclick: `allineaCorpiPerizia(${n})`, stile: 'ghost' as const }] : []),
        { etichetta: '⇄ Quadro comparativo', titolo: 'Il confronto fra contratto e perizia, voce per voce', onclick: `docPerizia(${n})`, stile: 'ghost' },
      ],
      aiuto: { onclick: 'libAiuto()', titolo: 'Come si misura in perizia' },
    })}${barraSelezioneHTML(ctx)}
    <div class="b-grid">
      ${fld('Data (gg/mm/aaaa)', pz.data, `setPerizia(${n},'data',this.value)`)}
      ${fld('In vigore dal SAL n.', pz.dalSal, `setPerizia(${n},'dalSal',this.value)`, 'number')}
      ${fld('Oggetto', pz.oggetto, `setPerizia(${n},'oggetto',this.value)`)}
    </div>
    <label class="b-field"><span>Motivazione (art. 120 c. 1)</span><textarea rows="2" oninput="setPerizia(${n},'motivazione',this.value)">${esc(pz.motivazione || '')}</textarea></label>
    <p class="b-muted" style="margin:8px 0">Scrivi solo i valori che cambiano: vuoto = invariato. Per le voci a misura la nuova quantità — a mano, oppure «▸ dettaglia» per misurarla come nel libretto (e con «↧ Misure di progetto» si parte da quelle del computo); per le voci a corpo il nuovo importo.</p>
    <div class="b-tablewrap">${grigliaHtml({ fase: FASE_PERIZIA, selezione: { tutte: 'libSelTutte(this.checked)' }, righe, vuoto: vuotoPz })}</div>
    <h4 class="b-panel__h" style="margin:16px 0 6px">Nuovi prezzi della perizia</h4>${listaNP}
    <div id="bPzTot"></div></div>`
  queueMicrotask(() => refreshPeriziaTot(n))
  return statoPeriziaHTML(pz) + (periziaApprovata(pz) ? `<fieldset class="b-locked" disabled>${corpo}</fieldset>` : corpo)
}
/** Allineamento: quote % dei corpi del SAL `dalSal` ricalcolate sul nuovo importo (stesso maturato). */
function allineaCorpiPerizia(n: number): void {
  const pz = perziaByN(n); if (!pz) return
  if (salBloccato(pz.dalSal)) return
  const sal = salById(pz.dalSal); if (!sal) return
  const prima = partiteVigenti(S.partite, perizie().filter((p) => p.numero < n), Number.MAX_SAFE_INTEGER)
  let k = 0
  for (const v of pz.voci) {
    if (v.importo == null) continue
    const p = prima.find((x) => x.id === v.partitaId); if (!p || p.modalita !== 'corpo') continue
    const r = sal.righe.find((x) => x.partitaId === p.id); if (!r || r.quotaPct == null) continue
    r.quotaPct = allineaQuotaCorpo(r.quotaPct, importoContrattualePartita(p), v.importo); k++
  }
  saveDraft(); renderAll(); toast(k ? `Allineate ${k} voci a corpo del SAL n. ${pz.dalSal}` : 'Nessuna quota a corpo da allineare')
}

/* ── Verbali e comunicazioni del DL ─────────────────────────────────────── */
function openNuovoVerbale(): void {
  const btns = VERBALE_TIPI.map((t) => `<button class="ehb-btn b-block" style="justify-content:flex-start;text-align:left" onclick="creaVerbale('${t}')"><b>${esc(VERBALE_LABEL[t])}</b><br><span class="b-muted" style="font-size:var(--fs-xs)">${esc(VERBALE_DESC[t])} · ${esc(VERBALE_ART[t])}</span></button>`).join('')
  modal(`<div class="b-modal__h">Nuovo verbale / atto del Direttore dei Lavori</div>
    <p class="b-muted" style="margin:0 0 12px">L'atto viene collocato alla data corrente (${esc(isoToIt(S.dataCorrenteISO) || '—')}); la modificherai nell'editor. Scegli il tipo:</p>
    <div style="display:grid;gap:8px">${btns}</div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button></div>`)
}
function creaVerbale(tipo: string): void {
  const t = tipo as VerbaleTipo
  const v = nuovoVerbale(t, isoToIt(S.dataCorrenteISO), S.verbali, uid())
  S.verbali.push(v)
  saveDraft(); renderAll()
  openEditor(`verb-${v.id}`, `verbale:${v.id}`)
}

/* ── Lavori in economia (liste settimanali) ─────────────────────────────── */
function creaLista(): void {
  if (!S.sals.length) { toast('Crea prima un SAL: la lista in economia confluisce nel SAL di competenza'); return }
  const salN = Math.max(...S.sals.map((s) => s.numero))
  const l = nuovaLista(salN, isoToIt(S.dataCorrenteISO), S.economia, uid())
  S.economia.push(l)
  saveDraft(); renderAll()
  openEditor(`sal-${salN}`, `lista:${l.id}`)
}

/* ── EDITOR dei documenti (le schede aprono qui) ────────────────────────── */
/* Atti che lavorano A TUTTA PAGINA invece che in una scheda: quelli in cui si
   STA, non quelli che si producono e si chiudono. Misurare è il mestiere. */

function openEditor(faseKey: string, tipo: string): void {
  const fd = findDoc(faseKey, tipo); if (!fd) return
  if (fd.d.needsPartite && !S.partite.length) { toast('Importa prima il computo (pannello sinistro → Importa computo)'); return }
  S.editor = { fase: faseKey, tipo }
  // OGNI atto si apre allo stesso modo: a tutta pagina, con la stessa testata e
  // un solo comando di stampa. Prima alcuni erano finestre e altri pagine, con
  // sei pulsanti di stampa diversi: due schermate per la stessa operazione.
  disegnaPagina(fd.f, fd.d, tipo)
}
function reopenEditor(): void { if (!S.editor) return; _tieniScroll = true; try { openEditor(S.editor.fase, S.editor.tipo) } finally { _tieniScroll = false } }

/** Disegna (o ridisegna) l'atto a tutta pagina, conservando lo scorrimento. */
function disegnaPagina(f: Fase, d: DocDesc, tipo: string): void {
  const host = $('bPagina'); const corpo = $('bPaginaBody'); const tit = $('bPaginaT'); const act = $('bPaginaAct')
  if (!host || !corpo || !tit || !act) return
  const y = _tieniScroll ? corpo.scrollTop : 0
  /* LA TESTATA DI FASE: dove sono, a che prezzi lavoro, a che punto è. Le
     stesse tre informazioni in ogni schermata, nello stesso posto. La linea
     del tempo non c'è più: era la navigazione dell'albero, disegnata due
     volte. */
  const r = catenaRevisioni().find((x) => x.fase === f.key)
  const vig = r && r.leggeDa != null ? siglaRevisione(r.leggeDa) : null
  document.documentElement.setAttribute('data-fase', r ? capitoloDi(r.tipo) : 'computo')
  // la testata condivisa col Computo (shared/griglia/testata.ts)
  tit.innerHTML = testataTitoloHtml({
    titolo: d.label,
    revisione: r ? siglaRevisione(r.n) : undefined,
    sottotitolo: `${f.titolo}${f.dataIt ? ' · ' + f.dataIt : ''}`,
    pastiglie: [
      ...(r ? [{ testo: TITOLO_RAMO[capitoloDi(r.tipo)].toLowerCase(), tono: 'fase' as const }] : []),
      ...(vig ? [{ testo: `prezzi ${vig}` }] : r?.tipo === 'contratto' ? [{ testo: 'prezzi di contratto' }] : []),
      ...(r?.stato === 'bozza' ? [{ testo: 'in bozza', tono: 'bozza' as const }] : []),
    ],
  })
  act.innerHTML = testataAzioniHtml({ azioni: ['libretto', 'registro', 'sommario'].includes(tipo) ? opzAttoHTML(tipo) : '', stampa: { onclick: 'apriStampaAtto()' } })
  corpo.innerHTML = editorBody(f, tipo)
  /* L'ELENCO PREZZI SI APRE DA SOLO dove serve: in un libretto o in una perizia
     si lavora guardandolo, e la voce entra da lì. Era un cassetto da aprire
     ogni volta, con un pulsante nella barra per farlo. */
  /* Il prezzario serve dove si scrive, non davanti a un'anteprima di stampa. */
  if (!['misure', 'variante'].includes(tipo)) chiudiCassetto()
  else if (!_cassetto) {
    const ctx: Contesto = tipo === 'perizia'
      ? `pz${Number(/^perizia-(\d+)$/.exec(f.key)?.[1] || 0)}`
      : Number(/^sal-(\d+)$/.exec(f.key)?.[1] || 0)
    if (ctx) apriCassetto(ctx, 'contratto')
  }
  host.hidden = false
  document.body.classList.add('is-pagina')
  if (y) corpo.scrollTop = y
}
/* ── LE STAMPE DEL LAVORO ──────────────────────────────────────────────────
   Un elenco solo, condiviso col Computo (shared/stampe/catalogo.ts): le carte di
   progetto, di gara e di contabilità stanno nella stessa schermata, perché chi le
   firma le cerca in un posto solo. Quelle del Computo si vedono anche qui e
   cliccarle porta di là. */
function stampeDelLavoro(): VoceStampa[] {
  const prodotte: Record<string, { data: string; impronta?: string }> = {}
  for (const c of S.consegne) {
    const id = c.salNumero ? `atti-${c.salNumero}` : c.tipo
    const sal = c.salNumero ? salById(c.salNumero) : undefined
    const pre = prodotte[id]
    if (!pre || (c.data && c.data > pre.data)) prodotte[id] = { data: c.data, impronta: sal?.impronta || c.impronta }
  }
  return [
    ...stampeDellaContabilita({
      sals: S.sals.map((x) => ({ numero: x.numero, firmato: !!x.firmato })),
      conPartite: S.partite.length > 0,
      conPerizie: (S.appalto.perizie || []).length > 0,
      perizie: (S.appalto.perizie || []).map((p) => ({ numero: p.numero, approvata: periziaApprovata(p) })),
      scadenzeUrgenti: scadenzeUrgenti(scadenzeDelLavoro()).length,
      semplificata: inSemplificata(S.appalto, S.partite),
      fatture: { totali: S.fatture.length, vistate: S.fatture.filter((f) => f.vistoData).length },
      prodotte,
    }),
    // le carte del progetto e della gara: le voci sono le stesse del contratto,
    // quindi se qui ci sono partite di là c'è un computo da stampare
    ...stampeDelComputo({ vociNelComputo: S.partite.length }),
  ]
}
/* ── L'ELENCO PREZZI DEL LAVORO ────────────────────────────────────────────
   Una cosa è il prezzario (il listino regionale o del fornitore: un archivio
   del programma, da cui si pesca); un'altra è l'ELENCO PREZZI DI QUESTO
   LAVORO, cioè gli articoli che il contratto conosce, con il loro prezzo e la
   loro provenienza. Nei programmi di contabilità sono due cose distinte, e giustamente: l'elenco
   prezzi è trasversale: lo stesso in computo e in contabilità, perché gli
   articoli sono gli stessi — cambia solo che in progetto si computano e in
   contabilità si contabilizzano.

   Qui l'elenco si gestisce per sé: si aggiunge una voce a mano, si pesca dal
   prezzario, si corregge un prezzo, si vede dove ogni voce è usata. Le misure
   non si toccano: restano nei libretti e nel computo. */
let _epQ = ''

function apriElencoPrezzi(): void {
  const host = $('bPagina'); const corpo = $('bPaginaBody'); const tit = $('bPaginaT'); const act = $('bPaginaAct')
  if (!host || !corpo || !tit || !act) return
  S.editor = null
  tit.innerHTML = `Elenco prezzi <span>— gli articoli di questo lavoro, con prezzo e provenienza</span>`
  act.innerHTML = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="epVoceAMano()" title="Crea un articolo scrivendolo: codice, descrizione, unità di misura, prezzo">＋ Voce a mano</button>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="epDalPrezzario()" title="Apri l'archivio dei prezzari del programma e pesca una voce: entra in elenco, senza misure">⌕ Dal prezzario</button>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="openImport()" title="Importa le voci da un computo XPWE o Excel">⭳ Importa voci</button>`
  corpo.innerHTML = lineaHTML() + `<div id="bEpBox">${elencoPrezziHTML()}</div>`
  host.hidden = false
  document.body.classList.add('is-pagina')
}
function disegnaElencoPrezzi(): void { const b = $('bEpBox'); if (b) b.innerHTML = elencoPrezziHTML() }
function epFiltra(q: string): void { _epQ = q; const t = $('bEpTab'); if (t) t.innerHTML = epRigheHTML() }

/** Il SAL in cui una voce aggiunta adesso può entrare: l'ultimo aperto. */
function salCorrente(): Sal | undefined {
  const aperti = S.sals.filter((x) => !x.firmato).sort((a, b) => b.numero - a.numero)
  return aperti[0] || [...S.sals].sort((a, b) => b.numero - a.numero)[0]
}

function epVoci(): Partita[] {
  const q = _epQ.trim().toLowerCase()
  const ord = ordineIscrizione(S.partite)
  // qui ci sono ANCHE le voci ancora da definire: l'elenco prezzi è il posto
  // dove si definiscono, nasconderle le renderebbe irraggiungibili
  let voci = [...S.partite]
  if (q) {
    const parole = q.split(/\s+/)
    voci = voci.filter((p) => { const t = (p.codice + ' ' + p.descrizione + ' ' + (p.categoria || '')).toLowerCase(); return parole.every((w) => t.includes(w)) })
  }
  // l'elenco si legge nell'ordine di iscrizione: lo stesso del registro
  return voci.sort((a, b) => (ord.get(a.id) ?? 0) - (ord.get(b.id) ?? 0))
}

/** Dove la voce è già contabilizzata: i SAL che la misurano. */
function epUsataIn(p: Partita): number[] {
  return S.sals.filter((s) => s.righe.some((r) => r.partitaId === p.id && ((r.misurazioni && r.misurazioni.length) || r.quantitaProgressiva != null || r.quotaPct != null)))
    .map((s) => s.numero).sort((a, b) => a - b)
}

function epVociElenco(): VoceElenco[] {
  const ord = ordineIscrizione(S.partite)
  const sal = salCorrente()
  return epVoci().map((p) => {
    const usata = epUsataIn(p)
    const prezzo = p.modalita === 'corpo' ? p.importoContrattuale : p.prezzoUnitario
    const contratto = p.modalita === 'corpo' ? null : p.prezzoContratto
    return {
      n: ord.get(p.id) ?? '',
      codice: p.codice,
      descrizione: p.descrizione,
      sotto: p.categoria,
      um: p.modalita === 'corpo' ? 'a corpo' : p.um,
      prezzo,
      contratto,
      scostato: contratto != null && prezzo != null && Math.abs(contratto - prezzo) >= 0.005,
      np: !!p.np,
      provenienza: epOrigine(p),
      usataIn: usata.length ? 'SAL ' + usata.join(', ') : '',
      azioni: `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="epModifica('${p.id}')" title="Correggi codice, descrizione, unità di misura e prezzo">✎</button>`
        + (p.np ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="epAssimila('${p.id}')" title="Nuovo prezzo per assimilazione da questa voce">≈</button>`)
        + (sal && !sal.firmato && (p.introdottaSal ?? 1) <= sal.numero ? `<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="epNelLibretto('${p.id}')" title="Portala nel libretto del SAL n. ${sal.numero} e misurala">↦ SAL ${sal.numero}</button>` : '')
        + (usata.length ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="epElimina('${p.id}')" title="Elimina l'articolo: non è misurato in nessun SAL">✕</button>`),
    }
  })
}
function epRigheHTML(): string {
  return righeElencoHTML(epVociElenco(), {
    conContratto: true, etichettaNonUsata: 'non misurata', titoloScostamento: 'Prezzo in contabilità diverso da quello di contratto',
    vuoto: _epQ ? 'Nessun articolo trovato.' : "L'elenco prezzi è vuoto: importa un computo, pesca dal prezzario o scrivi una voce a mano.",
  })
}

function elencoPrezziHTML(): string {
  const voci = epVoci()
  const tot = S.partite.length
  const daDefinire = S.partite.filter((p) => !p.codice.trim() && !p.descrizione.trim()).length
  const nonMisurate = S.partite.filter((p) => !epUsataIn(p).length).length
  const np = nuoviPrezzi(S.partite).length
  const versioni = (S.appalto.perizie || []).filter((pz) => periziaApprovata(pz)).sort((x, y) => x.numero - y.numero)
  const etVersione = versioni.length
    ? `in vigore: <b>contratto dopo la perizia n. ${versioni[versioni.length - 1].numero}</b> (dal SAL n. ${versioni[versioni.length - 1].dalSal})`
    : 'in vigore: <b>contratto</b>'
  return `<p class="b-muted">Gli articoli di questo lavoro: quelli del contratto, quelli pescati dai prezzari e i nuovi prezzi concordati in corso d'opera. I <b>prezzari</b> caricati — regionali o privati — sono un'altra cosa: restano nel programma finché non li togli o li aggiorni, e da lì si pesca. Questo elenco è invece <b>l'elenco prezzi del progetto</b>, che diventa elenco prezzi di contratto e viene aggiornato da ogni perizia approvata: ${etVersione}.</p>
    ${versioni.length ? `<p class="b-muted">Versioni: <b>contratto</b>${versioni.map((pz) => ` → <b>perizia n. ${pz.numero}</b> (dal SAL ${pz.dalSal})</b>`).join('')}. I SAL già firmati restano ai prezzi di allora.</p>` : ''}
    <div class="b-row">
      <label class="b-field" style="flex:1 1 260px"><span>Cerca nell'elenco</span><input value="${esc(_epQ)}" placeholder="codice, descrizione o categoria" oninput="epFiltra(this.value)"></label>
      <div class="b-panel__body b-epconta">
        <div class="b-sumrow"><span>Articoli</span><b>${tot}</b></div>
        <div class="b-sumrow"><span>Nuovi prezzi</span><b>${np}</b></div>
        <div class="b-sumrow"><span>Non ancora misurati</span><b>${nonMisurate}</b></div>
        ${daDefinire ? `<div class="b-sumrow"><span>Da definire</span><b>${daDefinire}</b></div>` : ''}
      </div>
    </div>
    ${elencoPrezziTabellaHTML(epVociElenco(), { conContratto: true, etichettaPrezzo: 'In contabilità', idCorpo: 'bEpTab', etichettaNonUsata: 'non misurata', titoloScostamento: 'Prezzo in contabilità diverso da quello di contratto', vuoto: _epQ ? 'Nessun articolo trovato.' : "L'elenco prezzi è vuoto: importa un computo, pesca dal prezzario o scrivi una voce a mano." })}
    ${voci.length !== tot ? `<p class="b-muted">${voci.length} articoli su ${tot} corrispondono alla ricerca.</p>` : ''}`
}

/** Da dove viene il prezzo: contratto, prezzario, assimilazione, analisi, perizia. */
function epOrigine(p: Partita): string {
  if (p.np) {
    const o = ORIGINE_NP[p.np.origine] || p.np.origine
    return `nuovo prezzo n. ${p.np.numero} · ${o} · ${STATO_NP[p.np.stato]}${p.np.periziaN != null ? ` · perizia ${p.np.periziaN}` : ''}`
  }
  if (p.prezzoContratto != null) return 'contratto'
  if ((p.introdottaSal ?? 1) > 1) return `introdotta al SAL ${p.introdottaSal}`
  return 'elenco del lavoro'
}

function epVoceAMano(): void {
  const introdottaSal = salCorrente()?.numero ?? 1
  const p: Partita = { id: uid(), modalita: S.appalto.modalita === 'corpo' ? 'corpo' : 'misura', codice: '', descrizione: '', um: '', prezzoUnitario: null, qtyProgetto: null, introdottaSal }
  if (p.modalita === 'corpo') { delete p.prezzoUnitario; p.importoContrattuale = null }
  S.partite.push(p)
  saveDraft(); renderLeft(); disegnaElencoPrezzi(); epModifica(p.id)
}
function epDalPrezzario(): void { apriCassetto(salCorrente()?.numero ?? 1, 'prezzario', undefined, true) }
function epModifica(pid: string): void { apriVoceEdit(pid, salCorrente()?.numero ?? 1) }
function epAssimila(pid: string): void {
  const sal = salCorrente()
  if (!sal) { toast('Serve un SAL aperto: un nuovo prezzo nasce in un avanzamento'); return }
  assimilaVoce(sal.numero, pid); disegnaElencoPrezzi()
}
function epNelLibretto(pid: string): void {
  const sal = salCorrente(); if (!sal) { toast('Nessun SAL aperto'); return }
  portaNelLibretto(sal.numero, pid)
  openEditor(`sal-${sal.numero}`, 'libretto')
}
function epElimina(pid: string): void {
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  if (epUsataIn(p).length) { toast('La voce è misurata in un SAL: si storna dal libretto, non si elimina'); return }
  S.partite = S.partite.filter((x) => x.id !== pid)
  for (const s of S.sals) s.righe = s.righe.filter((r) => r.partitaId !== pid)
  saveDraft(); renderLeft(); disegnaElencoPrezzi(); toast('Articolo eliminato dall\'elenco prezzi')
}

function apriStampe(): void {
  const host = $('bPagina'); const corpo = $('bPaginaBody'); const tit = $('bPaginaT'); const act = $('bPaginaAct')
  if (!host || !corpo || !tit || !act) return
  S.editor = null
  tit.innerHTML = `Stampe del lavoro <span>— tutte le carte, di progetto e di contabilità</span>`
  act.innerHTML = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="verificaFascicoli()" title="Ricalcola le impronte dei SAL firmati">⟳ Verifica i fascicoli</button>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="esportaFormatoAperto()" title="Pacchetto in formati aperti: JSON, CSV e leggimi">⇪ Formato aperto</button>`
  corpo.innerHTML = lineaHTML() + stampeHTML(stampeDelLavoro(), { tool: 'contabilita', vaiAllAltro: "vaiAlComputo('%s')" })
  host.hidden = false
  document.body.classList.add('is-pagina')
}
/** L'analisi del prezzo si compone nel Computo: stessa schermata, un posto solo. */
function componiAnalisiNelComputo(): void {
  try { sessionStorage.setItem('quadra:apri-analisi', '1') } catch { /* ok */ }
  try { window.parent.postMessage({ type: 'hub:navigate', appId: 'computo' }, '*') } catch { toast('Apri il Computo dal menu e usa «Σ Analisi Prezzi»') }
}
/** Una stampa di progetto: la fa il Computo, l'hub ci porta. */
function vaiAlComputo(idStampa: string): void {
  try { sessionStorage.setItem('quadra:stampa-attesa', idStampa || '') } catch { /* ok */ }
  try { window.parent.postMessage({ type: 'hub:navigate', appId: 'computo' }, '*') } catch { toast('Apri il Computo dal menu per questa stampa') }
}

/** Chiude l'atto a tutta pagina e torna alla catena documentale. */
function chiudiPagina(): void {
  S.editor = null
  disegnaCruscotto()
}

/* ── IL CRUSCOTTO DEL LAVORO ───────────────────────────────────────────────
   La pagina che si apre quando non si sta lavorando a un atto: che lavoro è,
   i quattro numeri che contano, che cosa scade e che cosa è già stato
   consegnato. Al posto del muro di schede — che erano la stessa navigazione
   dell'albero, disegnata una seconda volta, e costringevano a scorrere dieci
   riquadri uguali per trovare il libretto. */
function cruscottoNumeri(): { l: string; v: string; s?: string; forte?: boolean }[] {
  const a = S.appalto
  if (!S.partite.length) return []
  const tot = totaleContrattualeLavori(S.partite).totale
  const res = calcolaSals(a, S.partite, S.sals, S.economia)
  const ult = res[res.length - 1]
  const fatto = ult ? round2(ult.lavoriEseguiti + ult.oneriSicurezzaEseguiti) : 0
  const pct = tot > 0 ? Math.round((fatto / tot) * 1000) / 10 : 0
  return [
    { l: 'Importo di contratto', v: eur(tot), s: `${S.partite.length} voci` },
    { l: 'Contabilizzato', v: eur(fatto), s: `${String(pct).replace('.', ',')}% del contratto` },
    { l: 'Da liquidare', v: eur(ult?.importoSal ?? 0), s: ult ? `SAL n. ${ult.numero}` : 'nessun SAL', forte: true },
    { l: 'Residuo', v: eur(round2(tot - fatto)) },
  ]
}
function disegnaCruscotto(): void {
  const host = $('bPagina'); const corpo = $('bPaginaBody'); const tit = $('bPaginaT'); const act = $('bPaginaAct')
  if (!host || !corpo || !tit || !act) return
  const a = S.appalto
  host.hidden = false
  document.body.classList.add('is-pagina')
  tit.innerHTML = `${testataTitoloHtml({ titolo: a.oggetto || 'Nuovo lavoro', sottotitolo: a.ente.denominazione || undefined })}`
  act.innerHTML = `<button class="ehb-btn ehb-btn--sm" onclick="openDati()">Dati del lavoro</button>
    <button class="ehb-btn ehb-btn--sm" onclick="apriStampe()" title="Tutte le stampe del lavoro">⎙ Stampe…</button>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="${S.partite.length ? 'nuovoSalOggi()' : 'openImport()'}">${S.partite.length ? '＋ Nuovo SAL' : '↧ Importa il computo'}</button>`
  const numeri = cruscottoNumeri()
  corpo.innerHTML = `<div class="b-crus">
    ${numeri.length ? `<div class="b-kpis">${numeri.map((k) => `<div class="b-kpi${k.forte ? ' is-forte' : ''}">
      <div class="b-kpi__l">${esc(k.l)}</div><div class="b-kpi__v">${k.v}</div>${k.s ? `<div class="b-kpi__s">${esc(k.s)}</div>` : ''}</div>`).join('')}</div>` : ''}
    <div class="b-crus__g">
      <section class="b-panel">
        <div class="b-panel__h">Il lavoro</div>
        <div id="bAppSummary" class="b-panel__body"></div>
        <div id="bComputoSummary" class="b-panel__body"></div>
      </section>
      <section class="b-panel">
        <div class="b-panel__h">Da fare</div>
        <div id="bScadenze" class="b-scadenze"></div>
      </section>
      <section class="b-panel">
        <div class="b-panel__h">Documenti consegnati</div>
        <div id="bConsegne" class="b-consegne"></div>
        <div class="b-right__ft">
          <button class="ehb-btn ehb-btn--sm b-block" onclick="verificaFascicoli()" title="Ricalcola le impronte dei SAL firmati e verifica che i fascicoli siano ancora quelli (All. II.14 art. 12 c. 10)">⟳ Verifica i fascicoli firmati</button>
          <button class="ehb-btn ehb-btn--sm ehb-btn-fam-export b-block" onclick="esportaFormatoAperto()" title="Pacchetto in formati aperti e documentati: la contabilità resta leggibile anche senza Quadra">⇪ Esporta in formato aperto</button>
        </div>
      </section>
    </div>
  </div>`
  renderLeft(); renderScadenze(); renderConsegne()
}


function editorBody(f: Fase, tipo: string): string {
  if (tipo.startsWith('verbale:')) return editorVerbale(tipo.slice('verbale:'.length))
  if (tipo.startsWith('lista:')) return editorLista(tipo.slice('lista:'.length))
  if (tipo.startsWith('fattura:')) return editorFattura(tipo.slice('fattura:'.length))
  if (tipo === 'datiappalto') return `<div class="b-dati">${datiAppaltoCorpo()}</div>`
  if (tipo === 'copertina') return `<p class="b-muted">La copertina è composta automaticamente dai dati dell'appalto.</p><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="closeModal();openDati()">Modifica dati appalto</button>`
  if (tipo === 'giornale') return editorGiornale()
  if (tipo === 'misure') return editorLibretto(f)
  if (tipo === 'datisal') return editorDatiSal(f)
  if (tipo === 'variante') return editorPerizia(f)
  if (tipo === 'registrobianco') return editorRegistroBianco()
  /* Libretto, registro, sommario, stato di avanzamento e certificato sono
     ANTEPRIME: quello che si vede è esattamente il documento che si emette. */
  if (tipo === 'libretto' || tipo === 'registro' || tipo === 'sal' || tipo === 'certificato' || tipo === 'perizia')
    return anteprimaInPagina(f, tipo, anteprimaNota(tipo, f))
  if (tipo === 'relazione') return editorRelazione()
  if (tipo === 'contofinale') return editorContoFinale()
  if (tipo === 'sommario') return anteprimaInPagina(f, tipo, 'Documento derivato dagli atti a monte: partite, avanzamenti dei SAL, categorie omogenee.')
  /* Un atto che non ha campi da compilare non è una pagina vuota: è il
     documento, che si legge qui e si stampa da «⎙ Stampa…». Prima restava
     bianco — il quadro comparativo, per esempio — e sembrava rotto. */
  return anteprimaInPagina(f, tipo)
}
/** Il documento, letto a schermo: niente campi, perché non ce ne sono. */
function anteprimaInPagina(f: Fase, tipo: string, nota?: string): string {
  const fd = findDoc(f.key, tipo)
  if (!fd) return ''
  let corpo = ''
  try { corpo = fd.d.gen() } catch (e) { return `<p class="b-avviso">Non riesco a comporre questo documento: ${esc((e as Error)?.message || String(e))}</p>` }
  // del documento completo si mostra il contenuto, senza la sua intestazione di stampa
  const dentro = /<body[^>]*>([\s\S]*)<\/body>/i.exec(corpo)
  // via la barra del documento-finestra: qui si stampa dalla testata della pagina
  const senzaBarra = (dentro ? dentro[1] : corpo).replace(/<div class="doc-bar">[\s\S]*?<\/div>/i, '')
  return `${nota ? `<p class="b-muted b-anteprima-nota">${esc(nota)}</p>` : ''}<div class="b-docview">${senzaBarra}</div>`
}

/* Libretto — schermata tipo computo Computo: misure di dettaglio L1×L2×H×n per voce
   (con edit veloce a voce chiusa), nuovi prezzi, e STORNO tracciato al posto
   della cancellazione (atti pubblici: niente abrasioni, si porta in detrazione). */
/* SAL firmato: libretto e SAL in sola lettura (fieldset disabilitato) con la possibilità
   di sbloccare esplicitamente, lasciando traccia dello sblocco. */
function bloccoHTML(sal: Sal): string {
  const v = _verifiche.find((x) => x.salNumero === sal.numero)
  const sigillo = sal.impronta
    ? `<span class="b-muted" title="Impronta ${esc(sal.improntaAlgo || ALGO_IMPRONTA)} del fascicolo al momento della firma: ${esc(sal.impronta)}">· sigillo ${esc(improntaCorta(sal.impronta))}</span>
       ${v && v.esito !== 'non-firmato' ? `<span class="${v.esito === 'modificato' ? 'b-np' : 'b-np is-approvato'}">${esc(ESITO_LABEL[v.esito])}</span>` : ''}
       <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="verificaFascicoli()" title="Ricalcola l'impronta e verifica che il fascicolo sia ancora quello firmato">⟳ verifica</button>`
    : '<span class="b-muted">· senza sigillo (firmato prima dell\'impronta)</span>'
  if (sal.firmato) return `<div class="b-lock"><b>🔒 Atti del SAL n. ${sal.numero} firmati${sal.dataFirma ? ' il ' + esc(sal.dataFirma) : ''}</b> — sola lettura. ${sigillo}
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="sbloccaSal(${sal.numero})">Sblocca per correggere…</button>
    ${sal.sblocchi?.length ? `<span class="b-muted">Sbloccato ${sal.sblocchi.length} volt${sal.sblocchi.length === 1 ? 'a' : 'e'} (ultimo: ${esc(sal.sblocchi[sal.sblocchi.length - 1].data)})</span>` : ''}</div>`
  return `<div class="b-lock b-lock--open">Atti del SAL n. ${sal.numero} modificabili.
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="firmaSal(${sal.numero})" title="Dopo la firma libretto, registro e SAL di questo stato d'avanzamento non si modificano più">🔒 Firma e blocca</button></div>`
}
const conBlocco = (sal: Sal, html: string): string => bloccoHTML(sal) + (sal.firmato ? `<fieldset class="b-locked" disabled>${html}</fieldset>` : html)
/* ── FIRMA E SIGILLO (contabilità digitale, All. II.14 art. 12 c. 10) ──────
   Alla firma il fascicolo si blocca E si sigilla: un'impronta SHA-256 del testo
   canonico degli atti. Non è una firma digitale — quella è un certificato del
   tecnico — ma rende visibile ogni modifica successiva, che è ciò che la norma
   chiede a un programma: autenticità e provenienza dei dati. */
async function firmaSal(n: number): Promise<void> {
  const sal = salById(n); if (!sal) return
  if (!confirm(`Firmare e bloccare gli atti del SAL n. ${n}? Libretto, registro e SAL non saranno più modificabili.`)) return
  // prima il blocco (immediato, è quello che conta per l'utente), poi il sigillo
  sal.firmato = true; sal.dataFirma = isoToIt(todayISO())
  saveDraft(); reopenEditor(); renderLeft(); renderTimeline()
  toast(`SAL n. ${n} firmato e bloccato`)
  const h = await improntaSal(S.appalto, S.partite, S.sals, n, S.economia)
  if (!h) { toast(`SAL n. ${n} bloccato, ma l'impronta non è calcolabile in questo ambiente (serve una pagina sicura)`); return }
  sal.impronta = h; sal.improntaAlgo = ALGO_IMPRONTA; sal.improntaTs = Date.now()
  _verifiche = [..._verifiche.filter((v) => v.salNumero !== n), { salNumero: n, esito: 'integro', attesa: h, trovata: h }]
  saveDraft(); reopenEditor(); renderLeft(); renderTimeline()
  toast(`Fascicolo del SAL n. ${n} sigillato · impronta ${improntaCorta(h)}`)
}
/** Ricalcola le impronte dei SAL firmati e dice se i fascicoli sono ancora quelli. */
async function verificaAtti(): Promise<Verifica[]> {
  const out: Verifica[] = []
  // anche i SAL sbloccati che portano un sigillo: è lì che la verifica conta
  for (const s of S.sals.filter((x) => x.firmato || x.impronta).sort((a, b) => a.numero - b.numero)) {
    out.push(await verificaSal(S.appalto, S.partite, S.sals, s.numero, S.economia))
  }
  return out
}
async function verificaFascicoli(): Promise<void> {
  const v = await verificaAtti()
  if (!v.length) { toast('Nessun fascicolo sigillato da verificare: il sigillo si appone alla firma del SAL'); return }
  const modificati = v.filter((x) => x.esito === 'modificato')
  const senza = v.filter((x) => x.esito === 'senza-impronta')
  if (modificati.length) toast(`⚠ Fascicol${modificati.length === 1 ? 'o' : 'i'} modificat${modificati.length === 1 ? 'o' : 'i'} dopo la firma: ${modificati.map((x) => `SAL n. ${x.salNumero}`).join(', ')} — vedi il registro degli atti`)
  else toast(`${v.length - senza.length} fascicol${v.length - senza.length === 1 ? 'o integro' : 'i integri'}${senza.length ? ` · ${senza.length} firmat${senza.length === 1 ? 'o' : 'i'} senza impronta` : ''}`)
  _verifiche = v
  renderAll(); if (S.editor) reopenEditor()
}
/** Esito dell'ultima verifica, per mostrarlo negli atti senza ricalcolare a ogni disegno. */
let _verifiche: Verifica[] = []
function sbloccaSal(n: number): void {
  const sal = salById(n); if (!sal) return
  const motivo = prompt(`Motivo dello sblocco del SAL n. ${n} (resta annotato):`)
  if (motivo == null) return
  sal.firmato = false; sal.sblocchi = [...(sal.sblocchi || []), { data: isoToIt(todayISO()), motivo: motivo || undefined }]
  saveDraft(); reopenEditor(); renderLeft(); renderTimeline(); toast(`SAL n. ${n} sbloccato: lo sblocco è annotato`)
}
/** true (con avviso) se il SAL è firmato: le funzioni di modifica si fermano. */
/** Il SAL è firmato? Domanda pura: si usa per DISEGNARE (niente effetti). */
const salFirmato = (n: number | undefined): boolean => !!salById(n)?.firmato
/** Guardia delle MODIFICHE: se il SAL è firmato lo dice e blocca. */
function salBloccato(n: number | undefined): boolean {
  if (!salFirmato(n)) return false
  toast(`Il SAL n. ${n} è firmato: sbloccalo per modificarlo`); return true
}
/* Il totale di quello che si sta misurando, sotto le voci: un libretto senza
   totale costringe a sommare a mano per sapere dove si è arrivati. Importi al
   lordo del ribasso, come nel registro: qui si misura, non si liquida. */
function totaleLibrettoHTML(sal: Sal, quante = 0, mostrate = 0): string {
  const salN = sal.numero
  const res = calcolaSals(S.appalto, S.partite, S.sals.filter((x) => x.numero <= salN), S.economia)
  const r = res[res.length - 1]
  if (!r) return ''
  const prec = res.length > 1 ? res[res.length - 2] : null
  const lordo = round2(r.lavoriEseguiti + r.oneriSicurezzaEseguiti)
  const lordoPrec = prec ? round2(prec.lavoriEseguiti + prec.oneriSicurezzaEseguiti) : 0
  const misurate = r.righe.filter((x) => x.eseguito !== 0 || (x.progressivo ?? 0) !== 0).length
  const tot = quante || r.righe.length
  return piedeFaseHtml(FASE_SAL, {
    salN, misurate, quante: tot, mostrate: mostrate || tot,
    inQuestoSal: prec ? round2(lordo - lordoPrec) : null,
    lordo, sicurezza: r.oneriSicurezzaEseguiti, daLiquidare: r.importoSal,
  }, eur)
}

function editorLibretto(f: Fase): string {
  const sal = salById(f.salNumero); if (!sal) return ''
  return conBlocco(sal, editorLibrettoCorpo(sal))
}
function editorLibrettoCorpo(sal: Sal): string {
  const salN = sal.numero
  const tutte = pvAl(salN).filter((p) => voceVisibileInSal(p, salN))
  const q = _libQ.trim().toLowerCase()
  const cercate = filtraVoci(tutte, q, testoVoce)
  /* La ricerca pesca in tutto il contratto: se si cerca una voce non ancora
     misurata la si deve trovare, altrimenti il filtro la nasconderebbe. */
  const misurataQui = (p: Partita): boolean =>
    (sal.righe.find((r) => r.partitaId === p.id)?.misurazioni || []).length > 0
    || (sal.righe.find((r) => r.partitaId === p.id)?.quantitaProgressiva ?? null) != null
  const visibili = _libSolo === 'misurate' && !q ? cercate.filter(misurataQui) : cercate
  const primo = salN === 1
  const apribili = visibili.filter((p) => (sal.righe.find((r) => r.partitaId === p.id)?.misurazioni || []).length > 0)
  const tutteAperte = apribili.length > 0 && apribili.every((p) => libExpanded.has(p.id))
  return `<div class="b-lib">
    ${barraVoci({
      cerca: { valore: _libQ, onInput: 'libFiltra(this.value)', placeholder: FASE_SAL.cerca },
      viste: { valore: _libVista, opzioni: OPZ_VISTA, onclickTpl: "setLibVista('%v')" },
      ordine: { valore: _libOrdine, opzioni: OPZ_ORDINE, onclickTpl: "setLibOrdine('%v')" },
      mostra: { valore: q ? 'tutte' : _libSolo, opzioni: FASE_SAL.mostra!, onclickTpl: "setLibSolo('%v')" },
      espandi: apribili.length && _libVista === 'tabella' ? { tutteAperte, onclick: `libEspandi(${tutteAperte ? 'false' : 'true'})` } : undefined,
      aggiungi: azioniVoce(salN, !!sal.firmato),
      dati: azioniDati(salN, !!sal.firmato),
      strumenti: azioniStrumenti(),
      campi: `<label class="b-lib__data" title="Data del libretto">${fld('Data', sal.data, `setSalData(${salN},this.value)`)}</label>`,
      extra: primo ? [{ etichetta: '↻ Dal computo', titolo: 'Rigenera le quantità dal computo (solo primo libretto)', onclick: `rigeneraDaComputo(${salN})`, stile: 'ghost' }] : [],
      aiuto: { onclick: 'libAiuto()', titolo: 'Come si misura in questo libretto' },
    })}${barraSelezioneHTML(salN)}
    <div class="b-tablewrap">${grigliaHtml({
      fase: FASE_SAL,
      selezione: { tutte: 'libSelTutte(this.checked)' },
      righe: righeLibretto(sal, visibili),
      vuoto: _libQ ? 'Nessuna voce corrisponde alla ricerca.' : _libSolo === 'misurate' ? 'Nessuna misura in questo libretto. Le voci si prendono dal pannello dei prezzi qui a destra, con «＋ Misura». Oppure «＋ Voce libera» per una riga da compilare a mano, o «Tutto il contratto» per scorrerle qui.' : 'Nessuna partita: aggiungi una voce dalla barra qui sopra.',
    })}</div>
    ${totaleLibrettoHTML(sal, tutte.length, visibili.length)}
  </div>`
}

/* Le voci del libretto, raggruppate come nel computo quando si ordina per
   categorie: gli stessi titoli, così le due schermate si leggono allo stesso modo. */
function righeLibretto(sal: Sal, visibili: Partita[]): RigaGriglia[] {
  if (!visibili.length) return []
  const voci = ordinaVoci(visibili)
  const riga = (p: Partita): RigaVoce => (_libVista === 'elenco' ? rigaElenco(sal, p) : rigaLibretto(sal, p))
  if (_libVista !== 'capitoli' && _libOrdine !== 'categorie') return voci.map(riga)
  return [...raggruppa(voci)].flatMap(([titolo, gruppo]): RigaGriglia[] => {
    const tot = gruppo.reduce((n, p) => n + eseguitoPartita(p, sal.righe.find((x) => x.partitaId === p.id), sal.numero), 0)
    return [
      { tipo: 'gruppo', titolo, nota: `· ${gruppo.length} voc${gruppo.length === 1 ? 'e' : 'i'}` },
      ...gruppo.map(riga),
      ...(_libVista === 'capitoli' ? [{ tipo: 'totale' as const, titolo: `Totale ${titolo.toLowerCase()}`, valore: eur(tot) }] : []),
    ]
  })
}
/** Il testo su cui si cerca una voce: lo stesso nel libretto e nella perizia. */
const testoVoce = (p: Partita): string => `${p.codice} ${p.descrizione} ${p.categoria || ''}`
/** L'ordine delle voci a schermo: lo stesso del computo. */
function ordinaVoci(voci: Partita[]): Partita[] {
  if (_libOrdine !== 'wbs') return voci
  const k = (p: Partita): string => p.wbs ? p.wbs.split('.').map((x) => x.trim().padStart(6, '0')).join('.') : '\uffff'
  return voci.slice().sort((a, b) => k(a).localeCompare(k(b)))
}
/** I capitoli: categoria (o WBS di primo livello, se si ordina per WBS). */
function raggruppa(voci: Partita[]): Map<string, Partita[]> {
  const g = new Map<string, Partita[]>()
  for (const p of voci) {
    const k = p.sicurezza ? 'COSTI DELLA SICUREZZA'
      : _libOrdine === 'wbs' ? (p.wbs ? `WBS ${p.wbs.split('.')[0]}` : 'SENZA WBS')
      : (p.categoria || 'Senza categoria').toUpperCase()
    const v = g.get(k); if (v) v.push(p); else g.set(k, [p])
  }
  return g
}
/** Vista «Elenco»: una riga per voce, sola lettura. Per leggere, non per scrivere. */
function rigaElenco(sal: Sal, p: Partita): RigaVoce {
  const r = sal.righe.find((x) => x.partitaId === p.id)
  const q = p.modalita === 'corpo' ? `${pctFmt(quotaAttestata(p, r) ?? quotaDaSottoComputo(p, r) ?? 0)}` : `${numFmt(r?.misurazioni?.length ? sommaMisurazioni(r.misurazioni) : (r?.quantitaProgressiva ?? 0))} ${p.um || ''}`.trim()
  return { celle: {
    codice: { tipo: 'codice', codice: p.codice, tono: p.np ? 'np' : undefined },
    designazione: { tipo: 'designazione', testo: p.descrizione },
    quantita: { tipo: 'numero', testo: q },
    prezzo: { tipo: 'numero', testo: p.modalita === 'corpo' ? eur(importoContrattualePartita(p)) : (p.prezzoUnitario == null ? '' : eur(p.prezzoUnitario)), muto: p.modalita === 'corpo' },
    importo: { tipo: 'numero', testo: eur(eseguitoPartita(p, r, sal.numero)) },
  } }
}

function libFiltra(q: string): void { _libQ = q; reopenEditor() }
function setLibOrdine(v: OrdineVoci): void { _libOrdine = v; reopenEditor() }
function setLibVista(v: VistaVoci): void { _libVista = v; reopenEditor() }
function setLibSolo(v: 'misurate' | 'tutte'): void { _libSolo = v; reopenEditor() }
function setPzSolo(v: 'variate' | 'tutte'): void { _pzSolo = v; reopenEditor() }
function libEspandi(apri: boolean): void {
  const sal = S.editor ? salById(S.editor.fase.startsWith('sal-') ? Number(S.editor.fase.slice(4)) : undefined) : undefined
  if (!sal) return
  if (!apri) libExpanded.clear()
  else for (const r of sal.righe) if ((r.misurazioni || []).length) libExpanded.add(r.partitaId)
  reopenEditor()
}
function libAiuto(): void {
  modal(`<div class="b-modal__h">Come si misura nel libretto</div>
    <div class="b-modal__scroll"><p class="b-muted">Misure a tutto il SAL. Apri «▸ misure» per il dettaglio par.ug. × L1 × L2 × H: le detrazioni sono righe negative. Lo stesso articolo può comparire più volte — <b>⧉</b> ripete la voce con misure proprie. Le voci già contabilizzate non si cancellano: si <b>stornano</b>, e lo storno resta a verbale.</p></div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--accent-soft" onclick="closeModal()">Chiudi</button></div>`, true)
}
/** Il riquadro «Nuovo prezzo» della barra, come scheda a sé. */
function apriNuovoPrezzo(salN: number): void {
  modal(`<div class="b-modal__h">Nuovo prezzo</div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 8px">Un prezzo non di contratto è un <b>nuovo prezzo</b>: prende un codice NP stabile e va concordato con l'esecutore prima di contabilizzarlo.</p>
      <div class="b-grid">
        <label class="b-field"><span>Codice</span><input id="bnv-cod" placeholder="NP.01"></label>
        <label class="b-field"><span>Descrizione</span><input id="bnv-desc" placeholder="Nuova lavorazione"></label>
        <label class="b-field"><span>U.M.</span><input id="bnv-um" placeholder="mq"></label>
        <label class="b-field"><span>Prezzo €</span><input id="bnv-prezzo" type="number" step="any" placeholder="0,00"></label>
        <label class="b-field"><span>Modalità</span><select id="bnv-mod"><option value="misura">a misura</option><option value="corpo">a corpo</option></select></label>
      </div>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="addVoce(${salN});closeModal()">+ Aggiungi</button></div>`, true)
}

/* ── COME SI AGGIUNGE UNA VOCE ────────────────────────────────────────────
   Stessa barra, stesse tre strade, nello stesso posto: sopra l'elenco, dove si
   sta lavorando, e non in fondo alla pagina. Vale per il libretto del SAL e per
   la perizia, ed è il vocabolario del Computo: dall'elenco prezzi, voce libera,
   nuovo prezzo. */
/* Una voce nel libretto: riga principale (edit veloce) + eventuale dettaglio misure. */
function rigaLibretto(sal: Sal, p: Partita): RigaVoce {
  const salN = sal.numero
  const r = sal.righe.find((x) => x.partitaId === p.id)
  // Voce soppressa: resta a verbale con lo storno, non è editabile (annullabile solo nel SAL che l'ha stornata).
  if (voceSoppressaInSal(p, salN)) {
    return { classe: 'b-row-storno', celle: {
      codice: { tipo: 'codice', codice: p.codice },
      designazione: { tipo: 'designazione', testo: p.descrizione, nota: `soppressa al SAL ${p.soppressaSal} (storno)` },
      quantita: { tipo: 'numero', testo: 'stornata', muto: true },
      prezzo: { tipo: 'numero', testo: eur(importoContrattualePartita(p)), muto: true },
      importo: { tipo: 'numero', testo: eur(0) },
      comandi: { tipo: 'comandi', comandi: p.soppressaSal === salN ? [{ icona: '↺ annulla', titolo: 'Annulla lo storno fatto in questo SAL', onclick: `annullaStorno('${p.id}')` }] : [] },
    } }
  }
  // Il prezzo si può correggere, ma non è la colonna del libretto: la cella lo
  // disegna come testo finché non ci si passa sopra (shared/griglia/celle.ts).
  const prezzo: Cella = p.modalita === 'corpo'
    ? { tipo: 'numero', testo: eur(importoContrattualePartita(p)), muto: true }
    : { tipo: 'campo', valore: numIn(p.prezzoUnitario), prefisso: '€', segnaposto: 'prezzo', comando: `setPrezzo('${p.id}',this.value)`, dopo: scostamentoPrezzoHtml(p),
        titolo: p.prezzoContratto != null ? 'Prezzo di contratto: la contabilità si fa a questo prezzo. Cambiarlo qui significa contabilizzare fuori contratto — per una lavorazione nuova usa un nuovo prezzo.' : 'Prezzo unitario (virgola decimale)' }
  const hasMisure = !!(r?.misurazioni && r.misurazioni.length)
  const expanded = libExpanded.has(p.id)
  // Colonna "eseguito": quota % (a corpo) · quantità rapida (a misura senza dettaglio) · somma (a misura con dettaglio).
  let eseg: Cella
  let toggle = ''
  if (p.modalita === 'corpo') {
    const daSotto = quotaDaSottoComputo(p, r)
    if (daSotto != null) {
      // la quota non si scrive: la dimostra il sotto-computo
      const mostrata = quotaAttestata(p, r) ?? daSotto
      eseg = { tipo: 'numero', testo: pctFmt(mostrata), titolo: `Quota ricavata dal sotto-computo: eseguito ${eur(eseguitoSottoComputo(p, r))} su ${eur(totaleSottoComputo(p))}` }
      toggle = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="toggleMisure('${p.id}')" title="${expanded ? 'Comprimi' : 'Apri'} il sotto-computo del corpo">${expanded ? '▾' : '▸'} sotto-computo</button>`
    } else {
      eseg = { tipo: 'campo', percento: true, valore: String(r?.quotaPct ?? ''), segnaposto: '%', quando: 'input', comando: `setSalQuota(${salN},'${p.id}',this.value)`, titolo: 'Quota eseguita del corpo d\'opera, in percentuale',
        dopo: `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="creaSottoComputo('${p.id}',${salN})" title="Scomponi il corpo d'opera nelle sue lavorazioni: la percentuale si misurerà invece di stimarla">＋ sotto-computo</button>` }
    }
  } else if (hasMisure) {
    eseg = { tipo: 'misurata', valore: numFmt(sommaMisurazioni(r!.misurazioni)), um: p.um || '', misure: r!.misurazioni!.length, idValore: `bme-${p.id}` }
    toggle = `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="toggleMisure('${p.id}')" title="${expanded ? 'Comprimi' : 'Apri'} le misure di dettaglio">${expanded ? '▾' : '▸'} misure</button>`
  } else {
    eseg = { tipo: 'campo', valore: numIn(r?.quantitaProgressiva), segnaposto: 'qtà', um: p.um || '', comando: `setSalQta(${salN},'${p.id}',this.value)`, titolo: 'Quantità a tutto il SAL (virgola decimale, anche formule)',
      dopo: `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="dettagliaMisure(${salN},'${p.id}')" title="Passa alle misure di dettaglio L×L×H×n">▸ dettaglia</button>` }
  }
  const sel = `<input type="checkbox" class="b-selbox" data-pid="${p.id}" ${libSel.has(p.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="libSelToggle('${p.id}',this.checked,event.shiftKey)" title="Seleziona la voce (Maiusc per un intervallo)">`
  const origine = etichettaOrigine(p).replace(/^ · /, '')
  const designazione: Cella = {
    tipo: 'designazione',
    testo: voceDaDefinire(p) ? '' : p.descrizione,
    vuoto: 'voce libera — misurala, poi assegnale un articolo',
    nota: p.modalita === 'corpo' ? 'a corpo' : 'a misura',
    meta: origine ? [`<span class="ehb-gr-meta__nota">${origine}</span>`] : [],
    azioni: `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriVoceEdit('${p.id}',${salN})" title="${voceDaDefinire(p) ? 'Assegna la voce: cercala nel prezzario o scrivila a mano' : 'Modifica codice, descrizione, unità e prezzo'}">${voceDaDefinire(p) ? '⌕ assegna voce' : '✎'}</button>${p.np ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriNP('${p.id}',${salN})" title="Scheda del nuovo prezzo: derivazione, ribasso, iter, motivazione">⚖ NP</button>` : ''}`,
  }
  const dopo = p.modalita !== 'corpo' && hasMisure && expanded ? misureDettaglioHTML(salN, p)
    : p.modalita === 'corpo' && haSottoComputo(p) && expanded ? sottoComputoHTML(sal, p)
    : ''
  return {
    classe: libSel.has(p.id) ? 'is-sel' : '',
    attributi: `oncontextmenu="rigaMenu(event,'${p.id}',${salN})" onclick="rigaClick(event,'${p.id}')" ondragover="voceDragOver(event,this)" ondragleave="voceDragLeave(this)" ondrop="voceDrop(event,${salN},'${p.id}',this)"`,
    sel: sel + toggle,
    celle: {
      codice: { tipo: 'codice', codice: p.codice, tono: p.np ? 'np' : undefined },
      designazione,
      quantita: eseg,
      prezzo,
      importo: { tipo: 'numero', testo: eur(eseguitoPartita(p, r, salN)), id: `bmimp-${p.id}` },
      comandi: { tipo: 'comandi', comandi: [
        { icona: '⧉', titolo: 'Ripeti la voce: una seconda annotazione dello stesso articolo, con misure proprie', onclick: `duplicaVoce('${p.id}',${salN})` },
        { icona: '🗑', titolo: 'Elimina / storna la voce', onclick: `delVoce('${p.id}',${salN})`, pericolo: true },
      ] },
    },
    dopo,
  }
}

/* ── IL SOTTO-COMPUTO DI UN CORPO D'OPERA ──────────────────────────────────
   In un appalto a corpo la domanda è sempre la stessa: da dove viene quel
   35%? Qui il corpo si scompone nelle lavorazioni che lo formano, e la quota
   si misura su quelle, invece di stimarla. Il libretto dei sotto-computi la
   stampa riga per riga: è la dimostrazione della percentuale. */
function sottoComputoHTML(sal: Sal, p: Partita): string {
  const salN = sal.numero
  const r = sal.righe.find((x) => x.partitaId === p.id)
  const bloccato = salBloccato(salN)
  // la scomposizione non si tocca più quando un SAL firmato l'ha usata: cambiarla
  // falsificherebbe la dimostrazione di una percentuale già attestata
  const congelato = bloccato || sottoComputoCongelato(p, S.sals)
  const ro = congelato ? 'disabled' : ''
  const q = quadraturaSottoComputo(p)
  const righe = (p.sottoComputo || []).map((v) => {
    const av = avanzamentoDi(r, v.id)
    const eseg = eseguitoVoceSotto(av)
    return `<tr>
      <td><input value="${esc(v.codice || '')}" placeholder="cod." onchange="setSottoVoce('${p.id}','${v.id}','codice',this.value)" style="width:70px" ${ro}></td>
      <td><input value="${esc(v.descrizione)}" placeholder="lavorazione" onchange="setSottoVoce('${p.id}','${v.id}','descrizione',this.value)" ${ro}></td>
      <td><input value="${esc(v.um || '')}" placeholder="um" onchange="setSottoVoce('${p.id}','${v.id}','um',this.value)" style="width:56px" ${ro}></td>
      <td><input type="text" inputmode="decimal" value="${numIn(v.qty)}" placeholder="qtà" onchange="setSottoVoce('${p.id}','${v.id}','qty',this.value)" style="width:76px;text-align:right" ${ro}></td>
      <td><input type="text" inputmode="decimal" value="${numIn(v.prezzo)}" placeholder="€" onchange="setSottoVoce('${p.id}','${v.id}','prezzo',this.value)" style="width:84px;text-align:right" ${ro}></td>
      <td class="b-num b-muted">${eur(importoVoceSotto(v))}</td>
      <td><input type="text" inputmode="decimal" value="${numIn(av?.quantitaProgressiva)}" placeholder="eseguito" onchange="setSottoEseguito(${salN},'${p.id}','${v.id}',this.value)" style="width:84px;text-align:right" ${bloccato ? 'disabled' : ''}></td>
      <td class="b-num">${eur(round2(eseg * (v.prezzo || 0)))}</td>
      <td>${congelato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delSottoVoce('${p.id}','${v.id}',${salN})" title="Togli la lavorazione dal sotto-computo">✕</button>`}</td>
    </tr>`
  }).join('')
  const eseguito = eseguitoSottoComputo(p, r)
  const quota = quotaDaSottoComputo(p, r)
  return rigaDettaglioHtml(FASE_SAL, { classe: 'b-misure-row', conSelezione: true, contenuto: `
    <div class="b-tablewrap"><table class="b-etable b-etable--inner">
      <thead><tr><th>Cod.</th><th>Lavorazione</th><th>U.M.</th><th>Qtà progetto</th><th>Prezzo</th><th class="b-num">Importo</th><th>Eseguito</th><th class="b-num">Importo eseg.</th><th></th></tr></thead>
      <tbody>${righe}
        <tr><td colspan="5"><b>Totale del sotto-computo</b></td><td class="b-num"><b>${eur(totaleSottoComputo(p))}</b></td><td></td><td class="b-num"><b>${eur(eseguito)}</b></td><td></td></tr>
        <tr><td colspan="7"><b>Quota del corpo a tutto il SAL n. ${salN}</b></td><td class="b-num"><b>${quota == null ? '—' : pctFmt(quota)}</b></td><td></td></tr>
      </tbody></table></div>
    ${q.quadra ? '' : `<p class="b-avviso">Il sotto-computo somma ${eur(q.somma)} contro un corpo di ${eur(q.corpo)}: scostamento di ${eur(Math.abs(q.scostamento))}. La percentuale si calcola sul totale del sotto-computo; controlla la scomposizione.</p>`}
    ${congelato && !bloccato ? `<p class="b-avviso">La scomposizione è usata da un SAL già firmato: non si modifica più. Le quantità eseguite di questo avanzamento restano modificabili.</p>` : ''}
    ${congelato ? '' : `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="addSottoVoce('${p.id}',${salN})">＋ Lavorazione</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delSottoComputo('${p.id}',${salN})" title="Torna alla quota attestata a mano">✕ Togli il sotto-computo</button>`}` })
}
/** La quota del corpo segue il sotto-computo: si riscrive a ogni modifica. */
function allineaQuotaSotto(salN: number, pid: string): void {
  const sal = salById(salN); const p = S.partite.find((x) => x.id === pid)
  if (!sal || !p) return
  const r = rigaFor(sal, pid)
  const q = quotaDaSottoComputo(p, r)
  if (q != null) r.quotaPct = q
}
function creaSottoComputo(pid: string, salN: number): void {
  if (salBloccato(salN)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  p.sottoComputo = p.sottoComputo || []
  if (!p.sottoComputo.length) p.sottoComputo.push({ id: uid(), descrizione: '', qty: null, prezzo: null })
  libExpanded.add(p.id)
  saveDraft(); reopenEditor()
  toast("Scomponi il corpo d'opera: la percentuale si misurerà sulle lavorazioni eseguite")
}
function addSottoVoce(pid: string, salN: number): void {
  if (salBloccato(salN)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  ;(p.sottoComputo = p.sottoComputo || []).push({ id: uid(), descrizione: '', qty: null, prezzo: null })
  saveDraft(); reopenEditor()
}
function setSottoVoce(pid: string, vid: string, campo: keyof VoceSottoComputo, v: string): void {
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  if (sottoComputoCongelato(p, S.sals)) { toast('La scomposizione è usata da un SAL firmato: non si modifica'); reopenEditor(); return }
  const voce = p.sottoComputo?.find((x) => x.id === vid); if (!voce) return
  if (campo === 'qty' || campo === 'prezzo') (voce as unknown as Record<string, number | null>)[campo] = leggiNumero(v)
  else (voce as unknown as Record<string, string>)[campo] = v
  for (const s of S.sals) if (!s.firmato) allineaQuotaSotto(s.numero, pid)
  saveDraft(); reopenEditor()
}
function setSottoEseguito(salN: number, pid: string, vid: string, v: string): void {
  if (salBloccato(salN)) return
  const sal = salById(salN); if (!sal) return
  const r = rigaFor(sal, pid)
  r.sotto = r.sotto || []
  let av = r.sotto.find((x) => x.voceId === vid)
  if (!av) { av = { voceId: vid }; r.sotto.push(av) }
  av.quantitaProgressiva = leggiNumero(v)
  allineaQuotaSotto(salN, pid)
  saveDraft(); reopenEditor()
}
function delSottoVoce(pid: string, vid: string, salN: number): void {
  if (salBloccato(salN)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  if (sottoComputoCongelato(p, S.sals)) { toast('La scomposizione è usata da un SAL firmato: non si modifica'); return }
  p.sottoComputo = (p.sottoComputo || []).filter((x) => x.id !== vid)
  for (const s of S.sals) { const r = s.righe.find((x) => x.partitaId === pid); if (r?.sotto) r.sotto = r.sotto.filter((x) => x.voceId !== vid) }
  for (const s of S.sals) if (!s.firmato) allineaQuotaSotto(s.numero, pid)
  saveDraft(); reopenEditor()
}
function delSottoComputo(pid: string, salN: number): void {
  if (salBloccato(salN)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  if (sottoComputoCongelato(p, S.sals)) { toast('Un SAL firmato dimostra la sua quota con questo sotto-computo: non si toglie'); return }
  delete p.sottoComputo
  for (const s of S.sals) { const r = s.righe.find((x) => x.partitaId === pid); if (r) delete r.sotto }
  saveDraft(); reopenEditor()
  toast('Sotto-computo rimosso: la quota torna attestata a mano')
}
/* ── UN'INTERFACCIA SOLA PER MISURARE, IN OGNI FASE ───────────────────────
   Misurare è lo stesso mestiere nel computo di progetto, nel libretto del SAL e
   nella perizia di variante: stessa tabella, stesse formule, stessi tasti, stesso
   trascinamento. Cambia solo DOVE finiscono le misure, e quello è il «contesto»:
   un numero = il SAL n, 'pz<n>' = la perizia n. Tutti i comandi delle misure
   parlano di contesto, così non esistono due interfacce da tenere allineate. */
type Contesto = number | string
interface ContenitoreMisure { misurazioni?: MisurazioneRiga[]; quantitaProgressiva?: number | null; qty?: number | null }
const periziaDiCtx = (c: Contesto): Perizia | undefined => (typeof c === 'string' && /^pz\d+$/.test(c) ? perziaByN(Number(c.slice(2))) : undefined)
/** Il contenitore delle misure di una voce nel contesto: riga del SAL o voce della perizia. */
function contenitoreMisure(ctx: Contesto, pid: string, crea = false): ContenitoreMisure | undefined {
  const pz = periziaDiCtx(ctx)
  if (pz) {
    let v = pz.voci.find((x) => x.partitaId === pid)
    if (!v && crea) { v = { partitaId: pid }; pz.voci.push(v) }
    return v
  }
  const s = salById(Number(ctx)); if (!s) return undefined
  return crea ? rigaFor(s, pid) : s.righe.find((x) => x.partitaId === pid)
}
/** Dopo una modifica alle misure: il contesto allinea ciò che da esse dipende. */
function allineaMisure(ctx: Contesto, c: ContenitoreMisure): void {
  if (periziaDiCtx(ctx)) { if (c.misurazioni?.length) c.qty = sommaMisurazioni(c.misurazioni) }
  else c.quantitaProgressiva = null // la somma delle misure guida il progressivo
}
/** Una perizia approvata non si misura più: prima si riporta in bozza. */
function periziaBloccata(pz: Perizia): boolean {
  if (!periziaApprovata(pz)) return false
  toast(`La perizia n. ${pz.numero} è approvata: riportala in bozza per modificarla`)
  return true
}
const ctxBloccato = (ctx: Contesto): boolean => { const pz = periziaDiCtx(ctx); return pz ? periziaBloccata(pz) : salBloccato(Number(ctx)) }
const ctxSoloLettura = (ctx: Contesto): boolean => { const pz = periziaDiCtx(ctx); return pz ? periziaApprovata(pz) : salFirmato(Number(ctx)) }
/** Il contesto scritto per un gestore inline: 2 per il SAL, 'pz1' per la perizia. */
const ctxLit = (ctx: Contesto): string => (typeof ctx === 'number' ? String(ctx) : `'${ctx}'`)

/* Sotto-riga a tutta larghezza: LE MISURE, con la stessa tabella, le stesse formule
   e gli stessi tasti del Computo (par.ug. × L1 × L2 × H). Serve al libretto del SAL
   e alla perizia: cambia solo il contesto in cui si scrive. */
function misureDettaglioHTML(ctx: Contesto, p: Partita, opt?: { titolo?: string; totale?: string }): string {
  const mis = contenitoreMisure(ctx, p.id)?.misurazioni || []
  const q = (x: string): string => x.replace(/'/g, "\\'")
  const pid = q(p.id)
  const c = ctxLit(ctx)
  const corpo = misureTabellaHtml({
    righe: mis,
    um: p.um,
    titolo: opt?.titolo || 'Libretto delle misure (par.ug. × L1 × L2 × H)',
    totale: opt?.totale || 'Totale a tutto il SAL',
    soloLettura: ctxSoloLettura(ctx),
    fmt: (n) => numFmt(n),
    vuoto: 'Nessuna misura: aggiungi una riga.',
    azioni: {
      set: (i, cc) => `setMisura(${c},'${pid}',${i},'${cc}',this.value)`,
      tasti: (i, cc) => `misKey(event,${c},'${pid}',${i},'${cc}')`,
      incollaQui: (i) => `misIncollaQui(event,${c},'${pid}',${i})`,
      fuoco: (i, cc) => `misFuoco(this,${c},'${pid}',${i},'${cc}')`,
      sfuoco: (i, cc) => `misSfuoco(this,${c},'${pid}',${i},'${cc}')`,
      duplica: (i) => `duplicaMisura(${c},'${pid}',${i})`,
      elimina: (i) => `delMisura(${c},'${pid}',${i})`,
      menu: (i) => `menuMisura(event,${c},'${pid}',${i})`,
      aggiungi: `addMisura(${c},'${pid}',false)`,
      detrazione: `addMisura(${c},'${pid}',true)`,
      copia: `copiaMisure('${pid}',${c})`,
      incolla: `incollaMisure(${c},'${pid}')`,
      trascina: {
        inizio: (i) => `misDragStart(event,${c},'${pid}',${i})`,
        fine: 'misDragEnd()',
        sopra: 'misDragOver(event,this)',
        esce: 'misDragLeave(this)',
        rilascia: (i) => `misDrop(event,${c},'${pid}',${i},this)`,
      },
    },
    extra: p.misurazioniProgetto?.length
      ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriMisureProgetto(${c},'${pid}')" title="Le misure con cui questa voce è stata computata in progetto: si prendono quelle realmente eseguite">↧ Misure di progetto (${p.misurazioniProgetto.length})</button>`
      : '',
  })
  const fase = typeof ctx === 'number' ? FASE_SAL : FASE_PERIZIA
  return rigaDettaglioHtml(fase, { classe: 'b-misure-row', attributi: `data-mis-key="${esc(p.id)}"`, conSelezione: true, contenuto: corpo })
}
/* Nel campo si vede il risultato; entrando si vede (e si corregge) la formula. */
function misRiga(ctx: Contesto, pid: string, i: number): MisurazioneRiga | undefined {
  return contenitoreMisure(ctx, pid)?.misurazioni?.[i]
}
function misFuoco(el: HTMLInputElement, ctx: Contesto, pid: string, i: number, campo: string): void {
  const v = valoreModificabile(misRiga(ctx, pid, i), campo as CampoMisura)
  if (el.value !== v) el.value = v
  el.dataset.orig = v
  el.select()
}
function misSfuoco(el: HTMLInputElement, ctx: Contesto, pid: string, i: number, campo: string): void {
  const m = misRiga(ctx, pid, i)
  if (el.value === el.dataset.orig || el.value === valoreModificabile(m, campo as CampoMisura)) el.value = valoreMostrato(m, campo as CampoMisura)
}
/* Tasti delle misure, uguali nel Computo, nel libretto e nella perizia. */
function misKey(ev: KeyboardEvent, ctx: Contesto, pid: string, i: number, campo: string): void {
  const el = ev.target as HTMLInputElement
  const vaiA = (idx: number, c: string): void => {
    const t = document.querySelector<HTMLInputElement>(`[data-mis-key="${pid}"] [data-mis-input="${idx}:${c}"]`)
    if (t) { t.focus(); t.select?.() }
  }
  if (ev.key === 'Escape') { el.blur(); toggleMisure(pid); return }
  if (ev.key === 'Enter') {
    ev.preventDefault(); el.dispatchEvent(new Event('change'))
    const r = contenitoreMisure(ctx, pid)
    if (r?.misurazioni && i === r.misurazioni.length - 1) { addMisura(ctx, pid, false); setTimeout(() => vaiA(i + 1, 'descrizione'), 0) } else vaiA(i + 1, campo)
    return
  }
  if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && !ev.shiftKey) {
    const giu = ev.key === 'ArrowDown'
    ev.preventDefault(); el.dispatchEvent(new Event('change'))
    if (ev.altKey) { spostaMisura(ctx, pid, i, giu ? 1 : -1); return }
    vaiA(i + (giu ? 1 : -1), campo); return
  }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); el.dispatchEvent(new Event('change')); duplicaMisura(ctx, pid, i); return }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); delMisura(ctx, pid, i) }
}
function spostaMisura(ctx: Contesto, pid: string, i: number, delta: number): void {
  if (ctxBloccato(ctx)) return
  const r = contenitoreMisure(ctx, pid)
  if (!r?.misurazioni) return
  spostaRiga(r.misurazioni, i, delta); allineaMisure(ctx, r); saveDraft(); reopenEditor()
}
function duplicaMisura(ctx: Contesto, pid: string, i: number): void {
  if (ctxBloccato(ctx)) return
  const r = contenitoreMisure(ctx, pid)
  if (!r?.misurazioni?.[i]) return
  r.misurazioni.splice(i + 1, 0, copiaRighe([r.misurazioni[i]])[0])
  allineaMisure(ctx, r); saveDraft(); reopenEditor()
}
let _misAppunti: MisurazioneRiga[] = []
function copiaMisure(pid: string, ctx: Contesto): void {
  const righe = contenitoreMisure(ctx, pid)?.misurazioni || []
  if (!righe.length) { toast('Nessuna riga da copiare'); return }
  _misAppunti = copiaRighe(righe)
  navigator.clipboard?.writeText(misureATesto(righe)).catch(() => undefined)
  toast(`${righe.length} righe copiate`)
}
async function incollaMisure(ctx: Contesto, pid: string): Promise<void> {
  if (ctxBloccato(ctx)) return
  let righe = _misAppunti
  try { const t = await navigator.clipboard?.readText(); if (t?.trim()) { const d = testoAMisure(t); if (d.length) righe = d } } catch { /* senza permesso restano gli appunti interni */ }
  if (!righe.length) { toast('Niente da incollare'); return }
  const r = contenitoreMisure(ctx, pid, true); if (!r) return
  r.misurazioni = [...(r.misurazioni || []), ...copiaRighe(righe)]
  allineaMisure(ctx, r)
  libExpanded.add(pid); saveDraft(); reopenEditor()
  toast(`${righe.length} righe incollate`)
}
/* Incolla da Excel dentro una cella: più righe → righe di misura in fondo. */
function misIncollaQui(ev: ClipboardEvent, ctx: Contesto, pid: string, i: number): void {
  const t = ev.clipboardData?.getData('text') || ''
  if (!t.includes('\t') && !t.includes('\n')) return
  ev.preventDefault()
  if (ctxBloccato(ctx)) return
  const d = testoAMisure(t); if (!d.length) return
  const r = contenitoreMisure(ctx, pid, true); if (!r) return
  r.misurazioni = [...(r.misurazioni || []).slice(0, i + 1), ...d, ...(r.misurazioni || []).slice(i + 1)]
  allineaMisure(ctx, r)
  saveDraft(); reopenEditor()
  toast(`${d.length} righe incollate`)
}
/* ── DATI DEL SAL ───────────────────────────────────────────────────────────
   Tutto ciò che in un avanzamento si scrive A MANO, in una schermata sola:
   detrazioni e revisione prezzi, firma del registro e riserve, date del
   certificato. Prima erano sparsi in tre atti — registro, SAL, certificato —
   che però sono DOCUMENTI: devono mostrare quello che verrà emesso, non
   chiedere dati. */
function editorDatiSal(f: Fase): string {
  const sal = salById(f.salNumero); if (!sal) return ''
  return conBlocco(sal, `${editorSalCorpo(f)}
    ${firmaRegistroHTML(sal)}
    <fieldset class="b-fieldset"><legend>Riserve dell'esecutore</legend>
      <p class="b-muted">Si iscrivono nel registro, e il contenzioso si perde sui termini: iscrizione nel primo atto idoneo, esplicitazione entro ${GIORNI_ESPLICITAZIONE} giorni, deduzioni del DL.</p>
      <div id="bRiserve">${riserveEditorHTML()}</div>
      <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:10px" onclick="addRiserva(${f.salNumero ?? 'undefined'})">＋ Iscrivi riserva</button>
    </fieldset>
    ${editorCertificatoCorpo(f)}`)
}

/** La nota che accompagna un'anteprima: dove si scrivono i dati che mostra. */
function anteprimaNota(tipo: string, f: Fase): string {
  const dove = f.salNumero != null ? 'Misurazioni' : 'Computo di variante'
  if (tipo === 'libretto') return `Copia esatta dell'atto che verrà emesso. Le misure si inseriscono in «${dove}».`
  if (tipo === 'registro') return 'Copia esatta dell\'atto. Il credito viene dalle misure; firma e riserve si scrivono in «Dati del SAL».'
  if (tipo === 'sal') return 'Copia esatta dell\'atto. Detrazioni, revisione e note si scrivono in «Dati del SAL».'
  if (tipo === 'certificato') return 'Copia esatta dell\'atto del RUP. Le date e la formula si scrivono in «Dati del SAL».'
  return `Copia esatta dell'atto che verrà emesso. Le quantità si scrivono in «${dove}».`
}
function editorSalCorpo(f: Fase): string {
  const res = calcolaSals(S.appalto, S.partite, S.sals, S.economia).find((s) => s.numero === f.salNumero)
  const sal = salById(f.salNumero)
  if (!res || !sal) return ''
  const row = (k: string, v: string): string => `<div class="b-sumrow"><span>${esc(k)}</span><b>${v}</b></div>`
  return `<p class="b-muted">Gli avanzamenti si inseriscono nel <b>Libretto</b> di questo SAL. Qui si controlla la cascata e si annotano detrazioni e note.</p>
    <div class="b-editrow"><label class="b-field"><span>Detrazioni non conformi €</span><input type="text" inputmode="decimal" value="${esc(numIn(sal.detrazioni))}" placeholder="0,00" onchange="setSalDetr(${sal.numero},this.value)"></label></div>
    ${S.appalto.revisione?.attiva ? `<div class="b-editrow">${fld(`Indice revisione prezzi del periodo (base ${S.appalto.revisione.indiceBase ?? '—'})`, sal.indiceRevisione, `setSalIndice(${sal.numero},this.value)`, 'number', 'es. 118,2')}
      <span class="b-muted">${res.variazioneIndicePct == null ? 'Senza indice nessuna revisione in questo SAL.' : `Variazione ${pctFmt(res.variazioneIndicePct)} %: ${res.revisioneSal ? 'revisione ' + eur(res.revisioneSal) + ' su questo SAL' : 'sotto la soglia, nessuna revisione'}.`}</span></div>` : ''}
    <div class="b-panel__body" id="bSalCasc">${row('Totale eseguito', eur(res.totaleEseguito)) + row('Detrazioni', '− ' + eur(res.detrazioni)) + (res.revisioneProgressiva ? row('Revisione prezzi (progressiva)', eur(res.revisioneProgressiva)) : '') + row('Ritenuta 0,50%', '− ' + eur(res.ritenuta)) + (res.anticipazione ? row('Recupero anticipazione (progressivo)', '− ' + eur(res.recuperoAnticipazione)) : '') + row('SAL precedenti', '− ' + eur(res.salPrecedenti)) + '<div class="b-sumrow b-kv--tot"><span>Importo del SAL (netto IVA)</span><b>' + eur(res.importoSal) + '</b></div>'}</div>
    <label class="b-field" style="margin-top:10px"><span>Note del SAL</span><textarea rows="2" oninput="setSalNote(${sal.numero},this.value)" placeholder="Annotazioni facoltative">${esc(sal.note || '')}</textarea></label>`
}
function editorCertificatoCorpo(f?: Fase): string {
  const sal = salById(f?.salNumero)
  return `${sal ? dateCertificatoHTML(sal) : ''}
    <fieldset class="b-fieldset"><legend>Formula del certificato</legend>
    <div class="b-grid">
      ${fld('Art. del capitolato richiamato', S.appalto.articoloCapitolato, "setApp('articoloCapitolato',this.value)")}
      ${fld('Data stipula (per la formula)', S.appalto.dataStipula, "setApp('dataStipula',this.value)", 'text', 'gg/mm/aaaa')}
    </div></fieldset>
    <p class="b-muted" style="font-size:var(--fs-xs)">Gli importi (credito, ritenuta, IVA, importo in lettere) sono calcolati dal SAL di riferimento.</p>`
}

/* Le due date che fanno la differenza fra una contabilità in regola e una in
   ritardo: il certificato va emesso entro sette giorni dal SAL e il pagamento
   di regola entro trenta. Si scrivono qui e finiscono sull'atto, nello
   scadenziario e, se in ritardo, nell'avviso. */
function dateCertificatoHTML(sal: Sal): string {
  const sc = scadenzeDelLavoro()
  const cert = sc.find((x) => x.id === `cert-${sal.numero}`)
  const pag = sc.find((x) => x.id === `pag-${sal.numero}`)
  const avviso = (x?: Scadenza): string => !x || x.stato === 'aperta' || x.stato === 'nonCalcolabile' ? ''
    : `<p class="b-avviso${x.stato === 'fatto' ? ' b-avviso--ok' : ''}">${esc(x.cosa)}: ${esc(x.nota)}</p>`
  return `<fieldset class="b-fieldset"><legend>Date e termini</legend>
    <div class="b-grid">
      <label class="b-field"><span>Numero del certificato</span><input type="number" value="${sal.numeroCertificato ?? sal.numero}" oninput="setSalCert(${sal.numero},'numeroCertificato',this.value)"></label>
      <label class="b-field"><span>Data del certificato (entro ${GIORNI_CERTIFICATO} gg dal SAL)</span><input value="${esc(sal.dataCertificato || '')}" placeholder="${esc(addDaysIt(sal.data, GIORNI_CERTIFICATO) || 'gg/mm/aaaa')}" oninput="setSalCert(${sal.numero},'dataCertificato',this.value)"></label>
      <label class="b-field"><span>Data del pagamento (mandato)</span><input value="${esc(sal.dataPagamento || '')}" placeholder="${esc(addDaysIt(sal.data, GIORNI_PAGAMENTO) || 'gg/mm/aaaa')}" oninput="setSalCert(${sal.numero},'dataPagamento',this.value)"></label>
    </div>
    ${avviso(cert)}${avviso(pag)}
  </fieldset>`
}
function editorGiornale(): string {
  const rows = S.giornale.map((g, i) => `<tr>
    <td><input value="${esc(g.data || '')}" placeholder="gg/mm" oninput="setGiornale(${i},'data',this.value)" style="width:80px"></td>
    <td><input value="${esc(g.meteo || '')}" placeholder="sereno" oninput="setGiornale(${i},'meteo',this.value)" style="width:90px"></td>
    <td><input value="${esc(g.manodopera || '')}" placeholder="n. operai" oninput="setGiornale(${i},'manodopera',this.value)"></td>
    <td><input value="${esc(g.mezzi || '')}" placeholder="mezzi/provviste" oninput="setGiornale(${i},'mezzi',this.value)"></td>
    <td><input value="${esc(g.lavorazioni || '')}" placeholder="lavorazioni del giorno" oninput="setGiornale(${i},'lavorazioni',this.value)"></td>
    <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delGiornale(${i})">✕</button></td></tr>`).join('')
  // gli atti del cantiere compaiono nella stampa alla loro data: qui si dice
  // quanti sono, così il DL sa che non deve ricopiarli a mano
  const atti = vociGiornale([], S.sals, S.verbali, S.riserve).length
  return `<div class="b-tablewrap"><table class="b-etable"><thead><tr><th>Data</th><th>Meteo</th><th>Manodopera</th><th>Mezzi/provviste</th><th>Lavorazioni</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="b-muted">Nessuna annotazione.</td></tr>'}</tbody></table></div>
    <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:10px" onclick="addGiornale()">＋ Giornata alla data corrente</button>
    ${atti ? `<p class="b-muted" style="margin:10px 0 0">Nella stampa si aggiungono da soli <b>${atti} atti</b> già redatti (verbali, stati di avanzamento, riserve), ciascuno alla sua data: non vanno ricopiati qui.</p>` : ''}`
}
/* ── IL REGISTRO DA VIDIMARE ───────────────────────────────────────────────
   Il registro è uno solo e le sue pagine vanno numerate PRIMA, non dopo: è
   quello che chiede l'art. 2215 c.c. e che nessun programma stampa. Qui si
   sceglie quanti fogli e si stampa il PDF: fogli veri, rigati e numerati, da
   bollare e far firmare prima dell'inizio dei lavori. */
function editorRegistroBianco(): string {
  return `<p class="b-muted">Il registro di contabilità è <b>uno solo</b>, a fogli numerati, bollati e vidimati <b>prima dell'inizio dei lavori</b> (art. 2215 c.c.). Questa stampa produce i fogli vuoti, già numerati e rigati: le partite si scriveranno sopra, avanzamento dopo avanzamento.</p>
    <fieldset class="b-fieldset"><legend>Quanti fogli</legend>
      <div class="b-grid">
        <label class="b-field"><span>Fogli da stampare</span><input type="number" min="1" max="500" value="${S.fogliRegistro}" oninput="setFogliRegistro(this.value)"></label>
      </div>
      <p class="b-muted" style="font-size:var(--fs-xs)">Meglio abbondare: un registro che finisce a metà lavori costringe a vidimarne un secondo. Il PDF si ottiene con «PDF da registro»; l'anteprima a schermo mostra solo la dichiarazione di vidimazione.</p>
    </fieldset>`
}
function setFogliRegistro(v: string): void {
  S.fogliRegistro = Math.max(1, Math.min(500, Math.floor(Number(v) || 1)))
  saveDraft(); renderTimeline()
}

/* ── IL REGISTRO E LE RISERVE ──────────────────────────────────────────────
   Qui si fa l'unica cosa che il registro chiede a mano: sottoporlo alla firma
   dell'esecutore e raccogliere le riserve. Il contenzioso si perde sui termini,
   non sul merito: iscrizione nel primo atto idoneo, esplicitazione entro
   quindici giorni, deduzioni del DL, conferma al conto finale. Il programma
   mostra le scadenze accanto a ogni riserva; non le inventa quando le date
   mancano. */
/** Riquadro della firma dell'esecutore sul registro: è ciò che apre i termini. */
function firmaRegistroHTML(sal: Sal): string {
  const f = sal.firmaEsecutore
  const opz = (v: FirmaEsecutore, t: string): string => `<option value="${v}"${f === v ? ' selected' : ''}>${esc(t)}</option>`
  const avviso = f === 'rifiutata'
    ? `<p class="b-avviso">L'esecutore ha rifiutato di firmare: il DL deve redigerne <b>verbale</b> e darne <b>immediata comunicazione</b> alla stazione appaltante (art. 7 All. II.14).
       <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="verbaleRifiutoFirma(${sal.numero})">Crea il verbale di rifiuto</button></p>`
    : f === 'conRiserva'
      ? `<p class="b-avviso">Firma con riserva: le riserve iscritte vanno <b>esplicitate entro ${GIORNI_ESPLICITAZIONE} giorni</b>${sal.dataFirmaEsecutore ? `, cioè entro il <b>${esc(addDaysIt(sal.dataFirmaEsecutore, GIORNI_ESPLICITAZIONE))}</b>` : ''}, a pena di decadenza.</p>`
      : f === 'senzaRiserve'
        ? `<p class="b-avviso b-avviso--ok">Registro accettato senza riserve: le partite contabilizzate a tutto questo avanzamento risultano riconosciute.</p>`
        : ''
  return `<fieldset class="b-fieldset"><legend>Sottoscrizione del registro</legend>
    <div class="b-grid">
      <label class="b-field"><span>Firma dell'esecutore</span>
        <select onchange="setFirmaEsecutore(${sal.numero}, this.value)">
          <option value=""${!f ? ' selected' : ''}>— non ancora sottoposto —</option>
          ${opz('senzaRiserve', 'sottoscritto senza riserve')}
          ${opz('conRiserva', 'sottoscritto con riserva')}
          ${opz('rifiutata', 'sottoscrizione rifiutata')}
        </select></label>
      <label class="b-field"><span>Data della firma (o del rifiuto)</span>
        <input value="${esc(sal.dataFirmaEsecutore || '')}" placeholder="gg/mm/aaaa" oninput="setDataFirmaEsecutore(${sal.numero}, this.value)"></label>
    </div>
    ${avviso}
  </fieldset>`
}

function riserveEditorHTML(): string {
  if (!S.riserve.length) return '<p class="b-muted">Nessuna riserva iscritta.</p>'
  return S.riserve.map((r, i) => {
    const st = statoRiserva(r, S.dataCorrenteISO)
    const grave = st.stato === 'decaduta'
    const esiti: Array<[EsitoRiserva, string]> = [['aperta', 'aperta'], ['definita', "definita in corso d'opera"], ['rinunciata', 'rinunciata'], ['decaduta', 'decaduta']]
    return `<fieldset class="b-fieldset">
      <legend>Riserva n. ${esc(String(r.numero))} <span class="b-np${grave ? '' : st.stato === 'esplicitata' || st.stato === 'definita' ? ' is-approvato' : ''}">${esc(RISERVA_LABEL[st.stato])}</span></legend>
      <label class="b-field"><span>Oggetto della riserva</span><input value="${esc(r.oggetto)}" placeholder="oggetto della riserva" oninput="setRiserva(${i},'oggetto',this.value)"></label>
      <div class="b-grid">
        <label class="b-field"><span>Iscritta il</span><input value="${esc(r.data || '')}" placeholder="gg/mm/aaaa" oninput="setRiserva(${i},'data',this.value)"></label>
        <label class="b-field"><span>SAL</span><input type="number" value="${r.salNumero ?? ''}" placeholder="n." oninput="setRiserva(${i},'salNumero',this.value)"></label>
        <label class="b-field"><span>Atto di iscrizione</span><input value="${esc(r.attoIscrizione || '')}" placeholder="Registro di contabilità al SAL n. …" oninput="setRiserva(${i},'attoIscrizione',this.value)"></label>
      </div>
      <div class="b-grid">
        <label class="b-field"><span>Esplicitata il (entro ${GIORNI_ESPLICITAZIONE} gg)</span><input value="${esc(r.dataEsplicitazione || '')}" placeholder="${esc(st.scadenza || 'gg/mm/aaaa')}" oninput="setRiserva(${i},'dataEsplicitazione',this.value)"></label>
        <label class="b-field"><span>Pretesa quantificata</span><input type="number" step="0.01" value="${r.importo ?? ''}" placeholder="€" oninput="setRiserva(${i},'importo',this.value)"></label>
        <label class="b-field"><span>Esito</span><select onchange="setRiserva(${i},'esito',this.value)">${esiti.map(([v, t]) => `<option value="${v}"${(r.esito || 'aperta') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      </div>
      <label class="b-field"><span>Domande e ragioni dell'esecutore (esplicitazione)</span><textarea rows="2" oninput="setRiserva(${i},'esplicitazione',this.value)" placeholder="che cosa chiede e perché">${esc(r.esplicitazione || '')}</textarea></label>
      <label class="b-field"><span>Deduzioni motivate del direttore dei lavori</span><textarea rows="2" oninput="setRiserva(${i},'controdeduzioni',this.value)" placeholder="valutazione del DL, da riportare sul registro">${esc(r.controdeduzioni || '')}</textarea></label>
      <label class="b-check"><input type="checkbox" ${r.confermataContoFinale ? 'checked' : ''} onchange="setRiservaConferma(${i}, this.checked)"> <span>confermata alla firma del conto finale</span></label>
      <p class="${grave ? 'b-avviso' : 'b-muted'}" style="font-size:var(--fs-xs)">${esc(st.nota)}
        <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delRiserva(${i})" title="Elimina la riserva">✕ elimina</button></p>
    </fieldset>`
  }).join('')
}

/* ── L'ULTIMO PASSAGGIO IN CUI UNA PRETESA PUÒ MORIRE ─────────────────────
   Il conto finale si firma entro il termine assegnato dal RUP, non superiore a
   trenta giorni, e in quella sede le riserve vanno confermate: chi non firma, o
   firma senza confermare, ha accettato. Qui si tengono le tre date e l'esito,
   e si vede subito quali riserve restano da confermare. */
function editorContoFinale(): string {
  const it = (S.appalto.contoFinale = S.appalto.contoFinale || {})
  const aperte = riserveAperte(S.riserve)
  const daConfermare = aperte.filter((r) => !r.confermataContoFinale)
  const esiti: Array<[string, string]> = [
    ['', '— non ancora sottoscritto —'],
    ['firmatoConConferma', 'sottoscritto, con conferma delle riserve'],
    ['firmatoSenzaConferma', 'sottoscritto senza confermare le domande'],
    ['nonFirmato', 'non sottoscritto nel termine'],
  ]
  return `<p class="b-muted">Il conto finale è derivato dagli atti a monte. Qui si registra l'iter della sua sottoscrizione, che è ciò che decide la sorte delle riserve.</p>
    <fieldset class="b-fieldset"><legend>Sottoscrizione (art. 7 c. 3)</legend>
    <div class="b-grid">
      <label class="b-field"><span>Compilato dal DL il</span><input value="${esc(it.dataCompilazione || '')}" placeholder="gg/mm/aaaa" oninput="setContoFinale('dataCompilazione',this.value)"></label>
      <label class="b-field"><span>Invito del RUP del</span><input value="${esc(it.dataInvito || '')}" placeholder="gg/mm/aaaa" oninput="setContoFinale('dataInvito',this.value)"></label>
      <label class="b-field"><span>Termine assegnato (max ${GIORNI_FIRMA_CONTO_FINALE} gg)</span><input type="number" value="${it.giorniTermine ?? GIORNI_FIRMA_CONTO_FINALE}" oninput="setContoFinale('giorniTermine',this.value)"></label>
      <label class="b-field"><span>Sottoscritto il</span><input value="${esc(it.dataFirma || '')}" placeholder="${esc(addDaysIt(it.dataInvito, Math.min(GIORNI_FIRMA_CONTO_FINALE, it.giorniTermine || GIORNI_FIRMA_CONTO_FINALE)) || 'gg/mm/aaaa')}" oninput="setContoFinale('dataFirma',this.value)"></label>
      <label class="b-field"><span>Esito</span><select onchange="setContoFinale('esito',this.value)">${esiti.map(([v, t]) => `<option value="${v}"${(it.esito || '') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    </div>
    ${it.dataInvito ? `<p class="b-avviso">Termine per la sottoscrizione: <b>${esc(addDaysIt(it.dataInvito, Math.min(GIORNI_FIRMA_CONTO_FINALE, it.giorniTermine || GIORNI_FIRMA_CONTO_FINALE)))}</b>. Oltre quella data, o con firma senza conferma delle domande, il conto finale si ha come definitivamente accettato dall'esecutore.</p>` : ''}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Riserve da confermare</legend>
    ${aperte.length
      ? `<p class="b-muted" style="font-size:var(--fs-xs)">Riserve iscritte e non definite: <b>${aperte.length}</b>, per ${eur(importoRiserveAperte(S.riserve))} di pretese quantificate.</p>
         ${aperte.map((r) => `<label class="b-check"><input type="checkbox" ${r.confermataContoFinale ? 'checked' : ''} onchange="setRiservaConferma(${S.riserve.indexOf(r)}, this.checked)"> <span><b>n. ${esc(String(r.numero))}</b> ${esc(r.oggetto || '—')}${r.importo != null ? ` · ${eur(r.importo)}` : ' · non quantificata'} — confermata alla firma</span></label>`).join('')}
         ${daConfermare.length ? `<p class="b-avviso">${daConfermare.length} riserv${daConfermare.length === 1 ? 'a' : 'e'} non ancora confermat${daConfermare.length === 1 ? 'a' : 'e'}: se il conto finale viene firmato così, si ${daConfermare.length === 1 ? 'ha' : 'hanno'} per abbandonat${daConfermare.length === 1 ? 'a' : 'e'}.</p>` : '<p class="b-avviso b-avviso--ok">Tutte le riserve aperte risultano confermate.</p>'}`
      : '<p class="b-muted" style="font-size:var(--fs-xs)">Nessuna riserva iscritta e non definita: non c\'è nulla da confermare.</p>'}
    </fieldset>`
}
function setContoFinale(campo: string, v: string): void {
  const it = (S.appalto.contoFinale = S.appalto.contoFinale || {})
  if (campo === 'giorniTermine') it.giorniTermine = v === '' ? null : Math.max(1, Math.min(GIORNI_FIRMA_CONTO_FINALE, Math.floor(Number(v) || GIORNI_FIRMA_CONTO_FINALE)))
  else if (campo === 'esito') it.esito = (v === 'firmatoConConferma' || v === 'firmatoSenzaConferma' || v === 'nonFirmato') ? v : undefined
  else (it as unknown as Record<string, string>)[campo] = v
  saveDraft(); renderScadenze()
  if (campo === 'esito' || campo === 'dataInvito' || campo === 'giorniTermine') reopenEditor()
}

/* ── LA FATTURA E IL VISTO ─────────────────────────────────────────────────
   Nella contabilità semplificata è il visto del DL a chiudere il giro, e può
   sostituire il certificato di regolare esecuzione. Ma «semplificata» non vuol
   dire «senza verifica»: il programma mette davanti lo scostamento fra ciò che
   è fatturato e ciò che risulta eseguito, perché è quella la verifica che la
   norma chiede. */
function editorFattura(id: string): string {
  const f = S.fatture.find((x) => x.id === id); if (!f) return ''
  const am = ammissibilitaSemplificata(S.appalto, S.partite)
  const c = corrispondenza(S.appalto, S.partite, S.sals, S.fatture, S.economia)
  const t = totaliFatture(S.fatture)
  const scostaTanto = Math.abs(c.scostamento) >= 0.005
  return `<fieldset class="b-fieldset"><legend>Fattura dell'impresa</legend>
      <div class="b-grid">
        <label class="b-field"><span>Numero</span><input value="${esc(f.numero || '')}" placeholder="es. 42/2026" oninput="setFattura('${id}','numero',this.value)"></label>
        <label class="b-field"><span>Data</span><input value="${esc(f.data || '')}" placeholder="gg/mm/aaaa" oninput="setFattura('${id}','data',this.value)"></label>
        <label class="b-field"><span>Importo imponibile €</span><input type="number" step="0.01" value="${f.importo ?? ''}" oninput="setFattura('${id}','importo',this.value)"></label>
      </div>
      <label class="b-field"><span>Oggetto (che cosa fattura)</span><input value="${esc(f.oggetto || '')}" placeholder="lavorazioni fatturate" oninput="setFattura('${id}','oggetto',this.value)"></label>
    </fieldset>
    <fieldset class="b-fieldset"><legend>Verifica della corrispondenza</legend>
      <div class="b-panel__body">
        <div class="b-sumrow"><span>Lavori contabilizzati</span><b>${eur(c.eseguito)}</b></div>
        <div class="b-sumrow"><span>Totale fatturato</span><b>${eur(t.fatturato)}</b></div>
        <div class="b-sumrow"><span>Di cui già vistato</span><b>${eur(t.vistato)}</b></div>
        <div class="b-sumrow b-kv--tot"><span>Scostamento</span><b>${c.scostamento === 0 ? 'nessuno' : (c.scostamento > 0 ? '+ ' : '− ') + eur(Math.abs(c.scostamento))}</b></div>
      </div>
      ${c.scostamento > 0.004 ? `<p class="b-avviso">Il fatturato eccede l'eseguito di ${eur(c.scostamento)}: il visto si appone solo per la parte corrispondente ai lavori effettivamente eseguiti.</p>` : scostaTanto ? `<p class="b-avviso b-avviso--ok">L'eseguito supera il fatturato di ${eur(-c.scostamento)}: resta da fatturare.</p>` : '<p class="b-avviso b-avviso--ok">Fatturato ed eseguito coincidono.</p>'}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Visto del direttore dei lavori</legend>
      <div class="b-grid">
        <label class="b-field"><span>Visto apposto il</span><input value="${esc(f.vistoData || '')}" placeholder="gg/mm/aaaa" oninput="setFattura('${id}','vistoData',this.value)"></label>
      </div>
      <label class="b-field"><span>Rilievi (se il visto non è pieno)</span><textarea rows="2" oninput="setFattura('${id}','rilievi',this.value)" placeholder="che cosa non corrisponde, e per quale importo">${esc(f.rilievi || '')}</textarea></label>
      <label class="b-check"><input type="checkbox" ${f.sostituisceCre ? 'checked' : ''} ${am.ammessa ? '' : 'disabled'} onchange="setFatturaCre('${id}', this.checked)"> <span>il visto <b>sostituisce il certificato di regolare esecuzione</b> (art. 12 c. 11-bis)</span></label>
      ${am.ammessa ? '' : `<p class="b-avviso">${esc(am.motivo)}</p>`}
    </fieldset>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delFattura('${id}')">✕ Elimina la fattura</button>`
}
function creaFattura(): void {
  const f: Fattura = { id: uid(), data: isoToIt(S.dataCorrenteISO), numero: '', importo: null }
  S.fatture.push(f)
  saveDraft(); renderAll(); openEditor(`fatt-${f.id}`, `fattura:${f.id}`)
}
function setFattura(id: string, campo: keyof Fattura, v: string): void {
  const f = S.fatture.find((x) => x.id === id); if (!f) return
  if (campo === 'importo') f.importo = leggiNumero(v)
  else (f as unknown as Record<string, string>)[campo] = v
  saveDraft()
  if (campo === 'importo' || campo === 'vistoData') reopenEditor()
  renderLeft(); renderTimeline()
}
function setFatturaCre(id: string, on: boolean): void { const f = S.fatture.find((x) => x.id === id); if (!f) return; f.sostituisceCre = on || undefined; saveDraft(); reopenEditor() }
function delFattura(id: string): void {
  const prodotto = S.consegne.some((c) => c.tipo === `fattura:${id}`)
  if (prodotto) { toast('Il visto è già stato emesso: la fattura resta negli atti'); return }
  S.fatture = S.fatture.filter((x) => x.id !== id)
  saveDraft(); closeModal(); renderAll(); toast('Fattura eliminata')
}

function editorRelazione(): string { return `<label class="b-field"><span>Vicende dell'esecuzione (testo libero, un paragrafo per riga)</span><textarea rows="8" oninput="setRelazione(this.value)" placeholder="Descrizione dell'andamento dei lavori, sospensioni, proroghe, varianti…">${esc(S.relazione)}</textarea></label><p class="b-muted" style="font-size:var(--fs-xs)">Le riserve non transatte e i verbali prodotti (allegati) sono riportati automaticamente.</p>` }

/* Editor di un verbale/comunicazione del DL: campi comuni + campi per-tipo. */
function editorVerbale(id: string): string {
  const v = S.verbali.find((x) => x.id === id); if (!v) return `<p class="b-muted">Atto non trovato.</p>`
  const t = v.tipo
  let extra = ''
  if (t === 'consegna') {
    const opt = (val: string, lab: string): string => `<label style="margin-right:12px"><input type="radio" name="bvmod" value="${val}"${(v.consegnaMod || 'unica') === val ? ' checked' : ''} onchange="setVerb('${id}','consegnaMod',this.value)"> ${esc(lab)}</label>`
    extra = `<div class="b-import-mode" style="margin-top:4px">Modalità: ${opt('unica', 'unica')}${opt('parziale', 'parziale')}${opt('urgenza', "in via d'urgenza")}</div>`
  } else if (t === 'sospensione') {
    extra = `<div class="b-grid">${fld('Causa della sospensione', v.motivo, `setVerb('${id}','motivo',this.value)`, 'text', 'es. avverse condizioni meteo')}${fld('Durata stimata (giorni)', v.giorniDurata, `setVerb('${id}','giorniDurata',this.value)`, 'number', '0')}</div>`
  } else if (t === 'proroga') {
    extra = `<div class="b-grid">${fld('Giorni concessi', v.giorniProroga, `setVerb('${id}','giorniProroga',this.value)`, 'number', 'es. 30')}${fld('Istanza dell\'esecutore del', v.oggetto, `setVerb('${id}','oggetto',this.value)`, 'text', 'gg/mm/aaaa o riferimento')}</div><p class="b-muted" style="margin:4px 0 0">I giorni concessi spostano il termine vigente per l'ultimazione, e con esso il calcolo dell'eventuale ritardo.</p>`
  } else if (t === 'ripresa') {
    extra = `<div class="b-grid">${fld('Giorni residui contrattuali', v.giorniDurata, `setVerb('${id}','giorniDurata',this.value)`, 'number', '0')}</div>`
  }
  return `<div class="b-grid">
      ${fld('Data (gg/mm/aaaa)', v.data, `setVerb('${id}','data',this.value)`, 'text', 'gg/mm/aaaa')}
      ${fld('Numero', v.numero, `setVerb('${id}','numero',this.value)`, 'number', '1')}
    </div>
    ${fld('Oggetto dell\'atto', v.oggetto, `setVerb('${id}','oggetto',this.value)`, 'text', 'sintesi dell\'oggetto')}
    ${extra}
    <label class="b-field" style="margin-top:8px"><span>Contenuto (testo libero, un paragrafo per riga)</span><textarea rows="6" oninput="setVerb('${id}','testo',this.value)" placeholder="Descrizione dei fatti, disposizioni, accertamenti…">${esc(v.testo || '')}</textarea></label>
    <div style="margin-top:10px"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delVerbale('${id}')" title="Elimina l'atto">🗑 Elimina l'atto</button></div>`
}
function setVerb(id: string, campo: string, v: string): void {
  const atto = S.verbali.find((x) => x.id === id); if (!atto) return
  if (campo === 'numero' || campo === 'giorniDurata' || campo === 'giorniProroga') (atto as unknown as Record<string, number | null>)[campo] = v === '' ? null : leggiNumero(v)
  else (atto as unknown as Record<string, string>)[campo] = v
  saveDraft()
  if (campo === 'data' || campo === 'numero') { renderLeft(); renderTimeline() }
}
function delVerbale(id: string): void {
  S.verbali = S.verbali.filter((x) => x.id !== id)
  S.consegne = S.consegne.filter((c) => c.tipo !== `verbale:${id}`)
  saveDraft(); closeModal(); renderAll()
  toast('Atto eliminato')
}

/* ── Editor della lista in economia (operai · mezzi · provviste) ─────────── */
const impOperaio = (r: RigaOperaio): number => (r.ore || 0) * (r.tariffaOraria || 0)
const impMezzo = (r: RigaMezzo): number => (r.ore || 0) * (r.tariffaOraria || 0)
const impProvvista = (r: RigaProvvista): number => (r.quantita || 0) * (r.prezzoUnitario || 0)
function listaTotaliHTML(l: ListaEconomia): string {
  const v = valorizzaLista(l)
  const row = (k: string, x: string): string => `<div class="b-sumrow"><span>${esc(k)}</span><b>${x}</b></div>`
  return row('Mano d\'opera', eur(v.manodopera)) + row('Mezzi e noli', eur(v.noli)) + row('Provviste', eur(v.provviste)) + `<div class="b-sumrow b-kv--tot"><span>Totale in economia</span><b>${eur(v.totale)}</b></div>`
}
function editorLista(id: string): string {
  const l = S.economia.find((x) => x.id === id); if (!l) return '<p class="b-muted">Lista non trovata.</p>'
  const stornata = l.soppressaSal != null
  const operai = (l.operai || []).map((r, i) => `<tr>
      <td><input value="${esc(r.qualifica || '')}" placeholder="qualifica" oninput="setOperaio('${id}',${i},'qualifica',this.value)"></td>
      <td><input value="${esc(r.lavorazione || '')}" placeholder="lavorazione" oninput="setOperaio('${id}',${i},'lavorazione',this.value)"></td>
      <td><input type="number" step="0.5" value="${r.ore ?? ''}" placeholder="ore" oninput="setOperaio('${id}',${i},'ore',this.value)" style="width:70px"></td>
      <td>€ <input type="number" step="0.01" value="${r.tariffaOraria ?? ''}" placeholder="tariffa" oninput="setOperaio('${id}',${i},'tariffaOraria',this.value)" style="width:80px"></td>
      <td class="b-num" id="blo-${id}-${i}">${eur(impOperaio(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delOperaio('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const mezzi = (l.mezzi || []).map((r, i) => `<tr>
      <td><input value="${esc(r.descrizione || '')}" placeholder="mezzo / nolo" oninput="setMezzo('${id}',${i},'descrizione',this.value)"></td>
      <td><input type="number" step="0.5" value="${r.ore ?? ''}" placeholder="ore" oninput="setMezzo('${id}',${i},'ore',this.value)" style="width:70px"></td>
      <td>€ <input type="number" step="0.01" value="${r.tariffaOraria ?? ''}" placeholder="tariffa" oninput="setMezzo('${id}',${i},'tariffaOraria',this.value)" style="width:80px"></td>
      <td class="b-num" id="blm-${id}-${i}">${eur(impMezzo(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delMezzo('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const provviste = (l.provviste || []).map((r, i) => `<tr>
      <td><input value="${esc(r.descrizione || '')}" placeholder="provvista / materiale" oninput="setProvvista('${id}',${i},'descrizione',this.value)"></td>
      <td><input value="${esc(r.um || '')}" placeholder="u.m." oninput="setProvvista('${id}',${i},'um',this.value)" style="width:64px"></td>
      <td><input type="number" step="0.01" value="${r.quantita ?? ''}" placeholder="qtà" oninput="setProvvista('${id}',${i},'quantita',this.value)" style="width:80px"></td>
      <td>€ <input type="number" step="0.01" value="${r.prezzoUnitario ?? ''}" placeholder="prezzo" oninput="setProvvista('${id}',${i},'prezzoUnitario',this.value)" style="width:80px"></td>
      <td class="b-num" id="blp-${id}-${i}">${eur(impProvvista(r))}</td>
      <td><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delProvvista('${id}',${i})">✕</button></td>
    </tr>`).join('')
  const tbl = (head: string, rows: string, add: string, cols: number): string =>
    `<div class="b-tablewrap" style="margin-top:8px"><table class="b-etable"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="${cols}" class="b-muted">Nessuna riga.</td></tr>`}</tbody></table></div>${add}`
  return `${stornata ? `<p class="note" style="border-left-color:#b02a7a">Lista soppressa e portata in detrazione al SAL ${esc(String(l.soppressaSal))} (storno). <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="annullaStornoLista('${id}')">↺ annulla storno</button></p>` : ''}
    <div class="b-grid">
      ${fld('Settimana (gg/mm/aaaa)', l.data, `setLista('${id}','data',this.value)`, 'text', 'gg/mm/aaaa')}
      ${fld('SAL di competenza', l.salNumero, `setLista('${id}','salNumero',this.value)`, 'number', '1')}
      ${fld('Ordine di servizio (rif.)', l.ordineRef, `setLista('${id}','ordineRef',this.value)`, 'text', 'OdS n. …')}
    </div>
    <fieldset class="b-fieldset"><legend>Mano d'opera</legend>
      ${tbl('<tr><th>Qualifica</th><th>Lavorazione</th><th>Ore</th><th>Tariffa €/h</th><th class="b-num">Importo</th><th></th></tr>', operai, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addOperaio(\'' + id + '\')">＋ operaio</button>', 6)}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Mezzi d'opera e noli</legend>
      ${tbl('<tr><th>Mezzo / nolo</th><th>Ore</th><th>Tariffa €/h</th><th class="b-num">Importo</th><th></th></tr>', mezzi, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addMezzo(\'' + id + '\')">＋ mezzo / nolo</button>', 5)}
    </fieldset>
    <fieldset class="b-fieldset"><legend>Provviste</legend>
      ${tbl('<tr><th>Provvista</th><th>U.M.</th><th>Quantità</th><th>Prezzo €</th><th class="b-num">Importo</th><th></th></tr>', provviste, '<button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" style="margin-top:8px" onclick="addProvvista(\'' + id + '\')">＋ provvista</button>', 6)}
    </fieldset>
    <div class="b-panel__body" id="bl-tot-${id}" style="margin-top:8px">${listaTotaliHTML(l)}</div>
    <label class="b-field" style="margin-top:8px"><span>Note</span><textarea rows="2" oninput="setLista('${id}','note',this.value)" placeholder="Annotazioni facoltative">${esc(l.note || '')}</textarea></label>
    <div style="margin-top:10px"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="delLista('${id}')" title="Elimina / storna la lista">🗑 Elimina lista</button></div>`
}
function refreshListaTot(id: string): void { const l = S.economia.find((x) => x.id === id); const box = $(`bl-tot-${id}`); if (l && box) box.innerHTML = listaTotaliHTML(l); renderLeft(); renderTimeline() }
function setLista(id: string, campo: keyof ListaEconomia, v: string): void {
  const l = S.economia.find((x) => x.id === id); if (!l) return
  if (campo === 'salNumero') { l.salNumero = v === '' ? undefined : Number(v); if (S.editor) S.editor.fase = `sal-${l.salNumero}`; saveDraft(); renderAll(); reopenEditor(); return }
  ;(l as unknown as Record<string, string>)[campo] = v
  saveDraft()
  if (campo === 'data') { renderLeft(); renderTimeline() }
}
function addOperaio(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.operai.push({}); saveDraft(); reopenEditor() }
function addMezzo(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.mezzi.push({ descrizione: '' }); saveDraft(); reopenEditor() }
function addProvvista(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.provviste.push({ descrizione: '' }); saveDraft(); reopenEditor() }
function delOperaio(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.operai.splice(i, 1); saveDraft(); reopenEditor() }
function delMezzo(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.mezzi.splice(i, 1); saveDraft(); reopenEditor() }
function delProvvista(id: string, i: number): void { const l = S.economia.find((x) => x.id === id); if (!l) return; l.provviste.splice(i, 1); saveDraft(); reopenEditor() }
function setOperaio(id: string, i: number, campo: keyof RigaOperaio, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.operai[i]; if (!r) return
  if (campo === 'ore' || campo === 'tariffaOraria') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blo-${id}-${i}`); if (c) c.textContent = eur(impOperaio(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function setMezzo(id: string, i: number, campo: keyof RigaMezzo, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.mezzi[i]; if (!r) return
  if (campo === 'ore' || campo === 'tariffaOraria') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blm-${id}-${i}`); if (c) c.textContent = eur(impMezzo(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function setProvvista(id: string, i: number, campo: keyof RigaProvvista, v: string): void {
  const l = S.economia.find((x) => x.id === id); const r = l?.provviste[i]; if (!r) return
  if (campo === 'quantita' || campo === 'prezzoUnitario') { (r as unknown as Record<string, number | null>)[campo] = v === '' ? null : Number(v); const c = $(`blp-${id}-${i}`); if (c) c.textContent = eur(impProvvista(r)); refreshListaTot(id) }
  else (r as unknown as Record<string, string>)[campo] = v
  saveDraft()
}
function delLista(id: string): void {
  const l = S.economia.find((x) => x.id === id); if (!l) return
  const salN = l.salNumero ?? 1
  const prodotto = S.consegne.some((c) => c.tipo === 'libretto' && (c.salNumero ?? 0) >= salN)
  if (!prodotto) { S.economia = S.economia.filter((x) => x.id !== id); saveDraft(); closeModal(); renderAll(); toast('Lista eliminata (non ancora contabilizzata)') }
  else { l.soppressaSal = salN; saveDraft(); renderAll(); reopenEditor(); toast(`Lista soppressa e portata in detrazione al SAL ${salN} (storno): resta a verbale`) }
}
function annullaStornoLista(id: string): void { const l = S.economia.find((x) => x.id === id); if (!l) return; delete l.soppressaSal; saveDraft(); renderAll(); reopenEditor(); toast('Storno annullato') }

/* ── Setter dell'editor ─────────────────────────────────────────────────── */
function setSalQta(n: number, pid: string, v: string): void { if (salBloccato(n)) return; const s = salById(n); if (!s) return; rigaFor(s, pid).quantitaProgressiva = leggiNum(v); saveDraft(); refreshCascata(n) }
function setSalQuota(n: number, pid: string, v: string): void { if (salBloccato(n)) return; const s = salById(n); if (!s) return; rigaFor(s, pid).quotaPct = v === '' ? null : Math.max(0, Math.min(100, Number(v))); saveDraft(); refreshCascata(n) }
function setPrezzo(pid: string, v: string): void { if (S.sals.some((x) => x.firmato)) { toast('Ci sono SAL firmati: il prezzo di una voce già contabilizzata non si cambia (si concorda un nuovo prezzo)'); reopenEditor(); return } const p = S.partite.find((x) => x.id === pid); if (!p) return; p.prezzoUnitario = leggiNum(v); saveDraft(); renderLeft() }
function setSalData(n: number, v: string): void { if (salBloccato(n)) return; const s = salById(n); if (!s) return; s.data = v; saveDraft(); renderOra() }
function setSalDetr(n: number, v: string): void { if (salBloccato(n)) return; const s = salById(n); if (!s) return; s.detrazioni = leggiNum(v); saveDraft(); refreshCascata(n) }
function setSalCert(n: number, campo: 'dataCertificato' | 'dataPagamento' | 'numeroCertificato', v: string): void {
  const s = salById(n); if (!s) return
  if (campo === 'numeroCertificato') s.numeroCertificato = v === '' ? null : Math.max(1, Math.floor(Number(v) || 1))
  else s[campo] = v
  saveDraft(); renderScadenze(); reopenEditor()
}
function setSalNote(n: number, v: string): void { const s = salById(n); if (!s) return; s.note = v; saveDraft() }
function refreshCascata(n: number): void { const box = $('bSalCasc'); if (!box || !S.editor || S.editor.tipo !== 'sal') return; const res = calcolaSals(S.appalto, S.partite, S.sals).find((s) => s.numero === n); if (!res) return; const row = (k: string, v: string) => `<div class="b-sumrow"><span>${esc(k)}</span><b>${v}</b></div>`; box.innerHTML = row('Totale eseguito', eur(res.totaleEseguito)) + row('Detrazioni', '− ' + eur(res.detrazioni)) + row('Ritenuta 0,50%', '− ' + eur(res.ritenuta)) + row('SAL precedenti', '− ' + eur(res.salPrecedenti)) + `<div class="b-sumrow b-kv--tot"><span>Importo del SAL (netto IVA)</span><b>${eur(res.importoSal)}</b></div>` }
function rigeneraDaComputo(n: number): void { if (salBloccato(n)) return; const s = salById(n); if (!s) return; seedPrimoLibretto(s); saveDraft(); reopenEditor(); toast('Libretto rigenerato dalle quantità del computo') }
function addVoce(salN?: number): void {
  const codice = val('bnv-cod').trim(), desc = val('bnv-desc').trim()
  if (!codice && !desc) { toast('Inserisci almeno codice o descrizione'); return }
  const mod = (val('bnv-mod') === 'corpo' ? 'corpo' : 'misura') as Modalita
  const prezzo = val('bnv-prezzo') === '' ? null : Number(val('bnv-prezzo'))
  // La voce compare dal SAL in cui è introdotta: non retroagisce sui libretti già prodotti.
  const introdottaSal = salN ?? 1
  const base = { id: uid(), codice, descrizione: desc, um: val('bnv-um').trim(), introdottaSal }
  const p: Partita = mod === 'corpo'
    ? { ...base, modalita: 'corpo', importoContrattuale: prezzo }
    : { ...base, modalita: 'misura', prezzoUnitario: prezzo, qtyProgetto: null }
  S.partite.push(p); saveDraft(); renderLeft(); reopenEditor()
  toast(introdottaSal > 1 ? `Nuovo prezzo aggiunto dal SAL ${introdottaSal}` : 'Voce aggiunta')
}
/* Contabilità senza computo: si apre il primo SAL e si va dritti al libretto,
   dove le voci si creano come in un computo (libere o dall'elenco prezzi). */
function partiDaZero(): void {
  closeModal()
  if (!S.sals.length) nuovoSalOggi()
  const n = S.sals.length ? Math.min(...S.sals.map((x) => x.numero)) : 1
  const f = fasi().find((x) => x.salNumero === n && x.docs.some((d) => d.tipo === 'libretto'))
  if (f) openEditor(f.key, 'libretto')
  toast('Contabilità da zero: crea le voci qui, libere o dall\'elenco prezzi')
}

/* Il prezzo della contabilità è quello di CONTRATTO. Se in libretto è stato
   cambiato, la voce lo dice e offre il ritorno: non è un dettaglio estetico,
   è la differenza fra contabilizzare in contratto e fuori contratto. */
function scostamentoPrezzoHtml(p: Partita): string {
  const c = p.prezzoContratto
  if (c == null || p.prezzoUnitario == null || Math.abs(c - p.prezzoUnitario) < 0.005) return ''
  return `<span class="b-fuori" title="Prezzo di contratto: ${eur(c)}">· fuori contratto <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="ripristinaPrezzoContratto('${p.id}')" title="Riporta il prezzo di contratto">↺ ${eur(c)}</button></span>`
}
function ripristinaPrezzoContratto(pid: string): void {
  const p = S.partite.find((x) => x.id === pid); if (!p || p.prezzoContratto == null) return
  p.prezzoUnitario = p.prezzoContratto
  saveDraft(); renderLeft(); reopenEditor()
  toast('Ripristinato il prezzo di contratto')
}

/* La perizia a cui agganciare i nuovi prezzi: l'ultima dichiarata. Se non ce
   n'è ancora nessuna, il NP resta «in formazione» e si aggancia più tardi. */
function periziaCorrente(): Perizia | undefined {
  const pz = S.appalto.perizie || []
  if (!pz.length) return undefined
  const aperta = [...pz].reverse().find((p) => !periziaApprovata(p))
  return aperta || pz[pz.length - 1]
}

/* ── Nuovi prezzi: numero, iter, derivazione ──────────────────────────────
   Un NP non è una voce qualunque: ha un numero progressivo, una derivazione da
   dichiarare (assimilazione, prezzario, analisi) e un iter — bozza, concordato
   col verbale, approvato con la perizia. Finché non è approvato si contabilizza
   in conto provvisorio. */
function assimilaVoce(salN: number, pid: string): void {
  if (salBloccato(salN)) return
  const voce = S.partite.find((x) => x.id === pid); if (!voce) return
  const { partita } = assimila(S.partite, voce, periziaCorrente()?.numero ?? null)
  const p: Partita = { ...partita, id: uid(), introdottaSal: salN }
  S.partite.push(p)
  const s = salById(salN)
  if (s) { const r = rigaFor(s, p.id); r.misurazioni = [{ descrizione: '', quantita: 0 }]; r.quantitaProgressiva = null }
  libExpanded.add(p.id)
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
  toast(`${p.codice}: nuovo prezzo per assimilazione da «${voce.codice}» — adatta descrizione e prezzo`)
}
/** Avanza (o riporta indietro) l'iter del nuovo prezzo. */
function statoNP(pid: string, stato: string): void {
  const p = S.partite.find((x) => x.id === pid); if (!p?.np) return
  p.np.stato = stato as StatoNuovoPrezzo
  if (stato === 'concordato' && !p.np.dataConcordamento) p.np.dataConcordamento = isoToIt(S.dataCorrenteISO)
  if (stato === 'approvato' && p.np.periziaN == null) p.np.periziaN = periziaCorrente()?.numero ?? null
  saveDraft(); renderLeft(); reopenEditor(); disegnaCassetto()
  toast(`${p.codice}: ${STATO_NP[p.np.stato]}`)
}
function setNPCampo(pid: string, campo: 'motivazione' | 'base' | 'ribassoPct' | 'origine', v: string): void {
  const p = S.partite.find((x) => x.id === pid); if (!p?.np) return
  if (campo === 'motivazione') p.np.motivazione = v
  else if (campo === 'origine') p.np.origine = v as typeof p.np.origine
  else if (campo === 'base') { p.np.base = { ...(p.np.base || {}), prezzo: leggiNum(v) }; p.prezzoUnitario = prezzoNP(p.np.base.prezzo, p.np.ribassoPct) }
  else { p.np.ribassoPct = leggiNum(v); p.prezzoUnitario = prezzoNP(p.np.base?.prezzo, p.np.ribassoPct) }
  saveDraft(); renderLeft(); reopenEditor()
}
/** Scheda del nuovo prezzo: derivazione, ribasso, iter, motivazione. */
function apriNP(pid: string, salN: number): void {
  const p = S.partite.find((x) => x.id === pid); if (!p?.np) return
  const np = p.np
  const bloccato = salFirmato(salN)
  const opz = (v: string, et: string, sel: string): string => `<option value="${v}"${sel === v ? ' selected' : ''}>${et}</option>`
  modal(`<div class="b-modal__h">${esc(p.codice)} <span class="b-muted" style="font-weight:400">— nuovo prezzo n. ${np.numero}</span></div>
    <div class="b-modal__scroll">
      <p class="b-muted" style="margin:0 0 10px">Una lavorazione non prevista in contratto si determina in contraddittorio e si assoggetta al <b>medesimo ribasso contrattuale</b>. Finché non è approvata con la perizia, le sue quantità si contabilizzano <b>in conto provvisorio</b>.</p>
      <div class="b-editrow">
        <label class="b-field"><span>Derivazione</span><select onchange="setNPCampo('${p.id}','origine',this.value)" ${bloccato ? 'disabled' : ''}>
          ${opz('assimilazione', 'per assimilazione da voce di contratto', np.origine)}${opz('prezzario', 'desunto dal prezzario', np.origine)}${opz('analisi', 'da nuova analisi', np.origine)}</select></label>
        <label class="b-field"><span>Iter</span><select onchange="statoNP('${p.id}',this.value)" ${bloccato ? 'disabled' : ''}>
          ${opz('bozza', 'in bozza', np.stato)}${opz('concordato', 'concordato (verbale)', np.stato)}${opz('approvato', 'approvato (perizia)', np.stato)}</select></label>
      </div>
      <div class="b-editrow">
        <label class="b-field"><span>Prezzo base €</span><input type="text" inputmode="decimal" value="${esc(numIn(np.base?.prezzo))}" onchange="setNPCampo('${p.id}','base',this.value)" ${bloccato ? 'disabled' : ''}></label>
        <label class="b-field"><span>Ribasso %</span><input type="text" inputmode="decimal" value="${esc(numIn(np.ribassoPct))}" onchange="setNPCampo('${p.id}','ribassoPct',this.value)" ${bloccato ? 'disabled' : ''}></label>
        <label class="b-field"><span>Prezzo risultante</span><input value="${eur(p.prezzoUnitario)}" readonly></label>
      </div>
      ${np.base?.codice || np.base?.fonte ? `<p class="b-muted" style="font-size:var(--fs-xs)">Derivato da <b>${esc(np.base?.codice || '')}</b>${np.base?.fonte ? ` · ${esc(np.base.fonte)}` : ''}${np.base?.descrizione ? `<br>${esc(np.base.descrizione)}` : ''}</p>` : ''}
      ${np.origine === 'analisi' ? `<p class="b-muted" style="font-size:var(--fs-xs)">L'analisi del prezzo (manodopera, materiali, noli, spese generali e utile) si compone nel Computo, nella stessa schermata del compositore: <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="componiAnalisiNelComputo()" title="Apre il Computo sull'analisi del prezzo">Σ Componi l'analisi…</button> Il prezzo risultante si riporta qui, già al netto del ribasso.</p>` : ''}
      <label class="b-field"><span>Motivazione (va nel verbale)</span><input value="${esc(np.motivazione || '')}" placeholder="perché la lavorazione si rende necessaria" onchange="setNPCampo('${p.id}','motivazione',this.value)" ${bloccato ? 'disabled' : ''}></label>
      ${np.periziaN != null ? `<p class="b-muted" style="font-size:var(--fs-xs)">Introdotto dalla perizia n. ${np.periziaN}.</p>` : '<p class="b-muted" style="font-size:var(--fs-xs)">Nessuna perizia dichiarata: il nuovo prezzo vi si aggancia quando la crei.</p>'}
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Chiudi</button></div>`, true)
}

/* ── Voce libera ──────────────────────────────────────────────────────────
   Come nel computo: capita di avere prima la misura. Si apre una riga vuota, ci
   si fissa la quantità, e l'articolo (dall'elenco prezzi o scritto a mano) si
   assegna dopo — la voce resta la stessa, le misure non si toccano. */
function addVoceLibera(salN: number): void {
  if (salBloccato(salN)) return
  const p: Partita = { id: uid(), modalita: 'misura', codice: '', descrizione: '', um: '', prezzoUnitario: null, qtyProgetto: null, introdottaSal: salN }
  S.partite.push(p)
  const s = salById(salN)
  if (s) { const r = rigaFor(s, p.id); r.misurazioni = [{ descrizione: '', quantita: 0 }]; r.quantitaProgressiva = null }
  libExpanded.add(p.id)
  saveDraft(); renderLeft(); reopenEditor()
  toast('Voce libera: misurala, l\'articolo lo assegni dopo')
}
const voceDaDefinire = (p: Partita): boolean => !p.codice.trim() && !p.descrizione.trim()

let _voceEdit: { pid: string; salN: number; trovate: PriceRow[] } | null = null
/** Scheda della voce: codice, descrizione, unità, prezzo — con la ricerca nel prezzario. */
function apriVoceEdit(pid: string, salN: number): void {
  if (!S.partite.some((x) => x.id === pid)) return
  _voceEdit = { pid, salN, trovate: [] }
  disegnaVoceEdit()
}
function risultatiVoceEditHTML(): string {
  const ris = _voceEdit?.trovate || []
  if (!ris.length) return ''
  return `<div class="b-tablewrap"><table class="b-etable"><tbody>${ris.map((r, i) => `<tr><td class="b-mono">${esc(r.codice)}</td><td><span class="b-desc-clamp" title="${esc(r.declaratoria || r.desc_short)}">${esc(r.desc_short || r.declaratoria)}</span></td><td class="b-mono">${esc(r.um || '')}</td><td class="b-num">${eur(r.prezzo)}</td><td><button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" onclick="prendiVoceEdit(${i})" title="Riempi i campi con questa voce">usa</button></td></tr>`).join('')}</tbody></table></div>`
}
function disegnaVoceEdit(): void {
  if (!_voceEdit) return
  const p = S.partite.find((x) => x.id === _voceEdit!.pid); if (!p) return
  const lista = _prezzari
  modal(`<div class="b-modal__h">${voceDaDefinire(p) ? 'Assegna la voce' : 'Modifica la voce'} <span class="b-muted" style="font-weight:400">— le misure restano dove sono</span></div>
    <div class="b-modal__scroll">
      ${lista.length ? `<label class="b-field"><span>Cerca nel prezzario (riempie i campi qui sotto)</span><input id="bveQ" type="search" placeholder="codice o parole (es. intonaco civile)" oninput="cercaVoceEdit(this.value)" autocomplete="off"></label>
      <div id="bveRis">${risultatiVoceEditHTML()}</div>` : '<p class="b-muted">Nessun prezzario nell\'archivio: scrivi la voce a mano.</p>'}
      <div class="b-grid" style="margin-top:10px">
        <label class="b-field"><span>Codice</span><input id="bve-cod" value="${esc(p.codice)}" placeholder="NP.01"></label>
        <label class="b-field"><span>U.M.</span><input id="bve-um" value="${esc(p.um || '')}" placeholder="mq"></label>
        <label class="b-field"><span>Prezzo €${p.prezzoContratto != null ? ' <span class="b-muted">(di contratto: ' + eur(p.prezzoContratto) + ')</span>' : ''}</span><input id="bve-prezzo" type="text" inputmode="decimal" value="${esc(numIn(p.modalita === 'corpo' ? p.importoContrattuale : p.prezzoUnitario))}" placeholder="0,00"></label>
      </div>
      <label class="b-field"><span>Descrizione</span><input id="bve-desc" value="${esc(p.descrizione)}" placeholder="Designazione dei lavori"></label>
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="salvaVoceEdit()">Salva</button></div>`, true)
  const q = $('bveQ') as HTMLInputElement | null
  if (q && voceDaDefinire(p)) q.focus()
}
async function cercaVoceEdit(q: string): Promise<void> {
  if (!_voceEdit) return
  const lista = _prezzari; if (!lista.length) return
  const righe = await caricaPrezzario(lista[0].id)
  if (!_voceEdit) return
  _voceEdit.trovate = cercaNelPrezzario(righe, q, 12)
  const el = $('bveRis')
  if (el) el.innerHTML = _voceEdit.trovate.length ? risultatiVoceEditHTML() : (q ? '<div class="b-empty">Nessuna voce trovata.</div>' : '')
}
function prendiVoceEdit(i: number): void {
  const r = _voceEdit?.trovate[i]; if (!r) return
  const set = (id: string, v: string): void => { const el = $(id) as HTMLInputElement | null; if (el) el.value = v }
  set('bve-cod', r.codice); set('bve-desc', r.desc_short || r.declaratoria); set('bve-um', r.um || ''); set('bve-prezzo', numIn(r.prezzo > 0 ? r.prezzo : null))
  const p = S.partite.find((x) => x.id === _voceEdit!.pid)
  if (p && !p.categoria) p.categoria = categoriaDiRiga(r)
  toast('Campi riempiti dal prezzario: controlla e salva')
}
function salvaVoceEdit(): void {
  if (!_voceEdit) return
  const p = S.partite.find((x) => x.id === _voceEdit!.pid); if (!p) return
  if (salBloccato(_voceEdit.salN)) return
  p.codice = val('bve-cod').trim(); p.descrizione = val('bve-desc').trim(); p.um = val('bve-um').trim()
  const prezzo = leggiNum(val('bve-prezzo'))
  if (p.modalita === 'corpo') p.importoContrattuale = prezzo; else p.prezzoUnitario = prezzo
  _voceEdit = null
  closeModal(); saveDraft(); renderLeft(); reopenEditor()
  toast('Voce aggiornata: le misure sono rimaste')
}

/* Come si presenta la provenienza della voce: una ripetizione dello stesso articolo
   (seconda annotazione, scelta dal DL) non è un nuovo prezzo. */
function etichettaOrigine(p: Partita): string {
  if (p.np) return ` · <b>nuovo prezzo n. ${p.np.numero}</b> · ${STATO_NP[p.np.stato]}${p.np.periziaN != null ? ` (perizia ${p.np.periziaN})` : ''}`
  const intro = p.introdottaSal ?? 1
  const ripetuta = S.partite.filter((x) => x.codice.trim() === p.codice.trim() && x.codice.trim() !== '').length > 1
  if (ripetuta) return ' · voce ripetuta' + (intro > 1 ? ` (dal SAL ${intro})` : '')
  return intro > 1 ? ` · nuovo prezzo (SAL ${intro})` : ''
}
/* Ripete la voce: stesso articolo, misure proprie. La quantità di contratto resta
   sulla prima (la ripetizione è un'annotazione in più, non un raddoppio del progetto). */
function duplicaVoce(pid: string, salN: number): void {
  if (salBloccato(salN)) return
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const base = {
    id: uid(), codice: p.codice, descrizione: p.descrizione, um: p.um, categoria: p.categoria, introdottaSal: salN,
    ...(p.declaratoria ? { declaratoria: p.declaratoria } : {}),
    ...(p.sicurezza ? { sicurezza: true } : {}),
  }
  const n: Partita = p.modalita === 'corpo'
    ? { ...base, modalita: 'corpo', importoContrattuale: null }
    : { ...base, modalita: 'misura', prezzoUnitario: p.prezzoUnitario ?? null, prezzoBase: p.prezzoBase ?? null, qtyProgetto: null }
  S.partite.splice(S.partite.findIndex((x) => x.id === pid) + 1, 0, n)
  if (n.modalita !== 'corpo') libExpanded.add(n.id)
  saveDraft(); renderLeft(); reopenEditor()
  toast('Voce ripetuta: ha misure proprie, la quantità di contratto resta sulla prima')
}
/**
 * «Elimina voce». Atto pubblico: non si cancella ciò che è già stato
 * contabilizzato. Se la voce non è ancora entrata in alcun atto (introdotta in
 * questo stesso SAL e nessun libretto precedente prodotto) si rimuove davvero;
 * altrimenti si SOPPRIME con storno tracciato (detrazione dal SAL corrente).
 */
function delVoce(pid: string, salN: number): void {
  const esito = delVoceSilenziosa(pid, salN)
  if (esito === 'eliminata') toast('Voce eliminata (non ancora contabilizzata)')
  else if (esito === 'stornata') toast(`Voce soppressa e portata in detrazione al SAL ${salN}: resta a verbale negli atti precedenti (storno).`)
  saveDraft(); renderAll(); reopenEditor()
}
/** La regola di sempre, senza messaggi: la usano la riga singola e la selezione. */
function delVoceSilenziosa(pid: string, salN: number): 'eliminata' | 'stornata' | null {
  const p = S.partite.find((x) => x.id === pid); if (!p) return null
  const intro = p.introdottaSal ?? 1
  // Protetta (→ storno) solo se LA VOCE è esistita in un SAL precedente il cui
  // libretto è stato prodotto: un nuovo prezzo di questo stesso SAL resta eliminabile.
  const esistevaPrima = intro < salN
  const prodottaDaAllora = S.consegne.some((c) => c.tipo === 'libretto' && (c.salNumero ?? 0) >= intro && (c.salNumero ?? 0) < salN)
  const giaContabilizzata = esistevaPrima && prodottaDaAllora
  libExpanded.delete(pid)
  libSel.delete(pid)
  if (!giaContabilizzata) {
    S.partite = S.partite.filter((x) => x.id !== pid)
    for (const s of S.sals) s.righe = s.righe.filter((r) => r.partitaId !== pid)
    return 'eliminata'
  }
  p.soppressaSal = salN
  return 'stornata'
}
function annullaStorno(pid: string): void { const p = S.partite.find((x) => x.id === pid); if (!p) return; delete p.soppressaSal; saveDraft(); renderLeft(); reopenEditor(); toast('Storno annullato') }
/* ── Misure di dettaglio del libretto (stile computo Computo) ─────────────────── */
function toggleMisure(pid: string): void { if (libExpanded.has(pid)) libExpanded.delete(pid); else libExpanded.add(pid); reopenEditor() }
/** Converte la quantità rapida in una prima riga di misura e apre il dettaglio. */
/* «Dettaglia»: la quantità secca diventa misure vere. Se la voce è stata
   computata in progetto e la quantità coincide, le misure di progetto sono già
   quelle giuste: si prendono (restano correggibili). Altrimenti si parte da una
   riga sola e le misure di progetto si prendono a mano, quelle che servono. */
function dettagliaMisure(ctx: Contesto, pid: string): void { if (ctxBloccato(ctx)) return;
  const r = contenitoreMisure(ctx, pid, true); if (!r) return
  const p = S.partite.find((x) => x.id === pid)
  let daProgetto = false
  if (!r.misurazioni || !r.misurazioni.length) {
    // la quantità da cui si parte: il progressivo del SAL o la quantità della perizia
    const q = periziaDiCtx(ctx) ? r.qty ?? null : r.quantitaProgressiva ?? null
    const mp = p?.misurazioniProgetto || []
    daProgetto = mp.length > 0 && (q == null || Math.abs(sommaMisurazioni(mp) - q) < 0.005)
    r.misurazioni = daProgetto ? mp.map(copiaRigaProgetto) : [{ descrizione: 'da computo', l1: q ?? null, quantita: q ?? 0 }]
  }
  allineaMisure(ctx, r)
  libExpanded.add(pid); saveDraft(); reopenEditor()
  if (daProgetto) toast(periziaDiCtx(ctx) ? 'Misure prese dal computo di progetto: correggile con quelle di perizia' : 'Misure prese dal computo di progetto: correggile con quello che è stato eseguito')
}
function addMisura(ctx: Contesto, pid: string, detrazione: boolean): void { if (ctxBloccato(ctx)) return;
  const r = contenitoreMisure(ctx, pid, true); if (!r) return
  if (!r.misurazioni) r.misurazioni = []
  r.misurazioni.push(detrazione ? { descrizione: 'detrazione', n: -1, quantita: 0 } : { quantita: 0 })
  allineaMisure(ctx, r)
  libExpanded.add(pid); saveDraft(); reopenEditor()
}
function setMisura(ctx: Contesto, pid: string, idx: number, campo: string, v: string): void { if (ctxBloccato(ctx)) return;
  const r = contenitoreMisure(ctx, pid); const m = r?.misurazioni?.[idx]; if (!r || !m) return
  if (campo === 'descrizione') { m.descrizione = v; saveDraft(); return }
  // numero o formula (12+250+65, 2x3,5): la formula resta scritta e si ricalcola
  impostaCampo(m, campo as Fattore, v)
  allineaMisure(ctx, r)
  // Aggiornamento MIRATO delle celle calcolate (no rimontaggio: si conserva il focus dell'input).
  const p = S.partite.find((x) => x.id === pid); if (!p) return
  const pannello = document.querySelector(`[data-mis-key="${pid}"]`)
  const cell = pannello?.querySelectorAll('[data-mis-qt]')[idx] as HTMLElement | undefined
  if (cell) { cell.textContent = numFmt(m.quantita); cell.closest('tr')?.classList.toggle('is-neg', (m.quantita || 0) < 0) }
  const tot = sommaMisurazioni(r.misurazioni!)
  const tcell = pannello?.querySelector('[data-mis-tot]') as HTMLElement | undefined
  if (tcell) tcell.textContent = numFmt(tot)
  const pz = periziaDiCtx(ctx)
  if (pz) {
    const qcell = $(`bpzq-${pid}`); if (qcell) qcell.textContent = numFmt(tot)
    refreshPeriziaTot(pz.numero)
  } else {
    const ecell = $(`bme-${pid}`); if (ecell) ecell.textContent = numFmt(tot)
    const icell = $(`bmimp-${pid}`); if (icell) icell.textContent = eur(eseguitoPartita(p, r as RigaSal, Number(ctx)))
  }
  saveDraft(); renderLeft()
}
function delMisura(ctx: Contesto, pid: string, idx: number): void { if (ctxBloccato(ctx)) return;
  const r = contenitoreMisure(ctx, pid); if (!r?.misurazioni) return
  r.misurazioni.splice(idx, 1)
  allineaMisure(ctx, r)
  saveDraft(); reopenEditor()
}
function addGiornale(): void { S.giornale.push({ data: isoToIt(S.dataCorrenteISO), lavorazioni: '' }); saveDraft(); reopenEditor() }
function setGiornale(i: number, f: keyof RigaGiornale, v: string): void { if (S.giornale[i]) { (S.giornale[i] as unknown as Record<string, string>)[f] = v; saveDraft() } }
function delGiornale(i: number): void { S.giornale.splice(i, 1); saveDraft(); reopenEditor() }
/* Una riserva nasce con la data e l'atto su cui è iscritta: sono quei due dati
   che fanno partire i quindici giorni, e senza di loro il programma non può
   dire nulla sulle scadenze. Si precompilano col SAL che si sta firmando. */
function addRiserva(salN?: number): void {
  const n = S.riserve.length ? Math.max(...S.riserve.map((r) => r.numero)) + 1 : 1
  const sal = salById(salN)
  S.riserve.push({
    numero: n, oggetto: '', salNumero: salN,
    data: sal?.dataFirmaEsecutore || sal?.data || isoToIt(S.dataCorrenteISO),
    ...(salN ? { attoIscrizione: `Registro di contabilità al SAL n. ${salN}` } : {}),
  })
  saveDraft(); refreshRiserve(); renderTimeline()
}
function setRiserva(i: number, f: keyof Riserva, v: string): void {
  const r = S.riserve[i]; if (!r) return
  if (f === 'importo' || f === 'salNumero') (r as unknown as Record<string, number | null>)[f] = v === '' ? null : Number(v)
  else (r as unknown as Record<string, string>)[f] = v
  saveDraft()
  // le date e l'esito cambiano lo stato dei termini: la scheda si riscrive
  if (f === 'data' || f === 'dataEsplicitazione' || f === 'esito') refreshRiserve()
  renderTimeline()
}
function setRiservaConferma(i: number, on: boolean): void { const r = S.riserve[i]; if (!r) return; r.confermataContoFinale = on || undefined; saveDraft(); refreshRiserve() }
function delRiserva(i: number): void { S.riserve.splice(i, 1); saveDraft(); refreshRiserve(); renderTimeline() }
function refreshRiserve(): void { const b = $('bRiserve'); if (b) b.innerHTML = riserveEditorHTML(); else reopenEditor() }
function setFirmaEsecutore(n: number, v: string): void {
  const sal = salById(n); if (!sal) return
  sal.firmaEsecutore = (v === 'senzaRiserve' || v === 'conRiserva' || v === 'rifiutata') ? v : undefined
  if (sal.firmaEsecutore && !sal.dataFirmaEsecutore) sal.dataFirmaEsecutore = sal.data || isoToIt(S.dataCorrenteISO)
  saveDraft(); reopenEditor(); renderTimeline()
}
function setDataFirmaEsecutore(n: number, v: string): void { const sal = salById(n); if (!sal) return; sal.dataFirmaEsecutore = v; saveDraft(); renderTimeline() }
/** Il rifiuto di firma non si tace: diventa un verbale, con il suo posto in cronologia. */
function verbaleRifiutoFirma(n: number): void {
  const sal = salById(n)
  const v = nuovoVerbale('accertamento', sal?.dataFirmaEsecutore || isoToIt(S.dataCorrenteISO), S.verbali, uid())
  v.oggetto = `Rifiuto di sottoscrizione del registro di contabilità al SAL n. ${n}`
  v.testo = `Il registro di contabilità, aggiornato a tutto lo stato di avanzamento n. ${n}, è stato sottoposto all'esecutore per la sottoscrizione.\nL'esecutore ha rifiutato di sottoscriverlo${v.data ? ` in data ${v.data}` : ''}.\nDel rifiuto si redige il presente verbale, che fa parte degli atti contabili, e se ne dà immediata comunicazione alla stazione appaltante (art. 7 Allegato II.14 D.Lgs. 36/2023).`
  S.verbali.push(v); saveDraft(); renderAll(); closeModal(); openEditor(`verb-${v.id}`, `verbale:${v.id}`)
  toast('Verbale di rifiuto creato: completalo e stampalo')
}
function setRelazione(v: string): void { S.relazione = v; saveDraft() }

/* ── Anteprima / Stampa (registra nello storico solo su Stampa) ─────────── */
function openDoc(html: string): void {
  // Le impostazioni si applicano a ciò che si GUARDA e si stampa; l'atto
  // registrato nello storico resta il documento generato, perché è su quello
  // che si calcola l'impronta: margini e carattere non cambiano un atto.
  /* L'anteprima sta DENTRO il programma: una finestra separata non sempre si
     apre (popup bloccati, o il guscio desktop che la rifiuta) e l'anteprima
     restava muta. Gli stessi due comandi di ogni altra stampa. */
  const titolo = S.editor ? (findDoc(S.editor.fase, S.editor.tipo)?.d.label || 'Documento') : 'Documento'
  anteprimaHTML(applicaStileStampa(html, _pref.stile), {
    titolo, nomeFile: nomeFileDoc(titolo), estensione: 'html',
    // il pannello «Aspetto» dell'anteprima cambia le preferenze: si rileggono e si riapplicano
    rifai: async () => { _pref = leggiPreferenzeStampa(); return applicaStileStampa(html, _pref.stile) },
  })
}
async function pdfLib(): Promise<unknown> { await loadPdfLib(); return (window as unknown as { PDFLib: unknown }).PDFLib }
async function stampaPdf(): Promise<void> {
  if (!S.editor) return; const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd?.d.pdf) return
  try {
    const r = await fd.d.pdf()
    // l'anteprima prima della stampa, come per ogni altra stampa del programma:
    // da lì si stampa o si salva, con gli stessi due pulsanti
    anteprimaPdf(r.bytes as Uint8Array, {
      titolo: fd.d.label + (fd.f.salNumero ? ` — SAL n. ${fd.f.salNumero}` : ''),
      nomeFile: nomeFileDoc(fd.d.label + (fd.f.salNumero ? '_SAL' + fd.f.salNumero : '')),
      nota: `${r.pagine} pagin${r.pagine === 1 ? 'a' : 'e'}`,
      // lo stesso atto, rifatto con l'aspetto scelto nel pannello dell'anteprima
      rifai: async () => { _pref = leggiPreferenzeStampa(); return (await fd.d.pdf!()).bytes as Uint8Array },
    })
    // il conteggio delle pagine resta sull'atto emesso: è ciò che fa continuare
    // la numerazione del libretto e del registro all'avanzamento successivo
    const c = consegnaDi(fd.d.tipo, fd.f.salNumero)
    if (c) { c.pagine = r.pagine; saveDraft(); renderConsegne() }
    toast(`«${fd.d.label}» in PDF: ${r.pagine} pagin${r.pagine === 1 ? 'a' : 'e'}`)
  } catch (e) { toast('Errore nella stampa PDF: ' + ((e as Error)?.message || e)) }
}
/* ── DUE MODI DI STAMPARE, E NON SONO LO STESSO FOGLIO ────────────────────
   «Di lavoro» serve a guardare: esce con la filigrana COPIA DI LAVORO e non
   lascia traccia. «Definitiva» EMETTE l'atto: lo registra nello storico con la
   sua data e la sua impronta, ed è quella che si firma. Una bozza stampata è
   identica a un atto vero, e su un tavolo di cantiere i due fogli si confondono:
   per questo la differenza si vede sulla carta, non solo nel programma. */
function perchéNonDefinitiva(f: Fase): string | undefined {
  if (!f.salNumero) return undefined
  const s = salById(f.salNumero)
  return s?.firmato ? undefined : `il SAL n. ${f.salNumero} non è ancora firmato`
}
function anteprima(): void {
  if (!S.editor) return; const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd) return
  openDoc(marcaBozza(fd.d.gen(), perchéNonDefinitiva(fd.f)))
}
function stampa(): void {
  if (!S.editor) return; const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd) return
  const html = fd.d.gen()
  openDoc(html)
  const dataIt = fd.f.dataIt || isoToIt(S.dataCorrenteISO)
  registraConsegna(fd.d.tipo, fd.d.label, dataIt, fd.f.salNumero, html)
  saveDraft(); renderTimeline(); renderConsegne(); toast(`«${fd.d.label}» emesso e registrato nello storico`)
}
/* ── Gli atti del SAL si producono INSIEME ────────────────────────────────
   Un SAL non è un documento: è un fascicolo. Libretto, registro, sommario,
   stato di avanzamento e certificato di pagamento raccontano lo stesso
   avanzamento e si firmano insieme: si stampano in un colpo solo, nell'ordine
   del codice, e si registrano tutti nello storico. */
const ATTI_DEL_SAL = ['libretto', 'sottocomputi', 'registro', 'sommario', 'sal', 'certificato']

/** Unisce più atti in un solo documento da stampare, uno per pagina. */
function fondiAtti(pagine: string[]): string {
  const dp = new DOMParser()
  const docs = pagine.map((h) => dp.parseFromString(h, 'text/html'))
  const primo = docs[0]
  for (let i = 1; i < docs.length; i++) {
    const d = docs[i]
    d.querySelector('.doc-bar')?.remove()
    const blocco = primo.createElement('div')
    blocco.className = 'atto-seguente'
    // importNode COPIA: si scorre una lista statica, altrimenti il ciclo non finisce mai
    for (const n of Array.from(d.body.childNodes)) blocco.appendChild(primo.importNode(n, true))
    primo.body.appendChild(blocco)
  }
  const st = primo.createElement('style')
  st.textContent = '.atto-seguente{break-before:page;page-break-before:always;margin-top:28px;padding-top:22px;border-top:1px dashed #bbb}@media print{.atto-seguente{margin-top:0;padding-top:0;border:0}}'
  primo.head.appendChild(st)
  return '<!doctype html>' + primo.documentElement.outerHTML
}
function registraConsegna(tipo: string, label: string, dataIt: string, salNumero?: number, html?: string): void {
  const prev = consegnaDi(tipo, salNumero)
  const c = prev || { id: uid(), tipo, label, data: dataIt, salNumero, ts: Date.now() }
  c.data = dataIt; c.ts = Date.now()
  if (!prev) S.consegne.push(c)
  // impronta dell'atto come è stato prodotto: entra nel registro degli atti
  if (html) void improntaTesto(html).then((h) => { if (h) { c.impronta = h; saveDraft(); renderConsegne() } })
}
/** Produce e registra i cinque atti del SAL in un unico fascicolo. */
const ATTI_DELLA_PERIZIA = ['perizia', 'comparativo', 'elencoNP', 'sottomissione']

/** Il fascicolo di una tappa: gli atti del SAL o quelli della perizia. */
function attiDellaTappa(key: string): { f: Fase; scelti: DocDesc[] } | null {
  const f = fasi().find((x) => x.key === key)
  if (!f) return null
  const ordine = key.startsWith('perizia-') ? ATTI_DELLA_PERIZIA : ATTI_DEL_SAL
  const scelti = ordine.map((t) => f.docs.find((d) => d.tipo === t)).filter((d): d is DocDesc => !!d && (!d.soloSe || d.soloSe()))
  return scelti.length ? { f, scelti } : null
}
/* ── UNA SOLA INTERFACCIA DI STAMPA ───────────────────────────────────────
   Non un pulsante per ogni combinazione (di lavoro, PDF, Word, ODT, solo
   questo atto, tutti gli atti…): una domanda sola, sempre la stessa, con tre
   scelte — CHE COSA si stampa, COME, in che FORMATO. Poi l'anteprima, e dalla
   stessa riga di pulsanti si stampa o si salva. Vale per ogni atto e per ogni
   tappa; da qui passa anche il fascicolo del SAL, che resta UNA operazione. */
function apriStampaAtto(keyTappa?: string): void {
  const key = keyTappa || S.editor?.fase || ''
  const fd = !keyTappa && S.editor ? findDoc(S.editor.fase, S.editor.tipo) : null
  const t = attiDellaTappa(key)
  const nAtti = t ? t.scelti.length : 0
  if (!fd && !nAtti) { toast('Non ci sono atti da produrre per questa tappa'); return }
  if (nAtti && !S.partite.length) { toast('Importa prima il computo'); return }
  const conPdf = !!fd?.d.pdf
  const soloTappa = !fd
  const rb = (name: string, v: string, et: string, nota: string, on = false, off = false): string =>
    `<label class="b-opt${off ? ' is-off' : ''}"><input type="radio" name="${name}" value="${v}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span><b>${esc(et)}</b><small>${esc(nota)}</small></span></label>`
  modal(`<div class="b-modal__h">Stampa — ${esc(fd ? fd.d.label : t!.f.titolo)}</div>
    <div class="b-modal__scroll">
      <fieldset class="b-fieldset"><legend>Che cosa</legend>
        ${fd ? rb('st-cosa', 'atto', 'Solo questo atto', fd.d.label, true) : ''}
        ${nAtti > (fd ? 1 : 0) ? rb('st-cosa', 'tappa', `Tutti gli atti della tappa (${nAtti})`, t!.scelti.map((d) => d.label).join(', ').toLowerCase(), soloTappa) : ''}
      </fieldset>
      <fieldset class="b-fieldset"><legend>Come</legend>
        ${rb('st-come', 'definitiva', 'Definitiva', "emessa e registrata nello storico, con l'impronta", true)}
        ${rb('st-come', 'lavoro', 'Copia di lavoro', 'filigrana COPIA DI LAVORO, non registra nulla')}
      </fieldset>
      <fieldset class="b-fieldset"><legend>Formato</legend>
        ${rb('st-fmt', 'pagina', 'Pagina da stampare', 'anteprima, poi stampa o PDF del browser', true)}
        ${rb('st-fmt', 'pdf', 'PDF da registro', conPdf ? 'pagine numerate, riporto e a riportare' : soloTappa ? "si produce atto per atto" : 'non disponibile per questo atto', false, !conPdf)}
        ${rb('st-fmt', 'docx', 'Word (.docx)', 'editabile')}
        ${rb('st-fmt', 'odt', 'ODT', 'editabile, LibreOffice')}
      </fieldset>
      <p class="b-muted" style="margin:10px 0 0"><button class="ehb-btn ehb-btn--sm ehb-btn--ghost" onclick="apriImpostazioniStampa()" title="Foglio, margini, carattere, testata e cartiglio: valgono per tutte le stampe del programma">⚙ Impostazioni di stampa</button></p>
      <label class="b-opt" id="stUnico"${soloTappa ? '' : ' hidden'}><input type="checkbox" checked><span><b>Un unico fascicolo</b><small>tolto il segno esce uno zip con un file per atto — resta comunque una operazione sola</small></span></label>
      <input type="hidden" id="stKey" value="${esc(key)}">
    </div>
    <div class="b-modal__foot"><button class="ehb-btn ehb-btn--ghost" onclick="closeModal()">Annulla</button><button class="ehb-btn ehb-btn--accent-soft" onclick="eseguiStampaScelta()">⎙ Stampa</button></div>`, true)
  const agg = (): void => { const u = $('stUnico'); if (u) u.hidden = (document.querySelector('input[name="st-cosa"]:checked') as HTMLInputElement | null)?.value !== 'tappa' }
  document.querySelectorAll('input[name="st-cosa"]').forEach((el) => el.addEventListener('change', agg))
  agg()
}
function eseguiStampaScelta(): void {
  const val = (n: string): string => (document.querySelector(`input[name="${n}"]:checked`) as HTMLInputElement | null)?.value || ''
  const cosa = val('st-cosa'); const come = val('st-come'); const fmt = val('st-fmt')
  const unico = !!($('stUnico')?.querySelector('input') as HTMLInputElement | null)?.checked
  const key = ($('stKey') as HTMLInputElement | null)?.value || S.editor?.fase || ''
  closeModal()
  if (cosa === 'tappa') { void produciAttiTappa(key, { unico, fmt, lavoro: come === 'lavoro' }); return }
  if (fmt === 'pdf') { void stampaPdf(); return }
  if (fmt === 'docx' || fmt === 'odt') { void esportaEditabile(fmt); return }
  if (come === 'lavoro') { anteprima(); return }
  stampa()
}
function stampaAttiSal(salN: number): void { apriStampaAtto(`sal-${salN}`) }
function stampaAttiPerizia(n: number): void { apriStampaAtto(`perizia-${n}`) }
/* Una tappa non è un documento: è un fascicolo. Gli atti si producono INSIEME,
   nell'ordine del codice, e si registrano tutti nello storico. Chi li trasmette
   ha però spesso bisogno di un file per atto (protocollo, firma separata): si
   sceglie una volta sola, con la stessa domanda per SAL e per perizia. */
function produciAtti(key: string, unico: boolean): void {
  closeModal()
  const t = attiDellaTappa(key); if (!t) return
  const { f, scelti } = t
  const parti = scelti.map((d) => d.gen())
  if (unico) openDoc(fondiAtti(parti))
  else parti.forEach((html) => openDoc(html))
  const dataIt = f.dataIt || isoToIt(S.dataCorrenteISO)
  scelti.forEach((d, i) => registraConsegna(d.tipo, d.label, dataIt, f.salNumero, parti[i]))
  saveDraft(); renderTimeline(); renderConsegne()
  toast(`${f.titolo}: ${parti.length} atti prodotti e registrati${unico ? ' in un fascicolo unico' : ''}`)
}
/* Il fascicolo di una tappa in UNA operazione sola: o un documento unico, o un
   archivio zip con un file per atto — mai cinque finestre da chiudere a mano. */
async function produciAttiTappa(key: string, o: { unico: boolean; fmt: string; lavoro: boolean }): Promise<void> {
  const t = attiDellaTappa(key); if (!t) { toast('Non ci sono atti da produrre per questa tappa'); return }
  const { f, scelti } = t
  const parti = scelti.map((d) => d.gen())
  const dataIt = f.dataIt || isoToIt(S.dataCorrenteISO)
  const registra = (): void => {
    if (o.lavoro) return
    scelti.forEach((d, i) => registraConsegna(d.tipo, d.label, dataIt, f.salNumero, parti[i]))
    saveDraft(); renderTimeline(); renderConsegne()
  }
  if (o.unico && o.fmt === 'pagina') { openDoc(fondiAtti(parti)); registra(); toast(`${f.titolo}: ${parti.length} atti in un fascicolo unico`); return }
  try {
    toast(`Preparo ${o.unico ? 'il fascicolo' : `${parti.length} file`}…`)
    await loadJSZip()
    const JSZip = (window as unknown as { JSZip?: new () => { file: (path: string, content: string | Blob, opts?: { compression?: string }) => void; generateAsync: (o: { type: string; mimeType?: string }) => Promise<Blob> } }).JSZip
    if (!JSZip) { toast('Libreria ZIP non disponibile'); return }
    const estensione = o.fmt === 'docx' ? 'docx' : o.fmt === 'odt' ? 'odt' : 'html'
    const fileDi = async (html: string, nome: string): Promise<{ nome: string; blob: Blob }> => {
      if (estensione === 'html') return { nome: `${nome}.html`, blob: new Blob([applicaStileStampa(html, _pref.stile)], { type: 'text/html' }) }
      const doc = htmlDocToSimpleDoc(html)
      const z = new JSZip()
      if (estensione === 'docx') {
        for (const [path, content] of Object.entries(buildSimpleDocxParts(doc))) z.file(path, content)
        return { nome: `${nome}.docx`, blob: await z.generateAsync({ type: 'blob', mimeType: DOCX_MIME }) }
      }
      for (const [path, content] of Object.entries(buildOdtParts(doc))) z.file(path, content, path === ODT_MIMETYPE_ENTRY ? { compression: 'STORE' } : undefined)
      return { nome: `${nome}.odt`, blob: await z.generateAsync({ type: 'blob', mimeType: ODT_MIME }) }
    }
    if (o.unico) {
      const uno = await fileDi(fondiAtti(parti), nomeFileDoc(f.titolo))
      await scaricaBlob(uno.blob, uno.nome)
    } else {
      const zip = new JSZip()
      for (let i = 0; i < parti.length; i++) {
        const uno = await fileDi(parti[i], `${String(i + 1).padStart(2, '0')}_${nomeFileDoc(scelti[i].label)}`)
        zip.file(uno.nome, estensione === 'html' ? await uno.blob.text() : uno.blob)
      }
      await scaricaBlob(await zip.generateAsync({ type: 'blob' }), nomeFileDoc(f.titolo) + '.zip')
    }
    registra()
    toast(`${f.titolo}: ${parti.length} atti ${o.unico ? 'in un fascicolo unico' : 'in un archivio zip'}${o.lavoro ? ' (copia di lavoro, non registrata)' : ' prodotti e registrati'}`)
  } catch (e) { toast('Stampa non riuscita: ' + ((e as Error)?.message || e)) }
}
function produciAttiSal(salN: number, unico: boolean): void { produciAtti(`sal-${salN}`, unico) }

function riapri(id: string): void { const c = S.consegne.find((x) => x.id === id); if (!c) return; const fd = fasi().flatMap((f) => f.docs.map((d) => ({ f, d }))).find((x) => x.d.tipo === c.tipo && x.f.salNumero === c.salNumero); if (fd) { if (fd.d.needsPartite && !S.partite.length) { toast('Computo assente'); return } openDoc(fd.d.gen()) } }

/* ── EXPORT IN FORMATO APERTO (All. II.14 art. 12 c. 10) ──────────────────
   La contabilità deve restare leggibile anche senza il programma che l'ha
   scritta. Un pacchetto zip di file aperti e documentati: il JSON completo, le
   viste in CSV (voci, misure, eseguito, SAL, impronte) e un LEGGIMI che spiega
   com'è fatto. Nessun formato proprietario, nessuna formula. */
async function esportaFormatoAperto(): Promise<void> {
  if (!S.partite.length && !S.sals.length) { toast('Niente da esportare: la contabilità è vuota'); return }
  const file = pacchettoAperto({
    appalto: S.appalto, partite: S.partite, sals: S.sals, economia: S.economia,
    consegne: S.consegne, riserve: S.riserve, verbali: S.verbali, giornale: S.giornale, relazione: S.relazione,
  })
  try {
    await loadJSZip()
    const Zip = (window as unknown as { JSZip?: new () => { file: (n: string, c: string) => void; generateAsync: (o: { type: 'blob' }) => Promise<Blob> } }).JSZip
    if (!Zip) throw new Error('modulo zip non pronto')
    const zip = new Zip()
    for (const f of file) zip.file(f.nome, f.testo)
    await scaricaBlob(await zip.generateAsync({ type: 'blob' }), nomeFileDoc('Contabilita_formato_aperto') + '.zip')
    const righe = file.filter((f) => f.nome.endsWith('.csv')).reduce((n, f) => n + righeDi(f), 0)
    toast(`Esportati ${file.length} file aperti (${righe} righe di dati): JSON, CSV e leggimi`)
  } catch (e) {
    toast('Export non riuscito: ' + ((e as Error)?.message || e))
  }
}

/* ── Export editabile (.docx / .odt) — stesso HTML di anteprima/stampa, convertito
   via il walker generico `htmlDocToSimpleDoc` (shared/doc): funziona per TUTTI gli
   atti di Contabilità senza adattare i singoli generatori. */
function nomeFileDoc(label: string): string {
  return 'beta-' + label.replace(/[^\w]+/g, '_').slice(0, 60)
}
async function scaricaBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function esportaEditabile(fmt: 'docx' | 'odt'): Promise<void> {
  if (!S.editor) return
  const fd = findDoc(S.editor.fase, S.editor.tipo); if (!fd) return
  try {
    toast(`Generazione .${fmt}…`)
    await loadJSZip()
    const JSZip = (window as unknown as { JSZip?: new () => { file: (path: string, content: string, opts?: { compression?: string }) => void; generateAsync: (o: { type: string; mimeType: string }) => Promise<Blob> } }).JSZip
    if (!JSZip) { toast('Libreria ZIP non disponibile'); return }
    const doc = htmlDocToSimpleDoc(fd.d.gen())
    const zip = new JSZip()
    if (fmt === 'docx') {
      for (const [path, content] of Object.entries(buildSimpleDocxParts(doc))) zip.file(path, content)
      const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME })
      await scaricaBlob(blob, nomeFileDoc(fd.d.label) + '.docx')
    } else {
      for (const [path, content] of Object.entries(buildOdtParts(doc))) zip.file(path, content, path === ODT_MIMETYPE_ENTRY ? { compression: 'STORE' } : undefined)
      const blob = await zip.generateAsync({ type: 'blob', mimeType: ODT_MIME })
      await scaricaBlob(blob, nomeFileDoc(fd.d.label) + '.odt')
    }
  } catch (err) { toast('Errore export: ' + ((err as Error)?.message || err)) }
}

/* ── Export Excel ───────────────────────────────────────────────────────── */
async function exportExcel(kind: 'sal' | 'registro' | 'sommario', salNumero: number): Promise<void> {
  if (!S.partite.length) { toast('Importa prima il computo'); return }
  try {
    await loadXLSX()
    const XLSX = (window as unknown as { XLSX: { utils: Record<string, Function>; writeFile: Function } }).XLSX
    const aoa = kind === 'sal' ? salAOA(S.appalto, S.partite, S.sals, salNumero, S.economia) : kind === 'registro' ? registroAOA(S.appalto, S.partite, S.sals, S.economia) : sommarioAOA(S.appalto, S.partite, S.sals, salNumero, S.economia)
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = aoaColWidths(aoa).map((wch) => ({ wch }))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, (kind === 'registro' ? 'Registro' : `${kind} ${salNumero}`).slice(0, 31))
    XLSX.writeFile(wb, `beta-${kind}-${(S.appalto.oggetto || 'lavori').replace(/[^\w]+/g, '_').slice(0, 30)}.xlsx`)
  } catch (err) { toast('Errore export: ' + ((err as Error)?.message || err)) }
}

/* ── Avvio ──────────────────────────────────────────────────────────────── */
Object.assign(window, {
  pickPeriziaXpwe, pickXpweIn, esportaXpweCtx,
  setDataSalImport, importaComeComputo, confermaImportContabilita, proponiSalPerData, tuttoUnSalImport, chiediDatiContratto,
  stampaPdf,
  setTipologia, setRevisione, setAccordoQuadro, setAqMassimo, addApplicativo, setApplicativo, delApplicativo, setSalIndice,
  stampaAttiPerizia, produciAtti, produciAttiTappa,
  apriSorgente, addDaSorgente, firmaSal, verificaFascicoli, esportaFormatoAperto, apriStampe, apriStampaAtto, eseguiStampaScelta, apriStruttura, setStrutturaVoce, apriAggiornaPrezzi, toggleAggPrezzo, cambiaPrezzarioAgg, applicaAggiornaPrezzi, vaiAlComputo, componiAnalisiNelComputo, sbloccaSal, openPerizie, nuovaPerizia, delPerizia, delSal, docPerizia, setPerizia, setVocePerizia, editPerizia, approvaPerizia, riapriPerizia, allineaCorpiPerizia,
  setRegistrazione, setCollaudo, setDurc, setOpzAtto, produciAttiSal,
  libFiltra, setLibOrdine, setLibVista, setLibSolo, setPzSolo, libSelToggle, libSelTutte, rigaMenu, rigaClick, menuMisura, menuPrezzo, delVoceElenco, apriMenuVoci, chiudiMenuVoci, copiaVociSelezionate, incollaVoci, selCategoria, selWbs, selElimina, applicaSelCampo, eseguiConferma, libEspandi, libAiuto, apriNuovoPrezzo, periziaPerImport, apriImpostazioniStampa, setStile, ripristinaStile,
  toggleTheme, toggleGuida, openDati, closeModal, openImport, avanzaGiorni, setDataCorrenteIt, setDataCorrenteIso, nuovoSalOggi,
  openNuovoVerbale, creaVerbale, setVerb, delVerbale,
  creaLista, setLista, addOperaio, addMezzo, addProvvista, setOperaio, setMezzo, setProvvista,
  delOperaio, delMezzo, delProvvista, delLista, annullaStornoLista,
  setApp, setAppNum, setPrezziUnitari, setEnte, setImpresa, pickLogo, removeLogo,
  setImportMode, importMiu, pickXpwe, svuotaComputo,
  openPrezzario, apriCassetto, setPrezzario, cercaCassetto, schedaCassetto, portaNelLibretto,
  voceDragStart, voceDragOver, voceDragLeave, voceDrop, addDaPrezzario,
  chiudiPagina, apriMisureProgetto, chiudiCassetto, prendiMisuraProgetto, prendiMisureProgetto,
  addVoceLibera, apriVoceEdit, cercaVoceEdit, prendiVoceEdit, salvaVoceEdit,
  assimilaVoce, apriNP, statoNP, setNPCampo,
  partiDaZero, ripristinaPrezzoContratto, vaiA,
  misDragStart, progDragStart, misDragOver, misDragLeave, misDrop, misDragEnd,
  stampaAttiSal,
  openEditor, anteprima, stampa, riapri, scrollFase, exportExcel, esportaEditabile,
  setSalQta, setSalQuota, setPrezzo, setSalData, setSalDetr, setSalNote, rigeneraDaComputo, addVoce, duplicaVoce, delVoce,
  toggleMisure, dettagliaMisure, addMisura, setMisura, delMisura, annullaStorno,
  misKey, misFuoco, misSfuoco, duplicaMisura, copiaMisure, incollaMisure, misIncollaQui,
  addGiornale, setGiornale, delGiornale, addRiserva, setRiserva, delRiserva, setRelazione,
  setRiservaConferma, setFirmaEsecutore, setDataFirmaEsecutore, verbaleRifiutoFirma,
  setDestImport, setMisureImport, confermaAggiunta, confermaImport, setModoImport, setPeriziaIntera, toggleImport, segnaImport, filtraImport,
  vaiAScadenza, setSalCert, setContoFinale,
  creaFattura, setFattura, setFatturaCre, delFattura, setSemplificata, setFogliRegistro,
  creaSottoComputo, addSottoVoce, setSottoVoce, setSottoEseguito, delSottoVoce, delSottoComputo,
  apriElencoPrezzi, epFiltra, epVoceAMano, epDalPrezzario, epModifica, epAssimila, epNelLibretto, epElimina,
})

/* TRASCINA UN FILE SULLA FINESTRA. Un .quadra o un .xpwe lasciato qui si apre
   come SORGENTE da cui pescare voci quando un lavoro c'è già; su un programma
   vuoto, invece, diventa il lavoro. Niente di quello che c'è viene sovrascritto
   senza passare dal pannello di import. */
function abilitaTrascinamentoFile(): void {
  const utile = (e: DragEvent): File | null => {
    const f = e.dataTransfer?.files?.[0]
    return f && /\.(quadra|xpwe|xml)$/i.test(f.name) ? f : null
  }
  window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); document.body.classList.add('is-drop') } })
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('is-drop') })
  window.addEventListener('drop', (e) => {
    document.body.classList.remove('is-drop')
    const f = utile(e as DragEvent); if (!f) return
    e.preventDefault()
    if (!S.partite.length && /\.(xpwe|xml)$/i.test(f.name)) {
      // programma vuoto: il file trascinato diventa il lavoro, come se fosse
      // stato scelto dal pulsante di import
      const dt = new DataTransfer(); dt.items.add(f)
      const inp = $('bXpweFile') as HTMLInputElement | null
      if (inp) { inp.files = dt.files; inp.dispatchEvent(new Event('change')) }
      return
    }
    void leggiSorgente(f).then(() => {
      if (!_cassetto && _sorgente) apriCassetto(salDiDestinazione(S.sals), 'altro')
    })
  })
}

function boot(): void {
  abilitaTrascinamentoFile()
  /* ⌘C e ⌘V sulle voci: solo quando c'è una selezione e non si sta scrivendo
     in un campo, altrimenti si rubano gli appunti a chi copia del testo. */
  document.addEventListener('keydown', (e) => {
    const dentroCampo = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')
    if (dentroCampo || !(e.metaKey || e.ctrlKey) || !S.editor) return
    const ctx: Contesto = S.editor.tipo === 'perizia'
      ? `pz${Number(/^perizia-(\d+)$/.exec(S.editor.fase)?.[1] || 0)}`
      : Number(/^sal-(\d+)$/.exec(S.editor.fase)?.[1] || 0)
    if (e.key === 'c' && libSel.size) { e.preventDefault(); copiaVociSelezionate() }
    else if (e.key === 'v' && ctx) { e.preventDefault(); void incollaVoci(ctx) }
  })
  clearDraftResidue(); registerGuide(BETA_GUIDE); renderAll()
  void aggiornaPrezzari() // l'archivio del programma, lo stesso del Computo
  // se si arriva dalle stampe dell'altro strumento, si atterra sulle stampe
  try {
    // Si arriva dal Computo con una stampa già scelta: si apre la schermata e si
    // lancia quella stampa, invece di lasciare l'utente a ricercarla.
    const attesa = sessionStorage.getItem('quadra:stampa-attesa')
    if (attesa != null) {
      sessionStorage.removeItem('quadra:stampa-attesa')
      apriStampe()
      if (attesa) setTimeout(() => {
        const b = document.querySelector<HTMLButtonElement>(`.ehb-stampe [data-stampa="${CSS.escape(attesa)}"]`)
        if (b && !b.disabled && !b.classList.contains('is-altrove')) b.click()
      }, 60)
    }
  } catch { /* ok */ }
  sendToHub({ type: 'app:request-state', want: 'pricelist' })
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light')
  $('bLogoFile')?.addEventListener('change', onLogoFile)
  $('bXpweFile')?.addEventListener('change', (e) => { void onXpweFile(e) })
  bindThemeShortcut(toggleTheme)
  bindGuideShortcut('beta')
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
