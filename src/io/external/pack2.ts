/** Externe Modelle – Modellpaket 2. */
import type { ExternalModelDef } from './frame.ts';
import { zweitank } from './models/zweitank.view.ts';
import { kreisel } from './models/kreisel.view.ts';
import { zweihand } from './models/zweihand.view.ts';
import { kompensation } from './models/kompensation.view.ts';
import { palettierer } from './models/palettierer.view.ts';
import { rollenbahn } from './models/rollenbahn.view.ts';
import { polierer } from './models/polierer.view.ts';
import { klebeduese } from './models/klebeduese.view.ts';
import { lauflicht } from './models/lauflicht.view.ts';
import { schiebetor } from './models/schiebetor.view.ts';
import { garagentor } from './models/garagentor.view.ts';

export const PACK2_MODELS: readonly ExternalModelDef[] = [zweitank, kreisel, zweihand, kompensation, palettierer, rollenbahn, polierer, klebeduese, lauflicht, schiebetor, garagentor];
