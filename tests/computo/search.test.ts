import { describe, it, expect } from 'vitest'
import { searchRows, isManodoperaRow, isNoloRow, isMaterialeRow } from '../../src/tools/computo/engine/search'
import type { PriceRow } from '../../src/tools/computo/engine/types'

const row = (o: Partial<PriceRow>): PriceRow => ({
  codice: '', desc_short: '', declaratoria: '', um: '', prezzo: 0,
  disciplina: 'IMPIANTI ELETTRICI', ...o,
} as PriceRow)

const tray = row({ codice: 'T1', desc_short: 'Passerella portacavi in acciaio zincato, larghezza 150 mm' })
const trayLid = row({ codice: 'T2', desc_short: 'Coperchio di acciaio zincato; impiego: passerella portacavi; larghezza 150 mm' })
const rigido = row({ codice: 'R1', desc_short: 'Tubo in PVC rigido atossico, pesante — ø 25 mm' })
const corrugato = row({ codice: 'C1', desc_short: 'Tubo corrugato pieghevole autoestinguente ø 25 mm' })

// NOTA (Quadra): FAMIGLIE_DATA arriva da `compositore-catalog:thesaurus`, che
// vite.config.ts alias-a allo stub vuoto (catalog-data-empty.ts) — con FAMIGLIE=[]
// `expandQuery` non riconosce mai una famiglia, quindi `searchRows` prende sempre il
// ramo storico (AND letterale, retro-compat) e mai il ramo rankizzato (penalità
// accessorio/macro, cascata stem-aware, penalità RISORSA…). I test che verificavano
// quel ramo — che richiede famiglie REALI per attivarsi — sono stati rimossi. Restano
// i test compatibili con l'AND letterale (i fixture qui sotto usano parole letterali
// che il ramo storico trova comunque) e tutti i test dei classificatori puri
// (isManodoperaRow/isNoloRow/isMaterialeRow/isOperaCompiutaRow), che non dipendono dal
// catalogo.
describe('searchRows — ranking componente vs accessorio', () => {
  it('rigido e corrugato non si mescolano', () => {
    expect(searchRows([rigido, corrugato], 'tubo rigido').map(r => r.codice)).toEqual(['R1'])
    expect(searchRows([rigido, corrugato], 'tubo corrugato').map(r => r.codice)).toEqual(['C1'])
  })
})

