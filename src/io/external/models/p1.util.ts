/** Kleine Hilfen für die Modelle des Modellpakets 1 (reine Logik, ohne DOM). */

/** Deterministischer Zufallsgenerator (LCG), damit Modelle und Tests reproduzierbar bleiben */
export class Rng {
  #s: number;
  constructor(seed = 1) { this.#s = (seed >>> 0) || 1; }
  next(): number {
    this.#s = (Math.imul(this.#s, 1664525) + 1013904223) >>> 0;
    return this.#s / 2 ** 32;
  }
  pick<T>(items: readonly T[]): T { return items[Math.floor(this.next() * items.length)]!; }
}

/** Bewegt v mit konstanter Rate auf target zu */
export const approach = (v: number, target: number, rate: number, dt: number) =>
  v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt);

/** Zeit-Akkumulator: zählt Sekunden, solange cond wahr ist, sonst 0 (für verzögerte Störmeldungen) */
export const hold = (acc: number, cond: boolean, dt: number) => (cond ? acc + dt : 0);
