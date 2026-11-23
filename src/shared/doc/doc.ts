/**
 * Builder del sistema documentale unificato Quadra.
 * `renderDocPage` produce l'HTML stampabile completo (A4) con la "cornice"
 * condivisa: barra azioni, testata col blocco tool (glifo + nome su accento),
 * corpo del documento e cartiglio a piè di pagina col brand Quadra. Ogni tool
 * fornisce solo il proprio CONTENUTO (`bodyHTML`) e i metadati; lo stile vive
 * tutto in DOC_CSS (single source of truth). Vedi mockup docs/mockups/documenti-unificati.
 */
import { DOC_CSS } from './doc-css'
import { ehubBrand } from './brand'

/** Tool della suite con accento dedicato (via `data-tool`). */
export type DocTool = 'computo' | 'contabilita'

/** Nome breve del tool, per il blocco testata/cartiglio: brand Quadra + tag testo
 *  colorato sull'accento del tool (niente chip/glifo su sfondo pieno). */
const TOOL_NAME: Record<DocTool, string> = { computo: 'Computo', contabilita: 'Contabilità' }

export interface DocField { k: string; v: string }

/**
 * Intestazione dello STUDIO che produce il documento (l'azienda
 * cliente, es. lo studio che usa la suite): logo + ragione sociale + indirizzo,
 * come letterhead in ALTO. NON è il committente. Shape PIATTA (nessuna dipendenza
 * dal registro hub): nome, indirizzo e HTML del logo (immagine o TEMPLATE). Se
 * assente → niente letterhead (es. profilo admin: comportamento normale).
 */
export interface DocCompany {
  name: string
  address?: string
  /** HTML del logo (es. <img> o placeholder). Assente → solo nome. */
  logoHtml?: string
}

/**
 * Testata di un ENTE / stazione appaltante per i DOCUMENTI ISTITUZIONALI (Contabilità —
 * contabilità dei lavori pubblici): logo + denominazione + righe libere
 * (indirizzo, C.F., ecc.). NON è lo studio: qui in testa comanda il committente
 * pubblico (il Comune), come vuole la forma degli atti amministrativi.
 */
export interface DocEnte {
  name: string
  /** Righe secondarie (indirizzo, C.F./P.IVA, PEC…). */
  sub?: string[]
  /** HTML del logo dell'ente (es. <img> data-URL). Assente → solo testo. */
  logoHtml?: string
}

export interface DocPage {
  tool: DocTool
  /** Sopra-titolo in monospazio (es. "Cables & Conduits · Distinta"). */
  kicker: string
  title: string
  sub?: string
  /** Coppie etichetta/valore in alto a destra nella testata. */
  headMeta?: DocField[]
  /** Contenuto del documento (markup con le classi di DOC_CSS). */
  bodyHTML: string
  /** Cartiglio a piè di pagina: campi + disclaimer + numerazione. */
  footer: { fields: DocField[]; disc: string; page?: string }
  /** <title> della finestra; default = title. */
  docTitle?: string
  /** Intestazione aziendale discreta. Assente = nessuna. */
  company?: DocCompany
  /**
   * Marchio nel cartiglio: 'ehub' (default, retro-compatibile) stampa il lockup
   * Quadra; 'none' lo OMETTE — per gli atti standard della PA (Contabilità), dove Quadra non
   * deve comparire: sono documenti dell'ente, non di Quadra.
   */
  brand?: 'ehub' | 'none'
  /** Testata istituzionale dell'ente/stazione appaltante in ALTO (Contabilità). Assente = nessuna. */
  enteHeader?: DocEnte
  /**
   * COPIA DI LAVORO: il documento si guarda, non si firma. Esce con la filigrana e
   * una riga nel cartiglio, perché una bozza stampata è identica a un atto vero e
   * su un tavolo di cantiere i due fogli si confondono. La stampa definitiva — che
   * registra l'atto e lo sigilla — non ha nessuno dei due segni.
   */
  bozza?: boolean
  /** Che cosa manca perché diventi definitiva: una riga, nel cartiglio della bozza. */
  bozzaNota?: string
}

/** Letterhead dello STUDIO in alto (logo template/immagine + ragione sociale + indirizzo). */
function studioHeaderHTML(c: DocCompany): string {
  return `<div class="doc-letterhead">${c.logoHtml || ''}<div class="dl-txt"><div class="dl-name">${escHtml(c.name)}</div>${c.address ? `<div class="dl-addr">${escHtml(c.address)}</div>` : ''}</div></div>`
}

/** Testata istituzionale dell'ENTE (Contabilità): logo + denominazione + righe libere. Centrata, sobria. */
function enteHeaderHTML(e: DocEnte): string {
  const subs = (e.sub || []).filter(Boolean).map((s) => `<div class="de-sub">${escHtml(s)}</div>`).join('')
  return `<div class="doc-ente">${e.logoHtml || ''}<div class="de-txt"><div class="de-name">${escHtml(e.name)}</div>${subs}</div></div>`
}

