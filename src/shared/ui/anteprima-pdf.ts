/*
  L'ANTEPRIMA, SEMPRE PRIMA DELLA STAMPA.
  Una stampa si guarda prima di produrla: vale per gli atti della contabilità
  (HTML in pagina) e per le stampe del computo (PDF). Qui sta la metà PDF, così
  il percorso è lo stesso ovunque — si sceglie la stampa, si vede l'anteprima,
  e dalla stessa riga di pulsanti si stampa o si salva.

  L'ASPETTO SI DECIDE GUARDANDO (tappa 9 di Docs/06-Interfaccia-unica.md).
  Foglio, margini, carattere, corpo, testata e cartiglio si cambiano qui, dal
  pannello «Aa Aspetto», e il documento si rifà sotto gli occhi: chi apre
  l'anteprima passa `rifai`, cioè come rigenerare quel documento. Le scelte
  sono le preferenze di stampa del programma (stampe/preferenze.ts): valgono
  per ogni stampa, di progetto e di contabilità. «↺ Standard» torna
  all'impianto standard (doc/stile-stampa.ts).
*/
import { IMPIANTO_STANDARD, eImpiantoStandard, type StileStampa } from '../doc/stile-stampa'
import { leggiPreferenzeStampa, salvaPreferenzeStampa, type PreferenzeStampa } from '../stampe/preferenze'

export interface AnteprimaPdfOpts {
  /** Titolo mostrato in testa all'anteprima. */
  titolo: string
  /** Nome del file proposto al salvataggio (senza estensione). */
  nomeFile: string
  /** Riga sotto il titolo: pagine, voci, totale… */
  nota?: string
  /** Estensione proposta al salvataggio (pdf se non detto). */
  estensione?: string
  /**
   * Come rifare il documento con le impostazioni di stampa nuove: byte del PDF,
   * oppure il testo HTML. Senza, il pannello «Aspetto» non c'è.
   */
  rifai?: () => Promise<Uint8Array | ArrayBuffer | Blob | string>
  /**
   * Quali scelte di CONTENUTO offre il pannello, oltre al foglio: 'computo'
   * (descrizione, misure, WBS, riepiloghi, prezzi, più copertina e firme),
   * 'elaborato' (copertina e firme). Senza, solo l'aspetto del foglio.
   */
  contenuto?: 'computo' | 'elaborato' | 'atto'
}

/** Il PDF si dichiara PDF/A nei suoi metadati XMP, che non sono compressi: basta leggerli. */
export function ePdfA(bytes: Uint8Array | ArrayBuffer): boolean {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return /<pdfaid:part>2<\/pdfaid:part>/.test(s) && /<pdfaid:conformance>B<\/pdfaid:conformance>/.test(s)
}

/** Il pannello resta aperto da un documento all'altro: chi lo apre sta sistemando il foglio. */
let _aspettoAperto = false

const ID = 'ehb-anteprima'

/** Chiude l'anteprima aperta, se c'è. */
export function chiudiAnteprimaPdf(): void {
  const el = document.getElementById(ID)
  if (!el) return
  const url = el.dataset.url
  if (url) setTimeout(() => URL.revokeObjectURL(url), 1000)
  el.remove()
}

/** Mostra un documento HTML a tutta pagina, con gli stessi comandi del PDF.
 *  Serve perché una finestra separata non sempre si apre (popup bloccati, o il
 *  guscio desktop che la rifiuta) e l'anteprima restava muta. */
export function anteprimaHTML(html: string, o: AnteprimaPdfOpts): void {
  chiudiAnteprimaPdf()
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  montaAnteprima(url, o, (frame, wrap) => { wrap.dataset.tipo = 'html'; frame.src = url }, false)
}

/** Mostra il PDF a tutta pagina, con «Stampa» e «Salva PDF». */
export function anteprimaPdf(bytes: Uint8Array | ArrayBuffer | Blob, o: AnteprimaPdfOpts): void {
  chiudiAnteprimaPdf()
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const pdfa = !(bytes instanceof Blob) && ePdfA(bytes as Uint8Array)
  montaAnteprima(url, o, (frame, wrap) => { wrap.dataset.tipo = 'pdf'; void mostraPdf(wrap, frame, blob) }, pdfa)
}

