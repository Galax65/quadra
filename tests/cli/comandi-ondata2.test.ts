import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { runCli } from '../../scripts/cli/quadra'
import { partiteDiProva } from '../contabilita/_fixture'

const tmp = () => mkdtempSync(join(tmpdir(), 'quadra-cli2-'))

/** Progetto .ehub sintetico con stati Contabilità e δ (stessa forma dei test dei tool). */
function scriviProgetto(dir: string): string {
  const appalto = {
    oggetto: 'Manutenzione scuola', cup: 'C11', cig: 'Z0A',
    ente: { denominazione: 'Comune di Prova', indirizzo: 'Piazza Roma 1', codiceFiscale: '0', logo: '' },
    impresa: { denominazione: 'Impresa srl', partitaIva: '01234567890' },
    rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', articoloCapitolato: '12',
    baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto',
  }
  const partite = partiteDiProva()
  const sals = [{ numero: 1, data: '01/06/2026', righe: [
    { partitaId: partite[0]!.id, quantitaProgressiva: 50 },
    { partitaId: partite[1]!.id, quotaPct: 30 },
  ] }]
  const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const progetto = {
    kind: 'quadra-project', v: 1, ts: 1754300000000,
    tools: {
      'contabilita': { v: 1, appalto, partite, sals, verbali: [], giornale: [], economia: [] },
      delta: {
        v: 1,
        template: { dataUrl: PNG_1PX, w: 850, h: 1200, kind: 'pdf', name: 'cartiglio.pdf', ptW: 595, ptH: 842 },
        fields: [{ id: 'f1', kind: 'column', label: 'Titolo', column: 'Titolo', x: 0.5, y: 0.4, anchor: 'mc', align: 'center', fontFrac: 0.03 }],
        elenco: { headers: ['Codice', 'Titolo'], rows: [
          { Codice: 'A123-EL01', Titolo: 'Planimetria PT' },
          { Codice: 'A123-EL02', Titolo: 'Planimetria P1' },
        ], fileName: 'elenco.xlsx' },
        filenameColumn: 'Codice',
      },
    },
  }
  const path = join(dir, 'progetto.ehub')
  writeFileSync(path, JSON.stringify(progetto))
  return path
}

describe('CLI quadra — smoke ondata 2 (Contabilità)', () => {
  it('beta:atti genera la cartella d\'appalto da un .ehub (html + xlsx)', async () => {
    const dir = tmp()
    const progetto = scriviProgetto(dir)
    const esito = await runCli(['beta:atti', progetto, '--out', dir])
    expect(esito.stdout.length).toBeGreaterThanOrEqual(8)
    for (const p of esito.stdout) expect(existsSync(p), p).toBe(true)
    expect(readFileSync(esito.stdout.find((p) => p.includes('sal1'))!, 'utf-8')).toContain('Comune di Prova')

    const xlsx = await runCli(['beta:atti', progetto, '--tipo', 'sal', '--formato', 'xlsx', '--out', dir])
    const wb = XLSX.read(readFileSync(xlsx.stdout[0]!), { type: 'buffer' })
    expect(wb.SheetNames.length).toBe(1)
  })

  it('beta:atti su SAL inesistente → errore parlante', async () => {
    const dir = tmp()
    const progetto = scriviProgetto(dir)
    await expect(runCli(['beta:atti', progetto, '--tipo', 'sal', '--numero', '9'])).rejects.toThrowError(/SAL n\. 9 non presente/)
  })
})
