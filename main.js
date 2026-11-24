const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Progetto Quadra: cartella di salvataggio ricordata (scelta la prima volta) ──
function configPath() {
  return path.join(app.getPath('userData'), 'ehub-config.json')
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')) || {} } catch (e) { return {} }
}
function writeConfig(cfg) {
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8') } catch (e) { /* best-effort */ }
}
async function pickProjectDir() {
  const win = BrowserWindow.getFocusedWindow()
  const res = await dialog.showOpenDialog(win, {
    title: 'Scegli la cartella dei progetti Quadra',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (res.canceled || !res.filePaths || !res.filePaths.length) return null
  return res.filePaths[0]
}

// Salva un progetto Quadra: la prima volta chiede la cartella e la ricorda.
ipcMain.handle('ehub:save-project', async (_e, { filename, content }) => {
  try {
    let dir = readConfig().projectDir
    if (!dir || !fs.existsSync(dir)) {
      dir = await pickProjectDir()
      if (!dir) return { canceled: true }
      writeConfig({ ...readConfig(), projectDir: dir })
    }
    const safe = path.basename(String(filename || 'progetto.quadra'))
    const full = path.join(dir, safe)
    fs.writeFileSync(full, content, 'utf8')
    return { path: full }
  } catch (err) {
    return { error: String((err && err.message) || err) }
  }
})

// «Salva con nome»: finestra di salvataggio nativa (nome + cartella, pulsante «Salva»).
// La cartella scelta diventa quella dei progetti. Ritorna { path } | { canceled } | { error }.
ipcMain.handle('ehub:save-project-as', async (_e, { filename, content }) => {
  try {
    const win = BrowserWindow.getFocusedWindow()
    const cfg = readConfig()
    const base = cfg.projectDir && fs.existsSync(cfg.projectDir) ? cfg.projectDir : app.getPath('documents')
    const res = await dialog.showSaveDialog(win, {
      title: 'Salva il progetto Quadra',
      buttonLabel: 'Salva',
      defaultPath: path.join(base, path.basename(String(filename || 'progetto.quadra'))),
      filters: [{ name: 'Progetto Quadra', extensions: ['quadra'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    const full = res.filePath.toLowerCase().endsWith('.quadra') ? res.filePath : res.filePath + '.quadra'
    fs.writeFileSync(full, content, 'utf8')
    writeConfig({ ...readConfig(), projectDir: path.dirname(full) })
    return { path: full }
  } catch (err) {
    return { error: String((err && err.message) || err) }
  }
})

// Riscrive un progetto già salvato nello stesso file (dopo «Salva con nome»).
ipcMain.handle('ehub:save-project-to', async (_e, { path: p, content }) => {
  try {
    if (!p || typeof p !== 'string' || !p.toLowerCase().endsWith('.quadra')) return { error: 'percorso non valido' }
    if (!fs.existsSync(path.dirname(p))) return { error: 'cartella non trovata' }
    fs.writeFileSync(p, content, 'utf8')
    return { path: p }
  } catch (err) {
    return { error: String((err && err.message) || err) }
  }
})

// Cambia la cartella di salvataggio progetti.
ipcMain.handle('ehub:choose-project-dir', async () => {
  const dir = await pickProjectDir()
  if (!dir) return { canceled: true }
  writeConfig({ ...readConfig(), projectDir: dir })
  return { path: dir }
})

function buildMenu() {
  const isMac = process.platform === 'darwin'

  // Menu minimo: tiene attivi gli shortcut standard (copia/incolla/seleziona,
  // chiudi, ricarica, zoom). Senza questo, su macOS Cmd+C/V/Q smettono di
  // funzionare in un'app di data-entry.
  /* Due lavori affiancati. Capita spesso di pescare voci da un computo già
     fatto: si apre la seconda finestra, si mettono una accanto all'altra e si
     copiano le voci da una parte all'altra. */
  const menuFile = {
    label: 'File',
    submenu: [
      { label: 'Nuova finestra', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
      { type: 'separator' },
      { role: 'close', label: 'Chiudi finestra' },
    ],
  }
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'Info su Quadra' },
        { type: 'separator' },
        { role: 'hide', label: 'Nascondi Quadra' },
        { role: 'hideOthers', label: 'Nascondi altre' },
        { role: 'unhide', label: 'Mostra tutte' },
        { type: 'separator' },
        { role: 'quit', label: 'Esci da Quadra' }
      ]
    }] : []),
    menuFile,
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripeti' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        { role: 'reload', label: 'Ricarica' },
        { role: 'forceReload', label: 'Ricarica forzata' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Aumenta zoom' },
        { role: 'zoomOut', label: 'Riduci zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' }
      ]
    },
    ...(isMac ? [{
      label: 'Finestra',
      submenu: [
        { role: 'minimize', label: 'Riduci a icona' },
        { role: 'zoom', label: 'Ingrandisci' },
        { role: 'front', label: 'Porta tutte in primo piano' }
      ]
    }] : [])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Dimensione e posizione della finestra: si ricordano all'uscita ──────────
// Salvate in <userData>/finestra.json. All'avvio si riusano solo se la finestra
// cade ancora su uno schermo collegato (es. monitor esterno staccato → default).
const FILE_FINESTRA = () => path.join(app.getPath('userData'), 'finestra.json')

function leggiFinestra() {
  try {
    const f = JSON.parse(fs.readFileSync(FILE_FINESTRA(), 'utf8'))
    if (![f.x, f.y, f.width, f.height].every(Number.isFinite)) return null
    const area = screen.getDisplayMatching({ x: f.x, y: f.y, width: f.width, height: f.height }).workArea
    // almeno 100×50 px della barra del titolo devono restare sullo schermo trovato
    const visibile = f.x + f.width - 100 > area.x && f.x + 100 < area.x + area.width &&
      f.y >= area.y - 10 && f.y + 50 < area.y + area.height
    if (!visibile) return null
    return {
      x: f.x, y: f.y,
      width: Math.min(Math.max(f.width, 1024), area.width),
      height: Math.min(Math.max(f.height, 600), area.height),
      massimizzata: !!f.massimizzata, schermoIntero: !!f.schermoIntero,
    }
  } catch (e) { return null }
}

function salvaFinestra(win) {
  try {
    if (win.isDestroyed() || win.isMinimized()) return
    // da massimizzata o a schermo intero si ricordano le misure «normali» sottostanti
    const b = (win.isMaximized() || win.isFullScreen()) ? win.getNormalBounds() : win.getBounds()
    fs.writeFileSync(FILE_FINESTRA(), JSON.stringify({ ...b, massimizzata: win.isMaximized(), schermoIntero: win.isFullScreen() }))
  } catch (e) { /* non bloccare l'uscita */ }
}

function createWindow() {
  const ricordata = leggiFinestra()
  // La seconda finestra non si sovrappone alla prima: si sposta di un filo, così
  // si affiancano subito senza doverle inseguire.
  const aperte = BrowserWindow.getAllWindows().length
  const scarto = aperte * 28
  const win = new BrowserWindow({
    width: ricordata ? ricordata.width : 1440,
    height: ricordata ? ricordata.height : 900,
    ...(ricordata ? { x: ricordata.x + scarto, y: ricordata.y + scarto } : {}),
    minWidth: 1024,
    minHeight: 600,
    title: 'Quadra',
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // STEP 7 — hardening: il renderer (hub) è ISOLATO dal contesto Node. Il
      // preload espone solo un'API minima via contextBridge (window.ehubNative).
      // sandbox resta false perché il preload usa 'fs' per la cartella risorse;
      // il renderer non ha comunque accesso diretto a Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Il visore PDF di Chromium è un PLUGIN, e in Electron i plugin sono
      // spenti di default: senza questo, l'anteprima di stampa mostra una
      // pagina bianca invece del documento.
      plugins: true
    }
  })

  if (ricordata && ricordata.massimizzata) win.maximize()
  if (ricordata && ricordata.schermoIntero) win.setFullScreen(true)
  // si salva quando la si sposta o ridimensiona (con calma) e comunque alla chiusura
  let timer = null
  const salvaDopo = () => { clearTimeout(timer); timer = setTimeout(() => salvaFinestra(win), 800) }
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, salvaDopo)
  /* NON CHIUDERE PORTANDOSI VIA IL LAVORO. Il progetto vive in memoria finché
     non lo si salva in un file .quadra: alla chiusura si chiede, come fa ogni
     programma che tratta documenti. La domanda arriva solo se c'è davvero
     qualcosa da salvare (lo sa l'hub). */
  let chiusuraConfermata = false
  win.on('close', (e) => {
    clearTimeout(timer)
    salvaFinestra(win)
    if (chiusuraConfermata || win.webContents.isDestroyed()) return
    e.preventDefault()
    /* La domanda si fa una volta sola, e alla fine si CHIUDE PER DAVVERO
       (destroy): con win.close() si ripasserebbe di qui e la finestra non si
       chiuderebbe più, costringendo all'uscita forzata. Se la pagina non
       risponde entro un attimo, si chiude lo stesso: non si tiene in ostaggio
       l'utente per un controllo. */
    const chiedi = win.webContents.executeJavaScript('(()=>{try{return !!(window.__quadraDirty&&window.__quadraDirty())}catch(_){return false}})()').catch(() => false)
    const entro = (ms) => new Promise((r) => setTimeout(() => r(false), ms))
    Promise.race([chiedi, entro(1500)])
      .then(async (sporco) => {
        if (!sporco) { chiusuraConfermata = true; win.destroy(); return }
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Salva', 'Esci senza salvare', 'Annulla'],
          defaultId: 0,
          cancelId: 2,
          title: 'Quadra',
          message: 'Ci sono modifiche non salvate.',
          detail: 'Il lavoro di questa sessione non è ancora in un file .quadra. Salvandolo potrai riaprirlo da dove sei.',
        })
        if (response === 2) return
        if (response === 0) {
          await Promise.race([
            win.webContents.executeJavaScript('(async()=>{try{return await window.__quadraSalva()}catch(_){return false}})()').catch(() => false),
            entro(15000),
          ])
        }
        chiusuraConfermata = true
        win.destroy()
      })
      .catch(() => { chiusuraConfermata = true; win.destroy() })
  })

  win.loadFile('Quadra.html')

  // Apri i link esterni nel browser di sistema, non in una finestra Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
