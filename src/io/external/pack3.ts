/** Externe Modelle – Modellpaket 2, Teil 2. */
import type { ExternalModelDef } from './frame.ts';
import { pumpe } from './models/pumpe.view.ts';
import { mischer } from './models/mischer.view.ts';
import { drehrichtung } from './models/drehrichtung.view.ts';
import { absaug } from './models/absaug.view.ts';
import { rolltreppe } from './models/rolltreppe.view.ts';
import { waggon } from './models/waggon.view.ts';
import { foerder2 } from './models/foerder2.view.ts';
import { foerder3 } from './models/foerder3.view.ts';
import { farbe } from './models/farbe.view.ts';

export const PACK3_MODELS: readonly ExternalModelDef[] = [pumpe, mischer, drehrichtung, absaug, rolltreppe, waggon, foerder2, foerder3, farbe];
