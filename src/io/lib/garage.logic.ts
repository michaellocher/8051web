/** Garagentor nach Handbuch (reine Logik, kein DOM). */
import { bit, clamp, highIf, type PortLogic } from './b1-common.ts';
import { motorDir } from './lift.logic.ts';

/**
 * D0 Fernbedienungstaste (Eingang, 1 = gedrückt), D1 Endschalter unten, D2 Endschalter oben (Eingänge, 1 = betätigt),
 * D3/D4 Tormotor (10 hoch, 01 runter, 00/11 aus). Wird ein Endschalter überfahren, ertönt ein Warnton.
 */
export class GarageLogic implements PortLogic {
  /** 0 = Tor ganz unten (zu), 1 = ganz oben (offen) */
  door = 0;
  /** Fahrzeit über den ganzen Weg in s */
  readonly travel = 5;
  /** Endschalter schalten in diesem Abstand vor dem mechanischen Anschlag … */
  readonly switchZone = 0.04;
  /** … und gelten als überfahren, wenn der Motor das Tor noch weiter in den Anschlag treibt */
  readonly overrunZone = 0.02;
  key = false;
  m1 = false;
  m2 = false;
  get dir() { return motorDir(this.m1, this.m2); }
  get endBottom() { return this.door <= this.switchZone; }
  get endTop() { return this.door >= 1 - this.switchZone; }
  /** Warnton: Der Motor treibt das Tor über den Endschalter hinaus */
  get beep() {
    return (this.dir < 0 && this.door < this.overrunZone) || (this.dir > 0 && this.door > 1 - this.overrunZone);
  }
  setPins([p = 0xff]: readonly number[]) { this.m1 = bit(p, 3); this.m2 = bit(p, 4); }
  drive() { return highIf([0, this.key], [1, this.endBottom], [2, this.endTop]); }
  step(dt: number) { this.door = clamp(this.door + (this.dir * dt) / this.travel, 0, 1); }
}