/* ── Le pagine del PDF, disegnate da noi ───────────────────────────────────
   Il visore PDF del browser è un plugin, e nell'app desktop su Mac lasciava il
   riquadro BIANCO (con o senza `plugins: true`, prima e dopo Electron 45): il
   documento c'era, l'anteprima no. Le pagine si disegnano quindi con pdf.js
   (vendor/pdf.min.js) in una colonna di <canvas>, uguale in ogni guscio: app
   desktop, browser, iPad. Solo se pdf.js non si carica si torna al visore. */

interface PdfJsPagina { getViewport(o: { scale: number }): { width: number; height: number }; render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> } }
interface PdfJsDoc { numPages: number; getPage(n: number): Promise<PdfJsPagina>; destroy(): Promise<void> }
interface PdfJs { getDocument(o: { data: Uint8Array }): { promise: Promise<PdfJsDoc> } }

async function mostraPdf(wrap: HTMLElement, frame: HTMLIFrameElement, blob: Blob): Promise<void> {
  const vecchia = wrap.querySelector('.ehb-anteprima__pagine')
  try {
    const { loadPdfJs } = await import('../vendor')
    await loadPdfJs()
    const lib = (globalThis as unknown as { pdfjsLib?: PdfJs }).pdfjsLib
    if (!lib) throw new Error('pdf.js assente')
    const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
    if (!wrap.isConnected) { void doc.destroy(); return }
    // la nota in testata dice le pagine del documento com'è ORA (cambia col foglio e col contenuto)
    const nota = wrap.querySelector('.ehb-anteprima__t small')
    if (nota) nota.textContent = (nota.textContent || '').replace(/^\d+ pagin[ae]/, `${doc.numPages} pagin${doc.numPages === 1 ? 'a' : 'e'}`)
    const col = document.createElement('div')
    col.className = 'ehb-anteprima__v ehb-anteprima__pagine'
    col.tabIndex = 0
    const largo = Math.max(320, (frame.isConnected ? frame : (vecchia as HTMLElement | null) ?? wrap).clientWidth - 48)
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const pagine: { canvas: HTMLCanvasElement; n: number; scala: number; fatta: boolean }[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const pg = await doc.getPage(n)
      const v1 = pg.getViewport({ scale: 1 })
      const scala = Math.min(largo / v1.width, 2)
      const canvas = document.createElement('canvas')
      canvas.className = 'ehb-anteprima__pagina'
      canvas.style.width = `${Math.round(v1.width * scala)}px`
      canvas.style.height = `${Math.round(v1.height * scala)}px`
      canvas.setAttribute('aria-label', `Pagina ${n} di ${doc.numPages}`)
      col.appendChild(canvas)
      pagine.push({ canvas, n, scala, fatta: false })
    }
    const disegna = async (p: typeof pagine[number]): Promise<void> => {
      if (p.fatta) return
      p.fatta = true
      const pg = await doc.getPage(p.n)
      const vp = pg.getViewport({ scale: p.scala * dpr })
      p.canvas.width = Math.round(vp.width); p.canvas.height = Math.round(vp.height)
      const ctx = p.canvas.getContext('2d')
      if (ctx) await pg.render({ canvasContext: ctx, viewport: vp }).promise
    }
    // si disegnano le pagine che si vedono (e le vicine): un computo di 200 pagine non blocca nulla
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((voci) => { for (const e of voci) if (e.isIntersecting) { const p = pagine.find((x) => x.canvas === e.target); if (p) void disegna(p) } }, { root: col, rootMargin: '600px 0px' })
      : null
    if (io) pagine.forEach((p) => io.observe(p.canvas)); else for (const p of pagine) await disegna(p)
    // al posto del riquadro (o delle pagine di prima, se si è cambiato l'aspetto)
    const scroll = vecchia ? (vecchia as HTMLElement).scrollTop : 0
    if (vecchia) vecchia.replaceWith(col); else frame.replaceWith(col)
    col.scrollTop = scroll
    if (pagine[0]) void disegna(pagine[0])
  } catch {
    // pdf.js non disponibile: si prova col visore del browser
    if (vecchia) vecchia.replaceWith(frame)
    frame.src = wrap.dataset.url || ''
  }
}

