/** Ampel 4 (2-Port-Modell): Anschlussbelegung und Lampenzustände (reine Logik, kein DOM). */

/**
 * Port oben:  D0 Ruftaste-1, D1 Ruftaste-2, D2 Tag-/Nacht-Schalter (Eingänge, Ruftasten gedrückt = 0),
 *             D3 Hauptstraße Kfz rot, D4 Hauptstraße Kfz gelb (Ausgänge).
 * Port unten: D0 Hauptstraße Kfz grün, D1 Fußgänger-Hauptstraße rot, D2 Fußgänger-Hauptstraße grün,
 *             D3 Nebenstraße Kfz rot, D4 Nebenstraße Kfz gelb, D5 Nebenstraße Kfz grün,
 *             D6 Fußgänger-Nebenstraße rot, D7 Fußgänger-Nebenstraße grün.
 */
export type LampName = 'mainR' | 'mainY' | 'mainG' | 'pmR' | 'pmG' | 'sideR' | 'sideY' | 'sideG' | 'psR' | 'psG';
/** Lampe → [Port (0 = oben, 1 = unten), Bit] */
export const AMPEL4_LAMPS: Record<LampName, readonly [number, number]> = {
  mainR: [0, 3], mainY: [0, 4], mainG: [1, 0],
  pmR: [1, 1], pmG: [1, 2],
  sideR: [1, 3], sideY: [1, 4], sideG: [1, 5],
  psR: [1, 6], psG: [1, 7],
};
export const lampOn = (name: LampName, pins: readonly number[]): boolean => {
  const [port, bit] = AMPEL4_LAMPS[name];
  return (((pins[port] ?? 0) >> bit) & 1) === 1;
};

export class Ampel4 {
  ruf1 = false;
  ruf2 = false;
  /** true = Tag (D2 = 1) */
  day = true;
  /** Externe Pegel: Port oben D0–D2 (Ruftasten gedrückt = 0), Port unten wird nicht getrieben */
  drive(i: number): number {
    return i === 0 ? 0xf8 | (this.ruf1 ? 0 : 1) | (this.ruf2 ? 0 : 2) | (this.day ? 4 : 0) : 0xff;
  }
}
