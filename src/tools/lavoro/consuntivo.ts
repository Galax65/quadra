/**
 * IL COMPUTO CONSUNTIVO di un avanzamento: le voci contabilizzate a tutto il
 * SAL, nella forma del computo metrico (quantità eseguite, prezzi di
 * contratto, misure del libretto, categorie e WBS), più i lavori in economia.
 * Si stampa come il computo, per il committente o per controllo: anche — e
 * soprattutto — in una contabilità senza computo. Modulo PURO.
 */
import {
  attiDi, valoreLista, quantitaEseguita, quantitaVoce, prezzoIn, rigaDi, revisione, avanzamento,
  type Lavoro,
} from '../../shared/lavoro'
import type { VoceComputo } from '../../shared/xpwe/xpwe'

export function vociConsuntivo(l: Lavoro, avId: string): VoceComputo[] {
  const a0 = avanzamento(l, avId)
  // il CRE certifica lo stato finale: il consuntivo è quello del SAL finale
  const a = a0.tipo === 'cre' ? (l.avanzamenti.find((x) => x.tipo === 'salFinale') ?? a0) : a0
  const r = revisione(l, a.leggeDa)
  const art = new Map(r.articoli.map((x) => [x.id, x]))
  const out: VoceComputo[] = []
  for (const v of r.voci) {
    const ar = art.get(v.articolo); if (!ar) continue
    const riga = rigaDi(a, v.id)
    const qty = v.corpo ? Math.round(quantitaVoce(v) * (riga.quotaPct ?? 0)) / 100 : quantitaEseguita(riga)
    if (!qty) continue
    out.push({
      codice: ar.codice, desc_short: ar.descrizione, declaratoria: ar.estesa || ar.descrizione, um: ar.um,
      prezzo: prezzoIn(r, ar), qty,
      ...(!v.corpo && riga.misure.length ? { misurazioni: riga.misure.map((m) => ({ ...m })) } : {}),
      ...(v.categoria ? { categoria: v.categoria } : {}), ...(v.wbs ? { wbs: v.wbs } : {}),
      ...(ar.sicurezza ? { sicurezza: true } : {}), ...(v.corpo ? { corpo: true } : {}), ...(ar.origine === 'np' ? { np: true } : {}),
    })
  }
  // i lavori in economia del SAL (e dei precedenti): una voce per lista
  for (const x of attiDi(l).economie.filter((e) => e.salNumero != null && e.salNumero <= a.n)) {
    const t = valoreLista(x).totale
    if (t) out.push({ codice: `EC.${String(x.numero).padStart(2, '0')}`, desc_short: `Lavori in economia — lista n. ${x.numero} del ${x.data}`, um: 'a corpo', prezzo: t, qty: 1, categoria: 'Lavori in economia' })
  }
  return out
}
