import type { ExternalModelDef } from '../frame.ts';
import { Sort2Logic, SORT2_CFG } from './sort2.logic.ts';
import { sortView } from './sortbase.view.ts';

export const sort2: ExternalModelDef = {
  id: 'ext-sort2',
  name: 'Sortieranlage',
  group: 'Modellpaket 1',
  desc: 'Drei Teilegrößen laufen an vier Lichtschranken vorbei: kleine Teile schiebt Z1 ab, mittlere Z2, große laufen bis zum Bandende.',
  ax: ['Z1 Zylinder ausfahren (kleine Teile)', 'Z2 Zylinder ausfahren (mittlere Teile)', '', '', '', '', '', ''],
  ex: ['S1 Lichtschranke 1 (1 = unterbrochen)', 'S2 Lichtschranke 2', 'S3 Lichtschranke 3', 'S4 Lichtschranke 4', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new Sort2Logic(),
  createView: () => sortView(SORT2_CFG),
};