/** L'API del guscio desktop, se c'è (lo strumento vive in un riquadro dell'hub). */
function nativo(): { openPdf?: (dati: Uint8Array, nome: string) => Promise<{ path?: string; error?: string }> } | null {
  const w = window as unknown as { ehubNative?: unknown; top?: { ehubNative?: unknown } | null }
  try { return (w.ehubNative || w.top?.ehubNative || null) as ReturnType<typeof nativo> } catch { return (w.ehubNative || null) as ReturnType<typeof nativo> }
}

/** Stampa un PDF: nell'app desktop lo apre nel visore del sistema (Anteprima su Mac),
 *  con tutte le opzioni della stampante; nel browser lo stampa da un riquadro nascosto. */
async function stampaPdf(url: string, nome: string, salva: () => void): Promise<void> {
  const n = nativo()
  if (n?.openPdf) {
    const dati = new Uint8Array(await (await fetch(url)).arrayBuffer())
    const r = await n.openPdf(dati, nome)
    if (!r?.error) return
  }
  try {
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
    f.src = url
    f.onload = () => {
      try { f.contentWindow?.focus(); f.contentWindow?.print() } catch { salva() }
      setTimeout(() => f.remove(), 60000)
    }
    document.body.appendChild(f)
  } catch { salva() }
}

