/** Schalter, Segmentanzeigen und Dekoder der Grundgeräte (reine Logik, kein DOM). */

/** Segmentmuster a–g (Bit 0 = a … Bit 6 = g) der Hex-Ziffern 0–F */
export const HEX7 = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71] as const;

/** BCD-/Hex-Dekoder: 4-Bit-Wert → Segmentmaske (a–g). Werte über 9 werden als A–F dargestellt. */
export const decodeSegments = (v: number): number => HEX7[v & 0x0f]!;

/** Bank aus Schiebeschaltern: Bit = 1 offen (High), 0 zieht den Pin auf Masse. */
export class SwitchBank {
  state: number;
  /** Bits, die Schalter sind (übrige Bits werden nie gezogen) */
  readonly mask: number;
  constructor(mask: number, initial = 0xff) {
    this.mask = mask & 0xff;
    this.state = initial & 0xff;
  }
  get(i: number): boolean { return ((this.state >> i) & 1) === 1; }
  set(i: number, v: boolean) {
    if (((this.mask >> i) & 1) === 0) return;
    this.state = v ? this.state | (1 << i) : this.state & ~(1 << i);
  }
  toggle(i: number) { this.set(i, !this.get(i)); }
  /** Pegel, den die Schalter an den Port legen */
  pins(): number { return (this.state | ~this.mask) & 0xff; }
}

/** 7-Segment-Anzeige mit umschaltbarem aktiven Pegel (Handbuch: „0 - aktiv"). D0–D6 = a–g, D7 = DP. */
export class SevenSegment {
  /** Pegel, bei dem ein Segment leuchtet (Voreinstellung 0 = aktiv bei 0) */
  activeLevel: 0 | 1 = 0;
  /** Maske der leuchtenden Segmente (Bit 0 = a … Bit 6 = g, Bit 7 = DP) */
  lit(pins: number): number { return (this.activeLevel === 1 ? pins : ~pins) & 0xff; }
  toggleLevel() { this.activeLevel = this.activeLevel === 0 ? 1 : 0; }
}
