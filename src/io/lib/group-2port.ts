/** Handbuch-Gruppe „2-Port-Modelle". */
import type { DeviceDef } from '../kit.ts';
import { ampel4 } from './ampel4.ts';
import { DISP2P_DEVICES } from './disp2p.ts';
import { IC_DEVICES } from './ictester.ts';
import { LIFT_DEVICES } from './speiseaufzug.ts';
import { TONE_DEVICES } from './tongeber.ts';

export const TWO_PORT_DEVICES: readonly DeviceDef[] = [
  ...DISP2P_DEVICES, ampel4, ...TONE_DEVICES, ...IC_DEVICES, ...LIFT_DEVICES,
];
