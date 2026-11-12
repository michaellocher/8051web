/** Externe Modelle – Modellpaket 2, Teil 3. */
import type { ExternalModelDef } from './frame.ts';
import { reaktion } from './models/reaktion.view.ts';
import { biege } from './models/biege.view.ts';
import { fall } from './models/fall.view.ts';
import { hebe } from './models/hebe.view.ts';
import { bohr2 } from './models/bohr2.view.ts';
import { reakgef } from './models/reakgef.view.ts';
import { abfuell } from './models/abfuell.view.ts';
import { sieben } from './models/sieben.view.ts';

export const PACK4_MODELS: readonly ExternalModelDef[] = [reaktion, biege, fall, hebe, bohr2, reakgef, abfuell, sieben];
