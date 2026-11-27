import { describe, it, expect } from 'vitest'
import { frontespizioHTML, giornaleHTML, librettoHTML, registroHTML, sommarioHTML, salHTML, certificatoHTML, contoFinaleHTML, relazioneFinaleHTML, verbaleHTML, VERBALE_LABEL, listaEconomiaHTML } from '../../src/tools/contabilita/engine'
import type { Appalto, Partita, Sal, Verbale, ListaEconomia } from '../../src/tools/contabilita/engine/types'
import { partiteDiProva, verbaliDiProva } from './_fixture'

const appalto: Appalto = {
  oggetto: 'Manutenzione straordinaria scuola', cup: 'C11', cig: 'Z0A',
  ente: { denominazione: 'Comune di Prova', indirizzo: 'Piazza Roma 1', codiceFiscale: '00000000000', logo: 'data:image/png;base64,AAAA' },
  impresa: { denominazione: 'Impresa Edile srl', partitaIva: '01234567890' },
  rup: 'Ing. Rossi', direttoreLavori: 'Arch. Bianchi', articoloCapitolato: '12',
  baseAsta: 100000, importoOfferta: 80000, oneriSicurezza: 2000, ivaPct: 10, modalita: 'misto',
}
const partite: Partita[] = partiteDiProva()
const sals: Sal[] = [{ numero: 1, data: '01/06/2026', righe: [
  { partitaId: partite[0].id, quantitaProgressiva: 50 },
  { partitaId: partite[1].id, quotaPct: 30 },
] }]

// Un verbale per ogni tipo (id/numero deterministici), per verificare tutti gli atti.
const verbali: Verbale[] = verbaliDiProva()

const tutti: Record<string, string> = {
  frontespizio: frontespizioHTML(appalto, partite),
  giornale: giornaleHTML(appalto, []),
  libretto: librettoHTML(appalto, partite, sals[0]),
  registro: registroHTML(appalto, partite, sals),
  sommario: sommarioHTML(appalto, partite, sals, 1),
  sal: salHTML(appalto, partite, sals, 1),
  certificato: certificatoHTML(appalto, partite, sals, 1),
  contoFinale: contoFinaleHTML(appalto, partite, sals, verbali),
  relazione: relazioneFinaleHTML(appalto, partite, sals, [], '', verbali),
  ...Object.fromEntries(verbali.map((v) => [`verbale:${v.tipo}`, verbaleHTML(appalto, v)])),
}

describe('Contabilità documenti — modalità istituzionale (testata ente, NO brand Quadra)', () => {
  for (const [nome, html] of Object.entries(tutti)) {
    it(`${nome}: HTML valido, testata dell'ente, senza brand Quadra`, () => {
      expect(html.startsWith('<!doctype html>')).toBe(true)
      expect(html).toContain('data-tool="contabilita"')
      // testata istituzionale con la denominazione dell'ente
      expect(html).toContain('doc-ente')
      expect(html).toContain('Comune di Prova')
      // il brand Quadra NON deve comparire VISIBILMENTE in questi atti standard della PA:
      // né il wordmark reso (<small>Quadra</small>), né il lockup del cartiglio.
      // (Le regole CSS .ehub-brand restano nel foglio embeddato, invisibili al lettore.)
      expect(html).not.toContain('>Quadra<')
      expect(html).not.toContain('class="df-lockup"')
      expect(html).not.toContain('class="ehub-brand"')
    })
  }
})

describe('Contabilità documenti — contenuti chiave', () => {
  it('SAL espone la cascata e la ritenuta 0,50%', () => {
    expect(tutti.sal).toContain('ritenuta di garanzia 0,50%')
    expect(tutti.sal).toContain('IMPORTO DEL PRESENTE SAL')
  })
  it('certificato riporta il credito in lettere (Diconsi)', () => {
    expect(tutti.certificato).toContain('Diconsi euro')
    expect(tutti.certificato).toContain('CERTIFICA')
  })
  it('libretto distingue lavorazioni a misura e a corpo', () => {
    expect(tutti.libretto).toContain('Lavorazioni a misura')
    expect(tutti.libretto).toContain('Lavorazioni a corpo')
  })
})

describe('Contabilità lavori in economia — documenti', () => {
  const l: ListaEconomia = {
    id: 'l1', numero: 1, data: '05/06/2026', salNumero: 1,
    operai: [{ qualifica: 'operaio comune', ore: 8, tariffaOraria: 25 }],
    mezzi: [{ descrizione: 'escavatore', ore: 4, tariffaOraria: 50 }],
    provviste: [{ descrizione: 'calcestruzzo', um: 'mc', quantita: 2, prezzoUnitario: 100 }],
  }
  it('la lista settimanale è un atto istituzionale (testata ente, no brand Quadra, firme)', () => {
    const html = listaEconomiaHTML(appalto, l)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('data-tool="contabilita"')
    expect(html).toContain('doc-ente')
    expect(html).toContain('Comune di Prova')
    expect(html).not.toContain('>Quadra<')
    expect(html).toContain('Mano d\'opera')
    expect(html).toContain('bt-firme')
    expect(html).toContain('art. 12 c. 1 lett. c) All. II.14')
  })
})

describe('Contabilità verbali e comunicazioni del DL', () => {
  it('ogni tipo produce un atto col proprio titolo e le firme', () => {
    for (const v of verbali) {
      const html = verbaleHTML(appalto, v)
      expect(html, v.tipo).toContain(VERBALE_LABEL[v.tipo])
      expect(html, v.tipo).toContain('bt-firme') // riquadro firme sempre presente
      expect(html, v.tipo).toContain('Oggetto ' + v.tipo)
    }
  })
  it('il verbale di consegna espone gli accertamenti in contraddittorio', () => {
    const c = verbali.find((v) => v.tipo === 'consegna')!
    expect(verbaleHTML(appalto, c)).toContain('libera da persone e cose')
  })
  it('la relazione finale elenca i verbali come allegati', () => {
    expect(tutti.relazione).toContain('Allegati al conto finale')
    expect(tutti.relazione).toContain('Verbale di consegna dei lavori')
    // senza verbali → nessun allegato
    expect(relazioneFinaleHTML(appalto, partite, sals)).toContain('Nessun verbale o comunicazione')
  })
  it('il conto finale avvisa (gate soft) se manca il certificato di ultimazione', () => {
    const senzaUltim = verbali.filter((v) => v.tipo !== 'ultimazione')
    expect(contoFinaleHTML(appalto, partite, sals, senzaUltim)).toContain('non risulta redatto')
    // con l'ultimazione presente → nessun avviso
    expect(contoFinaleHTML(appalto, partite, sals, verbali)).not.toContain('non risulta redatto')
    // retro-compat: senza il parametro verbali, il documento resta valido (avvisa)
    expect(contoFinaleHTML(appalto, partite, sals)).toContain('CREDITO RESIDUO')
  })
})
