/**
 * PDF/A-2b — il PDF che si può conservare.
 *
 * Gli atti di un lavoro pubblico si conservano, e il PDF/A è il formato che le
 * Linee guida AgID sulla formazione del documento informatico indicano per la
 * conservazione. La «b» (livello base) chiede che il documento si veda sempre
 * allo stesso modo, ovunque e fra vent'anni. In pratica, dentro il file:
 *
 *  1. TUTTI i caratteri incorporati — niente Helvetica «di sistema», che un altro
 *     computer disegna a modo suo. Qui Arimo (src/shared/stampa/font-arimo.ts);
 *  2. nessun glifo mancante: un carattere che il font non ha non deve finire
 *     sul .notdef, si sostituisce prima (caratteriPdfA);
 *  3. un INTENTO DI OUTPUT con il suo profilo colore: il PDF dice in che spazio
 *     colore vanno letti i suoi RGB. Il profilo sRGB lo si costruisce qui
 *     (profiloSRGB), con i numeri pubblici della norma IEC 61966-2-1;
 *  4. i METADATI XMP che dichiarano «PDF/A-2b» e ripetono titolo, programma e
 *     date del dizionario Info, con gli stessi valori;
 *  5. l'identificativo del file nel trailer.
 *
 * Il resto (niente cifratura, niente JavaScript, niente contenuti esterni) pdf-lib
 * lo rispetta già da sé.
 */

import { ARIMO_BOLD_TTF, ARIMO_REGULAR_TTF } from './font-arimo'

type Lib = any // pdf-lib, passato da chi chiama (window.PDFLib o il modulo)

/* ── Il profilo colore sRGB (ICC v2, profilo «a matrice») ──────────────── */

function s15f16(v: number): number[] {
  const n = Math.round(v * 65536) >>> 0
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
}
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u16 = (n: number): number[] => [(n >>> 8) & 255, n & 255]
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0) & 127)
const allinea = (b: number[]): number[] => { while (b.length % 4) b.push(0); return b }

function tagXYZ(x: number, y: number, z: number): number[] {
  return [...ascii('XYZ '), 0, 0, 0, 0, ...s15f16(x), ...s15f16(y), ...s15f16(z)]
}
function tagDesc(s: string): number[] {
  // textDescriptionType (ICC v2): ASCII, poi Unicode e ScriptCode vuoti
  return allinea([...ascii('desc'), 0, 0, 0, 0, ...u32(s.length + 1), ...ascii(s), 0, ...u32(0), ...u32(0), ...u16(0), 0, ...new Array(67).fill(0)])
}
function tagText(s: string): number[] {
  return allinea([...ascii('text'), 0, 0, 0, 0, ...ascii(s), 0])
}
/** La curva di sRGB (IEC 61966-2-1), campionata: lineare vicino al nero, poi potenza 2,4. */
function tagCurvaSRGB(): number[] {
  const n = 1024
  const out = [...ascii('curv'), 0, 0, 0, 0, ...u32(n)]
  for (let i = 0; i < n; i++) {
    const v = i / (n - 1)
    const lin = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    out.push(...u16(Math.round(lin * 65535)))
  }
  return allinea(out)
}

let _profilo: Uint8Array | null = null
/** Il profilo ICC sRGB IEC61966-2.1, versione 2.1, costruito una volta e tenuto. */
export function profiloSRGB(): Uint8Array {
  if (_profilo) return _profilo
  const curva = tagCurvaSRGB()
  // primari di sRGB adattati a D50 (Bradford), bianco D65 — come il profilo della norma
  const dati: [string, number[]][] = [
    ['desc', tagDesc('sRGB IEC61966-2.1')],
    ['cprt', tagText('No copyright, use freely')],
    ['wtpt', tagXYZ(0.9505, 1.0, 1.0891)],
    ['rXYZ', tagXYZ(0.4361, 0.2225, 0.0139)],
    ['gXYZ', tagXYZ(0.3851, 0.7169, 0.0971)],
    ['bXYZ', tagXYZ(0.1431, 0.0606, 0.7141)],
    ['rTRC', curva], ['gTRC', curva], ['bTRC', curva],
  ]
  const nTag = dati.length
  let off = 128 + 4 + nTag * 12
  const tabella: number[] = [...u32(nTag)]
  const corpo: number[] = []
  const giaScritti = new Map<number[], number>()
  for (const [sig, b] of dati) {
    let pos = giaScritti.get(b)
    if (pos == null) { pos = off; giaScritti.set(b, pos); corpo.push(...b); off += b.length }
    tabella.push(...ascii(sig), ...u32(pos), ...u32(b.length))
  }
  const totale = 128 + tabella.length + corpo.length
  const testa = [
    ...u32(totale), 0, 0, 0, 0,               // dimensione, CMM
    0x02, 0x10, 0, 0,                          // versione 2.1
    ...ascii('mntr'), ...ascii('RGB '), ...ascii('XYZ '),
    ...u16(2026), ...u16(1), ...u16(1), 0, 0, 0, 0, 0, 0, // data
    ...ascii('acsp'), 0, 0, 0, 0,              // firma, piattaforma
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,        // flag, produttore, modello
    0, 0, 0, 0, 0, 0, 0, 0,                    // attributi
    0, 0, 0, 0,                                // intento percettivo
    ...s15f16(0.9642), ...s15f16(1.0), ...s15f16(0.8249), // illuminante D50
    0, 0, 0, 0,                                // creatore
  ]
  while (testa.length < 128) testa.push(0)
  _profilo = new Uint8Array([...testa, ...tabella, ...corpo])
  return _profilo
}

