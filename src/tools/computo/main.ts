/**
 * Modulo ES di Computo (STEP 4d): gestisce i prezzari INTERNI con caricamento
 * a RICHIESTA.
 *
 * Il manifest (`prezzari/_bundle/manifest.js`) popola la sidebar all'avvio senza
 * caricare i dati. Al clic su un prezzario, lo script legacy chiama
 * `window.__pricelistLoadRows(slug)` che:
 *  1. inietta `prezzari/_bundle/<slug>.js` via <script src> — funziona sotto
 *     file:// (dove `fetch` è bloccato dall'iframe srcdoc), come i vendor;
 *  2. decodifica il gzip base64 registrato su `window.__PRZ[slug]` con
 *     Blob + DecompressionStream (nessun fetch);
 *  3. ricostruisce le righe con `unpackPrezzario`.
 */
import { leggiPreferenzeStampa, salvaPreferenzeStampa } from '../../shared/stampe/preferenze'
import { impostaStudioStampe, impostaStileStampaPdf } from '../../shared/stampa/registro-pdf'
import { parseXpwe, xpweToVoci, buildXpwe, type VoceComputo } from '../../shared/xpwe/xpwe'
import { barraVoci } from '../../shared/ui/barra-voci'
import { computoPdf, importoVoce, type DatiGeneraliComputo, type OpzioniComputoPdf } from '../../shared/stampa/computo-pdf'
import type { ModoOrdine } from '../../shared/ordine-computo'
import { stampeDelComputo, stampeDellaContabilita, stampeHTML } from '../../shared/stampe/catalogo'
import { anteprimaPdf } from '../../shared/ui/anteprima-pdf'
import { elencoPrezziPdf, verbaleNuoviPrezziPdf, incidenzaManodoperaPdf, listaLavorazioniPdf, incidenzaSicurezzaPdf, type OpzioniIncidenzaMdo, quadroEconomicoPdf, stimaLavoriPdf } from '../../shared/stampa/progetto-pdf'
import { calcolaQE, normalizzaQE, type QuadroEconomico } from '../../shared/quadro-economico'
import { loadPdfLib } from '../../shared/vendor'
import { formDatiGenerali, normalizzaDatiGenerali, completaDatiGenerali, datiGeneraliCompilati, type DatiGenerali } from '../../shared/dati-generali'
import { openModal } from '../../shared/ui/components/modal'
import { apriOfferte } from './offerte-ui'
import { unpackPrezzario, classifyTematica, TEMATICHE, macrocategorieFor, MACROCATEGORIE, searchRows, prewarmSearchIndexAsync, searchManodoperaRows, isManodoperaRow, isNoloRow, searchNoloRows, isMaterialeRow, isOperaCompiutaRow, searchMaterialeRows, suggestManodoperaPerMacro, scomposizioneToRighe, indicePerCodice, hasScomposizione, suggestRows, suggestLabel, buildComputoModel, computoHTML, FRASARIO, componiDescrizione, verificaCoerenza, suggerisciFamiglia, frasarioFor, VOCI_PRONTE, voceProntaText, estraiVociDaScheda, rideriveDescrizione, MARCHI, SETTORE_LABEL, calcolaAnalisi, incidenzaManodopera, DEFAULT_SPESE_GENERALI_PCT, DEFAULT_UTILE_IMPRESA_PCT, analisiPrezziHTML, fascicoloAnalisiHTML, analisiPrezziAOA, analisiPrezziFileName, fascicoloIndiceAOA, fascicoloSheetName, fascicoloFileName, aoaColWidths, aoaMerges, computoMetricoAOA, computoMetricoFileName, CATEGORIE_GOLDEN, normalizzaAmbito, calcolaRigaMisurazione, sommaMisurazioni, type PackedPrezzario, type PriceRow, type ComputoItem, type ComputoMeta, type VoceProposta, type AnalisiPrezzi, FASI_COMPUTO, snapshotComputo, revisioneDiProgetto, rinominaRevisione, elencoDellaRevisione, naturaDi, ultimaDiComputo, confrontaRevisione, confrontoRevisioniHTML, type Revisione, type Confronto } from './engine'
import { loadScript, loadPDF, parseVersionFromURL, onHubMessage, type CompanyBrand } from '../../shared'
import { makeResizer, makeAccordion, makeCollapse, toggleGuide, closeGuide as closeGuideShared, bindGuideShortcut, flashElement, viewEnter, undoToast } from '../../shared/ui/components/index'
import { registerGuide } from '../../shared/ui/guide'
import { MIU_GUIDE } from './data/guida'
import { startTour } from '../../shared/ui/components/tour'
import { MIU_TOUR } from './data/tour'
import { initAnalytics } from '../../shared/analytics'

initAnalytics()

interface ManifestEntry { slug: string; regione: string | null; anno: string | null; count: number; categoria?: 'pubblico' | 'privato' }

declare global {
  interface Window {
    __PRZ?: Record<string, string>
    __PRZ_MANIFEST?: ManifestEntry[]
    __pricelistRegister?: (manifest: ManifestEntry[]) => void
    __pricelistLoadRows?: (slug: string, onP?: (p: number) => void) => Promise<PriceRow[]>
    /** Report computo/estratto (engine puro), usato dallo script inline di index.html. */
    miuComputoReport?: (items: ComputoItem[], meta?: ComputoMeta) => string
    /** Report PDF dell'Analisi Prezzi (engine puro), usato dallo script inline. */
    miuAnalisiPrezziReport?: (a: AnalisiPrezzi) => string
    /** Fascicolo PDF di TUTTE le Analisi Prezzi del carrello (sistema documentale condiviso). */
    miuFascicoloAnalisiReport?: (list: AnalisiPrezzi[]) => string
    /** Avvia il tour guidato di Computo, richiamato dal bottone nella guida (script inline). */
    startMiuTour?: () => void
    /** Layer condiviso di micro-interazioni, per lo script legacy inline. */
    ehbFeedback?: { flashElement: typeof flashElement; viewEnter: typeof viewEnter; undoToast: typeof undoToast }
  }
}

