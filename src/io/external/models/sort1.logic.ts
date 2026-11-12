/**
 * Einfache Sortieranlage: Kleine und große Teile laufen auf einem Band an drei Lichtschranken vorbei.
 * Kleine Teile (20 px lang) sollen vom Zylinder Z1 auf das Seitenband geschoben werden, große Teile
 * (60 px) laufen bis zum Bandende. Die Lichtschranken stehen 25 px auseinander: Ein kleines Teil
 * unterbricht nie zwei Strahlen gleichzeitig, ein großes immer mindestens zwei.
 *
 * Ax.0 Z1 Zylinder ausfahren (Teil ausschieben, bei 500 px)     Ex.0 S1 Lichtschranke 1 (1 = unterbrochen)
 *                                                                 Ex.1 S2 Lichtschranke 2
 *                                                                 Ex.2 S3 Lichtschranke 3
 * Teile werden alle 8 s automatisch aufgelegt (oder per Schaltfläche).
 */
import { SortPlant, type SortCfg } from './sortbase.logic.ts';

export const SORT1_CFG: SortCfg = {
  barriers: 3,
  kinds: ['small', 'large'],
  pushers: [{ x: 500, bin: 'z1', wants: 'small' }],
  endWants: 'large',
  feedEvery: 8,
  auto: true,
};

export class Sort1Logic extends SortPlant {
  constructor(auto = true) { super({ ...SORT1_CFG, auto }); }
}
