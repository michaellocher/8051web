/** IC-Tester (2-Port-Modell, 74xx-Gatter): reine Logik, kein DOM. */

export type IcType = '7400' | '7408' | '7432' | '7486';
export const IC_TYPES: readonly IcType[] = ['7400', '7408', '7432', '7486'];
export const IC_FUNCTION: Record<IcType, string> = { '7400': 'NAND', '7408': 'AND', '7432': 'OR', '7486': 'EXOR' };
/** Port_unten-Bit der Typtaste NAND, AND, OR, EXOR (= Datenleitungen IC1…IC4) */
export const IC_KEY_BIT: Record<IcType, number> = { '7400': 3, '7408': 4, '7432': 5, '7486': 6 };

/** Ausgang eines intakten Gatters */
export function gate(type: IcType, a: number, b: number): number {
  switch (type) {
    case '7400': return (a & b) ^ 1;
    case '7408': return a & b;
    case '7432': return a | b;
    case '7486': return a ^ b;
  }
}

/** Defektes Gatter: Ausgang hängt fest auf `stuck` */
export interface IcDefect { gate: number; stuck: 0 | 1 }

/** Die Wechsel-Taste schaltet reihum diese ICs durch (kein, ein, zwei, drei, vier defekte Gatter) */
export const IC_VARIANTS: readonly (readonly IcDefect[])[] = [
  [],
  [{ gate: 0, stuck: 0 }],
  [{ gate: 2, stuck: 1 }],
  [{ gate: 1, stuck: 0 }, { gate: 3, stuck: 1 }],
  [{ gate: 0, stuck: 1 }, { gate: 1, stuck: 0 }, { gate: 2, stuck: 0 }],
  [{ gate: 0, stuck: 0 }, { gate: 1, stuck: 1 }, { gate: 2, stuck: 0 }, { gate: 3, stuck: 1 }],
];

/**
 * Port oben: D0 = A, D1 = B (Ausgänge, an allen vier Gattern), D2–D5 = Y1–Y4 (Eingänge),
 *            D6 = Er1, D7 = Er2 (Ausgänge: Fehleranzeige Gatter 1/2).
 * Port unten: D0 = Er3, D1 = Er4, D2 = OK (Ausgänge), D3–D6 = IC-Tasten NAND/AND/OR/EXOR (Eingänge,
 *            gewählte Taste = 0), D7 = Start (Eingang, gedrückt = 0).
 */
export class IcTester {
  type: IcType = '7400';
  variant = 0;
  start = false;

  get defects(): readonly IcDefect[] { return IC_VARIANTS[this.variant] ?? []; }
  isDefective(g: number): boolean { return this.defects.some((d) => d.gate === g); }
  nextIc() { this.variant = (this.variant + 1) % IC_VARIANTS.length; }

  /** Ausgang des Gatters g (0–3) */
  gateOut(g: number, a: number, b: number): number {
    const d = this.defects.find((x) => x.gate === g);
    return d ? d.stuck : gate(this.type, a, b);
  }
  /** Ausgangsmaske Y1–Y4 (Bit 0 = Y1) */
  outputs(a: number, b: number): number {
    let y = 0;
    for (let g = 0; g < 4; g++) y |= this.gateOut(g, a, b) << g;
    return y;
  }

  /** Externe Pegel (0 = zieht herunter) für Port oben bei gegebenem Latch */
  drivePortA(latch: number): number {
    return 0xc3 | (this.outputs(latch & 1, (latch >> 1) & 1) << 2);
  }
  /** Externe Pegel für Port unten: Tastencode an D3–D6 (nur die gewählte Taste = 0), Start an D7 */
  drivePortB(): number {
    return 0x07 | (0x78 & ~(1 << IC_KEY_BIT[this.type])) | (this.start ? 0 : 0x80);
  }
  drive(i: number, latch: number): number {
    return i === 0 ? this.drivePortA(latch) : this.drivePortB();
  }
}