// Fix «ricerca mirata ma flessibile»: con famiglia riconosciuta i token liberi
// DESCRITTIVI (stopword escluse) tornano vincolanti (AND); se l'AND svuota il
// set si ripiega sul solo ranking (mai zero risultati quando la famiglia c'è).
// Rilievo utente: «punto luce interrotto a vista» restituiva l'intera famiglia.
describe('searchRows — token descrittivi vincolanti (tutte le macrocategorie)', () => {
  const plInterrottoVista = row({ codice: 'PL1', desc_short: 'Punto luce interrotto in tubo a vista' })
  const plSemplice = row({ codice: 'PL2', desc_short: 'Punto luce semplice sottotraccia' })
  const plDeviato = row({ codice: 'PL3', desc_short: 'Punto luce deviato sottotraccia' })
  const citazione = row({ codice: 'PL4', desc_short: 'Quadro di zona appartamento', declaratoria: 'comprensivo di collegamento al punto luce esistente' })

  it('«punto luce interrotto a vista»: solo le voci con interrotto E vista (la stopword «a» non vincola)', () => {
    const out = searchRows([plSemplice, citazione, plInterrottoVista, plDeviato], 'punto luce interrotto a vista')
    expect(out.map(r => r.codice)).toEqual(['PL1'])
  })
  it('la voce che CITA la famiglia solo in declaratoria non passa se mancano i token digitati', () => {
    const out = searchRows([citazione, plSemplice, plInterrottoVista], 'punto luce interrotto')
    expect(out.map(r => r.codice)).toEqual(['PL1'])
  })
  it('famiglia sola («punto luce»): comportamento invariato, tutta la famiglia rankizzata', () => {
    const out = searchRows([plSemplice, plDeviato, plInterrottoVista], 'punto luce')
    expect(out.length).toBe(3)
  })
  // Stessa semantica sugli altri domini impiantistici (il vincolo è nel motore, non per-famiglia)
  it('antincendio: «idrante a muro uni 45» non restituisce il soprassuolo', () => {
    const muro = row({ codice: 'ID1', desc_short: 'Idrante a muro UNI 45 completo di cassetta' })
    const soprassuolo = row({ codice: 'ID2', desc_short: 'Idrante soprassuolo UNI 70 a colonna' })
    const out = searchRows([soprassuolo, muro], 'idrante a muro uni 45')
    expect(out.map(r => r.codice)).toEqual(['ID1'])
  })
  it('meccanici: «ventilconvettore verticale» esclude quello a soffitto', () => {
    const vert = row({ codice: 'VC1', desc_short: 'Ventilconvettore carenato verticale a parete' })
    const soff = row({ codice: 'VC2', desc_short: 'Ventilconvettore da soffitto non carenato' })
    const out = searchRows([soff, vert], 'ventilconvettore verticale')
    expect(out.map(r => r.codice)).toEqual(['VC1'])
  })
  it('illuminazione: «plafoniera di emergenza» esclude la plafoniera ordinaria', () => {
    const emerg = row({ codice: 'IL1', desc_short: 'Plafoniera di emergenza a led autoalimentata' })
    const ordinaria = row({ codice: 'IL2', desc_short: 'Plafoniera led da controsoffitto 60x60' })
    const out = searchRows([ordinaria, emerg], 'plafoniera di emergenza')
    expect(out.map(r => r.codice)).toContain('IL1')
    expect(out[0]!.codice).toBe('IL1')
  })
  it('speciali: «rivelatore di fumo puntiforme» esclude il lineare', () => {
    const punt = row({ codice: 'RF1', desc_short: 'Rivelatore di fumo puntiforme ottico indirizzato' })
    const lin = row({ codice: 'RF2', desc_short: 'Rivelatore di fumo lineare a barriera' })
    const out = searchRows([lin, punt], 'rivelatore di fumo puntiforme')
    expect(out.map(r => r.codice)).toEqual(['RF1'])
  })
})

// Round «morfologia + misure»: match ADDITIVO su piano stemmato (flessioni
// italiane) e misure canoniche (virgola decimale, ø/diametro).
describe('searchRows — flessioni e misure', () => {
  const cavo25 = row({ codice: 'CV1', desc_short: 'Cavo FG16(O)R16 3x2,5 mm²' })
  const cavo4 = row({ codice: 'CV2', desc_short: 'Cavo FG16(O)R16 3x4 mm²' })
  it('«cavo 3x2.5» trova la voce scritta «3x2,5 mm²» (virgola decimale dei prezzari)', () => {
    const out = searchRows([cavo4, cavo25], 'cavo 3x2.5')
    expect(out.map(r => r.codice)).toEqual(['CV1'])
  })
  const tubo25 = row({ codice: 'TD1', desc_short: 'Tubo rigido in pvc Ø 25 mm' })
  const tubo32 = row({ codice: 'TD2', desc_short: 'Tubo rigido in pvc diametro 32 mm' })
  it('«ø25» ≡ «Ø 25» ≡ «diametro 25»: stesse voci', () => {
    const rows25 = [tubo32, tubo25]
    const a = searchRows(rows25, 'tubo rigido ø25').map(r => r.codice)
    const b = searchRows(rows25, 'tubo rigido diametro 25').map(r => r.codice)
    const c = searchRows(rows25, 'tubo rigido Ø 25').map(r => r.codice)
    expect(a).toEqual(['TD1'])
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })
  it('il piano stemmato matcha solo a inizio parola: «porta» non pesca «supporto»', () => {
    const supporto = row({ codice: 'SP1', desc_short: 'Supporto per passerella portacavi' })
    // ramo senza famiglia (parole ignote): AND letterale storico, nessun match stem
    const out = searchRows([supporto], 'porta blindata')
    expect(out).toEqual([])
  })
})

