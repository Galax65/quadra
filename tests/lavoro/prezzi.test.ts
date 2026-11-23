import { describe, it, expect } from 'vitest'
import { pannelloPrezziHtml, nuovoPannello, nomePrimaScheda, type Pannello } from '../../src/tools/lavoro/prezzi'
import { nuovoLavoro, nuovoComputo, aggiungiArticolo, aggiungiVoce, chiudi, promuoviAContratto, revisione, type Lavoro } from '../../src/shared/lavoro'

/**
 * IL PANNELLO PREZZI (tappa 3 di Docs/07-Un-lavoro-un-modulo.md): uno solo,
 * per ogni tappa, con le stesse tre schede — progetto (o contratto),
 * prezzario, altro progetto. Si pesca solo dove si può scrivere.
 */
const D = '01/01/2026'
function lavoro(): { l: Lavoro; id: string } {
  let l = nuovoLavoro()
  const r = nuovoComputo(l, { fase: 'esecutivo', data: D }); l = r.lavoro
  const a = aggiungiArticolo(l, r.id, { codice: 'A.01', descrizione: 'Scavo', um: 'm3', prezzo: 10, origine: 'prezzario' }); l = a.lavoro
  const n = aggiungiArticolo(l, r.id, { codice: 'NP.01', descrizione: 'Pozzetto speciale', um: 'cad', prezzo: 250, origine: 'np' }); l = n.lavoro
  l = aggiungiVoce(l, r.id, { articolo: a.id }).lavoro
  l = aggiungiVoce(l, r.id, { articolo: a.id }).lavoro
  return { l, id: r.id }
}
const pan = (o: Partial<Pannello> = {}): Pannello => ({ ...nuovoPannello(), ...o })

describe('le tre schede, sempre le stesse', () => {
  it('progetto, prezzario, altro progetto; la prima si chiama contratto quando la tappa lo è', () => {
    const { l, id } = lavoro()
    const h = pannelloPrezziHtml(revisione(l, id), pan())
    expect([...h.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['Progetto', 'Prezzario', 'Altro progetto'])
    const c = promuoviAContratto(chiudi(l, id, D), id, { data: D })
    expect(nomePrimaScheda(revisione(c.lavoro, c.id))).toBe('Contratto')
  })

  it("l'elenco della revisione dice quante voci usano ogni articolo, e si pesca con ＋", () => {
    const { l, id } = lavoro()
    const h = pannelloPrezziHtml(revisione(l, id), pan())
    expect(h).toContain('×2')
    expect(h).toContain('lvPzVoceDaArticolo(')
    expect(h).toContain('ondblclick=')
  })

  it('a revisione chiusa si consulta e basta', () => {
    const { l, id } = lavoro()
    const h = pannelloPrezziHtml(revisione(chiudi(l, id, D), id), pan())
    expect(h).not.toContain('lvPzVoceDaArticolo(')
    expect(h).not.toContain('ondblclick=')
    expect(h).toContain('in sola lettura')
  })

  it('ANALISI PREZZI apre i soli nuovi prezzi e le analisi', () => {
    const { l, id } = lavoro()
    const h = pannelloPrezziHtml(revisione(l, id), pan({ soloNp: true }))
    expect(h).toContain('NP.01')
    expect(h).not.toContain('>A.01<')
  })

  it('il prezzario: senza prezzari lo dice e propone l\'import; con le righe trovate si pesca', () => {
    const { l, id } = lavoro()
    const r = revisione(l, id)
    expect(pannelloPrezziHtml(r, pan({ scheda: 'prezzario' }))).toContain('lvPzImportaXpwe()')
    const h = pannelloPrezziHtml(r, pan({
      scheda: 'prezzario', prezzario: 'arc:v.xpwe',
      prezzari: [{ id: 'arc:v.xpwe', nome: 'Veneto 2026', regione: 'Veneto', anno: '2026', n: 2, origine: 'archivio' }],
      trovate: [{ codice: 'V.01', desc_short: 'Scavo', declaratoria: 'Scavo di sbancamento', um: 'm3', prezzo: 8 } as never],
    }))
    expect(h).toContain('Veneto 2026')
    expect(h).toContain('lvPzDaPrezzario(0)')
  })

  it("l'altro progetto: si apre un file, se ne sceglie la revisione, se ne prendono gli articoli", () => {
    const { l, id } = lavoro()
    expect(pannelloPrezziHtml(revisione(l, id), pan({ scheda: 'altro' }))).toContain('lvPzApriAltro()')
    const h = pannelloPrezziHtml(revisione(l, id), pan({ scheda: 'altro', altro: { nome: 'Scuola', lavoro: l, rev: id } }))
    expect(h).toContain('Scuola')
    expect(h).toContain('lvPzDaAltro(')
  })

  it('chiuso non c\'è, e si riapre dalla barra', () => {
    const { l, id } = lavoro()
    expect(pannelloPrezziHtml(revisione(l, id), pan({ aperto: false }))).toBe('')
  })
})

describe('i filtri del prezzario, a cascata', () => {
  it('disciplina › sistema › settore; i valori sotto dipendono da quelli sopra', async () => {
    const { filtraPrezzario, valoriFiltro } = await import('../../src/tools/lavoro/prezzi')
    const r = (codice: string, disciplina: string, sistema: string, settore: string) => ({ codice, disciplina, sistema, settore } as never)
    const righe = [r('1', 'EDILE', 'Strutture', 'Scavi'), r('2', 'EDILE', 'Finiture', 'Intonaci'), r('3', 'IMPIANTI', 'Elettrico', 'Cavi')]
    expect(valoriFiltro(righe, 'disciplina')).toEqual(['EDILE', 'IMPIANTI'])
    expect(valoriFiltro(righe, 'sistema', { disciplina: 'EDILE' })).toEqual(['Finiture', 'Strutture'])
    expect(filtraPrezzario(righe, { disciplina: 'EDILE', settore: 'Scavi' }).map((x: { codice: string }) => x.codice)).toEqual(['1'])
    const h = pannelloPrezziHtml(null, pan({ scheda: 'prezzario', prezzario: 'p', prezzari: [{ id: 'p', nome: 'P', n: 3, origine: 'archivio' } as never], righe, trovate: righe, filtri: { disciplina: 'EDILE' } }))
    expect(h).toContain('lvPzFiltro(')
    expect(h).toContain('togli i filtri')
  })
})
