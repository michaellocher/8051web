/** Handbuch-Gruppen „Schalter, Tasten …" und „LED, Anzeigen …" (1-Port). */
import { BASIC_DEVICES } from '../devices.ts';
import type { DeviceDef } from '../kit.ts';
import { COLOR_DEVICES } from './color.ts';
import { DISPLAY1_DEVICES } from './display1.ts';
import { GRAY_DEVICES } from './gray.ts';
import { KEYBOARD_DEVICES } from './keyboard.ts';
import { KEYPAD_DEVICES } from './keypad.ts';

export const INPUT_DISPLAY_DEVICES: readonly DeviceDef[] = [
  ...BASIC_DEVICES, ...GRAY_DEVICES, ...COLOR_DEVICES, ...DISPLAY1_DEVICES, ...KEYPAD_DEVICES, ...KEYBOARD_DEVICES,
];
