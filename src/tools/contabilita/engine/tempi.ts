/**
 * TEMPI CONTRATTUALI: consegna, tempo utile, sospensioni e riprese, proroghe,
 * ultimazione. Da qui esce il termine vigente, e dal termine vigente escono il
 * ritardo e la penale — quindi questi conti non si fanno due volte in due
 * posti diversi.
 *
 * Regola di fondo: i giorni si contano dagli ATTI, non si presumono. Una
 * sospensione senza verbale di ripresa non somma giorni presunti: resta aperta
 * e lo si dice. Un termine che non si può calcolare si dichiara tale, con il
 * dato che manca (art. 121 D.Lgs. 36/2023; All. II.14).
 */
import { addDaysIt, giorniTraIt } from '../../../shared/date-it'
import { escHtml } from '../../../shared/doc/doc'
import type { Appalto, Verbale } from './types'

export interface PeriodoSospensione {
  /** Verbale di sospensione. */
  dal: string
  motivo?: string
  /** Verbale di ripresa; assente = sospensione ancora in corso. */
  al?: string
  /** Giorni effettivi fra sospensione e ripresa (null se ancora aperta). */
  giorni: number | null
}

export interface Proroga {
  data?: string
  giorni: number
  oggetto?: string
}

export interface Tempi {
  /** Data da cui decorre il tempo utile: il verbale di consegna, o la data indicata. */
  decorrenza?: string
  giorniUtili?: number | null
  /** Termine contrattuale, senza sospensioni né proroghe. */
  termineContrattuale?: string
  sospensioni: PeriodoSospensione[]
  giorniSospensione: number
  sospensioneAperta: boolean
  proroghe: Proroga[]
  giorniProroga: number
  /** Termine vigente: contrattuale + sospensioni + proroghe (o quello imposto a mano). */
  termineVigente?: string
  /** Ultimazione effettiva, dal certificato di ultimazione. */
  ultimazione?: string
  /** Giorni di ritardo sull'ultimazione (o, se non ultimati, alla data di lettura). */
  ritardo: number
  /** Giorni che restano al termine vigente (negativi = ritardo). */
  residuo: number | null
  /** Che cosa manca per calcolare il termine, quando non si può. */
  nonCalcolabile?: string
}

const verbaliDi = (v: Verbale[] | undefined, tipo: string): Verbale[] =>
  (v || []).filter((x) => x.tipo === tipo && x.data).sort((a, b) => (giorniTraIt(a.data, b.data) ?? 0))

/**
 * Periodi di sospensione: ogni verbale di sospensione si chiude con la prima
 * ripresa successiva. Una ripresa senza sospensione aperta viene ignorata (è un
 * atto che non chiude nulla), e una sospensione senza ripresa resta aperta.
 */
export function periodiSospensione(verbali?: Verbale[]): PeriodoSospensione[] {
  const sosp = verbaliDi(verbali, 'sospensione')
  const ripr = verbaliDi(verbali, 'ripresa')
  const usate = new Set<number>()
  return sosp.map((s) => {
    let scelta = -1
    for (let i = 0; i < ripr.length; i++) {
      if (usate.has(i)) continue
      const g = giorniTraIt(s.data, ripr[i].data)
      if (g != null && g >= 0) { scelta = i; break }
    }
    if (scelta >= 0) usate.add(scelta)
    const al = scelta >= 0 ? ripr[scelta].data : undefined
    return { dal: s.data as string, motivo: s.motivo, al, giorni: al ? (giorniTraIt(s.data, al) ?? null) : null }
  })
}

