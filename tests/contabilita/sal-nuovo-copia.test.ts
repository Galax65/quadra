import { describe, expect, it } from 'vitest'
import type { RigaSal } from '../../src/tools/contabilita/engine/types'

/**
 * Un SAL nuovo parte dalle misure di quello precedente (progressivo), ma le COPIA:
 * il libretto già prodotto è un atto pubblico e non deve cambiare quando si scrive
 * nel SAL successivo. Qui si collauda la regola di copia usata da «nuovo SAL».
 */
const copiaRigheDalSalPrecedente = (righe: RigaSal[]): RigaSal[] =>
  righe.map((r) => ({ ...r, ...(r.misurazioni ? { misurazioni: r.misurazioni.map((m) => ({ ...m })) } : {}) }))

describe('nuovo SAL: le misure del precedente si copiano, non si condividono', () => {
  it('scrivere nel SAL nuovo non tocca il libretto precedente', () => {
    const sal1: RigaSal[] = [{ partitaId: 'p1', misurazioni: [{ descrizione: 'piano terra', n: 2, l1: 3, quantita: 6 }] }]
    const sal2 = copiaRigheDalSalPrecedente(sal1)
    sal2[0].misurazioni!.push({ descrizione: 'piano primo', n: 1, l1: 4, quantita: 4 })
    sal2[0].misurazioni![0].l1 = 10
    sal2[0].misurazioni![0].quantita = 20
    expect(sal1[0].misurazioni).toHaveLength(1)
    expect(sal1[0].misurazioni![0].l1).toBe(3)
    expect(sal1[0].misurazioni![0].quantita).toBe(6)
    expect(sal2[0].misurazioni).toHaveLength(2)
  })
  it('le righe senza misure (quota a corpo, quantità rapida) si copiano come stavano', () => {
    const sal1: RigaSal[] = [{ partitaId: 'c1', quotaPct: 40 }, { partitaId: 'm1', quantitaProgressiva: 12 }]
    const sal2 = copiaRigheDalSalPrecedente(sal1)
    sal2[0].quotaPct = 70
    expect(sal1[0].quotaPct).toBe(40)
    expect(sal2[1].quantitaProgressiva).toBe(12)
  })
})
