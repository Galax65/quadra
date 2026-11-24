import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FASI, FASE_PERIZIA, FASE_PROGETTO, FASE_SAL, FASE_CONTRATTO, COLONNE_NUMERICHE,  grigliaHtml, rigaDettaglioHtml, rigaGruppoHtml, rigaTotaleHtml, rigaVoceHtml, righeFoglioHtml, colonneGriglia, piedeFaseHtml, contenutoCella, COLONNE_MISURA, type IdColonna, type AzioniMisure } from '../../src/shared/griglia'

/**
 * LA GRIGLIA CONDIVISA (tappa 4 di Docs/06-Interfaccia-unica.md): computo,
 * libretto e perizia sono la stessa tabella. Cambia solo quale colonna si
 * scrive, quale si confronta e quali valori stanno in calce — e lo dice il
 * descrittore di fase, non lo strumento.
 */
const ROOT = resolve(__dirname, '../..')
const leggi = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8')
const eur = (n: number): string => '€ ' + n.toFixed(2).replace('.', ',')
const ORDINE: IdColonna[] = ['codice', 'designazione', 'confronto', 'parti', 'lung', 'larg', 'alt', 'quantita', 'prezzo', 'importo', 'differenza']

describe('il descrittore di fase', () => {
  it('ogni fase scrive una colonna che ha, e confronta una colonna che ha', () => {
    for (const f of Object.values(FASI)) {
      const ids = f.colonne.map((c) => c.id)
      expect(ids, f.fase).toContain(f.scrive)
      if (f.confronta) expect(ids, f.fase).toContain(f.confronta)
    }
  })
  it("l'ordine delle colonne è lo stesso in ogni fase (quello degli atti contabili)", () => {
    for (const f of Object.values(FASI)) {
      const pos = f.colonne.map((c) => ORDINE.indexOf(c.id))
      expect(pos, f.fase).toEqual([...pos].sort((a, b) => a - b))
      expect(pos[0], f.fase).toBe(0)  // si comincia sempre dal codice
    }
  })
  it('progetto, libretto e perizia scrivono la quantità; il contratto scrive il prezzo', () => {
    expect(FASE_PROGETTO.scrive).toBe('quantita')
    expect(FASE_SAL.scrive).toBe('quantita')
    expect(FASE_PERIZIA.scrive).toBe('quantita')
    expect(FASE_PERIZIA.confronta).toBe('confronto')
    expect(FASE_CONTRATTO.scrive).toBe('prezzo')
  })
})

