/** GRAY-Geber und GRAY-Aktor (reine Logik, kein DOM). */

export const GRAY_STEPS = 16;
export const STEP_DEG = 360 / GRAY_STEPS;

export const toGray = (n: number) => (n ^ (n >> 1)) & 0x0f;
export const fromGray = (g: number) => (g ^ (g >> 1) ^ (g >> 2) ^ (g >> 3)) & 0x0f;

const norm = (a: number) => ((a % 360) + 360) % 360;
/** Sektor (0–15) zu einem Winkel; Sektor p ist um p·22,5° zentriert (0 = oben, im Uhrzeigersinn) */
export const sectorOf = (deg: number): number => Math.floor((norm(deg) + STEP_DEG / 2) / STEP_DEG) % GRAY_STEPS;

/**
 * Winkelcodierer: Gray-Scheibe mit Zeiger. D0–D3 = Gray-Code der Zeigerposition, der äußerste Ring
 * liefert D0, der innerste D3; weiß = 1, schwarz = 0. D4–D7 sind nicht belegt (High).
 */
export class GraySensor {
  angle = 0;
  get position(): number { return sectorOf(this.angle); }
  get code(): number { return toGray(this.position); }
  /** Zeiger um `steps` Positionen weiterdrehen (positiv = im Uhrzeigersinn) und auf die Position einrasten */
  rotate(steps: number) { this.angle = norm(this.position * STEP_DEG + steps * STEP_DEG); }
  setAngle(deg: number) { this.angle = norm(deg); }
  pins(): number { return 0xf0 | this.code; }
}

/**
 * Motor mit Positionsmeldung: D0–D3 (Ausgänge) = Gray-Code der Zeigerposition,
 * D4 = 1 und D5 = 0: Rechtslauf, D4 = 0 und D5 = 1: Linkslauf, sonst Motor aus.
 */
export class GrayActuator {
  angle = 0;
  /** Drehgeschwindigkeit in Grad pro simulierter Sekunde */
  speed = 90;
  /** +1 Rechtslauf (im Uhrzeigersinn), −1 Linkslauf, 0 aus */
  direction: -1 | 0 | 1 = 0;
  get position(): number { return sectorOf(this.angle); }
  get code(): number { return toGray(this.position); }
  setPins(p: number) {
    const d4 = (p >> 4) & 1, d5 = (p >> 5) & 1;
    this.direction = d4 === 1 && d5 === 0 ? 1 : d4 === 0 && d5 === 1 ? -1 : 0;
  }
  /** Simulierte Zeit dt (Sekunden) voranschreiten */
  step(dt: number) { if (this.direction !== 0) this.angle = norm(this.angle + this.direction * this.speed * dt); }
  /** Pinzustand übernehmen und `cycles` Zyklen (1 µs je Zyklus) simulieren */
  advance(pins: number, cycles: number) { this.setPins(pins); this.step(cycles * 1e-6); }
  /** Pegel an den Portpins (D4–D7 zieht der Aktor nicht) */
  inputs(): number { return 0xf0 | this.code; }
}
