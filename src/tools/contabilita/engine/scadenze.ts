/**
 * Contabilità — SCADENZIARIO DI LEGGE.
 *
 * Quasi tutto ciò che va storto in un appalto pubblico va storto su un termine:
 * il certificato di pagamento emesso tardi, l'anticipazione mai erogata, la
 * riserva non esplicitata in quindici giorni, il conto finale firmato fuori
 * termine. Sono date che nessuno calcola a mano senza sbagliarle, e che il
 * programma conosce già, perché conosce gli atti.
 *
 * Qui si leggono i termini dagli atti e si dice che cosa scade e quando. Due
 * regole: nessun termine si inventa (se manca la data di partenza lo stato è
 * «non calcolabile», e si dice quale dato manca), e nessun adempimento si dà
 * per fatto se non risulta dagli atti.
 *
 * Riferimenti: art. 125 D.Lgs. 36/2023 (anticipazione, pagamenti); artt. 7, 17,
 * 18 e 23 Allegato II.14 (riserve, certificato di pagamento, conto finale,
 * collaudo).
 */
import { renderDocPage, escHtml as escDoc } from '../../../shared/doc/doc'
import { addDaysIt, giorniTra, itToISO, oggiISO } from '../../../shared/date-it'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi } from './doc-common'
import type { Appalto, Consegna, Riserva, Sal, Verbale } from './types'
import { GIORNI_ESPLICITAZIONE, GIORNI_FIRMA_CONTO_FINALE, riserveAperte, statoRiserva } from './riserve'

/** Giorni entro cui il RUP emette il certificato di pagamento dal SAL. */
export const GIORNI_CERTIFICATO = 7
/** Giorni entro cui si paga, dall'adozione del SAL (salvo diverso patto fino a 60). */
export const GIORNI_PAGAMENTO = 30
/** Giorni entro cui erogare l'anticipazione dall'effettivo inizio della prestazione. */
export const GIORNI_ANTICIPAZIONE = 15
/** Giorni entro cui l'esecutore sottoscrive il certificato di collaudo provvisorio. */
export const GIORNI_FIRMA_COLLAUDO = 20

export type StatoScadenza = 'fatto' | 'aperta' | 'inScadenza' | 'scaduta' | 'nonCalcolabile'

export interface Scadenza {
  id: string
  /** Che cosa va fatto, in una riga. */
  cosa: string
  /** Norma che fissa il termine. */
  norma: string
  /** Da che cosa decorre («SAL n. 2 del 01/07/2026»). */
  decorre: string
  /** Data entro cui (gg/mm/aaaa); vuota se non calcolabile. */
  entro: string
  /** Giorni residui alla data di lavoro (negativo = in ritardo); null se non calcolabile. */
  giorni: number | null
  stato: StatoScadenza
  /** Nota: cosa manca, o quando l'adempimento risulta fatto. */
  nota: string
  /** SAL di riferimento, per portare l'utente al punto giusto del lavoro. */
  salNumero?: number
}

interface Ingressi {
  appalto: Appalto
  sals: Sal[]
  riserve?: Riserva[]
  verbali?: Verbale[]
  consegne?: Consegna[]
}

/** Giorni di preavviso entro cui un termine si considera «in scadenza». */
const PREAVVISO = 5

function valuta(entro: string, oggi: string): { giorni: number | null; stato: StatoScadenza } {
  const g = giorniTra(oggi, itToISO(entro))
  if (g == null) return { giorni: null, stato: 'nonCalcolabile' }
  return { giorni: g, stato: g < 0 ? 'scaduta' : g <= PREAVVISO ? 'inScadenza' : 'aperta' }
}

/** Un termine aperto: calcola scadenza e stato da data di partenza e giorni. */
function termine(id: string, cosa: string, norma: string, decorre: string, da: string | undefined, giorni: number, oggi: string, mancante: string, salNumero?: number): Scadenza {
  const entro = addDaysIt(da, giorni)
  if (!entro) return { id, cosa, norma, decorre, entro: '', giorni: null, stato: 'nonCalcolabile', nota: `Termine non calcolabile: manca ${mancante}.`, salNumero }
  const v = valuta(entro, oggi)
  return {
    id, cosa, norma, decorre, entro, giorni: v.giorni, stato: v.stato, salNumero,
    nota: v.stato === 'scaduta' ? `In ritardo di ${-(v.giorni as number)} giorni.` : `Mancano ${v.giorni} giorni.`,
  }
}