// Intestazione dello studio (azienda) ricevuta dall'hub per le stampe.
let suiteCompany: CompanyBrand | null = null
onHubMessage((m) => { if (m.type === 'hub:set-company') { suiteCompany = m.company; impostaStudioStampe(m.company?.name) } })

// Esposto su window: lo script classico inline di index.html non può importare i
// moduli ES, quindi gli passiamo l'engine del report come funzione pronta all'uso.
window.miuComputoReport = (items, meta) => computoHTML(buildComputoModel(items, meta), suiteCompany)
window.miuAnalisiPrezziReport = (a) => analisiPrezziHTML(a, suiteCompany)
window.miuFascicoloAnalisiReport = (list) => fascicoloAnalisiHTML(list, suiteCompany)
window.startMiuTour = () => startTour(MIU_TOUR)
/* ── TUTTE LE STAMPE DEL LAVORO, DA QUI ───────────────────────────────────
   Le carte di un lavoro sono un elenco solo: progetto, gara, contabilità,
   interscambio. Si vedono tutte da tutti e due gli strumenti; quelle dell'altro
   strumento portano lì con la stampa già scelta. Per sapere a che punto è la
   contabilità (quanti SAL, se ci sono perizie) ascoltiamo lo stato che l'hub
   rilancia: se non arriva, l'elenco c'è lo stesso e dice che cosa manca. */
let statoContabilita: { sals?: { numero: number; firmato?: boolean }[]; partite?: unknown[]; appalto?: { perizie?: unknown[] } } | null = null
window.addEventListener('message', (ev: MessageEvent) => {
  const m = ev.data as { type?: string; source?: string; project?: unknown } | null
  if (m && m.type === 'hub:project-state' && m.source === 'contabilita') {
    statoContabilita = (m.project as typeof statoContabilita) || null
    ;(window as unknown as { miuAggiornaStampe?: () => void }).miuAggiornaStampe?.()
    /* I dati del lavoro sono gli stessi dei due strumenti: quelli corretti in
       Contabilità completano qui i campi ancora vuoti, senza mai sovrascrivere
       quello che il progettista ha scritto. */
    const dg = (m.project as { datiGenerali?: Partial<DatiGenerali> } | null)?.datiGenerali
    if (dg) (window as unknown as { miuCompletaDatiGenerali?: (d: Partial<DatiGenerali>) => void }).miuCompletaDatiGenerali?.(dg)
  }
})
;(window as unknown as { miuStampe?: unknown }).miuStampe = {
  catalogo: (o: { vociNelComputo: number; conAnalisi?: boolean }) => [
    ...stampeDelComputo(o),
    ...stampeDellaContabilita({
      sals: (statoContabilita?.sals || []).map((x) => ({ numero: x.numero, firmato: !!x.firmato })),
      conPartite: (statoContabilita?.partite || []).length > 0 || o.vociNelComputo > 0,
      conPerizie: ((statoContabilita?.appalto?.perizie || []) as unknown[]).length > 0,
    }),
  ],
  html: stampeHTML,
}
// Revisioni del computo: il modello puro per lo script legacy (engine/revisioni.ts).
;(window as unknown as { miuRevisioni?: unknown }).miuRevisioni = {
  FASI: FASI_COMPUTO,
  snapshot: snapshotComputo,
  progetto: revisioneDiProgetto,
  rinomina: rinominaRevisione,
  elenco: elencoDellaRevisione,
  natura: naturaDi,
  ultimaDiComputo,
  confronta: confrontaRevisione,
  importoVoce,
  confrontoHTML: (rev: Revisione, c: Confronto, dg?: Partial<DatiGenerali>) =>
    confrontoRevisioniHTML(rev, c, dg as { oggetto?: string; committente?: string; cup?: string }, { company: suiteCompany, now: Date.now() }),
}
window.ehbFeedback = { flashElement, viewEnter, undoToast }
/* L'anteprima prima della stampa, come negli atti della contabilità: una stampa
   si guarda, poi si stampa o si salva — dalla stessa riga di pulsanti. */
;(window as unknown as { miuAnteprimaPdf?: unknown }).miuAnteprimaPdf = (bytes: Uint8Array, o: Parameters<typeof anteprimaPdf>[1]) => {
  const rifai = _rifaiStampa
  anteprimaPdf(bytes, { ...o, ...(rifai ? { rifai: async () => (await rifai()).bytes } : {}) })
}

// Guida rapida Computo → sezione del manuale unico condiviso (visore F1). Sovrascrive
// openGuide/closeGuide dello script legacy (main.ts viene caricato dopo).
registerGuide({ ...MIU_GUIDE, onTour: () => startTour(MIU_TOUR) })
bindGuideShortcut('miu')
Object.assign(window, { openGuide: () => toggleGuide('miu'), closeGuide: () => closeGuideShared() })

/** Decodifica un gzip base64 in PackedPrezzario senza fetch (Blob + DecompressionStream). */
async function decodeGz(b64: string): Promise<PackedPrezzario> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  return JSON.parse(text) as PackedPrezzario
}

window.__pricelistLoadRows = async (slug, onP): Promise<PriceRow[]> => {
  onP?.(15)
  await loadScript(`prezzari/_bundle/${slug}.js`)   // <script src> esterno (ok sotto file://)
  const b64 = window.__PRZ?.[slug]
  if (!b64) throw new Error('dataset interno non trovato: ' + slug)
  onP?.(45)
  const packed = await decodeGz(b64)
  onP?.(80)
  const { rows } = unpackPrezzario(packed)
  for (const r of rows) {
    r.tematica = classifyTematica(r) // macro-tematica per il filtro
    r.macro = macrocategorieFor(r)   // macrocategorie impianti, 0..n
  }
  onP?.(100)
  return rows
}

