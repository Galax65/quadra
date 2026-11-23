// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { calcolaRigaMisurazione, sommaMisurazioni, type MisurazioneRiga } from '../../src/shared/compositore/misurazioni'
import { computoSource } from './computo-src'
import { misureTabellaHtml, type AzioniMisure } from '../../src/shared/compositore/misure-tabella'

/** Azioni fittizie: qui conta il MARKUP, non cosa fanno i pulsanti. */
const AZIONI: AzioniMisure = {
  set: (i, c) => `set(${i},'${c}')`, tasti: (i, c) => `misKeydown(event,${i},'${c}')`,
  duplica: (i) => `dup(${i})`, elimina: (i) => `del(${i})`, aggiungi: 'add()',
}

/**
 * Misurazioni del Computo Metrico — editing senza rebuild dell'overlay.
 *
 * Convenzione dei test DOM di Computo (come cart-custom.test.ts): contratto sul
 * markup/sorgente inline di index.html + logica replicata fedelmente dalle
 * funzioni inline (misMutAddRiga/misDropRigheVuote/misSetCampo) sopra il
 * motore REALE (calcolaRigaMisurazione/sommaMisurazioni), in jsdom.
 *
 * Il punto fissato qui: ogni onchange su un campo misura NON deve più
 * ricostruire l'intero overlay (openCart da zero) — quel rebuild distruggeva
 * l'input col focus e rompeva il Tab tra L1→L2→H→N.
 */

const html = computoSource()

describe('contratto sul sorgente inline — patch mirato, non rebuild', () => {
  it('N è il primo campo numerico (prima di L1/L2/H) nell\'intestazione e nella riga', () => {
    // la tabella è il componente condiviso: si collauda il suo HTML, non una stringa del tool
    const reso = misureTabellaHtml({ righe: [{ descrizione: 'piano terra', n: 2, l1: 3, quantita: 6 }], fmt: (n) => String(n), azioni: AZIONI })
    const intestazione = reso.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? ''
    expect(intestazione.indexOf('>par.ug.<')).toBeGreaterThan(0)
    expect(intestazione.indexOf('>par.ug.<')).toBeLessThan(intestazione.indexOf('>L1<'))
    expect(intestazione.indexOf('>L1<')).toBeLessThan(intestazione.indexOf('>L2<'))
    expect(intestazione.indexOf('>L2<')).toBeLessThan(intestazione.indexOf('>H/peso<'))
    const riga = reso.match(/<tr class="ehb-mis-riga[\s\S]*?<\/tr>/)?.[0] ?? ''
    expect(riga.indexOf('0:n')).toBeLessThan(riga.indexOf('0:l1'))
  })

  it('il pannello misure porta i data-hook per il patch in place', () => {
    expect(html).toContain('data-mis-key=')
    expect(html).toContain('data-mis-input=')
    expect(html).toContain('data-mis-qt')
    expect(html).toContain('data-mis-tot')
  })

  it('le righe voce portano data-cell per qty/importo/misure (reali e composte)', () => {
    // 2 occorrenze ciascuno: template righe reali (openCart) + righe composte (customRowsHtml)
    for (const hook of ['data-cell="qty"', 'data-cell="imp"', 'data-cell="mis"']) {
      const n = html.split(hook).length - 1
      expect(n, hook).toBeGreaterThanOrEqual(2)
    }
  })

  it('misSetCampo fa un patch mirato (misPatchDom), NON refreshCartOverlayIfOpen', () => {
    const fn = html.match(/function misSetCampo\([\s\S]*?\n}/)?.[0] ?? ''
    expect(fn).toContain('misPatchDom(')
    expect(fn).not.toContain('refreshCartOverlayIfOpen')
  })

  it('esistono le funzioni nuove del flusso a un clic + tastiera', () => {
    for (const name of ['function misPatchDom(', 'function misRerenderPanel(', 'function misMutAddRiga(', 'function misDropRigheVuote(', 'function misKeydown(', 'function cartPatchTotals(']) {
      expect(html).toContain(name)
    }
  })

  it('gli input del pannello hanno la tastiera cablata (misKeydown) e select-on-focus', () => {
    expect(html).toContain("tasti:(i,c)=>`misKeydown(event,'${ek}'")
    // select-on-focus: misFocusCampo mostra la formula e seleziona il contenuto
    expect(html).toContain("fuoco:(i,c)=>`misFocusCampo(this")
    expect(html.match(/function misFocusCampo\([\s\S]*?\n}/)?.[0] ?? '').toContain('.select()')
  })

  it("l'hint tastiera c'è una volta sola, compatto nel footer (dettaglio nel tooltip)", () => {
    expect(html).toContain('Invio = nuova riga · Esc = chiudi')
    expect(html).toContain('title="${esc(TASTI_MISURE)}"')
    expect(html).toContain('⌨ tasti e formule')
  })

  it("Esc a livelli: il listener globale chiude popover → menu → overlay", () => {
    const listener = html.match(/\/\/ Esc a livelli[\s\S]*?\n}\);/)?.[0] ?? ''
    expect(listener).toContain("closeCatPopover()")
    expect(listener).toContain("closeCartCtxMenu()")
    // il Computo non è più un modale da chiudere: Esc riporta al passo Cerca (setStep)
    expect(listener).toContain("setStep('cerca')")
    // ordine invariato: prima il popover, poi il menu contestuale, poi la vista computo
    expect(listener.indexOf('closeCatPopover')).toBeLessThan(listener.indexOf('closeCartCtxMenu'))
    expect(listener.indexOf('closeCartCtxMenu')).toBeLessThan(listener.indexOf("setStep('cerca')"))
  })
})

