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
import { leggiPreferenzeStampa, salvaPreferenzeStampa } from '../stampe/preferenze'

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
  montaAnteprima(url, o, (frame) => { frame.src = url }, false)
}

/** Mostra il PDF a tutta pagina, con «Stampa» e «Salva PDF». */
export function anteprimaPdf(bytes: Uint8Array | ArrayBuffer | Blob, o: AnteprimaPdfOpts): void {
  chiudiAnteprimaPdf()
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const pdfa = !(bytes instanceof Blob) && ePdfA(bytes as Uint8Array)
  montaAnteprima(url, o, (frame, wrap) => {
    const senzaVisore = (): void => {
      if (!frame.isConnected) return
      const avviso = document.createElement('div')
      avviso.className = 'ehb-anteprima__no'
      avviso.innerHTML = '<p><b>Il documento è pronto.</b></p><p>Qui non si riesce a mostrarlo in anteprima, perché manca il visore PDF. Usa <b>Stampa</b> oppure <b>Salva PDF</b>: il file è completo.</p>'
      // al posto del documento, non sotto: il pannello «Aspetto» resta dov'è
      frame.replaceWith(avviso)
      void wrap
    }
    /* Non si chiede PRIMA a navigator.pdfViewerEnabled: nell'app desktop
       risponde «no» anche dove il visore poi funziona, e l'anteprima restava
       bianca per prudenza. Si prova sempre, e se dopo un attimo non è comparso
       niente si dice com'è (sotto). */
    frame.src = url
    /* Il visore PDF è un plugin: dove è spento l'iframe resta BIANCO senza dare
       errore, e sembra che il documento sia vuoto. Si controlla poco dopo che
       qualcosa sia davvero comparso; in caso contrario si dice com'è. */
    setTimeout(() => {
      try {
        const d = frame.contentDocument
        /* Da Electron 45 (Chromium col visore «fuori processo») il documento
           PDF ha il corpo VUOTO anche quando il visore funziona: il visore sta
           in un riquadro a parte. Se il documento si dichiara PDF, il visore
           l'ha preso: si avvisa solo quando non è così. */
        const vuoto = d && d.contentType !== 'application/pdf' && d.body && d.body.childElementCount === 0 && !d.querySelector('embed')
        if (vuoto) senzaVisore()
      } catch { /* documento non ispezionabile: il visore l'ha preso in carico */ }
    }, 2500)
  }, pdfa)
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
      ${o.rifai ? `<button class="ehb-btn ehb-btn--sm ehb-btn--ghost${_aspettoAperto ? ' is-on' : ''}" data-az="aspetto" title="Foglio, margini, carattere e corpo: si cambiano qui e il documento si rifà" aria-expanded="${_aspettoAperto}">Aa Aspetto</button>` : ''}
      <button class="ehb-btn ehb-btn--sm ehb-btn--accent-soft" data-az="stampa">⎙ Stampa</button>
      <button class="ehb-btn ehb-btn--sm" data-az="salva">⇩ Salva</button>
      <button class="ehb-btn ehb-btn--sm ehb-btn--ghost" data-az="chiudi">Esc ✕</button>
    </div>
    <div class="ehb-anteprima__corpo">
      <iframe class="ehb-anteprima__v" title="Anteprima di stampa"></iframe>
      ${o.rifai ? `<aside class="ehb-anteprima__aspetto"${_aspettoAperto ? '' : ' hidden'}>${pannelloAspettoHTML(leggiPreferenzeStampa().stile)}</aside>` : ''}
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
      const campo = el.getAttribute('data-stile')
      if (!campo) return
      cambiaStile(campo, el.value)
      void rigenera(wrap, frame, rifai)
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
      void rigenera(wrap, frame, o.rifai)
      return
    }
    if (az === 'chiudi') chiudiAnteprimaPdf()
    else if (az === 'salva') salva()
    else if (az === 'stampa') {
      /* Se il visore non si lascia stampare si SALVA il file, non si apre una
         finestra nuova: nell'app desktop un blob in finestra separata resta
         bianco, e sembrava che la stampa non producesse niente. */
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
async function rigenera(wrap: HTMLElement, frame: HTMLIFrameElement, rifai: NonNullable<AnteprimaPdfOpts['rifai']>): Promise<void> {
  wrap.classList.add('is-rifa')
  try {
    const r = await rifai()
    const blob = typeof r === 'string' ? new Blob([r], { type: 'text/html' })
      : r instanceof Blob ? r : new Blob([r as BlobPart], { type: 'application/pdf' })
    const vecchio = wrap.dataset.url
    const url = URL.createObjectURL(blob)
    wrap.dataset.url = url
    frame.src = url
    if (vecchio) setTimeout(() => URL.revokeObjectURL(vecchio), 1000)
    const pan = wrap.querySelector('.ehb-anteprima__aspetto')
    if (pan) pan.innerHTML = pannelloAspettoHTML(leggiPreferenzeStampa().stile)
  } finally { wrap.classList.remove('is-rifa') }
}
