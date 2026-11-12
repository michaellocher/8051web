/** Ampeln 1–3 nach Handbuch: Pinbelegung und Eingänge (reine Logik, kein DOM). */
import { highIf, type PortLogic } from './b1-common.ts';

/** Ampel-1 (Fußgängerüberweg), alle Pins Ausgänge. */
export const AMPEL1 = { carGreen: 0, carYellow: 1, carRed: 2, pedGreen: 3, pedRed: 4 } as const;
/** Ampel-2 (Kreuzung mit Fußgängerüberwegen), alle Pins Ausgänge. */
export const AMPEL2 = {
  sideRed: 0, sideYellow: 1, sideGreen: 2, mainRed: 3, mainYellow: 4, mainGreen: 5, pedRed: 6, pedGreen: 7,
} as const;
/** Ampel-3 (Haupt-/Nebenstraße, Induktionsschleifen D6/D7 als Schalter). */
export const AMPEL3 = {
  sideRed: 0, mainGreen: 1, sideYellow: 2, mainYellow: 3, sideGreen: 4, mainRed: 5, loop1: 6, loop2: 7,
} as const;

export const lampOn = (pins: number, bit: number) => ((pins >> bit) & 1) === 1;

/** Ampel-3: Die beiden Induktionsschleifen sind Schalter (1 = Fahrzeug auf der Schleife). */
export class Ampel3Logic implements PortLogic {
  readonly loop = [false, false];
  setPins() {}
  drive() { return highIf([AMPEL3.loop1, this.loop[0]!], [AMPEL3.loop2, this.loop[1]!]); }
  step() {}
}
