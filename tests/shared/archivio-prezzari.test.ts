import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * ARCHIVIO PREZZARI DEL PROGRAMMA: uno scaffale solo, per tutti gli strumenti.
 * Un prezzario non appartiene al Computo — appartiene al programma — e la
 * Contabilità deve pescare dallo stesso posto, altrimenti chi ha caricato il
 * prezzario regionale di là si sente dire «nessun prezzario» di qua.
 */
const leggi = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')

describe('un solo archivio per i due strumenti', () => {
  it('l\'implementazione sta nel layer condiviso, non in un tool', () => {
    const a = leggi('src/shared/prezzari/archivio.ts')
    expect(a).toContain("const DB = 'quadra-prezzari'")
    expect(a).toContain('export async function prezzariDisponibili')
    expect(a).toContain('export async function righePrezzarioSalvato')
  })

  it('Lavoro elenca TUTTO lo scaffale, con lo stesso caricatore condiviso', () => {
    const b = leggi('src/shared/prezzari/carica.ts')
    expect(b).toContain("from './archivio'")
    expect(b).toContain('export { prezzariDisponibili }')
    expect(leggi('src/tools/lavoro/main.ts')).toContain("from '../../shared/prezzari/carica'")
    // carica sia dall'archivio dell'utente sia dal pacchetto del programma
    expect(b).toContain('fileArchivio(id)')
    expect(b).toContain('slugInstallato(id)')
  })

  it('il formato impacchettato è dati condivisi, non una funzione del Computo', () => {
    expect(() => leggi('src/shared/prezzari/pack.ts')).not.toThrow()
    expect(leggi('src/shared/prezzari/carica.ts')).toContain("from './pack'")
    expect(leggi('scripts/build-prezzari.ts')).toContain("from '../src/shared/prezzari/pack'")
  })
})
