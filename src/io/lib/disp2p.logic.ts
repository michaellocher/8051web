/** Logik der 2-Port-Anzeigen (2×7-Segment, 4×7-Segment, Punktmatrix, 16 LEDs) – reine Logik, kein DOM. */

/**
 * 2×7-Segment mit Direktansteuerung (Bildvorlage des Handbuchs):
 * D0 = dp, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g.
 * `SEG2_OF_BIT[bit]` = Index des Segments (0 = a … 6 = g, 7 = dp).
 */
export const SEG2_OF_BIT = [7, 2, 3, 4, 1, 0, 5, 6] as const;
export const SEG2_BIT_NAMES = ['dp', 'c', 'd', 'e', 'b', 'a', 'f', 'g'] as const;

/** Portwert → Segmentmaske (Bit 0 = a … Bit 6 = g, Bit 7 = dp) */
export function seg2Mask(byte: number): number {
  let m = 0;
  for (let bit = 0; bit < 8; bit++) if ((byte >> bit) & 1) m |= 1 << SEG2_OF_BIT[bit]!;
  return m;
}
/** Segmentmaske (a = Bit 0 … dp = Bit 7) → Portwert der 2×7-Segment-Anzeige */
export function seg2Byte(mask: number): number {
  let b = 0;
  for (let bit = 0; bit < 8; bit++) if ((mask >> SEG2_OF_BIT[bit]!) & 1) b |= 1 << bit;
  return b;
}

/**
 * 4×7-Segment mit Daten- und Select-Port: Daten-Port (unten) D0–D7 = a–g, dp;
 * Select-Port (oben) D0–D3 = Stelle 0 (rechts) … Stelle 3 (links), low-aktiv.
 * Liefert je Stelle die leuchtende Segmentmaske (a = Bit 0 … dp = Bit 7).
 */
export function mux4Masks(select: number, data: number): number[] {
  return [0, 1, 2, 3].map((pos) => (((select >> pos) & 1) === 0 ? data & 0xff : 0));
}

/**
 * Punktmatrix 7×5. Port oben: D0–D4 = Spalten C1–C5 (low-aktiv, Kathoden), Port unten: D0–D6 = Zeilen R1–R7 (high-aktiv).
 * Nachleuchten wie im Original: Die Zeilendaten einer aktiven (Low) Spalte werden gespeichert und bleiben
 * stehen, bis die Spalte erneut aktiv ist und neue Daten bekommt.
 */
export class DotMatrix {
  /** Gespeicherte Zeilenmaske je Spalte (Bit 0 = R1) */
  readonly cols: number[] = [0, 0, 0, 0, 0];
  update(colPins: number, rowPins: number) {
    for (let c = 0; c < 5; c++) if (((colPins >> c) & 1) === 0) this.cols[c] = rowPins & 0x7f;
  }
  dot(col: number, row: number): boolean {
    return (((this.cols[col] ?? 0) >> row) & 1) === 1;
  }
}

/** Portbit (0–7) und Port (0/1) der LED i = 0…15 (A.0…A.7, B.0…B.7) */
export const led16Bit = (i: number) => i & 7;
export const led16Port = (i: number) => i >> 3;