// Esposte allo script legacy (inline): classificatore + elenco ufficiale tematiche.
;(window as unknown as { classifyTematica?: typeof classifyTematica; TEMATICHE?: string[] }).classifyTematica = classifyTematica
;(window as unknown as { TEMATICHE?: string[] }).TEMATICHE = TEMATICHE
;(window as unknown as { macrocategorieFor?: typeof macrocategorieFor }).macrocategorieFor = macrocategorieFor
;(window as unknown as { MACROCATEGORIE?: string[] }).MACROCATEGORIE = MACROCATEGORIE
;(window as unknown as { searchRows?: typeof searchRows }).searchRows = searchRows
;(window as unknown as { prewarmSearchIndexAsync?: typeof prewarmSearchIndexAsync }).prewarmSearchIndexAsync = prewarmSearchIndexAsync
;(window as unknown as { searchManodoperaRows?: typeof searchManodoperaRows }).searchManodoperaRows = searchManodoperaRows
;(window as unknown as { isManodoperaRow?: typeof isManodoperaRow }).isManodoperaRow = isManodoperaRow
;(window as unknown as { isNoloRow?: typeof isNoloRow }).isNoloRow = isNoloRow
;(window as unknown as { searchNoloRows?: typeof searchNoloRows }).searchNoloRows = searchNoloRows
;(window as unknown as { isMaterialeRow?: typeof isMaterialeRow }).isMaterialeRow = isMaterialeRow
;(window as unknown as { isOperaCompiutaRow?: typeof isOperaCompiutaRow }).isOperaCompiutaRow = isOperaCompiutaRow
;(window as unknown as { searchMaterialeRows?: typeof searchMaterialeRows }).searchMaterialeRows = searchMaterialeRows
;(window as unknown as { suggestManodoperaPerMacro?: typeof suggestManodoperaPerMacro }).suggestManodoperaPerMacro = suggestManodoperaPerMacro
;(window as unknown as { scomposizioneToRighe?: typeof scomposizioneToRighe }).scomposizioneToRighe = scomposizioneToRighe
;(window as unknown as { indicePerCodice?: typeof indicePerCodice }).indicePerCodice = indicePerCodice
;(window as unknown as { hasScomposizione?: typeof hasScomposizione }).hasScomposizione = hasScomposizione
;(window as unknown as { suggestRows?: typeof suggestRows }).suggestRows = suggestRows
;(window as unknown as { suggestLabel?: typeof suggestLabel }).suggestLabel = suggestLabel
// Compositore di descrizioni per voci di computo (engine puro).
;(window as unknown as { FRASARIO?: typeof FRASARIO }).FRASARIO = FRASARIO
;(window as unknown as { componiDescrizione?: typeof componiDescrizione }).componiDescrizione = componiDescrizione
;(window as unknown as { verificaCoerenza?: typeof verificaCoerenza }).verificaCoerenza = verificaCoerenza
;(window as unknown as { suggerisciFamiglia?: typeof suggerisciFamiglia }).suggerisciFamiglia = suggerisciFamiglia
// una distinta pubblica solo famigliaId (non un testo): per il match nel prezzario
// si cerca sul NOME della famiglia (allineato al thesaurus), non sulla dicitura
// propria della distinta, che non è detto coincida con alias/sinonimi del prezzario.
;(window as unknown as { frasarioFor?: typeof frasarioFor }).frasarioFor = frasarioFor
// Libreria di voci pronte (seed curato minato dai computi golden) + helper testo.
;(window as unknown as { VOCI_PRONTE?: typeof VOCI_PRONTE }).VOCI_PRONTE = VOCI_PRONTE
;(window as unknown as { voceProntaText?: typeof voceProntaText }).voceProntaText = voceProntaText
// Import scheda tecnica (PDF) → voci candidate. Il testo lo estrae pdf.js qui
// (adapter impuro); il riconoscimento è l'engine puro `estraiVociDaScheda`.
;(window as unknown as { estraiVociDaScheda?: typeof estraiVociDaScheda }).estraiVociDaScheda = estraiVociDaScheda
// Ricalcola breve/estesa di una voce-da-scheda quando marca/modello vengono
// arricchiti DOPO l'estrazione (es. un aggancio al listino) — senza, l'arricchimento
// non arrivava mai al testo mostrato/caricato nel compositore.
;(window as unknown as { rideriveDescrizione?: typeof rideriveDescrizione }).rideriveDescrizione = rideriveDescrizione
// KB marchi + label settori: la UI mostra per quali produttori/comparti l'import
// è ottimizzato (pannello ⓘ) — si aggiorna da sola quando la KB cresce.
;(window as unknown as { MARCHI?: typeof MARCHI }).MARCHI = MARCHI
;(window as unknown as { SETTORE_LABEL?: typeof SETTORE_LABEL }).SETTORE_LABEL = SETTORE_LABEL
;(window as unknown as { importDatasheetPDF?: (f: File) => Promise<VoceProposta[]> }).importDatasheetPDF = importDatasheetPDF