/* ── I metadati XMP ───────────────────────────────────────────────────── */

const xml = (s: string): string => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string))
/** Data in ISO 8601 al secondo, in UTC: la stessa che pdf-lib scrive nel dizionario Info. */
const isoUTC = (d: Date): string => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

export interface MetaPdfA { titolo: string; creatore: string; produttore: string; data: Date }

export function xmpPdfA(m: MetaPdfA): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdfaid:part>2</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(m.titolo)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreatorTool>${xml(m.creatore)}</xmp:CreatorTool>
   <xmp:CreateDate>${isoUTC(m.data)}</xmp:CreateDate>
   <xmp:ModifyDate>${isoUTC(m.data)}</xmp:ModifyDate>
   <xmp:MetadataDate>${isoUTC(m.data)}</xmp:MetadataDate>
   <pdf:Producer>${xml(m.produttore)}</pdf:Producer>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

/* ── I caratteri ──────────────────────────────────────────────────────── */

function base64InByte(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const s = atob(b64); const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'))
}

/**
 * Un font che non manda mai un carattere sul .notdef: quello che non ha lo
 * sostituisce con «?», sia nel disegnarlo sia nel misurarlo (così l'a capo resta
 * giusto). Il testo arriva già ripulito per WinAnsi; qui si chiude il buco dei
 * caratteri che WinAnsi ha e Arimo no.
 */
function senzaGlifiMancanti(font: any): any {
  const set: Set<number> = new Set(font.getCharacterSet?.() ?? [])
  if (!set.size) return font
  const pulisci = (t: string): string => [...String(t)].map((ch) => (ch === '\n' || set.has(ch.codePointAt(0)!) ? ch : '?')).join('')
  const enc = font.encodeText.bind(font), w = font.widthOfTextAtSize.bind(font)
  font.encodeText = (t: string) => enc(pulisci(t))
  font.widthOfTextAtSize = (t: string, s: number) => w(pulisci(t), s)
  return font
}

/** fontkit, se è sulla pagina (vendor/fontkit.min.js) o passato da chi chiama. */
export function trovaFontkit(lib: Lib, fk?: unknown): unknown {
  return fk ?? lib?.fontkit ?? (globalThis as any).fontkit ?? null
}

/**
 * I caratteri del documento, incorporati: normale e grassetto in Arimo; il
 * corsivo è il normale inclinato (Arimo corsivo non c'è, e un corsivo finto è
 * meglio di un carattere non incorporato). Null se fontkit non c'è: allora il
 * documento non può essere PDF/A, e chi chiama ripiega sui font standard.
 */
export async function caratteriPdfA(doc: any, lib: Lib, fontkit: unknown): Promise<{ n: any; b: any; i: any } | null> {
  if (!fontkit) return null
  doc.registerFontkit(fontkit)
  const n = senzaGlifiMancanti(await doc.embedFont(base64InByte(ARIMO_REGULAR_TTF), { subset: true }))
  const b = senzaGlifiMancanti(await doc.embedFont(base64InByte(ARIMO_BOLD_TTF), { subset: true }))
  void lib
  return { n, b, i: n }
}

/* ── Il documento ─────────────────────────────────────────────────────── */

function idFile(m: MetaPdfA): string {
  // impronta breve e stabile di titolo e data: l'identificativo non deve essere segreto, solo unico
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const s = `${m.titolo}|${m.data.toISOString()}|${Math.random()}`
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 2654435761) }
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0')
  return (hex(h1) + hex(h2) + hex(h1 ^ h2) + hex(Math.imul(h1, h2))).toUpperCase()
}

/**
 * Rende PDF/A-2b un documento pdf-lib già disegnato con caratteri incorporati:
 * metadati Info e XMP coerenti, intento di output sRGB, identificativo.
 * Da salvare poi con `salvaPdfA`, che non riscrive le date.
 */
export function rendiPdfA(doc: any, lib: Lib, m: MetaPdfA): void {
  const { PDFName, PDFString, PDFHexString } = lib
  doc.setTitle(m.titolo, { showInWindowTitleBar: true })
  doc.setCreator(m.creatore)
  doc.setProducer(m.produttore)
  doc.setCreationDate(m.data)
  doc.setModificationDate(m.data)
  const ctx = doc.context
  const xmp = new TextEncoder().encode(xmpPdfA(m))
  const metadati = ctx.stream(xmp, { Type: 'Metadata', Subtype: 'XML', Length: xmp.length })
  doc.catalog.set(PDFName.of('Metadata'), ctx.register(metadati))
  const icc = profiloSRGB()
  const profilo = ctx.flateStream(icc, { N: 3 })
  const intento = ctx.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: ctx.register(profilo),
  })
  doc.catalog.set(PDFName.of('OutputIntents'), ctx.obj([intento]))
  const id = PDFHexString.of(idFile(m))
  ctx.trailerInfo.ID = ctx.obj([id, id])
}

/** Salva senza che pdf-lib riscriva produttore e date: devono restare uguali a quelle dell'XMP. */
export function salvaPdfA(doc: any): Promise<Uint8Array> {
  return doc.save({ updateMetadata: false, useObjectStreams: false })
}