/** Il guscio dell'anteprima: testata con i comandi, documento sotto. */
function montaAnteprima(url: string, o: AnteprimaPdfOpts, riempi: (frame: HTMLIFrameElement, wrap: HTMLElement) => void, pdfa: boolean): void {
  const wrap = document.createElement('div')
  wrap.id = ID
  wrap.dataset.url = url
  wrap.className = 'ehb-anteprima'
  wrap.innerHTML = `
    <div class="ehb-anteprima__hd">
      <div class="ehb-anteprima__t"><b></b><small></small></div>
      ${pdfa ? '<span class="ehb-pastiglia ehb-anteprima__pdfa" title="Il PDF è PDF/A-2b: caratteri incorporati, profilo colore e metadati dentro il file. È il formato da conservazione.">PDF/A-2b</span>' : ''}
      <span class="ehb-anteprima__sp"></span>
      ${o.rifai ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost${_aspettoAperto ? ' is-on' : ''}" data-az="aspetto" title="Foglio, margini, carattere e corpo: si cambiano qui e il documento si rifà" aria-expanded="${_aspettoAperto}">${o.contenuto ? 'Aa Opzioni' : 'Aa Aspetto'}</button>` : ''}
      <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" data-az="stampa">⎙ Stampa</button>
      <button class="ehb-btn ehb-btn--sm" data-az="salva">⇩ Salva</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" data-az="chiudi">Esc ✕</button>
    </div>
    <div class="ehb-anteprima__corpo">
      <iframe class="ehb-anteprima__v" title="Anteprima di stampa"></iframe>
      ${o.rifai ? `<aside class="ehb-anteprima__aspetto"${_aspettoAperto ? '' : ' hidden'}>${pannelloAspettoHTML(leggiPreferenzeStampa().stile)}${o.contenuto ? `<div class="ehb-aspetto__contenuto">${pannelloContenutoHTML(leggiPreferenzeStampa(), o.contenuto)}</div>` : ''}</aside>` : ''}
    </div>`
  const t = wrap.querySelector('.ehb-anteprima__t') as HTMLElement
  ;(t.querySelector('b') as HTMLElement).textContent = o.titolo
  ;(t.querySelector('small') as HTMLElement).textContent = o.nota || ''
  const frame = wrap.querySelector('iframe') as HTMLIFrameElement
  const salva = (): void => {
    const a = document.createElement('a')
    a.href = wrap.dataset.url || url; a.download = `${o.nomeFile}.${o.estensione || 'pdf'}`
    document.body.appendChild(a); a.click(); a.remove()
  }
  if (o.rifai) {
    const rifai = o.rifai
    wrap.addEventListener('change', (ev) => {
      const el = ev.target as HTMLInputElement | HTMLSelectElement
      const pref = el.getAttribute('data-pref')
      if (pref) { cambiaPreferenza(pref, el.value); void rigenera(wrap, frame, rifai, o.contenuto); return }
      const campo = el.getAttribute('data-stile')
      if (!campo) return
      cambiaStile(campo, el.value)
      void rigenera(wrap, frame, rifai, o.contenuto)
    })
  }
  wrap.addEventListener('click', (ev) => {
    const az = (ev.target as HTMLElement).closest('[data-az]')?.getAttribute('data-az')
    if (az === 'aspetto') {
      _aspettoAperto = !_aspettoAperto
      const pan = wrap.querySelector('.ehb-anteprima__aspetto') as HTMLElement | null
      if (pan) pan.hidden = !_aspettoAperto
      const b = wrap.querySelector('[data-az="aspetto"]')
      b?.classList.toggle('is-on', _aspettoAperto); b?.setAttribute('aria-expanded', String(_aspettoAperto))
      return
    }
    if (az === 'standard' && o.rifai) {
      const p = leggiPreferenzeStampa()
      salvaPreferenzeStampa({ ...p, stile: { ...IMPIANTO_STANDARD, margini: { ...IMPIANTO_STANDARD.margini } } })
      void rigenera(wrap, frame, o.rifai, o.contenuto)
      return
    }
    if (az === 'chiudi') chiudiAnteprimaPdf()
    else if (az === 'salva') salva()
    else if (az === 'stampa') {
      const corrente = wrap.dataset.url || url
      // il PDF si stampa dal visore; l'HTML (atti in pagina) dal suo riquadro
      if (wrap.dataset.tipo === 'pdf') { void stampaPdf(corrente, `${o.nomeFile}.pdf`, salva); return }
      try {
        if (frame.isConnected && frame.contentWindow) { frame.contentWindow.focus(); frame.contentWindow.print() }
        else salva()
      } catch { salva() }
    }
  })
  document.addEventListener('keydown', function esc(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return
    document.removeEventListener('keydown', esc)
    chiudiAnteprimaPdf()
  })
  document.body.appendChild(wrap)
  riempi(frame, wrap)
}

/* ── Il pannello «Aspetto» ─────────────────────────────────────────────── */

const escA = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** Il pannello: le stesse voci delle impostazioni di stampa, una per riga. */
export function pannelloAspettoHTML(st: StileStampa): string {
  const d = IMPIANTO_STANDARD
  const m = { ...d.margini, ...(st.margini || {}) }
  const sel = (campo: string, val: string, voci: [string, string][]): string =>
    `<select data-stile="${campo}">${voci.map(([v, et]) => `<option value="${v}"${v === val ? ' selected' : ''}>${escA(et)}</option>`).join('')}</select>`
  const num = (campo: string, val: number, min: number, max: number, passo = 1): string =>
    `<input type="number" data-stile="${campo}" value="${val}" min="${min}" max="${max}" step="${passo}">`
  const std = eImpiantoStandard(st)
  return `
    <div class="ehb-aspetto__h">Aspetto della stampa${std ? '<span class="ehb-pastiglia">standard</span>' : ''}</div>
    <p class="ehb-aspetto__nota">Vale per tutte le stampe, di progetto e di contabilità. Non cambia gli importi né il contenuto degli atti.</p>
    <label class="ehb-aspetto__f"><span>Foglio</span>${sel('formato', st.formato || d.formato, [['A4', 'A4'], ['A3', 'A3'], ['Letter', 'Letter'], ['Legal', 'Legal']])}</label>
    <label class="ehb-aspetto__f"><span>Orientamento</span>${sel('orientamento', st.orientamento || d.orientamento, [['verticale', 'verticale'], ['orizzontale', 'orizzontale']])}</label>
    <div class="ehb-aspetto__m">
      <label class="ehb-aspetto__f"><span>Sopra</span>${num('margine.sopra', m.sopra, 5, 60)}</label>
      <label class="ehb-aspetto__f"><span>Sotto</span>${num('margine.sotto', m.sotto, 5, 60)}</label>
      <label class="ehb-aspetto__f"><span>Sinistra</span>${num('margine.sinistra', m.sinistra, 5, 60)}</label>
      <label class="ehb-aspetto__f"><span>Destra</span>${num('margine.destra', m.destra, 5, 60)}</label>
    </div>
    <p class="ehb-aspetto__nota">Margini in millimetri. A sinistra si rilega: lo standard ne lascia 20.</p>
    <label class="ehb-aspetto__f"><span>Carattere</span>${sel('carattere', st.carattere || d.carattere, [['sans', 'lineare (Arimo)'], ['serif', 'graziato'], ['mono', 'monospazio']])}</label>
    <label class="ehb-aspetto__f"><span>Corpo (pt)</span>${num('corpo', st.corpo ?? d.corpo, 6, 16, 0.5)}</label>
    <label class="ehb-aspetto__f"><span>Testata</span>${sel('intestazione', st.intestazione === false ? 'no' : 'si', [['si', 'sì'], ['no', 'no (carta intestata)']])}</label>
    <label class="ehb-aspetto__f"><span>Piè di pagina</span>${sel('piede', st.piede === false ? 'no' : 'si', [['si', 'sì'], ['no', 'no']])}</label>
    <p class="ehb-aspetto__nota">Nei PDF il carattere è sempre il lineare incorporato: è quello che rende il file PDF/A e uguale su ogni computer. Graziato e monospazio valgono per gli atti in pagina.</p>
    <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" data-az="standard"${std ? ' disabled' : ''} title="A4 verticale, margini 15 mm e 20 a sinistra, lineare 10 pt, testata e piè">↺ Impianto standard</button>`
}