// Analisi Prezzi (engine puro): calcolo totali + default SG/UI + matrice export Excel.
;(window as unknown as { calcolaAnalisi?: typeof calcolaAnalisi }).calcolaAnalisi = calcolaAnalisi
;(window as unknown as { incidenzaManodopera?: typeof incidenzaManodopera }).incidenzaManodopera = incidenzaManodopera
// Computo Metrico (engine puro): righe di misura L1×L2×H×n → quantità di voce.
;(window as unknown as { calcolaRigaMisurazione?: typeof calcolaRigaMisurazione }).calcolaRigaMisurazione = calcolaRigaMisurazione
;(window as unknown as { sommaMisurazioni?: typeof sommaMisurazioni }).sommaMisurazioni = sommaMisurazioni
;(window as unknown as { DEFAULT_SPESE_GENERALI_PCT?: number }).DEFAULT_SPESE_GENERALI_PCT = DEFAULT_SPESE_GENERALI_PCT
;(window as unknown as { DEFAULT_UTILE_IMPRESA_PCT?: number }).DEFAULT_UTILE_IMPRESA_PCT = DEFAULT_UTILE_IMPRESA_PCT
;(window as unknown as { analisiPrezziAOA?: typeof analisiPrezziAOA }).analisiPrezziAOA = analisiPrezziAOA
;(window as unknown as { analisiPrezziFileName?: typeof analisiPrezziFileName }).analisiPrezziFileName = analisiPrezziFileName
// Fascicolo multi-analisi (toolbar): Indice + un foglio per analisi del carrello.
;(window as unknown as { fascicoloIndiceAOA?: typeof fascicoloIndiceAOA }).fascicoloIndiceAOA = fascicoloIndiceAOA
;(window as unknown as { fascicoloSheetName?: typeof fascicoloSheetName }).fascicoloSheetName = fascicoloSheetName
;(window as unknown as { fascicoloFileName?: typeof fascicoloFileName }).fascicoloFileName = fascicoloFileName
;(window as unknown as { aoaColWidths?: typeof aoaColWidths }).aoaColWidths = aoaColWidths
;(window as unknown as { aoaMerges?: typeof aoaMerges }).aoaMerges = aoaMerges
// Export Excel del Computo Metrico (generico, nessun template esterno).
;(window as unknown as { computoMetricoAOA?: typeof computoMetricoAOA }).computoMetricoAOA = computoMetricoAOA
;(window as unknown as { computoMetricoFileName?: typeof computoMetricoFileName }).computoMetricoFileName = computoMetricoFileName
// Import/export XPWE del computo — vedi src/shared/xpwe/xpwe.ts.
;(window as unknown as { miuXpwe?: unknown }).miuXpwe = { parseXpwe, xpweToVoci, buildXpwe }
// La barra delle voci: la stessa del libretto e della perizia (shared/ui/barra-voci).
;(window as unknown as { ehbBarraVoci?: typeof barraVoci }).ehbBarraVoci = barraVoci
// Stampa PDF «da elaborato» del computo (riporti, numerazione pagine) — pdf-lib da vendor/, caricato a richiesta.
;(window as unknown as { miuDatiGeneraliLib?: unknown }).miuDatiGeneraliLib = {
  /** Apre il form dei dati generali; risolve con i dati salvati o undefined se annullato. */
  async apri(attuali: unknown): Promise<DatiGenerali | undefined> {
    let bozza = normalizzaDatiGenerali(attuali)
    const corpo = formDatiGenerali(bozza, (dg) => { bozza = dg })
    const esito = await openModal({
      title: 'Dati generali del progetto', body: corpo,
      actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Salva', variant: 'accent', value: true }],
    })
    return esito === true ? normalizzaDatiGenerali(bozza) : undefined
  },
  completa: (base: unknown, nuovi: Partial<DatiGenerali>) => completaDatiGenerali(normalizzaDatiGenerali(base), nuovi),
}
/** Badge del passo «Dati generali» nel binario: quanti campi sono compilati. */
;(window as unknown as { miuAggiornaDgRail?: unknown }).miuAggiornaDgRail = () => {
  const el = document.getElementById('dg-rail-n')
  const S = (window as unknown as { miuStato?: () => { datiGenerali?: Partial<DatiGenerali> } }).miuStato?.()
  if (el) el.textContent = S ? String(datiGeneraliCompilati(S.datiGenerali)) : ''
}
/** Opzioni di stampa del computo (descrizioni estese/ridotte/compatte, riga WBS), ricordate tra una stampa e l'altra. */
;(window as unknown as { miuOpzioniStampa?: unknown }).miuOpzioniStampa = async (modoSchermo: ModoOrdine = 'categorie'): Promise<OpzioniComputoPdf | undefined> => {
  // Le opzioni di stampa sono UNA per tutto il programma: quello che si sceglie
  // qui vale anche per gli atti contabili, e viceversa (shared/stampe/preferenze).
  const pref = leggiPreferenzeStampa()
  const prec: OpzioniComputoPdf = {
    descrizione: pref.descrizione, righeMax: pref.righeMax, righeFinali: pref.righeFinali,
    rigaWbs: pref.rigaWbs, riepilogo: pref.riepilogo, senzaPrezzi: pref.senzaPrezzi, conRidotta: pref.conRidotta,
  }
  const corpo = document.createElement('div')
  corpo.className = 'stampa-opz'
  corpo.style.display = 'grid'; corpo.style.gap = 'var(--sp-3)'
  const voce = (val: string, titolo: string, sotto: string): string =>
    `<label class="ehb-field" style="flex-direction:row;align-items:flex-start;gap:var(--sp-2)"><input type="radio" name="descr" value="${val}"${prec.descrizione === val ? ' checked' : ''}>` +
    `<span><b>${titolo}</b><br><span class="ehb-label">${sotto}</span></span></label>`
  corpo.innerHTML = `<label class="ehb-field" style="flex-direction:row;align-items:flex-start;gap:var(--sp-2)"><input type="checkbox" name="senzaprezzi"${prec.senzaPrezzi ? ' checked' : ''}>` +
    `<span><b>Senza prezzi</b> (computo metrico non estimativo)<br><span class="ehb-label">Solo misure e quantità: niente prezzi, importi né riepiloghi.</span></span></label>` +
    `<span class="ehb-label" style="font-weight:700">Descrizione delle voci</span>` +
    voce('estesa', 'Estesa', 'La descrizione completa del prezzario.') +
    voce('ridotta', 'Ridotta', 'Solo la descrizione breve: il computo occupa molte meno pagine.') +
    voce('compatta', 'Estesa, ma accorciata', 'Delle voci lunghe si stampano le prime righe e le ultime (dove stanno le sottovoci); il taglio in mezzo è segnato da «…».') +
    `<div style="display:flex;gap:var(--sp-3);margin-left:28px">` +
    `<label class="ehb-field" style="max-width:140px"><span class="ehb-label">Prime righe</span><input class="ehb-input" type="number" min="1" max="30" name="righe" value="${prec.righeMax ?? 3}"></label>` +
    `<label class="ehb-field" style="max-width:140px"><span class="ehb-label">Ultime righe</span><input class="ehb-input" type="number" min="0" max="30" name="finali" value="${prec.righeFinali ?? 2}"></label></div>` +
    `<label class="ehb-field" style="flex-direction:row;align-items:flex-start;gap:var(--sp-2)"><input type="checkbox" name="conridotta"${prec.conRidotta ? ' checked' : ''}>` +
    `<span>Includi anche la <b>descrizione ridotta</b><br><span class="ehb-label">In grassetto sopra l'estesa (vale per «Estesa» e «Estesa, ma accorciata»).</span></span></label>` +
    `<label class="ehb-field"><span class="ehb-label" style="font-weight:700">Ordine e titoli delle voci</span><select class="ehb-input" name="ordine">` +
    ([['categorie', 'Per Supercategoria › Categoria › Subcategoria'], ['wbs', 'Per WBS'], ['manuale', 'Ordine manuale, senza titoli']] as const)
      .map(([v, t]) => `<option value="${v}"${modoSchermo === v ? ' selected' : ''}>${t}${modoSchermo === v ? ' (come a schermo)' : ''}</option>`).join('') +
    `</select></label>` +
    `<label class="ehb-field" style="flex-direction:row;align-items:center;gap:var(--sp-2)"><input type="checkbox" name="wbs"${prec.rigaWbs !== false ? ' checked' : ''}><span>Stampa la riga WBS sotto ogni voce</span></label>` +
    `<label class="ehb-field"><span class="ehb-label" style="font-weight:700">Riepilogo in fondo</span><select class="ehb-input" name="riepilogo">` +
    ([['entrambi', 'Per categorie e per WBS'], ['categorie', 'Solo per categorie (Super › Categoria › Sub)'], ['wbs', 'Solo per WBS'], ['nessuno', 'Nessun riepilogo']] as const)
      .map(([v, t]) => `<option value="${v}"${(prec.riepilogo ?? 'entrambi') === v ? ' selected' : ''}>${t}</option>`).join('') +
    `</select></label>`
  corpo.addEventListener('keydown', e => e.stopPropagation())
  const esito = await openModal({
    title: 'Stampa del computo metrico estimativo', body: corpo,
    actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Crea il PDF', variant: 'accent', value: true }],
  })
  if (esito !== true) return undefined
  const sel = corpo.querySelector('input[name="descr"]:checked') as HTMLInputElement | null
  const opz: OpzioniComputoPdf = {
    descrizione: (sel?.value as OpzioniComputoPdf['descrizione']) ?? 'estesa',
    righeMax: Math.max(1, Number((corpo.querySelector('input[name="righe"]') as HTMLInputElement).value) || 3),
    righeFinali: Math.max(0, Number((corpo.querySelector('input[name="finali"]') as HTMLInputElement).value) || 0),
    raggruppa: ((corpo.querySelector('select[name="ordine"]') as HTMLSelectElement).value as ModoOrdine) || modoSchermo,
    rigaWbs: (corpo.querySelector('input[name="wbs"]') as HTMLInputElement).checked,
    riepilogo: ((corpo.querySelector('select[name="riepilogo"]') as HTMLSelectElement).value as OpzioniComputoPdf['riepilogo']) || 'entrambi',
    senzaPrezzi: (corpo.querySelector('input[name="senzaprezzi"]') as HTMLInputElement).checked,
    conRidotta: (corpo.querySelector('input[name="conridotta"]') as HTMLInputElement).checked,
  }
  salvaPreferenzeStampa({
    ...pref, descrizione: opz.descrizione ?? 'estesa', righeMax: opz.righeMax ?? 3, righeFinali: opz.righeFinali ?? 2,
    rigaWbs: opz.rigaWbs !== false, riepilogo: opz.riepilogo ?? 'entrambi',
    senzaPrezzi: !!opz.senzaPrezzi, conRidotta: !!opz.conRidotta,
  })
  return opz
}
/** Ordine/titoli e riepiloghi per le stampe che seguono il computo (es. incidenza manodopera). */
;(window as unknown as { miuOpzioniOrdine?: unknown }).miuOpzioniOrdine = async (modoSchermo: ModoOrdine = 'categorie', titolo = 'Stampa'): Promise<{ raggruppa: ModoOrdine; riepilogo: OpzioniComputoPdf['riepilogo'] } | undefined> => {
  const prec: OpzioniComputoPdf['riepilogo'] = leggiPreferenzeStampa().riepilogo
  const corpo = document.createElement('div')
  corpo.style.display = 'grid'; corpo.style.gap = 'var(--sp-3)'
  corpo.innerHTML =
    `<label class="ehb-field"><span class="ehb-label" style="font-weight:700">Ordine e titoli delle voci</span><select class="ehb-input" name="ordine">` +
    ([['categorie', 'Per Supercategoria › Categoria › Subcategoria'], ['wbs', 'Per WBS'], ['manuale', 'Ordine manuale, senza titoli']] as const)
      .map(([v, t]) => `<option value="${v}"${modoSchermo === v ? ' selected' : ''}>${t}${modoSchermo === v ? ' (come a schermo)' : ''}</option>`).join('') +
    `</select></label>` +
    `<label class="ehb-field"><span class="ehb-label" style="font-weight:700">Riepilogo in fondo</span><select class="ehb-input" name="riepilogo">` +
    ([['entrambi', 'Per categorie e per WBS'], ['categorie', 'Solo per categorie (Super › Categoria › Sub)'], ['wbs', 'Solo per WBS'], ['nessuno', 'Nessun riepilogo']] as const)
      .map(([v, t]) => `<option value="${v}"${prec === v ? ' selected' : ''}>${t}</option>`).join('') +
    `</select></label>`
  corpo.addEventListener('keydown', e => e.stopPropagation())
  const esito = await openModal({
    title: titolo, body: corpo,
    actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Crea il PDF', variant: 'accent', value: true }],
  })
  if (esito !== true) return undefined
  return {
    raggruppa: ((corpo.querySelector('select[name="ordine"]') as HTMLSelectElement).value as ModoOrdine) || modoSchermo,
    riepilogo: ((corpo.querySelector('select[name="riepilogo"]') as HTMLSelectElement).value as OpzioniComputoPdf['riepilogo']) || 'entrambi',
  }
}
/** Chiede il codice WBS («01.02 Scavi») da assegnare a più voci; null se annullato, '' per toglierlo. */
;(window as unknown as { miuChiediWbs?: unknown }).miuChiediWbs = async (n: number, nodi: Record<string, string>): Promise<string | null> => {
  const corpo = document.createElement('div')
  corpo.style.display = 'grid'; corpo.style.gap = 'var(--sp-2)'
  const att = (t: string): string => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const codici = Object.keys(nodi).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
  // con una struttura WBS predisposta si sceglie da elenco; il campo libero serve solo per un nodo nuovo
  corpo.innerHTML = (codici.length
    ? `<label class="ehb-field"><span class="ehb-label">Nodo della struttura WBS</span><select class="ehb-input" name="nodo">` +
      `<option value="">— nessuna WBS (toglie) —</option>` +
      codici.map(c => `<option value="${att(c)}">${att(c)}${nodi[c] ? ' — ' + att(nodi[c]) : ''}</option>`).join('') +
      `<option value="__nuovo">＋ nuovo nodo…</option></select></label>`
    : '') +
    `<label class="ehb-field"${codici.length ? ' hidden' : ''}><span class="ehb-label">Codice e descrizione del nuovo nodo (es. <b>02.01 Scavi</b>; vuoto per togliere la WBS dalle ${n} voci)</span>` +
    `<input class="ehb-input" name="wbs" placeholder="02.01 Scavi"></label>`
  const sel = corpo.querySelector('select') as HTMLSelectElement | null
  const inp = corpo.querySelector('input') as HTMLInputElement
  corpo.addEventListener('keydown', e => e.stopPropagation())
  sel?.addEventListener('change', () => {
    const libero = sel.value === '__nuovo'
    ;(inp.closest('label') as HTMLElement).hidden = !libero
    if (libero) inp.focus()
  })
  setTimeout(() => (sel ?? inp).focus(), 50)
  const esito = await openModal({
    title: `WBS per ${n} voc${n === 1 ? 'e' : 'i'}`, body: corpo,
    actions: [{ label: 'Annulla', variant: 'ghost', value: false }, { label: 'Assegna', variant: 'accent', value: true }],
  })
  if (esito !== true) return null
  return sel && sel.value !== '__nuovo' ? sel.value : inp.value
}
/* I PDF rispettano le impostazioni di stampa di chi stampa (foglio, margini, corpo):
   il motore le legge da qui, ogni volta, così le cambia anche il pannello «Aspetto»
   dell'anteprima (shared/ui/anteprima-pdf.ts). */
