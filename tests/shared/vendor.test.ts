import { describe, it, expect, beforeEach } from 'vitest'
import { loadScript, loadXLSX, loadPdfLib, _resetVendorCache } from '../../src/shared/vendor'

describe('loadScript — idempotenza del loader vendor', () => {
  beforeEach(() => _resetVendorCache())

  it('inietta una sola volta per src, anche con chiamate concorrenti', async () => {
    const seen: string[] = []
    const inject = (src: string) => { seen.push(src); return Promise.resolve() }

    await Promise.all([
      loadScript('vendor/x.js', inject),
      loadScript('vendor/x.js', inject),
      loadScript('vendor/x.js', inject),
    ])
    expect(seen).toEqual(['vendor/x.js'])   // un solo inject
  })

  it('src diversi vengono iniettati separatamente', async () => {
    const seen: string[] = []
    const inject = (src: string) => { seen.push(src); return Promise.resolve() }
    await loadScript('vendor/a.js', inject)
    await loadScript('vendor/b.js', inject)
    expect(seen).toEqual(['vendor/a.js', 'vendor/b.js'])
  })

  it('i loader nominali puntano ai path corretti in vendor/', async () => {
    const seen: string[] = []
    await loadXLSX((src) => { seen.push(src); return Promise.resolve() })
    expect(seen).toEqual(['vendor/xlsx.full.min.js'])
  })

  it('pdf-lib arriva sempre con fontkit: senza, i PDF non possono essere PDF/A', async () => {
    const seen: string[] = []
    await loadPdfLib((src) => { seen.push(src); return Promise.resolve() })
    expect(seen).toEqual(['vendor/pdf-lib.min.js', 'vendor/fontkit.min.js'])
  })

  it('se fontkit non si carica si stampa lo stesso', async () => {
    await expect(loadPdfLib((src) => (src.includes('fontkit') ? Promise.reject(new Error('no')) : Promise.resolve()))).resolves.toBeUndefined()
  })
})