describe('la griglia', () => {
  const html = grigliaHtml({
    fase: FASE_SAL,
    selezione: { tutte: 'libSelTutte(this.checked)' },
    righe: [
      { tipo: 'gruppo', titolo: 'OPERE EDILI', nota: '· 1 voce' },
      { celle: { codice: 'A.01', quantita: '<input value="3">', prezzo: '<input value="10">', importo: { html: '€ 30,00', id: 'imp-1' } }, sel: '<input type="checkbox">', classe: 'is-sel', attributi: 'data-key="a"' },
      { tipo: 'totale', titolo: 'Totale opere edili', valore: '€ 30,00' },
    ],
  })
  it("l'intestazione viene dalla fase, con la casella «tutte» in testa", () => {
    const th = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
    expect(th).toEqual(['', 'Codice', 'Designazione dei lavori', 'Par.ug.', 'Lung.', 'Larg.', 'H/peso', 'Eseguito a tutto il SAL', 'Prezzo unit.', 'Importo'])
    expect(html).toContain('onchange="libSelTutte(this.checked)"')
    expect(html).toContain('data-fase="sal"')
  })
  it('ha l\'aspetto di un campo solo la colonna che la fase scrive', () => {
    expect(html.match(/ehb-gr-c--scrive/g)).toHaveLength(1)
    expect(html).toMatch(/class="ehb-gr-c ehb-gr-c--quantita ehb-gr-num ehb-gr-c--scrive"><input value="3">/)
    expect(html).toMatch(/class="ehb-gr-c ehb-gr-c--prezzo ehb-gr-num"><input value="10">/)
  })
  it('le celle mancanti restano vuote ma ci sono: le colonne non si spostano', () => {
    const riga = /<tr class="ehb-gr-voce is-sel" data-key="a">(.*?)<\/tr>/.exec(html)![1]
    expect(riga.match(/<td/g)).toHaveLength(colonneGriglia(FASE_SAL, true))
    expect(riga).toContain('id="imp-1"')
  })
  it('gruppi, totali e dettaglio occupano la riga intera, qualunque sia la fase', () => {
    for (const f of Object.values(FASI)) {
      for (const sel of [false, true]) {
        const n = colonneGriglia(f, sel)
        expect(rigaGruppoHtml(f, { titolo: 'X' }, sel)).toContain(`colspan="${n}"`)
        expect(rigaDettaglioHtml(f, { contenuto: '', conSelezione: sel })).toContain(`colspan="${n}"`)
        const tot = rigaTotaleHtml(f, { titolo: 'T', valore: '1' }, sel)
        const span = [...tot.matchAll(/colspan="(\d+)"/g)].reduce((s, m) => s + Number(m[1]) - 1, 0) + (tot.match(/<td/g)?.length ?? 0)
        expect(span, `${f.fase} sel=${sel}`).toBe(n)
      }
    }
  })
  it('il totale di un gruppo sta sotto l\'importo (o sotto la differenza, in perizia)', () => {
    expect(rigaTotaleHtml(FASE_SAL, { titolo: 'T', valore: '€ 1' }, true)).toMatch(/^<tr class="ehb-gr-totale"><td colspan="9"/)
    expect(rigaTotaleHtml(FASE_PERIZIA, { titolo: 'T', valore: '€ 1' })).toMatch(/<td colspan="8"[^>]*>T<\/td><td class="ehb-gr-c ehb-gr-num">€ 1<\/td><\/tr>$/)
  })
  it('i numeri vanno a destra, i testi no', () => {
    for (const id of ['quantita', 'prezzo', 'importo', 'differenza', 'confronto'] as IdColonna[]) expect(COLONNE_NUMERICHE.has(id)).toBe(true)
    for (const id of ['parti', 'lung', 'larg', 'alt'] as IdColonna[]) expect(COLONNE_NUMERICHE.has(id)).toBe(true)
    for (const id of ['codice', 'designazione'] as IdColonna[]) expect(COLONNE_NUMERICHE.has(id)).toBe(false)
  })
  it('una griglia vuota lo dice, sull\'intera larghezza', () => {
    expect(grigliaHtml({ fase: FASE_PERIZIA, righe: [], vuoto: 'Niente <qui>' })).toContain(`<td colspan="9">Niente &lt;qui&gt;</td>`)
  })
})

describe('i valori di controllo in calce', () => {
  it('progetto: il totale del computo', () => {
    const h = piedeFaseHtml(FASE_PROGETTO, { totale: 1234.5, sotto: ['a corpo € 10,00'] }, eur, { id: 'p' })
    expect(h).toContain('Totale computo')
    expect(h).toContain('€ 1234,50')
    expect(h).toContain('id="p"')
  })
  it('libretto: il contabilizzato a tutto il SAL, con quanto è in questo SAL', () => {
    const h = piedeFaseHtml(FASE_SAL, { salN: 2, misurate: 3, quante: 10, mostrate: 3, inQuestoSal: 50, lordo: 150, sicurezza: 5, daLiquidare: 0 }, eur)
    expect(h).toContain('Totale contabilizzato a tutto il SAL n. 2')
    expect(h).toContain('in questo SAL € 50,00')
    expect(h).toContain('3 mostrate')
    expect(h).not.toContain('da liquidare')
  })
  it("perizia: la differenza col segno, rossa oltre il quinto d'obbligo", () => {
    const v = { variate: 1, voci: 2, aumenti: 30, diminuzioni: 0, prima: 100, dopo: 130, differenza: 30, variazione: '30%', oltreQuinto: true }
    const h = piedeFaseHtml(FASE_PERIZIA, v, eur)
    expect(h).toContain('+ € 30,00')
    expect(h).toContain('is-allarme')
    expect(h).toContain("oltre il quinto d'obbligo")
    expect(piedeFaseHtml(FASE_PERIZIA, { ...v, differenza: -5, oltreQuinto: false }, eur)).toContain('− € 5,00')
  })
})