impostaStileStampaPdf(() => leggiPreferenzeStampa().stile)
/* COME RIFARE L'ULTIMA STAMPA: ogni generatore si ricorda con che argomenti è
   stato chiamato, e l'anteprima lo richiama quando cambia l'aspetto. */
let _rifaiStampa: (() => Promise<{ bytes: Uint8Array }>) | null = null
function ricorda<A extends unknown[], R extends { bytes: Uint8Array }>(f: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => { _rifaiStampa = () => f(...a); return f(...a) }
}
;(window as unknown as { miuComputoPdf?: unknown }).miuComputoPdf = ricorda(async (voci: VoceComputo[], dg?: DatiGeneraliComputo, opz?: OpzioniComputoPdf) => {
  await loadPdfLib()
  return computoPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg, opz)
})
// Vocabolario categorie (vista Categorie: pannello suggerimenti/drag&drop) —
// vedi src/tools/computo/engine/categorie-db.ts.
;(window as unknown as { CATEGORIE_GOLDEN?: typeof CATEGORIE_GOLDEN }).CATEGORIE_GOLDEN = CATEGORIE_GOLDEN
;(window as unknown as { normalizzaAmbito?: typeof normalizzaAmbito }).normalizzaAmbito = normalizzaAmbito

/**
 * Estrae il testo di TUTTE le pagine di un PDF scheda-tecnica con pdf.js (già in
 * vendor/, offline) e ne ricava le voci candidate. PDF scansionati senza layer
 * testo ⇒ testo vuoto ⇒ nessuna proposta (l'UI mostra il messaggio dedicato).
 */