/** Un termine già assolto. */
function assolto(id: string, cosa: string, norma: string, decorre: string, quando: string, nota: string, salNumero?: number): Scadenza {
  return { id, cosa, norma, decorre, entro: quando, giorni: null, stato: 'fatto', nota, salNumero }
}

/**
 * Tutti i termini di legge aperti o assolti, in ordine di scadenza (prima i
 * ritardi). `oggi` è la data di lavoro del programma, non l'orologio: la
 * contabilità si scrive anche a mesi di distanza.
 */
export function scadenze(d: Ingressi, oggi = oggiISO()): Scadenza[] {
  const out: Scadenza[] = []
  const { appalto: a, sals } = d

  // ── anticipazione: entro 15 giorni dall'effettivo inizio della prestazione ──
  if (a.anticipazionePct) {
    const pagata = (d.consegne || []).some((c) => c.tipo === 'anticipazione')
    out.push(pagata
      ? assolto('anticipazione', `Erogazione dell'anticipazione del ${String(a.anticipazionePct).replace('.', ',')}%`, 'art. 125 c. 1 D.Lgs. 36/2023', `inizio dei lavori${a.dataInizio ? ` (${a.dataInizio})` : ''}`, '', 'Risulta erogata.')
      : termine('anticipazione', `Erogare l'anticipazione del ${String(a.anticipazionePct).replace('.', ',')}% del valore del contratto`, 'art. 125 c. 1 D.Lgs. 36/2023', `inizio dei lavori${a.dataInizio ? ` (${a.dataInizio})` : ''}`, a.dataInizio, GIORNI_ANTICIPAZIONE, oggi, 'la data di inizio dei lavori'))
  }

  for (const s of [...sals].sort((x, y) => x.numero - y.numero)) {
    const rif = `SAL n. ${s.numero}${s.data ? ` del ${s.data}` : ''}`
    // ── certificato di pagamento: entro 7 giorni dall'adozione del SAL ──
    out.push(s.dataCertificato
      ? certificatoFattoInTempo(s, rif, oggi)
      : termine(`cert-${s.numero}`, `Emettere il certificato di pagamento del SAL n. ${s.numero}`, 'art. 17 All. II.14 (previa verifica DURC)', rif, s.data, GIORNI_CERTIFICATO, oggi, `la data del SAL n. ${s.numero}`, s.numero))
    // ── pagamento: di regola entro 30 giorni dall'adozione del SAL ──
    out.push(s.dataPagamento
      ? assolto(`pag-${s.numero}`, `Pagamento della rata del SAL n. ${s.numero}`, 'art. 125 D.Lgs. 36/2023', rif, s.dataPagamento, `Pagato il ${s.dataPagamento}.`, s.numero)
      : termine(`pag-${s.numero}`, `Pagare la rata del SAL n. ${s.numero} (emissione del mandato)`, 'art. 125 D.Lgs. 36/2023 — salvo diverso termine pattuito, max 60 giorni', rif, s.data, GIORNI_PAGAMENTO, oggi, `la data del SAL n. ${s.numero}`, s.numero))
    // ── firma del registro da parte dell'esecutore ──
    if (!s.firmaEsecutore && s.firmato) {
      out.push({
        id: `firma-${s.numero}`, cosa: `Sottoporre il registro di contabilità alla firma dell'esecutore (SAL n. ${s.numero})`,
        norma: 'art. 7 All. II.14 — è il momento dell\'iscrizione delle riserve', decorre: rif, entro: '', giorni: null,
        stato: 'nonCalcolabile', nota: 'Gli atti sono firmati dal DL ma non risulta la sottoscrizione dell\'esecutore.', salNumero: s.numero,
      })
    }
  }

  // ── riserve: esplicitazione entro 15 giorni dall'iscrizione ──
  for (const r of riserveAperte(d.riserve)) {
    if (r.dataEsplicitazione) continue
    const st = statoRiserva(r, oggi)
    out.push(st.scadenza
      ? { id: `ris-${r.numero}`, cosa: `Esplicitare la riserva n. ${r.numero} (domande, ragioni e quantificazione)`, norma: `art. 7 All. II.14 — ${GIORNI_ESPLICITAZIONE} giorni a pena di decadenza`, decorre: `iscrizione del ${r.data}`, entro: st.scadenza, giorni: st.giorniResidui, stato: st.stato === 'decaduta' ? 'scaduta' : st.stato === 'inScadenza' ? 'inScadenza' : 'aperta', nota: st.nota, salNumero: r.salNumero }
      : { id: `ris-${r.numero}`, cosa: `Esplicitare la riserva n. ${r.numero}`, norma: `art. 7 All. II.14 — ${GIORNI_ESPLICITAZIONE} giorni a pena di decadenza`, decorre: 'iscrizione della riserva', entro: '', giorni: null, stato: 'nonCalcolabile', nota: 'Termine non calcolabile: manca la data di iscrizione.', salNumero: r.salNumero })
  }

  // ── conto finale: firma entro il termine assegnato (max 30 giorni dall'invito) ──
  const cf = a.contoFinale
  const ultimazione = (d.verbali || []).find((v) => v.tipo === 'ultimazione')
  if (ultimazione || cf?.dataInvito || cf?.dataCompilazione) {
    const gg = Math.min(GIORNI_FIRMA_CONTO_FINALE, Math.max(1, cf?.giorniTermine || GIORNI_FIRMA_CONTO_FINALE))
    out.push(cf?.esito
      ? assolto('contofinale', 'Sottoscrizione del conto finale', 'art. 7 c. 3 All. II.14', `invito del RUP${cf.dataInvito ? ` (${cf.dataInvito})` : ''}`, cf.dataFirma || '', cf.esito === 'firmatoConConferma' ? 'Sottoscritto con conferma delle riserve.' : cf.esito === 'firmatoSenzaConferma' ? 'Sottoscritto senza confermare le domande: conto finale definitivamente accettato.' : 'Non sottoscritto nel termine: conto finale definitivamente accettato.')
      : termine('contofinale', 'Far sottoscrivere il conto finale all\'esecutore (con conferma delle riserve)', `art. 7 c. 3 All. II.14 — termine non superiore a ${GIORNI_FIRMA_CONTO_FINALE} giorni`, `invito del RUP${cf?.dataInvito ? ` (${cf.dataInvito})` : ''}`, cf?.dataInvito, gg, oggi, "la data dell'invito del RUP a prendere cognizione del conto finale"))
  }

  const peso: Record<StatoScadenza, number> = { scaduta: 0, inScadenza: 1, aperta: 2, nonCalcolabile: 3, fatto: 4 }
  return out.sort((x, y) => (peso[x.stato] - peso[y.stato]) || (itToISO(x.entro) || '9999').localeCompare(itToISO(y.entro) || '9999'))
}