describe('le celle: lo strumento dice che cosa, la griglia dice come', () => {
  const riga = (celle: Parameters<typeof rigaVoceHtml>[1]['celle'], fase = FASE_SAL): string => rigaVoceHtml(fase, { celle })

  it('il campo della fase è un campo; lo stesso campo in un\'altra colonna sembra testo', () => {
    const h = riga({
      quantita: { tipo: 'campo', valore: '3,5', um: 'm²', comando: "setSalQta(1,'p1',this.value)", segnaposto: 'qtà' },
      prezzo: { tipo: 'campo', valore: '10', prefisso: '€', comando: "setPrezzo('p1',this.value)" },
    })
    expect(h).toMatch(/<td class="[^"]*ehb-gr-c--quantita[^"]*ehb-gr-c--scrive"><input type="text" inputmode="decimal" class="ehb-gr-campo" value="3,5" placeholder="qtà" onchange="setSalQta\(1,&#39;p1&#39;,this.value\)"> <span class="ehb-gr-um">m²<\/span><\/td>/)
    expect(h).toMatch(/<td class="ehb-gr-c ehb-gr-c--prezzo ehb-gr-num"><span class="ehb-gr-um">€<\/span> <input[^>]*class="ehb-gr-campo"/)
    // niente stili in linea: larghezze e colori stanno nel foglio condiviso
    expect(h).not.toContain('style=')
  })
  it('la quantità fatta dalle misure si legge, con quante misure la fanno', () => {
    const h = contenutoCella({ tipo: 'misurata', valore: '12,00', um: 'm', misure: 1, idValore: 'bme-p1' })
    expect(h).toContain('<span class="ehb-gr-misurata" id="bme-p1">12,00</span>')
    expect(h).toContain('(da 1 misura)')
    expect(contenutoCella({ tipo: 'misurata', valore: '1', misure: 3 })).toContain('(da 3 misure)')
  })
  it('codice e designazione escono sempre protetti, con le loro etichette', () => {
    expect(contenutoCella({ tipo: 'codice', codice: 'NP.01', tono: 'np', etichetta: 'NP' }))
      .toBe('<span class="ehb-gr-cod is-np">NP.01</span><span class="ehb-gr-etic">NP</span>')
    const d = contenutoCella({ tipo: 'designazione', testo: 'Scavo <b>a sezione</b>', nota: 'a misura', meta: ['<i>chip</i>'] })
    expect(d).toContain('Scavo &lt;b&gt;a sezione&lt;/b&gt;')
    expect(d).toContain('<div class="ehb-gr-meta"><span class="ehb-gr-meta__nota">a misura</span><i>chip</i></div>')
    expect(contenutoCella({ tipo: 'designazione', testo: '', vuoto: 'voce libera' })).toContain('class="ehb-gr-des is-vuota">voce libera')
  })
  it('la voce piegata è uno stato della griglia, non dello strumento', () => {
    expect(rigaVoceHtml(FASE_PROGETTO, { celle: {}, compatta: true })).toContain('class="ehb-gr-voce is-compatta"')
  })
})

describe('la barra: due righe, i comandi su una sola', () => {
  it('la riga dei comandi non va mai a capo', () => {
    const css = leggi('src/shared/ui/components.css')
    expect(css).toMatch(/\.ehb-barra__r2 \{[^}]*flex-wrap: nowrap/)
    expect(css).toContain('@container azioni')
  })
})