async function importDatasheetPDF(file: File): Promise<VoceProposta[]> {
  await loadPDF() // inietta vendor/pdf.min.js una sola volta
  const pdfjsLib = (window as unknown as { pdfjsLib: any }).pdfjsLib
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'
  const data = new Uint8Array(await file.arrayBuffer())
  // isEvalSupported:false → una scheda tecnica PDF ostile non esegue JS nel
  // renderer (CVE-2024-4367): qui il file arriva da un produttore qualsiasi.
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  let testo = ''
  let titolo = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    const items = tc.items as { str?: string; height?: number; transform?: number[] }[]
    testo += items.map(it => it.str ?? '').join(' ') + '\n'
    // titolo = il testo più GRANDE della prima pagina (di solito modello + codice),
    // raggruppato per RIGA (y da transform[5]): i titoli su due righe restano in
    // ordine di lettura e non si mescolano con frammenti sparsi della pagina.
    if (i === 1) {
      const nonVuoti = items.filter(it => (it.str ?? '').trim())
      const maxH = Math.max(0, ...nonVuoti.map(it => it.height ?? 0))
      const grandi = nonVuoti.filter(it => (it.height ?? 0) >= maxH * 0.85)
      const righe = new Map<number, string[]>()
      for (const it of grandi) {
        const y = Math.round((it.transform?.[5] ?? 0) / 3) // tolleranza ~3pt di baseline
        if (!righe.has(y)) righe.set(y, [])
        righe.get(y)!.push(it.str ?? '')
      }
      titolo = [...righe.entries()]
        .sort((a, b) => b[0] - a[0]) // y PDF cresce verso l'alto: prima le righe in alto
        .slice(0, 2)
        .map(([, frag]) => frag.join(' '))
        .join(' ')
    }
  }
  return estraiVociDaScheda(testo, { titolo })
}