/** Il certificato c'è: dice se è stato emesso nei sette giorni o in ritardo. */
function certificatoFattoInTempo(s: Sal, rif: string, _oggi: string): Scadenza {
  const g = giorniTra(itToISO(s.data), itToISO(s.dataCertificato))
  const tardi = g != null && g > GIORNI_CERTIFICATO
  return {
    id: `cert-${s.numero}`, cosa: `Certificato di pagamento del SAL n. ${s.numero}`, norma: 'art. 17 All. II.14',
    decorre: rif, entro: s.dataCertificato || '', giorni: null, stato: tardi ? 'scaduta' : 'fatto', salNumero: s.numero,
    nota: tardi ? `Emesso il ${s.dataCertificato}, ${g} giorni dopo il SAL: oltre i ${GIORNI_CERTIFICATO} giorni di legge.` : `Emesso il ${s.dataCertificato}${g != null ? ` (${g} giorni dal SAL)` : ''}.`,
  }
}

/** Quante scadenze meritano attenzione adesso: in ritardo e in scadenza. */
export function scadenzeUrgenti(l: Scadenza[]): Scadenza[] {
  return l.filter((x) => x.stato === 'scaduta' || x.stato === 'inScadenza')
}

export const SCADENZA_LABEL: Record<StatoScadenza, string> = {
  fatto: 'assolto',
  aperta: 'in corso',
  inScadenza: 'in scadenza',
  scaduta: 'in ritardo',
  nonCalcolabile: 'termine non calcolabile',
}

