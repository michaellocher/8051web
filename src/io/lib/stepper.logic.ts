/** Schrittmotor (unipolar, 4 Spulen D0–D3) nach Handbuch + Schiebeschalter an D7 (reine Logik, kein DOM). */
import { highIf, type PortLogic } from './b1-common.ts';

/** Halbschritt-Tabelle (D3 D2 D1 D0 als Hexziffer): Rechtslauf = aufsteigender Index, jeder zweite Eintrag ist ein Vollschritt. */
export const HALF_STEP_TABLE = [0xa, 0x2, 0x6, 0x4, 0x5, 0x1, 0x9, 0x8] as const;
/** Vollschritt-Tabelle Rechtslauf (Linkslauf: rückwärts) */
export const FULL_STEP_TABLE = [0xa, 0x6, 0x5, 0x9] as const;

/** Index (0–7) des Zustands in der Halbschritt-Tabelle; -1 = undefinierter Zustand */
export const stepIndex = (nibble: number): number => HALF_STEP_TABLE.indexOf((nibble & 0xf) as (typeof HALF_STEP_TABLE)[number]);

export class StepperLogic implements PortLogic {
  /** Rotorstellung in Halbschritten (fortlaufend, + = Rechtslauf); undefined = noch kein gültiger Zustand */
  pos: number | undefined;
  /** Aktueller Zustand ist undefiniert („?“ im Rotor) */
  undefinedState = false;
  coils = 0;
  slider = false;
  /** Zahl der ausgeführten Halbschritte (mit Vorzeichen) seit Programmstart */
  net = 0;
  setPins([p = 0xff]: readonly number[]) {
    this.coils = p & 0x0f;
    const idx = stepIndex(this.coils);
    if (idx < 0) { this.undefinedState = true; return; }
    this.undefinedState = false;
    if (this.pos === undefined) { this.pos = idx; return; }
    const cur = ((this.pos % 8) + 8) % 8;
    let d = idx - cur;
    if (d > 4) d -= 8;
    if (d < -3) d += 8;
    this.pos += d;
    this.net += d;
  }
  /**
   * Rotorwinkel in Grad (im Uhrzeigersinn, 0° = Nordpol oben, 45° je Halbschritt). Die Spulen liegen im Uhrzeigersinn
   * D3 (oben), D1 (rechts), D2 (unten), D0 (links): Zustand 8h (nur D3) = 0°, 2h (nur D1) = 90° usw.
   */
  get angle() { return ((this.pos ?? 0) + 1) * 45; }
  drive() { return highIf([7, this.slider]); }
  step() {}
}