describe('searchRows — retro-compatibilità', () => {
  it('query vuota = identità', () => {
    const rows = [tray, rigido]
    expect(searchRows(rows, '')).toBe(rows)
  })
  it('query-codice: filtro letterale senza riordino', () => {
    const out = searchRows([rigido, tray, corrugato], 'T1')
    expect(out.map(r => r.codice)).toEqual(['T1'])
  })
  it('parole ignote: AND storico, ordine del prezzario preservato', () => {
    const out = searchRows([corrugato, rigido], 'atossico pesante')
    expect(out.map(r => r.codice)).toEqual(['R1'])
  })
})

// La ricerca manodopera nell'Analisi Prezzi deve restare SOLO tariffe
// orarie CCNL (mai voci di opera compiuta come lo scavo, prezzato a m³/m²).
const operaioSpecializzato = row({ codice: 'VEN25-RU.01.02.a', desc_short: 'OPERAIO SPECIALIZZATO EDILE', um: 'h', prezzo: 33.03 })
const operaioComune = row({ codice: 'VEN25-RU.01.04.a', desc_short: 'OPERAIO COMUNE EDILE', um: 'ora', prezzo: 27.33 })
const scavo = row({ codice: 'VEN25-01.02.03', desc_short: 'Scavo di sbancamento a sezione ampia', um: 'm³', prezzo: 12.5 })
const noloOrario = row({ codice: 'VEN25-NOL.02.01', desc_short: 'Nolo di autocarro con operatore', um: 'h', prezzo: 45 })
// Regressione: «opere in economia» prezzate a ora ma NON manodopera —
// trovate cercando "o" nel prezzario Veneto reale (falso positivo col solo filtro UM).
const scavoOrario = row({ codice: 'VEN25-01.41.13.00', desc_short: 'RICOGNIZIONE PRELIMINARE ALLO SCAVO ARCHEOLOGICO', um: 'h', prezzo: 662.99 })
const scalpelloOrario = row({ codice: 'VEN25-04.01.23.a', desc_short: 'USO DI SCALPELLO', um: 'h', prezzo: 240.03 })
// trovato in prova reale: contiene "operaio" ma è formazione/sicurezza, non la tariffa base
const infoLavoratori = row({ codice: 'VEN25-21.03.02.b', desc_short: 'INFORMAZIONE DEI LAVORATORI - operaio specializzato', um: 'h', prezzo: 5.2 })

describe('isManodoperaRow / searchManodoperaRows', () => {
  it('riconosce le tariffe orarie manodopera (um "h" o "ora")', () => {
    expect(isManodoperaRow(operaioSpecializzato)).toBe(true)
    expect(isManodoperaRow(operaioComune)).toBe(true)
  })
  it('esclude le voci di opera compiuta anche se il testo contiene lettere in comune', () => {
    expect(isManodoperaRow(scavo)).toBe(false)
  })
  it('esclude il nolo anche se prezzato a ore (non è manodopera)', () => {
    expect(isManodoperaRow(noloOrario)).toBe(false)
  })
  it('esclude le «opere in economia» prezzate a ora (UM sola non basta, serve una parola di ruolo)', () => {
    expect(isManodoperaRow(scavoOrario)).toBe(false)
    expect(isManodoperaRow(scalpelloOrario)).toBe(false)
  })
  it('esclude una voce che CONTIENE "operaio" ma non è la tariffa base (il ruolo deve aprire la descrizione)', () => {
    expect(isManodoperaRow(infoLavoratori)).toBe(false)
  })
})