// Popola la sidebar coi prezzari interni (dal manifest), senza caricarne i dati.
window.__pricelistRegister?.(window.__PRZ_MANIFEST ?? [])

// Pannello dettaglio (destro) ridimensionabile (handle al bordo sinistro).
makeResizer(document.getElementById('detail-resize'), {
  cssVar: '--detail-w', side: 'right', min: 280, max: 560, storageKey: 'pricelist:detail-w',
})

// Dock della selezione ("Da copiare"): l'elenco ha un tetto, e la
// maniglia sul bordo superiore lo alza/abbassa (asse y: trascinare in su fa
// crescere il dock). Tetto massimo a metà finestra: la lista dei risultati
// non deve mai sparire sotto il dock.
makeResizer(document.getElementById('sel-dock-resize'), {
  cssVar: '--sel-dock-h', side: 'right', axis: 'y',
  min: 56, max: Math.round(window.innerHeight * 0.5), storageKey: 'miu:sel-dock-h',
})

// Sidebar sinistra ridimensionabile — unifica il resizer inline sul condiviso.
makeResizer(document.getElementById('sidebar-resize'), {
  cssVar: '--sidebar-w', side: 'left', min: 200, max: 600, storageKey: 'sidebarW',
})

// Sidebar comprimibile — componente condiviso della suite.
// Migrazione one-shot della vecchia chiave non-namespaced → 'miu:sidebar-collapsed'.
;(function migrateSidebarKey(): void {
  const old = localStorage.getItem('sidebarCollapsed')
  if (old !== null && localStorage.getItem('miu:sidebar-collapsed') === null) {
    localStorage.setItem('miu:sidebar-collapsed', old)
    localStorage.removeItem('sidebarCollapsed')
  }
})()
const _sidebar = makeCollapse(
  document.getElementById('sidebar'),
  document.getElementById('sidebar-collapse-btn'),
  { storageKey: 'miu:sidebar-collapsed' },
)
// Secondo trigger: l'affordance di espansione (visibile da CSS quando .collapsed).
document.querySelector('#sidebar-collapsed-icon button')?.addEventListener('click', () => _sidebar.toggle())

// Filtri: drawer a fisarmonica dietro un solo bottone "Filtri ▾" (schermata
// leggera — macrocategorie + griglia campi restano a riposo finché non servono).
// La mini-search "filtra opzioni" compare solo a filtri aperti; alla chiusura
// si nasconde e il suo filtro viene azzerato.
// Default COLLASSATO alla prima visita (a differenza della vecchia .filter-grid,
// aperta di default): seminiamo la chiave solo se non è già stata scelta dall'utente.
if (localStorage.getItem('pricelist:filters-collapsed') === null) {
  localStorage.setItem('pricelist:filters-collapsed', '1')
}
makeAccordion(
  document.getElementById('filtri-btn'),
  document.getElementById('filtri-drawer'),
  {
    storageKey: 'pricelist:filters-collapsed',
    onChange: (collapsed: boolean): void => {
      const mini = document.getElementById('filter-mini-search') as HTMLInputElement | null
      if (mini) {
        mini.style.display = collapsed ? 'none' : ''
        if (collapsed) {
          mini.value = ''
          ;(window as unknown as { filterMiniSearch?: (q: string) => void }).filterMiniSearch?.('')
        }
      }
      ;(window as unknown as { updateFiltriBtnLabel?: () => void }).updateFiltriBtnLabel?.()
    },
  },
)

// Versione (da filename, modulo condiviso) → titolo, sottotitolo, tooltip + app:ready.
;(function applyAppVersion(): void {
  const v = parseVersionFromURL()
  const vStr = v ? ` · v${v}` : ''
  document.title = `Computo — computo metrico${v ? ' v' + v : ''}`
  const logo = document.getElementById('app-logo')
  if (logo) logo.title = `Computo${v ? ' v' + v : ''}`
  const sub = document.getElementById('appLogoSub')
  // dice che cosa si fa qui, non com'era nato lo strumento (una consultazione di prezzari)
  if (sub) sub.textContent = `computo metrico e revisioni di progetto${vStr}`
  try {
    window.parent.postMessage({ type: 'app:ready' }, '*')
  } catch {
    /* fuori da iframe */
  }
})()