/** Quadro completo dei tempi alla data indicata (per difetto: nessuna data di lettura). */
export function tempi(appalto: Appalto, verbali?: Verbale[], oggiIt?: string): Tempi {
  const consegna = verbaliDi(verbali, 'consegna')[0]?.data
  const decorrenza = appalto.dataConsegna || consegna || appalto.dataInizio
  const giorniUtili = appalto.giorniUtili ?? null
  const termineContrattuale = appalto.dataUltimazionePrevista
    || (decorrenza && giorniUtili ? addDaysIt(decorrenza, giorniUtili) || undefined : undefined)

  const sospensioni = periodiSospensione(verbali)
  const giorniSospensione = sospensioni.reduce((n, p) => n + (p.giorni ?? 0), 0)
  const sospensioneAperta = sospensioni.some((p) => !p.al)

  const proroghe: Proroga[] = verbaliDi(verbali, 'proroga')
    .map((v) => ({ data: v.data, giorni: Math.max(0, Math.round(Number(v.giorniProroga) || 0)), oggetto: v.oggetto }))
    .filter((p) => p.giorni > 0)
  const giorniProroga = proroghe.reduce((n, p) => n + p.giorni, 0)

  const termineVigente = appalto.nuovaDataUltimazione
    || (termineContrattuale ? addDaysIt(termineContrattuale, giorniSospensione + giorniProroga) || undefined : undefined)

  const ultimazione = verbaliDi(verbali, 'ultimazione')[0]?.data
  const riferimento = ultimazione || oggiIt
  const residuo = termineVigente && riferimento ? -(giorniTraIt(termineVigente, riferimento) ?? 0) : null
  const ritardo = residuo != null && residuo < 0 ? -residuo : 0

  const nonCalcolabile = termineVigente ? undefined
    : !decorrenza ? 'manca la data di consegna dei lavori'
      : !giorniUtili ? "manca il tempo utile per l'ultimazione"
        : undefined

  return {
    decorrenza, giorniUtili, termineContrattuale, sospensioni, giorniSospensione, sospensioneAperta,
    proroghe, giorniProroga, termineVigente, ultimazione, ritardo, residuo, nonCalcolabile,
  }
}

const g = (n: number): string => `${n} ${n === 1 ? 'giorno' : 'giorni'}`
const d = (v?: string): string => (v ? escHtml(v) : '<i class="nd">—</i>')

/**
 * Prospetto dei tempi per gli atti: la catena che porta dal termine di contratto
 * a quello vigente, con i periodi uno per uno. Senza i periodi, «+45 giorni di
 * sospensione» è un numero di cui nessuno può rispondere.
 */
export function tempiHTML(t: Tempi): string {
  const righe = [
    `<tr><td>Consegna dei lavori</td><td class="num">${d(t.decorrenza)}</td><td></td></tr>`,
    `<tr><td>Tempo utile contrattuale</td><td class="num">${t.giorniUtili ? g(t.giorniUtili) : '<i class="nd">—</i>'}</td><td class="num">${d(t.termineContrattuale)}</td></tr>`,
  ]
  for (const p of t.sospensioni) {
    righe.push(`<tr><td>Sospensione dal ${escHtml(p.dal)}${p.al ? `, ripresa il ${escHtml(p.al)}` : ''}${p.motivo ? `<span class="sub">${escHtml(p.motivo)}</span>` : ''}</td><td class="num">${p.giorni == null ? '<i>in corso</i>' : '+ ' + g(p.giorni)}</td><td></td></tr>`)
  }
  for (const p of t.proroghe) {
    righe.push(`<tr><td>Proroga${p.data ? ` del ${escHtml(p.data)}` : ''}${p.oggetto ? `<span class="sub">${escHtml(p.oggetto)}</span>` : ''}</td><td class="num">+ ${g(p.giorni)}</td><td></td></tr>`)
  }
  righe.push(`<tr class="tot"><td>Termine vigente per l'ultimazione</td><td class="num">${t.giorniSospensione + t.giorniProroga ? '+ ' + g(t.giorniSospensione + t.giorniProroga) : ''}</td><td class="num">${t.termineVigente ? escHtml(t.termineVigente) : `<i class="nd">non calcolabile${t.nonCalcolabile ? ': ' + escHtml(t.nonCalcolabile) : ''}</i>`}</td></tr>`)
  if (t.ultimazione) {
    righe.push(`<tr><td>Ultimazione dei lavori (certificato)</td><td class="num"></td><td class="num">${escHtml(t.ultimazione)}</td></tr>`)
  }
  const esito = t.sospensioneAperta
    ? '<p class="note">Una sospensione è ancora in corso: il termine vigente si potrà calcolare solo con il verbale di ripresa.</p>'
    : t.termineVigente && t.residuo != null
      ? (t.ritardo > 0
        ? `<p class="warn"><b>Ritardo di ${g(t.ritardo)}</b> sul termine vigente${t.ultimazione ? ' alla data di ultimazione' : ' alla data odierna'}.</p>`
        : `<p class="note">${t.ultimazione ? 'Lavori ultimati nel termine' : `Restano ${g(t.residuo)}`} rispetto al termine vigente.</p>`)
      : ''
  return `
    <h2 class="sec-h">Tempi contrattuali</h2>
    <table class="dtable">
      <thead><tr><th>Atto</th><th class="num">Giorni</th><th class="num">Data</th></tr></thead>
      <tbody>${righe.join('')}</tbody>
    </table>
    ${esito}`
}