/**
 * IL CONTENUTO, come nelle opzioni di stampa dei programmi di computo: quanto
 * della voce si stampa, le misure o solo le quantità, i riepiloghi, i prezzi;
 * per ogni elaborato copertina e firme in calce. Non cambia gli importi.
 */
export function pannelloContenutoHTML(p: PreferenzeStampa, quale: 'computo' | 'elaborato' | 'atto'): string {
  const sel = (campo: string, val: string, voci: [string, string][]): string =>
    `<select data-pref="${campo}">${voci.map(([v, et]) => `<option value="${v}"${v === val ? ' selected' : ''}>${escA(et)}</option>`).join('')}</select>`
  const sn = (campo: string, v: boolean, si = 'sì', no = 'no'): string => sel(campo, v ? 'si' : 'no', [['si', si], ['no', no]])
  const num = (campo: string, val: number): string => `<input type="number" data-pref="${campo}" value="${val}" min="0" max="20" step="1">`
  const descr = `
    <label class="ehb-aspetto__f"><span>Descrizione</span>${sel('descrizione', p.descrizione, [['estesa', 'estesa (intera)'], ['compatta', 'inizio e fine'], ['ridotta', 'solo la breve']])}</label>
    ${p.descrizione === 'compatta' ? `<div class="ehb-aspetto__m">
      <label class="ehb-aspetto__f"><span>Righe all'inizio</span>${num('righeMax', p.righeMax)}</label>
      <label class="ehb-aspetto__f"><span>alla fine</span>${num('righeFinali', p.righeFinali)}</label>
    </div>` : ''}`
  if (quale === 'atto') return `
    <div class="ehb-aspetto__h">Contenuto</div>
    <p class="ehb-aspetto__nota">Quanto testo delle voci entra negli atti. Importi, quantità e firme non cambiano.</p>
    ${descr}
    <label class="ehb-aspetto__f"><span>Date dei rilevamenti</span>${sn('date', p.date)}</label>`
  const computo = quale === 'computo' ? `
    ${descr}
    <label class="ehb-aspetto__f"><span>Titolo breve in grassetto</span>${sn('conRidotta', p.conRidotta)}</label>
    <label class="ehb-aspetto__f"><span>Misure</span>${sn('misure', p.misure, 'righe di misura', 'solo quantità')}</label>
    <label class="ehb-aspetto__f"><span>Riga WBS</span>${sn('rigaWbs', p.rigaWbs)}</label>
    <label class="ehb-aspetto__f"><span>Riepiloghi</span>${sel('riepilogo', p.riepilogo, [['entrambi', 'categorie e WBS'], ['categorie', 'categorie'], ['wbs', 'WBS'], ['nessuno', 'nessuno']])}</label>
    <label class="ehb-aspetto__f"><span>Prezzi</span>${sn('senzaPrezzi', !p.senzaPrezzi, 'estimativo', 'solo quantità')}</label>` : ''
  return `
    <div class="ehb-aspetto__h">Contenuto</div>
    <p class="ehb-aspetto__nota">Che cosa entra nella stampa. Gli importi non cambiano.</p>
    ${computo}
    <label class="ehb-aspetto__f"><span>Copertina</span>${sn('copertina', p.copertina)}</label>
    <label class="ehb-aspetto__f"><span>Luogo, data e firme</span>${sn('firme', p.firme)}</label>
    ${p.firme ? `<label class="ehb-aspetto__f"><span>Luogo della firma</span><input data-pref="luogo" value="${escA(p.luogo)}" placeholder="il comune dei lavori"></label>` : ''}`
}

