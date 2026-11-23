/**
 * L'albero che la Contabilità pubblica verso l'hub.
 *
 * La cronologia del lavoro non è più una striscia disegnata al centro della
 * pagina: è l'albero della sidebar, e i test che riguardano «che cosa c'è e in
 * che ordine» si fanno qui, sulla sorgente, non sul disegno.
 */
export interface AttoAlbero { tipo: string; label: string; art?: string; lavoro?: boolean }
export interface RamoAlbero { fase: string; etichetta: string; stato?: string; rev?: number; elimina?: string; atti: AttoAlbero[] }

let ultimo: RamoAlbero[] = []
window.addEventListener('message', (ev) => {
  const d = (ev as MessageEvent).data as { type?: string; project?: { albero?: RamoAlbero[] } }
  if (d?.type === 'app:project-update' && d.project?.albero) ultimo = d.project.albero
})

/** postMessage consegna in un giro di eventi: si aspetta un tick. */
export async function albero(): Promise<RamoAlbero[]> {
  await new Promise((r) => setTimeout(r, 0))
  return ultimo
}
/** L'albero in una riga, per asserire ordine e contenuto insieme. */
export async function testoAlbero(): Promise<string> {
  return (await albero()).map((r) =>
    `${r.etichetta}${r.stato ? ` (${r.stato})` : ''}${r.atti.length ? ` [${r.atti.map((a) => a.label).join(', ')}]` : ''}`).join(' | ')
}