/** Escape HTML difensivo, condiviso da tutti i documenti. */
export function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Data/ora in formato italiano dd/mm/yyyy HH:MM (deterministico, no Intl). */
export function fmtDateTime(now?: number | Date): string {
  const d = now == null ? new Date() : now instanceof Date ? now : new Date(now)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const fieldsHTML = (fields: DocField[]): string =>
  fields.map((f) => `<div class="field"><span class="k">${escHtml(f.k)}</span><span class="v">${f.v}</span></div>`).join('')

const metaHTML = (meta: DocField[]): string =>
  meta.map((m) => `<div><span class="k">${escHtml(m.k)}</span></div><div><span class="v">${m.v}</span></div>`).join('')

/**
 * HTML stampabile completo. NOTA: `bodyHTML`, i valori dei campi e dei meta sono
 * inseriti COSÌ COME SONO (il chiamante è responsabile dell'escape del proprio
 * contenuto, es. con `escHtml`), perché spesso contengono già markup di tabella.
 * Le ETICHETTE (k) sono sempre escapate qui.
 */
/**
 * Marca come COPIA DI LAVORO un documento già reso da `renderDocPage`: filigrana
 * e riga nel cartiglio, senza rigenerarlo. Serve a chi produce l'atto in due modi
 * — di lavoro e definitivo — dalla stessa funzione di stampa: la differenza non è
 * nel contenuto, è nel fatto che uno è emesso e l'altro no.
 */
export function marcaBozza(html: string, nota?: string): string {
  if (html.includes('doc-filigrana')) return html
  const filigrana = '<div class="doc-filigrana" aria-hidden="true">COPIA DI LAVORO</div>'
  const riga = `<div class="df-disc df-bozza"><b>COPIA DI LAVORO</b> — documento non emesso, non valido come atto${nota ? `: ${escHtml(nota)}` : '.'}</div>`
  return html
    .replace('<body>', `<body>\n  ${filigrana}`)
    .replace('</footer>', `  ${riga}\n  </footer>`)
}

export function renderDocPage(p: DocPage): string {
  const name = TOOL_NAME[p.tool]
  const head = `
  <header class="dochead">
    <!-- Niente marchio Quadra in testa. Sopra c'è già la carta intestata dello STUDIO — il logo
         che conta per chi legge il documento — e il marchio tornava comunque nel piè di pagina:
         erano due volte lo stesso marchio, su un foglio dove ogni segno deve guadagnarsi il
         posto. Nemmeno il nome del tool resta qui: da solo («Price») non dice nulla, viveva
         solo come coda del lockup. A dire di cosa si tratta ci pensa il kicker qui sotto
         («Price · Analisi Prezzi»), e il piè di pagina firma il documento. -->
    <div class="dochead__main">
      <div class="dochead__kicker">${escHtml(p.kicker)}</div>
      <h1 class="dochead__title">${escHtml(p.title)}</h1>
      ${p.sub ? `<p class="dochead__sub">${escHtml(p.sub)}</p>` : ''}
    </div>
    <div class="dochead__meta">${metaHTML(p.headMeta || [])}</div>
  </header>`

  // brand 'none' (Contabilità, atti della PA): niente lockup Quadra nel cartiglio — resta
  // solo la riga di campi/disclaimer, così il documento è dell'ente e non di Quadra.
  const showBrand = p.brand !== 'none'
  const foot = `
  <footer class="docfoot${showBrand ? '' : ' docfoot--nobrand'}">
    ${showBrand ? `<span class="df-lockup">${ehubBrand()}<span class="df-tooltag">${escHtml(name)}</span></span>` : ''}
    ${fieldsHTML(p.footer.fields)}
    ${p.footer.page ? `<span class="df-page">${escHtml(p.footer.page)}</span>` : ''}
    ${p.bozza ? `<div class="df-disc df-bozza"><b>COPIA DI LAVORO</b> — documento non emesso, non valido come atto${p.bozzaNota ? `: ${escHtml(p.bozzaNota)}` : '.'}</div>` : ''}
    ${p.footer.disc ? `<div class="df-disc">${escHtml(p.footer.disc)}</div>` : ''}
  </footer>`


  return `<!doctype html>
<html lang="it" data-tool="${p.tool}"><head><meta charset="utf-8">
<title>${escHtml(p.docTitle || p.title)}</title>
<style>${DOC_CSS}</style></head>
<body>
  <div class="doc-bar">
    <button class="ghost" onclick="window.close()">Chiudi</button>
    <button onclick="window.print()">⎙ Stampa / Salva PDF</button>
  </div>
  ${p.bozza ? '<div class="doc-filigrana" aria-hidden="true">COPIA DI LAVORO</div>' : ''}
  ${p.enteHeader ? enteHeaderHTML(p.enteHeader) : ''}
  ${p.company ? studioHeaderHTML(p.company) : ''}
  ${head}
  <div class="docbody">
${p.bodyHTML}
  </div>
  ${foot}
</body></html>`
}
