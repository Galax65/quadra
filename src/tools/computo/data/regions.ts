/** Dati di dominio: anagrafica regioni, colori. */

/** Prefisso codice/sigla → nome regione (per il riconoscimento da contenuto/filename). */
export const REGIONS: Record<string, string> = {
  LOM: 'Lombardia', VEN: 'Veneto', TOS: 'Toscana', LAZ: 'Lazio',
  PIE: 'Piemonte', LIG: 'Liguria', EMR: 'Emilia-Romagna', MAR: 'Marche',
  UMB: 'Umbria', ABR: 'Abruzzo', MOL: 'Molise', CAM: 'Campania',
  PUG: 'Puglia', BAS: 'Basilicata', CAL: 'Calabria', SIC: 'Sicilia',
  SAR: 'Sardegna', FRI: 'Friuli V.G.', TN: 'Trento', BZ: 'Bolzano', VDA: "Valle d'Aosta",
}

/** Colore identità per regione (badge/banner). */
export const REG_COLORS: Record<string, string> = {
  'Lombardia': '#2563eb', 'Veneto': '#0891b2', 'Toscana': '#059669', 'Lazio': '#7c3aed',
  'Piemonte': '#b45309', 'Liguria': '#0f766e', 'Emilia-Romagna': '#dc2626', 'Marche': '#6d28d9',
}

/** Colore di una regione (grigio neutro di fallback). */
export function regColor(r: string): string {
  return REG_COLORS[r] || '#6b7280'
}
