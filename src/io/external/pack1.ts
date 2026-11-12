/** Externe Modelle – Modellpaket 1. */
import type { ExternalModelDef } from './frame.ts';
import { foerder } from './models/foerder.view.ts';
import { gener } from './models/gener.view.ts';
import { lueft } from './models/lueft.view.ts';
import { mfs } from './models/mfs.view.ts';
import { misch } from './models/misch.view.ts';
import { motgrp } from './models/motgrp.view.ts';
import { schwest } from './models/schwest.view.ts';
import { silo } from './models/silo.view.ts';
import { sort1 } from './models/sort1.view.ts';
import { sort2 } from './models/sort2.view.ts';
import { spiel } from './models/spiel.view.ts';

export const PACK1_MODELS: readonly ExternalModelDef[] = [spiel, gener, mfs, motgrp, lueft, misch, sort1, sort2, silo, foerder, schwest];
