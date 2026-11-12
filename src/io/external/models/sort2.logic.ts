/**
 * Sortieranlage: Drei Teilegrößen (klein 20 px, mittel 40 px, groß 80 px) laufen an vier Lichtschranken
 * (25 px Abstand) vorbei. Kleine Teile gehören in Behälter 1 (Zylinder Z1 bei 400 px), mittlere in Behälter 2
 * (Zylinder Z2 bei 560 px), große laufen bis zum Bandende. Ein kleines Teil unterbricht nie zwei Strahlen
 * gleichzeitig, ein mittleres zwei, aber nie S1 und S4, ein großes zeitweise S1 und S4 zugleich.
 *
 * Ax.0 Z1 Zylinder ausfahren (kleine Teile)      Ex.0 S1 Lichtschranke 1 (1 = unterbrochen)
 * Ax.1 Z2 Zylinder ausfahren (mittlere Teile)    Ex.1 S2 Lichtschranke 2
 *                                                 Ex.2 S3 Lichtschranke 3
 *                                                 Ex.3 S4 Lichtschranke 4
 * Teile werden alle 8 s automatisch aufgelegt (oder per Schaltfläche).
 */
import { SortPlant, type SortCfg } from './sortbase.logic.ts';

export const SORT2_CFG: SortCfg = {
  barriers: 4,
  kinds: ['small', 'medium', 'large'],
  pushers: [{ x: 400, bin: 'z1', wants: 'small' }, { x: 560, bin: 'z2', wants: 'medium' }],
  endWants: 'large',
  feedEvery: 8,
  auto: true,
};

export class Sort2Logic extends SortPlant {
  constructor(auto = true) { super({ ...SORT2_CFG, auto }); }
}
