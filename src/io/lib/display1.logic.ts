/** Logik der 1-Port-Anzeigen: 2×7-Segment-MUX, ICM7212, NSOW (reine Logik, kein DOM). */
import { HEX7 } from './basic.logic.ts';

// ───────────── 2×7-Segment-MUX ─────────────
/**
 * Segmentzuordnung der Datenleitungen: D0 = DP, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g.
 * Index = Bit der Datenleitung, Wert = Segmentindex (0 = a … 6 = g, 7 = DP).
 */
export const MUX_SEG_OF_BIT = [7, 2, 3, 4, 1, 0, 5, 6] as const;
/** Segmentindex (a–g, DP) → Datenbit */
export const MUX_BIT_OF_SEG = [5, 4, 1, 2, 3, 6, 7, 0] as const;
/** Freigabe über P3.7 (linke Ziffer) und P3.6 (rechte Ziffer): 1 = Display an */
export const MUX_LEFT_EN = 7, MUX_RIGHT_EN = 6;

/** Leuchtet Segment `seg` (0 = a … 7 = DP) der Ziffer `digit` (0 = links, 1 = rechts)? */
export function muxLit(data: number, p3: number, digit: 0 | 1, seg: number): boolean {
  const en = (p3 >> (digit === 0 ? MUX_LEFT_EN : MUX_RIGHT_EN)) & 1;
  return en === 1 && ((data >> MUX_BIT_OF_SEG[seg]!) & 1) === 1;
}
/** Segmentmaske (a–g, Bit 7 = DP) einer Ziffer aus Port- und P3-Pegel */
export function muxMask(data: number, p3: number, digit: 0 | 1): number {
  let m = 0;
  for (let s = 0; s < 8; s++) if (muxLit(data, p3, digit, s)) m |= 1 << s;
  return m;
}

// ───────────── ICM7212 ─────────────
/** Ziffernwahl D4–D7: Bit 4 = Einer, 5 = Zehner, 6 = Hunderter, 7 = Tausender */
export const ICM_DIGITS = ['Einer', 'Zehner', 'Hunderter', 'Tausender'] as const;

/**
 * 4-stellige 7-Segment-Anzeige mit ICM7212-Decoder. D0–D3 = Daten, D4–D7 wählen die Stelle
 * (Handbuch, D4 D5 D6 D7: 1000 Einer, 0100 Zehner, 0010 Hunderter, 0001 Tausender, 1111 alle,
 * 0000 keine Änderung). Die Daten werden mit jedem Schreiben ins Port-Latch übernommen und
 * bleiben gespeichert. Daten über 9 sind ungültig (Warnton).
 */
export class Icm7212 {
  /** gespeicherte Daten je Stelle (0 = Einer … 3 = Tausender); nach dem Einschalten F */
  readonly data: number[] = [15, 15, 15, 15];
  /** Anzahl ungültiger Schreibvorgänge (für den Warnton) */
  invalid = 0;
  /** Port-Latch geschrieben; liefert true, wenn ungültige Daten (> 9) übernommen wurden */
  write(latch: number): boolean {
    const sel = (latch >> 4) & 0x0f;
    if (sel === 0) return false;
    const d = latch & 0x0f;
    for (let pos = 0; pos < 4; pos++) if ((sel >> pos) & 1) this.data[pos] = d;
    if (d > 9) { this.invalid++; return true; }
    return false;
  }
  /** Segmentmaske (a–g) der Stelle */
  segments(pos: number): number { return HEX7[this.data[pos]! & 15]!; }
}

// ───────────── NSOW ─────────────
const NSOW_CHARS = ['', 'N', 'S', 'O', 'W'] as const;
/** Mittleres Zeichen (D0–D2): 1 = N, 2 = S, 3 = O, 4 = W, sonst leer */
export const nsowMiddle = (v: number): string => NSOW_CHARS[v & 7] ?? '';
/** Linkes Zeichen (D3–D5): wie das mittlere */
export const nsowLeft = (v: number): string => NSOW_CHARS[(v >> 3) & 7] ?? '';
/** Rechtes Zeichen (D6–D7): 1 = O, 2 = W, sonst leer */
export const nsowRight = (v: number): string => (['', 'O', 'W', ''] as const)[(v >> 6) & 3]!;
/** Die drei Zeichen (links, Mitte, rechts) für den Portwert */
export const nsowChars = (v: number): [string, string, string] => [nsowLeft(v), nsowMiddle(v), nsowRight(v)];
/** Portwert für eine der 16 Himmelsrichtungen (N, NNO, NO, ONO, O, OSO, SO, SSO, S, SSW, SW, WSW, W, WNW, NW, NNW) */
export function nsowCode(name: string): number {
  const code = (c: string) => NSOW_CHARS.indexOf(c as never);
  const n = name.toUpperCase();
  if (n.length === 1) return code(n);
  if (n.length === 2) return (code(n[0]!) << 0) | (((n[1] === 'O' ? 1 : 2) << 6));
  return (code(n[1]!) << 0) | (code(n[0]!) << 3) | ((n[2] === 'O' ? 1 : 2) << 6);
}
export const NSOW_NAMES16 = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const;
