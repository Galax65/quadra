/**
 * Salva un file prodotto dal programma (Excel, XPWE, zip): il browser lo
 * scarica, il guscio desktop chiede dove metterlo. Un posto solo, per tutti.
 */
export function salvaFile(nome: string, dati: Blob | Uint8Array | ArrayBuffer | string, tipo = 'application/octet-stream'): void {
  const blob = dati instanceof Blob ? dati : new Blob([dati as BlobPart], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
