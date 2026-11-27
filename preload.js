// preload.js
// ──────────────────────────────────────────────────────────────────────────
// STEP 7 — hardening: contextIsolation:true. Il renderer (hub) è isolato dal
// contesto Node del preload; espone SOLO un'API minima e sicura via
// contextBridge (`window.ehubNative`). L'hub la usa per scoprire e caricare i
// tool dalla cartella risorse dell'app (dove vivono gli .html + vendor/), al
// posto della File System Access API (che non esiste sotto file://).
// In un pacchetto asar __dirname è dentro l'asar e 'fs' lo legge comunque.
// ──────────────────────────────────────────────────────────────────────────
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

const RES_DIR = __dirname

contextBridge.exposeInMainWorld('ehubNative', {
  /** Nome della cartella risorse (per la UI). */
  folderName() {
    return path.basename(RES_DIR) || 'Quadra'
  },
  /** Nomi dei file .html direttamente nella cartella risorse. */
  listHtml() {
    return fs
      .readdirSync(RES_DIR, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.html'))
      .map((d) => d.name)
  },
  /** Testo di un file della cartella risorse (solo file diretti: niente path traversal). */
  readText(name) {
    const safe = path.basename(String(name))
    return fs.readFileSync(path.join(RES_DIR, safe), 'utf8')
  },
  /**
   * Salva un progetto Quadra. La PRIMA volta chiede la cartella di destinazione
   * (e la ricorda); le volte successive ci scrive direttamente. Ritorna
   * { path } | { canceled:true } | { error }. Delega al main (dialog + fs).
   */
  saveProject(filename, content) {
    return ipcRenderer.invoke('ehub:save-project', { filename, content })
  },
  /** «Salva con nome»: finestra di salvataggio nativa. Ritorna { path } | { canceled } | { error }. */
  saveProjectAs(filename, content) {
    return ipcRenderer.invoke('ehub:save-project-as', { filename, content })
  },
  /** Riscrive il progetto nel file scelto con «Salva con nome». */
  saveProjectTo(absPath, content) {
    return ipcRenderer.invoke('ehub:save-project-to', { path: absPath, content })
  },
  /** Apre un PDF nel visore del sistema (Anteprima su Mac), da cui si stampa. Ritorna { path } | { error }. */
  openPdf(data, filename) {
    return ipcRenderer.invoke('ehub:apri-pdf', { data, filename })
  },
  /** Forza la scelta di una nuova cartella di salvataggio progetti. */
  chooseProjectDir() {
    return ipcRenderer.invoke('ehub:choose-project-dir')
  },
})
