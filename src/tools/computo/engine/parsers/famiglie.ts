/**
 * LE FAMIGLIE DI PREZZARI XML: come si riconosce un file (dalle prime righe) e
 * quale lettore lo legge. Un elenco solo, per la pipeline dei prezzari
 * (scripts/build-prezzari.ts) e per l'import da file nell'interfaccia
 * (src/shared/prezzari/leggi-file.ts): un formato riconosciuto in un posto lo
 * è anche nell'altro.
 */
import type { ParseResult } from '../types'
import { parseEasy } from './easy'
import { parseLombardiaDataroot } from './lombardia-dataroot'
import { parseLombardia } from './lombardia'
import { parseDocumento } from './documento'
import { parseBasilicata } from './basilicata'
import { parseVeneto } from './veneto'
import { parseRfi } from './rfi'

export type CategoriaPrezzario = 'pubblico' | 'privato'

export interface FamigliaXml {
  name: string
  categoria?: CategoriaPrezzario
  detect: (head: string) => boolean
  parse: (xml: string, fb?: { regione?: string; anno?: string }) => ParseResult
}

export const FAMIGLIE_XML: FamigliaXml[] = [
  { name: 'easy', detect: (head) => head.includes('EASY:Prezzario'), parse: parseEasy },
  // dataroot PRIMA di lombardia: sniff su <dataroot (export Access "Parte 4"), categoria pubblico.
  { name: 'lombardia-dataroot', categoria: 'pubblico', detect: (head) => head.includes('<dataroot'), parse: parseLombardiaDataroot },
  { name: 'lombardia', detect: (head) => head.includes('<report'), parse: parseLombardia },
  { name: 'documento', detect: (head) => head.includes('<Documento'), parse: parseDocumento },
  { name: 'basilicata', detect: (head) => /<Prezzario[\s>]/.test(head), parse: parseBasilicata },
  { name: 'veneto', detect: (head) => /<prezzario[\s>]/.test(head), parse: parseVeneto },
  // RFI: vero export XPWE di terzi, non il nostro buildXpwe — vedi doc in parsers/rfi.ts.
  { name: 'rfi', categoria: 'privato', detect: (head) => head.includes('PriMus.Document.XPWE'), parse: parseRfi },
]
