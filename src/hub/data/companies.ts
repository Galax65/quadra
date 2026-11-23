/**
 * Registro AZIENDE/studi (profili aziendali dell'hub).
 *
 * FONDAMENTA estensibili: aggiungere un'azienda = una riga in `COMPANIES`, senza
 * toccare la UI. Un profilo aziendale porta con sé logo + intestazioni discrete
 * nelle schermate e nei documenti; l'admin (senza azienda) ha comportamento normale.
 *
 * PREDISPOSIZIONE: il logo può non essere ancora caricato → si mostra un TEMPLATE
 * placeholder (sigla) da riempire con l'immagine quando arriverà (`logo`).
 *
 * Quadra include un solo profilo demo, sostituibile: ogni studio che scarica
 * la suite modifica `COMPANIES` con la propria ragione sociale e il proprio logo.
 */

import { escHtml as escAttr } from '../../shared/doc/doc'

/** Logo placeholder generico (monogramma vettoriale, nessuna identità reale). */
const STUDIO_DEMO_LOGO_DATA_URL =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">'
    + '<rect width="120" height="120" rx="16" fill="#2b3a55"/>'
    + '<text x="60" y="72" font-family="sans-serif" font-size="44" font-weight="700" '
    + 'fill="#e8edf7" text-anchor="middle">SD</text></svg>',
  )

export interface Company {
  /** Chiave di riconoscimento (match case-insensitive sul nome digitato). */
  id: string
  /** Ragione sociale completa (mostrata nelle intestazioni). */
  name: string
  /** Sigla breve per il placeholder del logo (default: id in maiuscolo). */
  short?: string
  /** Indirizzo (per le intestazioni dei documenti). */
  address?: string
  /** URL/percorso del logo. ASSENTE → si usa il template placeholder (sigla). */
  logo?: string
  /** Partita IVA / codice fiscale. */
  piva?: string
  /** Telefono, email, PEC… (una riga). */
  contatti?: string
}

/** Dati dello studio scritti dall'utente in Amministrazione → Azienda (sovrascrivono il demo). */
export const CHIAVE_AZIENDA = 'hub:azienda'
export type DatiAzienda = Partial<Pick<Company, 'name' | 'short' | 'address' | 'logo' | 'piva' | 'contatti'>>

/** Dati salvati dall'utente, o null se lo studio non è ancora stato personalizzato. */
export function aziendaSalvata(store: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): DatiAzienda | null {
  try {
    const o = JSON.parse(store?.getItem(CHIAVE_AZIENDA) || 'null')
    return o && typeof o === 'object' && String(o.name || '').trim() ? o as DatiAzienda : null
  } catch { return null }
}

/** Unisce i dati salvati al profilo di base (campi vuoti = tolti). */
export function applicaAzienda(base: Company, d: DatiAzienda | null): Company {
  if (!d) return base
  const out: Company = { ...base }
  for (const k of ['name', 'short', 'address', 'logo', 'piva', 'contatti'] as const) {
    const v = typeof d[k] === 'string' ? d[k]!.trim() : undefined
    if (v === undefined) continue
    if (v) out[k] = v
    else if (k !== 'name') delete out[k]
  }
  if (!d.short && d.name) out.short = sigla(d.name)
  return out
}

/** Sigla dalle iniziali (max 3 lettere): «Studio Tecnico Rossi» → «STR». */
export function sigla(nome: string): string {
  return nome.split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).slice(0, 3).map((w) => w[0]).join('').toUpperCase() || 'Q'
}

/** Riga di recapiti per le intestazioni: indirizzo · P.IVA · contatti. */
export function recapitiAzienda(c: Company): string {
  return [c.address, c.piva ? `P.IVA/C.F. ${c.piva}` : '', c.contatti].filter(Boolean).join(' · ')
}

/** Aziende/studi riconosciuti. Sostituisci questa voce con la tua: id, ragione
 *  sociale, indirizzo e logo (data URL, così resta incorporato anche nei PDF). */
export const COMPANIES: Company[] = [
  {
    id: 'studio-demo',
    short: 'SD',
    name: 'Studio Demo',
    logo: STUDIO_DEMO_LOGO_DATA_URL,
  },
]

/** Le aziende con i dati personalizzati dall'utente (lo studio è il primo profilo). */
export function aziende(): Company[] {
  const d = aziendaSalvata()
  return COMPANIES.map((c, i) => (i === 0 ? applicaAzienda(c, d) : c))
}

/** Riconosce un'azienda dal nome digitato (id, nome esatto o prefisso). */
export function findCompany(input: string): Company | null {
  const q = (input || '').trim().toLowerCase()
  if (!q) return null
  const lista = aziende()
  return (
    lista.find((c) => c.id === q || c.name.toLowerCase() === q) ||
    lista.find((c) => c.name.toLowerCase().startsWith(q) || c.id.startsWith(q)) ||
    null
  )
}

/** Lo studio di questa installazione (Quadra è mono-studio). */
export function studio(): Company {
  return aziende()[0]
}

/** Sigla del logo placeholder. */
export function companyShort(c: Company): string {
  return (c.short || c.id).toUpperCase()
}

/**
 * HTML del logo azienda. Se `logo` è presente → <img> con FALLBACK: se il file
 * non si carica (non ancora salvato, o percorso non risolto in un iframe srcdoc),
 * l'`onerror` nasconde l'immagine e rivela il placeholder (sigla) accanto.
 * Se `logo` è assente → direttamente il TEMPLATE placeholder.
 */
export function companyLogoHtml(c: Company, cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  const ph = (hidden: boolean): string =>
    `<span class="co-logo co-logo--ph${cl}"${hidden ? ' style="display:none"' : ''} data-company="${escAttr(c.id)}" title="Logo ${escAttr(c.name)} — da caricare">${escAttr(companyShort(c))}</span>`
  if (c.logo) {
    return `<img class="co-logo${cl}" src="${escAttr(c.logo)}" alt="${escAttr(c.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display=''">${ph(true)}`
  }
  return ph(false)
}
