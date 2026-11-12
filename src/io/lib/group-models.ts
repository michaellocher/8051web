/** Handbuch-Gruppe „Sonstige Modelle“ (1-Port): Ampeln, Würfel, Aufzüge, Garage, Parkhaus, Schrittmotor, Behälter, Prozess, xy-Plotter, Codelineal. */
import type { DeviceDef } from '../kit.ts';
import { AMPEL_DEVICES } from './ampel.ts';
import { aufzug1, aufzug2 } from './aufzug.ts';
import { behaelter } from './behaelter.ts';
import { codelineal } from './codelineal.ts';
import { DICE_DEVICES } from './dice.ts';
import { garage } from './garage.ts';
import { parkhaus } from './parkhaus.ts';
import { plotter } from './plotter.ts';
import { prozess } from './prozess.ts';
import { stepper } from './stepper.ts';

export const OTHER_MODEL_DEVICES: readonly DeviceDef[] = [
  ...AMPEL_DEVICES, ...DICE_DEVICES, aufzug1, aufzug2, garage, parkhaus, stepper, behaelter, prozess, plotter, codelineal,
];
