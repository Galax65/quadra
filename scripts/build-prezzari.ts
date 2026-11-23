/**
 * Build dei prezzari: normalizza i grezzi di `prezzari-src/` (gitignored) in JSON
 * tipizzati (`PriceRow[]`) dentro `prezzari/` (gitignored), un file per prezzario.
 * È la stessa cartella da cui legge `bundle-prezzari.mjs`: i due passi si
 * concatenano senza spostamenti a mano (`build:prezzari` → `bundle:prezzari`).
 *
 * Gira raramente (i prezzari si aggiornano ~1 volta/anno). Esegui con:
 *   npm run build:prezzari            → tutti i file riconosciuti
 *   npm run build:prezzari calabria   → solo i percorsi che contengono "calabria"
 *
 * Ogni famiglia di formato registra un `detect` (sniff sulla testa del file) e il
 * suo parser. Oggi è implementata solo la famiglia EASY; le altre vengono saltate
 * finché il relativo parser non esiste.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { join, relative, resolve } from 'node:path'
import { parseCratere } from '../src/tools/computo/engine/parsers/cratere'
import { parseDei } from '../src/tools/computo/engine/parsers/dei'
import { isVenetoAnalisi, parseVenetoAnalisi, applyAnalisi } from '../src/tools/computo/engine/parsers/veneto-analisi'
import { parseVda } from '../src/tools/computo/engine/parsers/vda'
import { isFvg, parseFvg } from '../src/tools/computo/engine/parsers/fvg'
import { packPrezzario } from '../src/shared/prezzari/pack'
import { FAMIGLIE_XML } from '../src/tools/computo/engine/parsers/famiglie'

const SRC = resolve('prezzari-src')
const OUT = resolve('prezzari')

/** Famiglie di formato: `detect` sniffa i primi KB, `parse` produce le righe.
 *  `categoria` guida il raggruppamento in sidebar (default 'pubblico'). */
type Categoria = 'pubblico' | 'privato'
const FAMILIES = FAMIGLIE_XML

/** Nome cartella top-level sotto prezzari-src → regione (fallback se il codice non basta).
 *  NB: il grezzo di Puglia NON è presente nel repo — la cartella esiste ma è vuota
 *  e marcata "- manca". Il relativo parser è rinviato a quando il grezzo sarà disponibile;
 *  basterà aggiungere qui la voce 'Puglia'. Molise e Sicilia sono solo-PDF → fuori scope.
 *  Valle d'Aosta (3 xlsx: elettrico/meccanico/edile) è gestita a parte, vedi VDA_FOLDER più sotto. */
const FOLDER_REGION: Record<string, string> = {
  'Calabria': 'Calabria', 'Campania': 'Campania', 'Piemonte': 'Piemonte', 'Sardegna': 'Sardegna',
  'Toscana': 'Toscana', 'Emilia Romagna': 'Emilia-Romagna', 'Friuli Venezia Giulia': 'Friuli V.G.',
  'Bolzano': 'Bolzano', 'Trento': 'Trento', 'Basilicata': 'Basilicata', 'Liguria': 'Liguria',
  'Lombardia': 'Lombardia', 'Veneto': 'Veneto', 'Molise': 'Molise', 'Sicilia': 'Sicilia',
  'RFI': 'RFI',
}
/** Cartella top-level dei 3 xlsx della Valle d'Aosta — instradati a `parseVda` e
 *  AGGREGATI in un unico prezzario (i capitoli elettrico/meccanico/edile hanno
 *  prefissi di codice disgiunti: P60.*, P50/P51/S5*, M/N/P0*…). */
const VDA_FOLDER = "Valle d'aosta"

/** Elenco ricorsivo dei file sorgente (.xml e .xlsx) sotto `dir`. */
function findXml(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...findXml(p))
    else { const l = e.toLowerCase(); if (l.endsWith('.xml') || l.endsWith('.xlsx') || l.endsWith('.csv') || l.endsWith('.xpwe')) out.push(p) }
  }
  return out
}

/** Estrae il foglio dati di un xlsx (il più ricco, escludendo gli indici) → array 2D. */
function readXlsxGrid(file: string): unknown[][] {
  const XLSX = createRequire(import.meta.url)('xlsx')
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' })
  const names: string[] = wb.SheetNames
  const dataName = names.filter(n => !/indice/i.test(n)).sort((a, b) => {
    const rows = (s: string) => XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: '' }).length
    return rows(b) - rows(a)
  })[0] ?? names[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[dataName], { header: 1, raw: false, defval: '' }) as unknown[][]
}

