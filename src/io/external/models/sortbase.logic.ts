/**
 * Gemeinsame Logik der Sortieranlagen: Ein Band fördert Teile unterschiedlicher Länge an einer
 * Reihe von Lichtschranken vorbei. Druckzylinder (Ausfahren = Ax-Bit 1) schieben Teile vom Band auf
 * ein Seitenband in den jeweiligen Behälter; nicht ausgeschobene Teile fallen am Bandende in den Endbehälter.
 * Die Teile werden vom Modell selbst aufgelegt (automatisch alle `feedEvery` s oder per Eingabe).
 * Lichtschranke Ex-Bit = 1 → Strahl unterbrochen.
 */
import { Cylinder, bit, pack, springValve, type ModelLogic } from '../logic.ts';
import { Rng } from './p1.util.ts';

export type Kind = 'small' | 'medium' | 'large';
export type Bin = 'z1' | 'z2' | 'end';

/** Geometrie in Zeichnungseinheiten (px) */
export const BELT_SPEED = 90;
export const BARRIER_X0 = 120;
export const BARRIER_DX = 25;
export const BELT_END = 660;
export const PUSH_HALF = 12;
export const SIDE_TIME = 1.4;
export const KIND_LEN: Record<Kind, number> = { small: 20, medium: 40, large: 80 };
export const KIND_NAME: Record<Kind, string> = { small: 'klein', medium: 'mittel', large: 'groß' };

export interface Box {
  kind: Kind;
  /** linke (hintere) Kante auf dem Band */
  x: number;
  state: 'belt' | 'side' | 'done';
  bin: Bin;
  /** Fortschritt auf dem Seitenband 0..1 */
  prog: number;
}

export interface SortCfg {
  barriers: number;
  kinds: readonly Kind[];
  /** Position der Druckzylinder, Ziel-Behälter und das Teil, das dort hingehört */
  pushers: readonly { x: number; bin: Bin; wants: Kind }[];
  endWants: Kind;
  feedEvery: number;
  auto: boolean;
}

export class SortPlant implements ModelLogic {
  readonly cfg: SortCfg;
  readonly cyl: Cylinder[];
  boxes: Box[] = [];
  bins: Record<Bin, Record<Kind, number>> = SortPlant.emptyBins();
  wrong = 0;
  ax = 0;
  status = '';
  #rng = new Rng(7);
  #timer = 0.5;

  constructor(cfg: SortCfg) {
    this.cfg = cfg;
    this.cyl = cfg.pushers.map(() => new Cylinder(3));
  }

  static emptyBins(): Record<Bin, Record<Kind, number>> {
    const k = () => ({ small: 0, medium: 0, large: 0 });
    return { z1: k(), z2: k(), end: k() };
  }

  get ex() {
    const onBelt = this.boxes.filter((b) => b.state === 'belt');
    return pack(Array.from({ length: this.cfg.barriers }, (_, i) => {
      const bx = BARRIER_X0 + i * BARRIER_DX;
      return onBelt.some((b) => b.x <= bx && bx <= b.x + KIND_LEN[b.kind]);
    }));
  }

  /** Legt ein Teil auf, falls der Bandanfang frei ist */
  feed(kind: Kind): boolean {
    if (this.boxes.some((b) => b.state === 'belt' && b.x < 10)) return false;
    this.boxes.push({ kind, x: -KIND_LEN[kind], state: 'belt', bin: 'end', prog: 0 });
    return true;
  }

  step(ax: number, dt: number) {
    this.ax = ax;
    this.cyl.forEach((c, i) => c.move(springValve(bit(ax, i)), dt));
    if (this.cfg.auto) {
      this.#timer -= dt;
      if (this.#timer <= 0 && this.feed(this.#rng.pick(this.cfg.kinds))) this.#timer = this.cfg.feedEvery;
    }
    for (const b of this.boxes) {
      if (b.state === 'belt') {
        b.x += BELT_SPEED * dt;
        const len = KIND_LEN[b.kind];
        this.cfg.pushers.forEach((p, i) => {
          if (b.state !== 'belt' || this.cyl[i]!.pos <= 0.3) return;
          if (b.x + len >= p.x - PUSH_HALF && b.x <= p.x + PUSH_HALF) { b.state = 'side'; b.bin = p.bin; b.x = p.x - len / 2; b.prog = 0; }
        });
        if (b.state === 'belt' && b.x >= BELT_END) this.land(b, 'end');
      } else if (b.state === 'side') {
        b.prog += dt / SIDE_TIME;
        if (b.prog >= 1) this.land(b, b.bin);
      }
    }
    this.boxes = this.boxes.filter((b) => b.state !== 'done');
  }

  private land(b: Box, bin: Bin) {
    b.state = 'done'; b.bin = bin;
    this.bins[bin][b.kind]++;
    const wants = bin === 'end' ? this.cfg.endWants : this.cfg.pushers.find((p) => p.bin === bin)?.wants;
    if (wants === b.kind) this.status = `Teil „${KIND_NAME[b.kind]}“ richtig sortiert.`;
    else { this.wrong++; this.status = `Falsch sortiert: Teil „${KIND_NAME[b.kind]}“ im Behälter ${bin === 'end' ? 'Bandende' : bin.toUpperCase()}!`; }
  }

  input(name: string, down: boolean) {
    const m = /^feed-(small|medium|large)$/.exec(name);
    if (m && down && !this.feed(m[1] as Kind)) this.status = 'Bandanfang ist belegt.';
  }

  /** Anzahl sortierter Teile je Behälter */
  count(bin: Bin, kind?: Kind) {
    const r = this.bins[bin];
    return kind ? r[kind] : r.small + r.medium + r.large;
  }

  reset() {
    this.boxes = []; this.bins = SortPlant.emptyBins(); this.wrong = 0; this.status = ''; this.ax = 0;
    this.cyl.forEach((c) => { c.pos = 0; }); this.#timer = 0.5; this.#rng = new Rng(7);
  }
}