// ── Stampe di progetto: elenco prezzi, stima lavori, quadro economico ───────────
;(window as unknown as { miuStampeProgetto?: unknown }).miuStampeProgetto = {
  elenco: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>, descrizione?: 'estesa' | 'ridotta') => {
    await loadPdfLib()
    return elencoPrezziPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg, { descrizione })
  }),
  elencoNP: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>) => {
    await loadPdfLib()
    return elencoPrezziPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg, { titolo: 'ELENCO DEI NUOVI PREZZI' })
  }),
  lista: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>) => {
    await loadPdfLib()
    return listaLavorazioniPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg)
  }),
  incidenzaSicurezza: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>) => {
    await loadPdfLib()
    return incidenzaSicurezzaPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg)
  }),
  incidenzaMdo: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>, opz?: OpzioniIncidenzaMdo) => {
    await loadPdfLib()
    return incidenzaManodoperaPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg, opz)
  }),
  verbaleNP: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>) => {
    await loadPdfLib()
    return verbaleNuoviPrezziPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg)
  }),
  stima: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>) => {
    await loadPdfLib()
    return stimaLavoriPdf((window as unknown as { PDFLib: unknown }).PDFLib, voci, dg)
  }),
  qe: ricorda(async (voci: VoceComputo[], dg: Partial<DatiGenerali>, stato: Partial<QuadroEconomico>) => {
    await loadPdfLib()
    const lavori = voci.reduce((s, v) => s + importoVoce(v), 0)
    const sic = voci.filter(v => v.sicurezza).reduce((s, v) => s + importoVoce(v), 0)
    return quadroEconomicoPdf((window as unknown as { PDFLib: unknown }).PDFLib, calcolaQE(normalizzaQE(stato), lavori, sic), dg)
  }),
  /** Finestra del quadro economico: righe B modificabili, anteprima dei totali. Risolve con il nuovo stato (o undefined). */
  async modifica(voci: VoceComputo[], stato: Partial<QuadroEconomico>): Promise<{ stato: QuadroEconomico; stampa: boolean } | undefined> {
    const lavori = voci.reduce((s, v) => s + importoVoce(v), 0)
    const sic = voci.filter(v => v.sicurezza).reduce((s, v) => s + importoVoce(v), 0)
    let qe = normalizzaQE(stato)
    const corpo = document.createElement('div')
    corpo.className = 'qe-form'
    corpo.addEventListener('keydown', e => e.stopPropagation())
    const e = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    const eur = (n: number): string => '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' as unknown as boolean })
    const leggi = (): void => {
      const righe = [...corpo.querySelectorAll<HTMLElement>('[data-qe-riga]')].map(tr => ({
        codice: (tr.querySelector('[name=codice]') as HTMLInputElement).value,
        descrizione: (tr.querySelector('[name=descrizione]') as HTMLInputElement).value,
        tipo: (tr.querySelector('[name=tipo]') as HTMLSelectElement).value as 'importo' | 'percentuale',
        valore: Number((tr.querySelector('[name=valore]') as HTMLInputElement).value.replace(',', '.')) || 0,
        base: (tr.querySelector('[name=base]') as HTMLInputElement).value || undefined,
      }))
      qe = normalizzaQE({ sicurezzaExtra: Number((corpo.querySelector('[name=sicx]') as HTMLInputElement).value.replace(',', '.')) || 0, righeB: righe })
    }
    const disegna = (): void => {
      const r = calcolaQE(qe, lavori, sic)
      corpo.innerHTML = `<table class="qe-tab"><tbody>
        <tr class="qe-h"><td>A</td><td colspan="4">Lavori</td><td></td></tr>
        <tr><td>A1</td><td colspan="4">Lavori soggetti a ribasso (dal computo)</td><td class="qe-n">${eur(r.a1)}</td></tr>
        <tr><td>A2</td><td colspan="2">Oneri della sicurezza: voci del computo ${eur(sic)} + altri oneri (PSC)</td>
          <td colspan="2"><input class="ehb-input" name="sicx" value="${qe.sicurezzaExtra || ''}" placeholder="0,00" inputmode="decimal"></td><td class="qe-n">${eur(r.a2)}</td></tr>
        <tr class="qe-t"><td></td><td colspan="4">Totale lavori (A)</td><td class="qe-n">${eur(r.a)}</td></tr>
        <tr class="qe-h"><td>B</td><td colspan="4">Somme a disposizione</td><td></td></tr>
        ${r.righeB.map((x, i) => `<tr data-qe-riga="${i}">
          <td><input class="ehb-input" name="codice" value="${e(x.codice)}" style="width:44px"></td>
          <td><input class="ehb-input" name="descrizione" value="${e(x.descrizione)}"></td>
          <td><select class="ehb-input" name="tipo"><option value="importo"${x.tipo === 'importo' ? ' selected' : ''}>€</option><option value="percentuale"${x.tipo === 'percentuale' ? ' selected' : ''}>%</option></select></td>
          <td><input class="ehb-input" name="valore" value="${x.valore || ''}" inputmode="decimal" style="width:84px"></td>
          <td><input class="ehb-input" name="base" value="${e(x.base || '')}" placeholder="${x.tipo === 'percentuale' ? 'A' : ''}" title="Base della percentuale: A, A1, A2 o codici B (es. B2+B3)" style="width:70px"${x.tipo === 'percentuale' ? '' : ' disabled'}></td>
          <td class="qe-n">${eur(x.importo)} <button type="button" class="ehb-icon-btn" data-qe-del="${i}" title="Togli la riga">✕</button></td></tr>`).join('')}
        <tr><td colspan="6"><button type="button" class="ehb-btn ehb-btn--ghost" data-qe-add>+ riga</button></td></tr>
        <tr class="qe-t"><td></td><td colspan="4">Totale somme a disposizione (B)</td><td class="qe-n">${eur(r.b)}</td></tr>
        <tr class="qe-t qe-tot"><td></td><td colspan="4">TOTALE INTERVENTO (A + B)</td><td class="qe-n">${eur(r.totale)}</td></tr>
      </tbody></table>`
    }
    corpo.addEventListener('change', () => { leggi(); disegna() })
    corpo.addEventListener('click', ev => {
      const t = ev.target as HTMLElement
      if (t.closest('[data-qe-add]')) { leggi(); qe.righeB.push({ codice: 'B' + (qe.righeB.length + 1), descrizione: '', tipo: 'importo', valore: 0 }); disegna() }
      const del = t.closest('[data-qe-del]') as HTMLElement | null
      if (del) { leggi(); qe.righeB.splice(Number(del.dataset.qeDel), 1); disegna() }
    })
    disegna()
    const esito = await openModal({
      title: 'Quadro economico', body: corpo,
      actions: [{ label: 'Annulla', variant: 'ghost', value: 0 }, { label: 'Salva', variant: 'ghost', value: 1 }, { label: 'Salva e stampa PDF', variant: 'accent', value: 2 }],
    })
    if (esito !== 1 && esito !== 2) return undefined
    leggi()
    return { stato: qe, stampa: esito === 2 }
  },
}

// Offerte: richiesta, quadro comparativo, aggiudicazione (offerta a prezzi unitari)
;(window as unknown as { apriOfferte?: () => Promise<void> }).apriOfferte = () => apriOfferte(loadPdfLib)
