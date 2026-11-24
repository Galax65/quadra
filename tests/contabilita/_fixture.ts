import type { Partita, Verbale, VerbaleTipo } from '../../src/tools/contabilita/engine/types'

/**
 * Le due partite di prova dei test sugli atti: una a misura (scavo, 100 mc a 10 €)
 * e un corpo d'opera (impianti, 2.000 €). Sono scritte per esteso: il motore non
 * ha più un import dal computo, perché il contratto lo costruisce «Lavoro».
 */
export function partiteDiProva(): Partita[] {
  return [
    { id: 'p-m1', modalita: 'misura', codice: 'M1', descrizione: 'Scavo', um: 'mc', categoria: 'Opere edili',
      prezzoUnitario: 10, prezzoContratto: 10, qtyProgetto: 100 },
    { id: 'p-c1', modalita: 'corpo', codice: 'C01', descrizione: 'Impianti', categoria: 'Impianti', importoContrattuale: 2000 },
  ]
}

const TIPI: VerbaleTipo[] = ['consegna', 'ordine', 'sospensione', 'ripresa', 'proroga', 'nuoviprezzi', 'accertamento', 'ultimazione', 'relazioneRup']

/** Un verbale per ogni tipo, con id e numero fissi. */
export function verbaliDiProva(): Verbale[] {
  return TIPI.map((tipo, i) => ({
    id: `v${i}`, tipo, data: `0${i + 1}/06/2026`, numero: 1,
    ...(tipo === 'consegna' ? { consegnaMod: 'unica' as const } : {}),
    oggetto: `Oggetto ${tipo}`, testo: 'Primo paragrafo.\nSecondo paragrafo.',
  }))
}