// ── logica replicata: misMutAddRiga + misDropRigheVuote ──────────────────────
interface QtyEntry { qty: number; um: string; source: string; misurazioni?: MisurazioneRiga[] }

function misMutAddRigaLogic(qty: Record<string, QtyEntry>, key: string): number {
  const q = qty[key] || { qty: 0, um: '', source: 'manual' }
  q.misurazioni = q.misurazioni || []
  q.misurazioni.push({ descrizione: '', l1: null, l2: null, h: null, n: null, quantita: 0 })
  qty[key] = q
  return q.misurazioni.length - 1
}

function misDropRigheVuoteLogic(qty: Record<string, QtyEntry>, key: string): void {
  const q = qty[key]; if (!q || !q.misurazioni) return
  q.misurazioni = q.misurazioni.filter(m => (m.descrizione || '').trim() || m.l1 != null || m.l2 != null || m.h != null || m.n != null)
  if (!q.misurazioni.length) delete q.misurazioni
  else q.qty = sommaMisurazioni(q.misurazioni)
  if (!(q.qty > 0) && !(q.misurazioni && q.misurazioni.length)) delete qty[key]
}

function misSetCampoLogic(qty: Record<string, QtyEntry>, key: string, idx: number, campo: 'l1' | 'l2' | 'h' | 'n', value: number): void {
  const q = qty[key]; if (!q || !q.misurazioni || !q.misurazioni[idx]) return
  const riga = q.misurazioni[idx]
  riga[campo] = value
  riga.quantita = calcolaRigaMisurazione(riga)
  q.qty = sommaMisurazioni(q.misurazioni)
}

describe('flusso a un clic — prima riga auto-creata, righe vuote non restano', () => {
  it('aprire le misure di una voce senza righe crea subito la riga 0', () => {
    const qty: Record<string, QtyEntry> = {}
    const idx = misMutAddRigaLogic(qty, 'k1')
    expect(idx).toBe(0)
    expect(qty['k1'].misurazioni).toHaveLength(1)
    expect(qty['k1'].misurazioni![0].quantita).toBe(0)
  })

  it('chiudere il pannello con la riga auto-creata ancora vuota la elimina (e libera S.qty)', () => {
    const qty: Record<string, QtyEntry> = {}
    misMutAddRigaLogic(qty, 'k1')
    misDropRigheVuoteLogic(qty, 'k1')
    expect(qty['k1']).toBeUndefined()
  })

  it('chiudere il pannello con righe compilate le conserva e riallinea il totale', () => {
    const qty: Record<string, QtyEntry> = {}
    misMutAddRigaLogic(qty, 'k1')
    misSetCampoLogic(qty, 'k1', 0, 'l1', 4)
    misSetCampoLogic(qty, 'k1', 0, 'l2', 2.5)
    misMutAddRigaLogic(qty, 'k1') // seconda riga lasciata vuota
    misDropRigheVuoteLogic(qty, 'k1')
    expect(qty['k1'].misurazioni).toHaveLength(1)
    expect(qty['k1'].qty).toBe(10)
  })

  it('una detrazione (N negativo) resta e pesa sul totale', () => {
    const qty: Record<string, QtyEntry> = {}
    misMutAddRigaLogic(qty, 'k1')
    misSetCampoLogic(qty, 'k1', 0, 'l1', 10)
    misMutAddRigaLogic(qty, 'k1')
    misSetCampoLogic(qty, 'k1', 1, 'l1', 1.89)
    misSetCampoLogic(qty, 'k1', 1, 'n', -1)
    misDropRigheVuoteLogic(qty, 'k1')
    expect(qty['k1'].misurazioni).toHaveLength(2)
    expect(qty['k1'].qty).toBeCloseTo(8.11, 10)
  })
})
