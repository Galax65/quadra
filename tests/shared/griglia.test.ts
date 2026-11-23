import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  FASI, FASE_PERIZIA, FASE_PROGETTO, FASE_SAL, FASE_CONTRATTO, COLONNE_NUMERICHE, OPZ_ORDINE, OPZ_VISTA, filtraVoci,
  grigliaHtml, rigaDettaglioHtml, rigaGruppoHtml, rigaTotaleHtml, rigaVoceHtml, colonneGriglia, piedeFaseHtml, contenutoCella, type IdColonna,
} from '../../src/shared/griglia'
import { MODI_ORDINE } from '../../src/shared/ordine-computo'

/**
 * LA GRIGLIA CONDIVISA (tappa 4 di Docs/06-Interfaccia-unica.md): computo,
 * libretto e perizia sono la stessa tabella. Cambia solo quale colonna si
 * scrive, quale si confronta e quali valori stanno in calce — e lo dice il
 * descrittore di fase, non lo strumento.
 */
const ROOT = resolve(__dirname, '../..')
const leggi = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8')
const eur = (n: number): string => '€ ' + n.toFixed(2).replace('.', ',')
const ORDINE: IdColonna[] = ['codice', 'designazione', 'confronto', 'quantita', 'prezzo', 'importo', 'differenza', 'comandi']

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
  it('viste e ordinamenti sono gli stessi ovunque, e gli ordini sono quelli della stampa', () => {
    expect(OPZ_VISTA.map((o) => o.valore)).toEqual(['tabella', 'elenco', 'capitoli'])
    expect(OPZ_ORDINE.map((o) => o.valore)).toEqual(MODI_ORDINE)
  })
  it('la ricerca è la stessa regola: senza maiuscole, su un testo che decide lo strumento', () => {
    const v = [{ c: 'A.01 Scavo' }, { c: 'B.02 Getto' }]
    expect(filtraVoci(v, '  scAVO ', (x) => x.c)).toEqual([v[0]])
    expect(filtraVoci(v, '', (x) => x.c)).toBe(v)
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
    expect(th).toEqual(['', 'Codice', 'Designazione', 'Eseguito a tutto il SAL', 'Prezzo unit.', 'Importo', ''])
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
    expect(rigaTotaleHtml(FASE_SAL, { titolo: 'T', valore: '€ 1' }, true)).toMatch(/^<tr class="ehb-gr-totale"><td colspan="5"/)
    expect(rigaTotaleHtml(FASE_PERIZIA, { titolo: 'T', valore: '€ 1' })).toMatch(/<td colspan="4"[^>]*>T<\/td><td class="ehb-gr-c ehb-gr-num">€ 1<\/td><\/tr>$/)
  })
  it('i numeri vanno a destra, i testi no', () => {
    for (const id of ['quantita', 'prezzo', 'importo', 'differenza', 'confronto'] as IdColonna[]) expect(COLONNE_NUMERICHE.has(id)).toBe(true)
    for (const id of ['codice', 'designazione', 'comandi'] as IdColonna[]) expect(COLONNE_NUMERICHE.has(id)).toBe(false)
  })
  it('una griglia vuota lo dice, sull\'intera larghezza', () => {
    expect(grigliaHtml({ fase: FASE_PERIZIA, righe: [], vuoto: 'Niente <qui>' })).toContain(`<td colspan="5">Niente &lt;qui&gt;</td>`)
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
  it('i comandi di riga sono pulsanti del design system, e quelli distruttivi si dichiarano', () => {
    const h = contenutoCella({ tipo: 'comandi', comandi: [{ icona: '🗑', titolo: 'Elimina', onclick: "delVoce('p1',1)", pericolo: true }] })
    expect(h).toContain('class="ehb-btn ehb-btn--sm ehb-btn--ghost ehb-gr-cmd is-pericolo"')
    expect(h).toContain('aria-label="Elimina"')
  })
  it('la voce piegata è uno stato della griglia, non dello strumento', () => {
    expect(rigaVoceHtml(FASE_PROGETTO, { celle: {}, compatta: true })).toContain('class="ehb-gr-voce is-compatta"')
  })
})