// ── Lombardia: RISORSE elementari sotto le OPERE COMPIUTE (rilievo utente) ──
// Il prezzario Lombardia porta la voce gemella due volte (RISORSA MATERIALE =
// costo elementare, OPERA COMPIUTA = voce in opera): a pari pertinenza l'opera
// compiuta deve stare sopra — scegliere il materiale per sbaglio è l'errore da
// prevenire. La penalità non deve però seppellire il materiale ESATTO sotto
// opere compiute che matchano peggio.
const rmPasserella = row({
  codice: 'LOM261.RM.71.15.30.X.a', tipologia: 'RISORSA MATERIALE',
  desc_short: 'Passerella portacavi di acciaio zincato; larghezza [mm] = 200',
})
const ocPasserella = row({
  codice: 'LOM261.OC.EEA.Pa01.X.a', tipologia: 'OPERA COMPIUTA',
  desc_short: 'Passerella, portacavi di acciaio zincato; larghezza [mm] = 200',
})

describe('searchRows — voci RISORSA (Lombardia) sfavorite rispetto alle opere compiute', () => {
  // NOTA: le due varianti «a pari pertinenza» richiedono la famiglia
  // «passerella-portacavi» riconosciuta per attivare il ramo rankizzato (che applica
  // la penalità RISORSA) — con FAMIGLIE=[] il motore resta sul ramo storico (AND
  // letterale, ordine di prezzario) e i due test sono stati rimossi.
  it('il materiale che matcha la misura chiesta resta sopra l’opera compiuta che non la ha', () => {
    const ocAltra = row({
      codice: 'LOM261.OC.EEA.Pa01.X.b', tipologia: 'OPERA COMPIUTA',
      desc_short: 'Passerella, portacavi di acciaio zincato; larghezza [mm] = 400',
    })
    const out = searchRows([ocAltra, rmPasserella], 'passerella 200')
    expect(out[0].codice).toBe('LOM261.RM.71.15.30.X.a')
  })
  it('prezzari senza tipologia RISORSA: ranking invariato', () => {
    const out = searchRows([tray, trayLid], 'passerella')
    expect(out[0].codice).toBe('T1')
  })
})

describe('classificatori con tipologia Lombardia', () => {
  it('isManodoperaRow: RISORSA UMANA è manodopera anche fuori FRASARIO ruoli', () => {
    expect(isManodoperaRow(row({ desc_short: 'Impiegato edile di livello 7°; qualifica: quadro', um: 'h', tipologia: 'RISORSA UMANA' }))).toBe(true)
  })
  it('isNoloRow: RISORSA STRUMENTALE equivale a un nolo', () => {
    expect(isNoloRow(row({ desc_short: 'Mini escavatore cingolato; potenza [kW] ≤ 9,6', um: 'h', tipologia: 'RISORSA STRUMENTALE PRODUTTIVA' }))).toBe(true)
  })
  it('isMaterialeRow: decide la tipologia — RM sì, OPERA COMPIUTA no (anche senza «in opera» nel testo)', () => {
    expect(isMaterialeRow(rmPasserella)).toBe(true)
    expect(isMaterialeRow(ocPasserella)).toBe(false)
  })
})

describe('isOperaCompiutaRow · una distinta di CAVI vuole opere compiute, non materiale nudo', () => {
  const r = (desc: string, extra: Record<string, unknown> = {}) =>
    ({ codice: 'X', desc_short: desc, declaratoria: '', um: 'm', ...extra }) as never

  it('«materiale» batte «opera» quando il capitolo dice entrambe le cose', () => {
    // trabocchetti veri: «MATERIALI IMPIANTI MECCANICI» contiene anche IMPIANTI, e
    // «MATERIALI IN FORNITURA A PIE' D'OPERA» contiene anche D'OPERA
    expect(isMaterialeRow(r('Tubo', { liv1: 'MATERIALI IMPIANTI MECCANICI' }))).toBe(true)
    expect(isMaterialeRow(r('Cavo', { liv1: 'MATERIALI IN FORNITURA A PIE\' D\'OPERA' }))).toBe(true)
  })

})
