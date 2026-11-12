/** Sammelt alle Geräte der Bauteilebibliothek (gegliedert wie im Handbuch des Originals). */
import { EXTERNAL_DEVICES } from './external/index.ts';
import type { DeviceDef } from './kit.ts';
import { TWO_PORT_DEVICES } from './lib/group-2port.ts';
import { INPUT_DISPLAY_DEVICES } from './lib/group-input.ts';
import { OTHER_MODEL_DEVICES } from './lib/group-models.ts';

export const DEVICES: readonly DeviceDef[] = [...INPUT_DISPLAY_DEVICES, ...OTHER_MODEL_DEVICES, ...TWO_PORT_DEVICES, ...EXTERNAL_DEVICES];
export const DEVICE_BY_ID: ReadonlyMap<string, DeviceDef> = new Map(DEVICES.map((d) => [d.id, d]));