describe('la barra: due righe, i comandi su una sola', () => {
  it('sopra come si guarda, sotto che cosa si fa', async () => {
    const { barraVoci } = await import('../../src/shared/ui/barra-voci')
    const h = barraVoci({
      cerca: { valore: '', onInput: 'f(this.value)' },
      viste: { valore: 'tabella', opzioni: OPZ_VISTA, onclickTpl: "v('%v')" },
      aggiungi: [{ etichetta: '+ Voce libera', titolo: 'Riga vuota', onclick: 'a()' }],
      dati: [{ etichetta: '⇩ XPWE', titolo: 'Importa', onclick: 'i()' }],
    })
    const r1 = /<div class="ehb-barra__r1">(.*?)<\/div><div class="ehb-barra__r2">/.exec(h)![1]
    expect(r1).toContain('ehb-barra__q')
    expect(r1).toContain('ehb-seg')
    expect(h).toMatch(/<div class="ehb-barra__r2"><span class="ehb-barra__g ehb-barra__g--aggiungi">/)
    // il segno e il nome si separano, così da stretto resta il segno e il nome va nel title
    expect(h).toContain('<span class="ehb-barra__i">⇩</span><span class="ehb-barra__t"> XPWE</span>')
    expect(h).toContain('aria-label="⇩ XPWE"')
  })
  it('la riga dei comandi non va mai a capo', () => {
    const css = leggi('src/shared/ui/components.css')
    expect(css).toMatch(/\.ehb-barra__r2 \{[^}]*flex-wrap: nowrap/)
    expect(css).toContain('@container azioni')
  })
})

describe('Computo e Contabilità la richiamano entrambi', () => {
  const contabilita = leggi('src/tools/contabilita/main.ts')
  const dir = resolve(ROOT, 'src/tools/computo/legacy')
  const computo = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(dir, f), 'utf8')).join('\n')
  it('la Contabilità disegna libretto e perizia con la griglia e il piede condivisi', () => {
    expect(contabilita).toContain("from '../../shared/griglia'")
    expect(contabilita).toMatch(/grigliaHtml\(\{\s*fase: FASE_SAL/)
    expect(contabilita).toMatch(/grigliaHtml\(\{ fase: FASE_PERIZIA/)
    expect(contabilita).toContain('piedeFaseHtml(FASE_SAL')
    expect(contabilita).toContain('piedeFaseHtml(FASE_PERIZIA')
  })
  it('il Computo disegna le sue voci con la stessa griglia e lo stesso piede', () => {
    expect(computo).toContain("from '../../../shared/griglia'")
    expect(computo).toMatch(/grigliaHtml\(\{ fase:FASE_PROGETTO/)
    expect(computo).toContain('piedeFaseHtml(FASE_PROGETTO')
  })
  it('nessuno dei due si ridisegna da sé intestazioni, gruppi o piede delle voci', () => {
    // prima: <th>Codice</th>… scritti a mano in tre posti, e colspan="6"/"7" contati a occhio
    expect(contabilita).not.toMatch(/<th>Codice<\/th><th>Designazione<\/th><th class="b-num">(Prezzo unit|Contratto vigente)/)
    expect(contabilita).not.toContain('class="b-fondo')
    expect(contabilita).not.toContain('<tr class="b-grp">')
    expect(computo).not.toContain('<th style="padding:8px 4px">Codice</th>')
    expect(computo).not.toMatch(/<tr class="(cm-sez-corpo|cm-sez-sic|mis-panel-row|cart-cat-head cm-grp-head)[^"]*"[^>]*>\s*<td colspan="6"/)
    expect(computo).not.toContain('id="cart-ov-total"')
  })
  it('le celle delle voci le descrivono, non le scrivono a mano', () => {
    // codice, designazione, quantità e comandi: dalle celle condivise in tutti e tre
    expect(contabilita).not.toContain('codice: esc(p.codice)')
    expect(contabilita).not.toMatch(/designazione: `<span class="b-desc-clamp"/)
    const libretto = contabilita.slice(contabilita.indexOf('function rigaLibretto('), contabilita.indexOf('function sottoComputoHTML('))
    expect(libretto).not.toMatch(/<input type="(text|number)"/) // solo la casella di selezione resta HTML
    expect(contabilita.match(/codice: \{ tipo: 'codice'/g)?.length).toBeGreaterThanOrEqual(4)
    expect(computo).not.toContain('class="cm-desc"')
    expect(computo).not.toContain('cm-voce-meta')
    expect(computo).not.toContain('background:var(--danger-light);color:var(--danger)')
    expect(computo).toMatch(/codice:\{ tipo:'codice'/)
    // la quantità del computo non porta più un colore scritto in esadecimale
    expect(computo).not.toContain('#22d3ee')
    expect(computo).toContain("contenutoCella({ tipo:'misurata'")
  })
})
