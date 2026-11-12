import type { ExternalModelDef } from '../frame.ts';
import { Sort1Logic } from './sort1.logic.ts';
import { SORT1_CFG } from './sort1.logic.ts';
import { sortView } from './sortbase.view.ts';

export const sort1: ExternalModelDef = {
  id: 'ext-sort1',
  name: 'Einfache Sortieranlage',
  group: 'Modellpaket 1',
  desc: 'Kleine und große Teile laufen auf dem Band an drei Lichtschranken vorbei. Der Zylinder Z1 soll die kleinen Teile auf das Seitenband schieben, große laufen bis zum Bandende.',
  ax: ['Z1 Zylinder ausfahren (kleine Teile ausschieben)', '', '', '', '', '', '', ''],
  ex: ['S1 Lichtschranke 1 (1 = unterbrochen)', 'S2 Lichtschranke 2', 'S3 Lichtschranke 3', '', '', '', '', ''],
  width: 720,
  height: 460,
  createLogic: () => new Sort1Logic(),
  createView: () => sortView(SORT1_CFG),
};
