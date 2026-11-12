/**
 * Würfel-1/-2/-3 nach Handbuch (reine Logik, kein DOM).
 * Ein Würfel besteht aus einem 3×3-Raster; Zelle = Zeile·3 + Spalte:
 * 0 oben links, 1 oben Mitte, 2 oben rechts, 3 Mitte links, 4 Mitte, 5 Mitte rechts, 6 unten links, 7 unten Mitte, 8 unten rechts.
 */
export type Cells = readonly boolean[];

/** Augenmuster 0–7 als Zellenmaske; 0 und 7 = leer (Würfel-2: „Bei 0 und 7 erscheint das Symbol leer“). */
export const VALUE_CELLS: readonly (readonly number[])[] = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [],
];
const toCells = (on: readonly number[]): Cells => Array.from({ length: 9 }, (_, i) => on.includes(i));
const bitOf = (pins: number, b: number) => ((pins >> b) & 1) === 1;

/** Würfel-2: Bits 0–2 = Wert, 0 und 7 leer. */
export const dice2Cells = (pins: number): Cells => toCells(VALUE_CELLS[pins & 7]!);

/** Würfel-1: Jeder Eingang D0–D6 ist ein Leuchtpunkt (Zelle je Bit, wie im Symbol beschriftet). */
export const DICE1_CELL = [0, 3, 6, 4, 2, 5, 8] as const; // D0 oben links, D1 Mitte links, D2 unten links, D3 Mitte, D4 oben rechts, D5 Mitte rechts, D6 unten rechts
export const dice1Cells = (pins: number): Cells => toCells(DICE1_CELL.filter((_, b) => bitOf(pins, b)));

/** Würfel-3: Je Zelle das steuernde Datenbit (-1 = kein Leuchtpunkt). Gegenüberliegende Augen hängen am selben Bit. */
export const DICE3_LEFT: readonly number[] = [7, -1, 5, 6, 4, 6, 5, -1, 7]; // D4–D7
export const DICE3_RIGHT: readonly number[] = [3, -1, 1, 2, 0, 2, 1, -1, 3]; // D0–D3
export const dice3Cells = (pins: number, map: readonly number[]): Cells => map.map((b) => b >= 0 && bitOf(pins, b));

/** Anzahl der leuchtenden Augen */
export const pipCount = (c: Cells) => c.filter(Boolean).length;