/**
 * SCADENZIARIO stampabile: un foglio di lavoro, non un atto. Serve al DL e al
 * RUP per sapere in una pagina che cosa è in ritardo, che cosa scade e che
 * cosa manca per poter calcolare un termine.
 */
export function scadenziarioHTML(appalto: Appalto, lista: Scadenza[], oggi: string): string {
  const righe = lista.map((x) => `<tr class="${x.stato === 'scaduta' ? 'nv' : ''}">
      <td>${escDoc(x.cosa)}<span class="sub">${escDoc(x.norma)} · decorre da ${escDoc(x.decorre)}</span></td>
      <td class="num">${escDoc(x.entro || '—')}</td>
      <td class="num">${x.giorni == null ? '—' : escDoc(String(x.giorni))}</td>
      <td>${escDoc(SCADENZA_LABEL[x.stato])}<span class="sub">${escDoc(x.nota)}</span></td>
    </tr>`).join('')
  const urgenti = scadenzeUrgenti(lista)
  const body = `
    <p class="note">Scadenziario dei termini di legge alla data del ${escDoc(oggi)} — <b>foglio di lavoro</b>, non un atto contabile. I termini sono calcolati dagli atti registrati; dove la data di decorrenza manca, il termine è dichiarato non calcolabile e non viene presunto.</p>
    ${urgenti.length ? `<p class="note"><b>Richiedono attenzione adesso: ${escDoc(String(urgenti.length))}</b> — ${escDoc(urgenti.map((u) => u.cosa).join('; '))}.</p>` : '<p class="note">Nessun termine in ritardo o in scadenza nei prossimi giorni.</p>'}
    <table class="dtable">
      <thead><tr><th>Adempimento</th><th class="num">Entro il</th><th class="num">Giorni</th><th>Stato</th></tr></thead>
      <tbody>${righe || '<tr><td colspan="4"><i>Nessun termine da sorvegliare: non risultano SAL, riserve né anticipazione.</i></td></tr>'}</tbody>
    </table>
    <p class="note">Termini richiamati: certificato di pagamento ${GIORNI_CERTIFICATO} giorni dal SAL (art. 17 All. II.14); pagamento ${GIORNI_PAGAMENTO} giorni, salvo diverso termine pattuito e comunque non oltre 60 (art. 125 D.Lgs. 36/2023); anticipazione ${GIORNI_ANTICIPAZIONE} giorni dall'effettivo inizio della prestazione (art. 125 c. 1); esplicitazione delle riserve ${GIORNI_ESPLICITAZIONE} giorni dall'iscrizione e conferma al conto finale, a pena di decadenza (art. 7 All. II.14); sottoscrizione del conto finale entro un termine non superiore a ${GIORNI_FIRMA_CONTO_FINALE} giorni dall'invito del RUP; sottoscrizione del certificato di collaudo provvisorio entro ${GIORNI_FIRMA_COLLAUDO} giorni dalla trasmissione (art. 23). La ritenuta dello 0,50% si svincola in sede di liquidazione finale, dopo l'approvazione del collaudo o del certificato di regolare esecuzione, previo documento unico di regolarità contributiva.</p>`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, 'Scadenziario'),
    title: 'Scadenziario dei termini di legge',
    sub: `alla data del ${oggi}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Foglio di lavoro: i termini sono calcolati dagli atti registrati nel programma. Non sostituisce la verifica del capitolato speciale.', page: 'Scadenziario' },
    docTitle: `Scadenziario — ${appalto.oggetto || 'Lavori'}`,
  })
}
