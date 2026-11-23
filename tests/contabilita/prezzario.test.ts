import { describe, expect, it } from 'vitest'
import { categoriaDiRiga, cercaNelPrezzario } from '../../src/tools/contabilita/prezzario'
import type { PriceRow } from '../../src/tools/computo/engine/types'

/**
 * Elenco prezzi in contabilità: si cerca come nel computo — per codice o per
 * parole — e la voce buona deve venire prima di una che nomina le stesse parole
 * solo dentro la declaratoria.
 */
const riga = (p: Partial<PriceRow>): PriceRow => ({
  codice: '', declaratoria: '', desc_short: '', um: 'm3', prezzo: 10, importo_netto: 0, ru: 0,
  liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina: '', sistema: '', attivita: '',
  settore: '', keywords: '', tipologia: '', regione: 'FVG', anno: '2026', ...p,
})

const righe: PriceRow[] = [
  riga({ codice: '10.5.CE3.02', desc_short: 'SCOGLIERE CON MASSI PROVENIENTI DA CAVA', declaratoria: 'Fornitura e posa di massi; compreso lo scavo di fondazione del piede della scogliera.' }),
  riga({ codice: '11.7.CP1.01.A', desc_short: 'SCAVO DI FONDAZIONE IN TERRENO DI QUALSIASI NATURA', declaratoria: 'Scavo a sezione obbligata per fondazioni.', liv1: 'Opere edili', liv2: 'Scavi e riporti' }),
  riga({ codice: '11.8.CP1.01.A', desc_short: 'RIPORTI IN MATERIALE MISTO DI CAVA', declaratoria: 'Riporti costipati.' }),
]

describe('ricerca nell\'elenco prezzi della contabilità', () => {
  it('la voce col titolo giusto batte quella che le nomina solo nella declaratoria', () => {
    const t = cercaNelPrezzario(righe, 'scavo fondazione')
    expect(t).toHaveLength(2)
    expect(t[0].codice).toBe('11.7.CP1.01.A')
  })
  it('il codice scritto per intero porta la sua voce in cima', () => {
    expect(cercaNelPrezzario(righe, '11.8.CP1.01.A')[0].codice).toBe('11.8.CP1.01.A')
    expect(cercaNelPrezzario(righe, '11.7')[0].codice).toBe('11.7.CP1.01.A')
  })
  it('senza parole non cerca nulla; parole assenti non trovano nulla', () => {
    expect(cercaNelPrezzario(righe, '   ')).toHaveLength(0)
    expect(cercaNelPrezzario(righe, 'intonaco')).toHaveLength(0)
  })
  it('la categoria della voce arriva dai livelli del prezzario', () => {
    expect(categoriaDiRiga(righe[1])).toBe('Opere edili · Scavi e riporti')
    expect(categoriaDiRiga(righe[2])).toBeUndefined()
  })
})
