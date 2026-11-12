/** Alle externen Modelle (Modellpaket 1 und 2). */
import { externalDevice, type ExternalModelDef } from './frame.ts';
import { bohr } from './models/bohr.view.ts';
import { PACK1_MODELS } from './pack1.ts';
import { PACK2_MODELS } from './pack2.ts';
import { PACK3_MODELS } from './pack3.ts';
import { PACK4_MODELS } from './pack4.ts';

export const EXTERNAL_MODELS: readonly ExternalModelDef[] = [bohr, ...PACK1_MODELS, ...PACK2_MODELS, ...PACK3_MODELS, ...PACK4_MODELS];
export const EXTERNAL_DEVICES = EXTERNAL_MODELS.map(externalDevice);