/** Come `readXlsxGrid`, ma concatena TUTTI i fogli dati (esclusi gli indici) invece di
 *  tenere solo il più ricco — necessario per Valle d'Aosta: alcuni xlsx (es. Opere Edili)
 *  hanno il capitolo Manodopera/Noli in un foglio SEPARATO e più piccolo del foglio
 *  principale, che `readXlsxGrid` scarterebbe silenziosamente (bug scoperto sul codice
 *  M00.A00.004, assente dal prezzario pur essendo nel grezzo). Una riga vuota separa i
 *  fogli: `parseVda` la ignora e il capitolo del foglio successivo (depth 0) resetta
 *  comunque lo stack titoli, quindi l'ordine di concatenazione è innocuo. */
function readXlsxAllSheets(file: string): unknown[][] {
  const XLSX = createRequire(import.meta.url)('xlsx')
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' })
  const names = wb.SheetNames.filter((n: string) => !/indice/i.test(n))
  const out: unknown[][] = []
  for (const name of names) {
    out.push(...(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][]))
    out.push([])
  }
  return out
}

/** Legge solo i primi `n` byte del file (per lo sniff del formato senza caricarlo tutto). */
function readHead(path: string, n = 4096): string {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(n)
    const read = readSync(fd, buf, 0, n, 0)
    return buf.toString('utf-8', 0, read)
  } finally {
    closeSync(fd)
  }
}

