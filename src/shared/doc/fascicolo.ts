/**
 * IL FASCICOLO e l'EXPORT MODIFICABILE degli atti in HTML.
 *
 * Un SAL (o una perizia) non è un documento: è un fascicolo. Gli atti si
 * fondono in un documento solo, uno per pagina (fondiAtti). E chi li deve
 * ritoccare in Word o LibreOffice li esporta in DOCX o ODT (esportaEditabile),
 * con lo stesso testo e le stesse tabelle.
 */
import { htmlDocToSimpleDoc } from './html-to-blocks'
import { buildSimpleDocxParts, DOCX_MIME } from './ooxml'
import { buildOdtParts, ODT_MIME, ODT_MIMETYPE_ENTRY } from './odt'

/** Unisce più atti in un solo documento da stampare, uno per pagina. */
export function fondiAtti(pagine: string[]): string {
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

interface ZipLike { file: (path: string, content: string | Blob, opts?: { compression?: string }) => void; generateAsync: (o: { type: string; mimeType?: string }) => Promise<Blob> }

/** Un atto HTML in DOCX o ODT (la libreria JSZip la passa chi chiama, caricata a richiesta). */
export async function esportaEditabile(html: string, formato: 'docx' | 'odt', JSZip: new () => ZipLike): Promise<Blob> {
  const doc = htmlDocToSimpleDoc(html)
  const z = new JSZip()
  if (formato === 'docx') {
    for (const [path, content] of Object.entries(buildSimpleDocxParts(doc))) z.file(path, content)
    return z.generateAsync({ type: 'blob', mimeType: DOCX_MIME })
  }
  for (const [path, content] of Object.entries(buildOdtParts(doc))) z.file(path, content, path === ODT_MIMETYPE_ENTRY ? { compression: 'STORE' } : undefined)
  return z.generateAsync({ type: 'blob', mimeType: ODT_MIME })
}