/**
 * IL FOGLIO, come nei programmi di computo (PriMus): sotto la voce le sue
 * misure, nelle STESSE colonne della griglia, e la riga SOMMANO con quantità,
 * prezzo e importo. Si scrive cella per cella, senza pannelli.
 */
describe('il foglio: le misure dentro la griglia', () => {
  const azioni: AzioniMisure = {
    set: (i, c) => `set(${i},'${c}')`, tasti: (i, c) => `tasti(${i},'${c}')`,
    duplica: (i) => `dup(${i})`, elimina: (i) => `del(${i})`, aggiungi: 'agg()', detrazione: 'det()',
  }
  const righe = [
    { descrizione: 'tratto nord', l1: 120, l2: 2.5, h: 0.4, quantita: 120 },
    { descrizione: 'a dedurre', n: -1, l1: 2, l2: 1, h: 0.5, quantita: -1 },
  ]
  const html = (soloLettura = false): string => righeFoglioHtml(FASE_PROGETTO, {
    righe, um: 'm³', fmt: (n) => n.toFixed(2).replace('.', ','), azioni, soloLettura, conSelezione: true,
    sommano: { prezzo: { tipo: 'numero', testo: '9,80' }, importo: { tipo: 'numero', testo: '1.166,20' } },
  })
  const celle = (tr: string): string[] => [...tr.matchAll(/<td class="([^"]*)"/g)].map((m) => m[1])

  it('ogni fase che misura ha par.ug., lung., larg. e H/peso subito prima della quantità', () => {
    for (const f of [FASE_PROGETTO, FASE_SAL, FASE_PERIZIA]) {
      const ids = f.colonne.map((c) => c.id)
      const q = ids.indexOf('quantita')
      expect(ids.slice(q - 4, q), f.fase).toEqual(COLONNE_MISURA.map((c) => c.id))
    }
    expect(FASE_CONTRATTO.colonne.map((c) => c.id)).not.toContain('parti')
  })
  it('una riga di misura ha una cella per ogni colonna, e i fattori stanno nelle loro', () => {
    const tr = html().split('</tr>')[0]
    expect(celle(tr)).toHaveLength(colonneGriglia(FASE_PROGETTO, true))
    expect(tr).toContain('data-mis-input="0:descrizione"')
    for (const c of COLONNE_MISURA) expect(tr).toMatch(new RegExp(`ehb-gr-c--${c.id}[^"]*"><input[^>]*data-mis-input="0:${c.campo}"`))
    expect(tr).toMatch(/ehb-gr-c--quantita[^"]*" data-mis-qt>120,00</)
  })
  it('la detrazione si vede come tale', () => {
    expect(html().split('</tr>')[1]).toContain('class="ehb-gr-mis is-neg"')
  })
  it('la riga SOMMANO porta il totale delle misure, il prezzo e l\'importo, allineati', () => {
    const som = html().split('</tr>').find((x) => x.includes('ehb-gr-sommano'))!
    expect(som).toContain('SOMMANO m³')
    expect(som).toContain('data-mis-tot>119,00')
    expect(som).toContain('9,80')
    expect(som).toContain('1.166,20')
    // la designazione si allarga sulle quattro colonne delle misure: le celle tornano lo stesso numero
    const span = Number(som.match(/colspan="(\d+)"/)![1])
    expect(celle(som).length + span - 1).toBe(colonneGriglia(FASE_PROGETTO, true))
    expect(som).toContain('onclick="agg()"')
    expect(som).toContain('onclick="det()"')
  })
  it('in sola lettura si legge e basta', () => {
    const h = html(true)
    expect(h).not.toContain('agg()')
    expect(h).not.toContain('dup(0)')
    expect(h).toContain('readonly')
  })
  it('i comandi di una riga non rubano il Tab: si va di cella in cella', () => {
    expect(html()).toMatch(/<button class="ehb-icon-btn" tabindex="-1" onclick="dup\(0\)"/)
  })
})