/** Una scelta di contenuto cambiata: si scrive nelle preferenze di stampa. */
export function cambiaPreferenza(campo: string, v: string): PreferenzeStampa {
  const p = leggiPreferenzeStampa()
  let n: PreferenzeStampa = p
  if (campo === 'righeMax' || campo === 'righeFinali') n = { ...p, [campo]: Math.max(campo === 'righeMax' ? 1 : 0, Math.min(20, Math.round(Number(v) || 0))) }
  else if (campo === 'senzaPrezzi') n = { ...p, senzaPrezzi: v === 'no' }
  else if (campo === 'conRidotta' || campo === 'misure' || campo === 'rigaWbs' || campo === 'firme' || campo === 'copertina' || campo === 'date') n = { ...p, [campo]: v === 'si' }
  else if (campo === 'luogo') n = { ...p, luogo: String(v).trim().slice(0, 60) }
  else if (campo === 'descrizione' && ['estesa', 'compatta', 'ridotta'].includes(v)) n = { ...p, descrizione: v as PreferenzeStampa['descrizione'] }
  else if (campo === 'riepilogo' && ['entrambi', 'categorie', 'wbs', 'nessuno'].includes(v)) n = { ...p, riepilogo: v as PreferenzeStampa['riepilogo'] }
  salvaPreferenzeStampa(n)
  return n
}

/** Una voce del pannello cambiata: si scrive nelle preferenze di stampa. */
export function cambiaStile(campo: string, v: string): StileStampa {
  const p = leggiPreferenzeStampa()
  let st: StileStampa = { ...p.stile }
  if (campo.startsWith('margine.')) {
    const lato = campo.slice(8) as 'sopra' | 'sotto' | 'sinistra' | 'destra'
    st = { ...st, margini: { ...(st.margini || {}), [lato]: Math.max(5, Math.min(60, Number(v) || 0)) } }
  } else if (campo === 'corpo') st = { ...st, corpo: Math.max(6, Math.min(16, Number(v) || 10)) }
  else if (campo === 'intestazione' || campo === 'piede') st = { ...st, [campo]: v === 'si' }
  else st = { ...st, [campo]: v } as StileStampa
  salvaPreferenzeStampa({ ...p, stile: st })
  return st
}

/** Rifà il documento con le impostazioni nuove e lo rimette nell'anteprima. */
async function rigenera(wrap: HTMLElement, frame: HTMLIFrameElement, rifai: NonNullable<AnteprimaPdfOpts['rifai']>, contenuto?: AnteprimaPdfOpts['contenuto']): Promise<void> {
  wrap.classList.add('is-rifa')
  try {
    const r = await rifai()
    const blob = typeof r === 'string' ? new Blob([r], { type: 'text/html' })
      : r instanceof Blob ? r : new Blob([r as BlobPart], { type: 'application/pdf' })
    const vecchio = wrap.dataset.url
    const url = URL.createObjectURL(blob)
    wrap.dataset.url = url
    wrap.dataset.tipo = typeof r === 'string' ? 'html' : 'pdf'
    // il pannello si aggiorna subito: non aspetta che le pagine siano disegnate
    const pan = wrap.querySelector('.ehb-anteprima__aspetto')
    if (pan) pan.innerHTML = pannelloAspettoHTML(leggiPreferenzeStampa().stile) + (contenuto ? `<div class="ehb-aspetto__contenuto">${pannelloContenutoHTML(leggiPreferenzeStampa(), contenuto)}</div>` : '')
    if (vecchio) setTimeout(() => URL.revokeObjectURL(vecchio), 1000)
    if (typeof r === 'string') frame.src = url
    else await mostraPdf(wrap, frame, blob)
  } finally { wrap.classList.remove('is-rifa') }
}