/** Slug stabile per il nome file di output (es. "Toscana/...Firenze..." → "firenze-2026"). */
function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function main(): void {
  const filter = process.argv[2]?.toLowerCase()
  mkdirSync(OUT, { recursive: true })

  // `prezzari-src/` è gitignored e quindi NON esiste in un checkout appena clonato: senza
  // questa guardia il primo comando che un nuovo utente lancia seguendo CLAUDE.md §2
  // risponde con uno stack trace ENOENT invece di dirgli cosa manca.
  if (!existsSync(SRC)) {
    console.error(`✗ Manca la cartella dei grezzi: ${SRC}`)
    console.error('  I prezzari non sono inclusi nel repo (dati regionali/di fornitore, non')
    console.error('  ridistribuibili). Crea `prezzari-src/<Regione>/` e mettici dentro il file')
    console.error('  ufficiale scaricato, poi rilancia. Ricetta completa: CLAUDE.md §2.')
    process.exitCode = 1
    return
  }

  const tutti = findXml(SRC).filter(f => !filter || f.toLowerCase().includes(filter))
  // COMPANION analisi prezzi: file `<analisiPrezzi>` (Veneto) — non sono
  // prezzari a sé: arricchiscono le voci del prezzario della stessa cartella/anno.
  const companions: { file: string; top: string }[] = []
  const senzaAnalisi = tutti.filter(f => {
    if (f.toLowerCase().endsWith('.xml') && isVenetoAnalisi(readHead(f))) {
      companions.push({ file: f, top: relative(SRC, f).split(/[\\/]/)[0] })
      return false
    }
    return true
  })
  // Valle d'Aosta: 3 xlsx aggregati in un unico prezzario, gestiti a parte dopo il loop.
  const vdaFiles = senzaAnalisi.filter(f => relative(SRC, f).split(/[\\/]/)[0] === VDA_FOLDER)
  const files = senzaAnalisi.filter(f => !vdaFiles.includes(f))

  console.log(`Build prezzari → ${relative(process.cwd(), OUT)}/`)
  let ok = 0, skipped = 0
  for (const file of files) {
    const rel = relative(SRC, file)
    const topFolder = rel.split(/[\\/]/)[0]
    const fbRegione = FOLDER_REGION[topFolder]
    const fbAnno = rel.match(/20\d{2}/)?.[0]   // anno dal percorso (per i formati che non lo espongono)
    const t0 = Date.now()

    let res, family: string, categoria: Categoria
    if (file.toLowerCase().endsWith('.csv')) {
      // Prezzario Unico Cratere Centro Italia (Abruzzo/Lazio/Marche/Umbria), CSV ';'
      const XLSX = createRequire(import.meta.url)('xlsx')
      const wb = XLSX.read(readFileSync(file, 'utf-8'), { type: 'string', FS: ';' })
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as unknown[][]
      res = parseCratere(grid, { regione: 'Cratere Centro Italia', anno: fbAnno ?? '2026' })
      family = 'cratere'; categoria = 'pubblico'
    } else if (file.toLowerCase().endsWith('.xlsx')) {
      const grid = readXlsxGrid(file)
      if (isFvg(grid)) {
        // Friuli Venezia Giulia — prezzario regionale lavori pubblici (xlsx descrizioni estese)
        res = parseFvg(grid, { regione: fbRegione ?? 'Friuli V.G.', anno: fbAnno })
        family = 'fvg'; categoria = 'pubblico'
      } else {
        // prezzario editoriale privato in xlsx (impianti elettrici)
        res = parseDei(grid, { regione: fbRegione, anno: fbAnno })
        family = 'dei'; categoria = 'privato'
      }
    } else {
      const fam = FAMILIES.find(f => f.detect(readHead(file)))
      if (!fam) { console.log(`  ⏭  ${rel}  (formato non ancora supportato)`); skipped++; continue }
      res = fam.parse(readFileSync(file, 'utf-8'), { regione: fbRegione, anno: fbAnno })
      family = fam.name; categoria = fam.categoria ?? 'pubblico'
    }

    // companion analisi prezzi della stessa cartella (e stesso anno, se dichiarato)
    for (const c of companions.filter(c => c.top === topFolder)) {
      const { anno, byCod } = parseVenetoAnalisi(readFileSync(c.file, 'utf-8'))
      if (anno && res.anno && anno !== res.anno) continue
      const n = applyAnalisi(res.rows, byCod)
      if (n) console.log(`     ↳ analisi prezzi: ${n} voci arricchite da ${relative(SRC, c.file)}`)
    }

    // Lombardia dataroot e report condividono regione+anno (Lombardia/2026): slug dedicato
    // per non sovrascrivere lombardia-2026.json.gz.
    const base = family === 'lombardia-dataroot'
      ? slug(`${res.regione ?? topFolder}-dataroot-${res.anno ?? ''}`)
      : slug(`${res.regione ?? topFolder}-${res.anno ?? ''}`) || slug(rel)
    const packed = packPrezzario(
      { regione: res.regione, anno: res.anno, family, source: rel, count: res.rows.length, categoria },
      res.rows,
    )
    const json = JSON.stringify(packed)
    const gz = gzipSync(json, { level: 9 })
    const outPath = join(OUT, `${base}.json.gz`)
    writeFileSync(outPath, gz)
    const gzMb = (gz.length / 1048576).toFixed(1)
    const rawMb = (Buffer.byteLength(json) / 1048576).toFixed(1)
    console.log(`  ✓  ${rel}  [${family}] → ${base}.json.gz  ${res.rows.length} voci · packed ${rawMb} MB → gzip ${gzMb} MB · ${Date.now() - t0}ms`)
    ok++
  }

  // ── Valle d'Aosta: 3 xlsx (elettrico/meccanico/edile) → 1 prezzario aggregato ──
  if (vdaFiles.length && (!filter || filter.includes('aosta') || filter.includes('vda'))) {
    const t0 = Date.now()
    const anno = vdaFiles.map(f => relative(SRC, f).match(/20\d{2}/)?.[0]).find(Boolean) ?? '2026'
    const rows = vdaFiles.flatMap(f => {
      const res = parseVda(readXlsxAllSheets(f), { regione: "Valle d'Aosta", anno })
      console.log(`     ↳ ${relative(SRC, f)}  ${res.rows.length} voci`)
      return res.rows
    })
    const base = slug(`valle-d-aosta-${anno}`)
    const packed = packPrezzario(
      { regione: "Valle d'Aosta", anno, family: 'vda', source: relative(SRC, vdaFiles[0]).split(/[\\/]/).slice(0, 2).join('/'), count: rows.length, categoria: 'pubblico' },
      rows,
    )
    const json = JSON.stringify(packed)
    const gz = gzipSync(json, { level: 9 })
    writeFileSync(join(OUT, `${base}.json.gz`), gz)
    console.log(`  ✓  Valle d'Aosta [${anno}] → ${base}.json.gz  ${rows.length} voci · gzip ${(gz.length / 1048576).toFixed(1)} MB · ${Date.now() - t0}ms`)
    ok++
  }

  console.log(`\nFatto: ${ok} prezzari, ${skipped} saltati.`)
}

main()
