/** Behälter mit Füll- und Ablassventil und drei Füllstandssensoren nach Handbuch (reine Logik, kein DOM). */
import { bit, clamp, highIf, type PortLogic } from './b1-common.ts';

/**
 * D0 Ventil-1 (Füllen), D1 Ventil-2 (Leeren) – Ausgänge; D2 Sensor-A (unten), D3 Sensor-B, D4 Sensor-C (oben)
 * – Eingänge (1 = Flüssigkeit am Sensor).
 */
export class TankLogic implements PortLogic {
  readonly capacity = 100; // l
  readonly inflow = 10; // l/s
  readonly outflow = 10; // l/s
  /** Sensorhöhen in Litern */
  readonly thresholds = { A: 15, B: 50, C: 85 } as const;
  level: number;
  v1 = false;
  v2 = false;
  constructor(level = 0) { this.level = level; }
  sensor(k: 'A' | 'B' | 'C') { return this.level >= this.thresholds[k]; }
  setPins([p = 0xff]: readonly number[]) { this.v1 = bit(p, 0); this.v2 = bit(p, 1); }
  drive() { return highIf([2, this.sensor('A')], [3, this.sensor('B')], [4, this.sensor('C')]); }
  step(dt: number) {
    this.level = clamp(this.level + ((this.v1 ? this.inflow : 0) - (this.v2 ? this.outflow : 0)) * dt, 0, this.capacity);
  }
}
