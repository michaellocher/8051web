/** Ampel-1, Ampel-2 und Ampel-3 (Handbuch „Sonstige Modelle“). */
import { board, el, rowY, toggleSwitch, trafficLight, type DeviceDef } from '../kit.ts';
import { AMPEL1, AMPEL2, AMPEL3, Ampel3Logic, lampOn } from './ampel.logic.ts';
import { LampBank, label, pinRows, type Pin } from './b1-view.ts';

const dlabels = (n: number, input = new Set<number>()): Pin[] =>
  Array.from({ length: n }, (_, i): Pin => [i, `D${i}`, input.has(i)]);

/** Ampelkopf (Gehäuse + Lampen); `bits` = Pinbits der Lampen von oben nach unten. */
function head(svg: SVGSVGElement, x: number, y: number, bits: readonly number[], s = 0.8) {
  const lamps = trafficLight(svg, x, y, bits.length === 3 ? 3 : 2, s);
  return lamps.map((lamp, i) => ({ lamp, bit: bits[i]! }));
}

const traffic: DeviceDef = {
  id: 'traffic', name: 'Ampel-1', group: 'Ampeln', ports: 1, width: 190,
  desc: 'Straße mit Fußgängerüberweg. Alle Pins sind Ausgänge (1 = Lampe an): D0 = Kfz-Ampel grün, D1 = Kfz-Ampel gelb, D2 = Kfz-Ampel rot, '
    + 'D3 = Fußgängerampel grün, D4 = Fußgängerampel rot.',
  create() {
    const svg = board(190, 1);
    pinRows(svg, dlabels(5), 40);
    el('rect', { x: 46, y: 6, width: 138, height: 148, rx: 4, class: 'dm-grass' }, svg);
    el('rect', { x: 46, y: 62, width: 138, height: 52, class: 'road' }, svg);
    for (let i = 0; i < 7; i++) el('rect', { x: 92 + i * 9, y: 64, width: 5, height: 48, class: 'zebra' }, svg);
    // Kfz-Ampel (Reihenfolge der Lampen oben nach unten: rot, gelb, grün), Fußgängerampel (rot, grün)
    const car = head(svg, 62, 8, [AMPEL1.carRed, AMPEL1.carYellow, AMPEL1.carGreen], 0.95);
    const ped = head(svg, 150, 8, [AMPEL1.pedRed, AMPEL1.pedGreen], 0.95);
    label(svg, 73, 126, 'Kfz', 'dev-tiny', 'middle');
    label(svg, 161, 126, 'Fußg.', 'dev-tiny', 'middle');
    const all = [...car, ...ped];
    const bank = new LampBank(all.map((a) => a.lamp), (i, [p = 0]) => lampOn(p, all[i]!.bit));
    return { svg, drive: () => 0xff, sample: (p, c) => bank.sample(p, c), render: () => bank.render() };
  },
};

const crossing: DeviceDef = {
  id: 'crossing', name: 'Ampel-2', group: 'Ampeln', ports: 1, width: 200,
  desc: 'Straßenkreuzung mit Hauptstraße (von links nach rechts), Nebenstraße (von oben nach unten) und Fußgängerüberwegen. Alle Pins sind Ausgänge (1 = Lampe an): '
    + 'D0 = Nebenstraße Kfz rot, D1 = Nebenstraße gelb, D2 = Nebenstraße grün, D3 = Hauptstraße Kfz rot, D4 = Hauptstraße gelb, D5 = Hauptstraße grün, '
    + 'D6 = Fußgängerampel rot, D7 = Fußgängerampel grün.',
  create() {
    const svg = board(200, 1);
    pinRows(svg, dlabels(8), 40);
    el('rect', { x: 46, y: 4, width: 150, height: 152, rx: 4, class: 'dm-grass' }, svg);
    el('rect', { x: 46, y: 62, width: 150, height: 40, class: 'road' }, svg); // Hauptstraße
    el('rect', { x: 100, y: 4, width: 40, height: 152, class: 'road' }, svg); // Nebenstraße
    for (let i = 0; i < 4; i++) el('rect', { x: 102 + i * 9, y: 36, width: 5, height: 24, class: 'zebra' }, svg);
    for (let i = 0; i < 4; i++) el('rect', { x: 144 + 0 * i, y: 64 + i * 9, width: 24, height: 5, class: 'zebra' }, svg);
    label(svg, 50, 86, 'Hauptstr.', 'dm-roadtxt');
    label(svg, 120, 152, 'Neben', 'dm-roadtxt', 'middle');
    const S = AMPEL2;
    const lamps = [
      ...head(svg, 74, 6, [S.mainRed, S.mainYellow, S.mainGreen], 0.78), // Hauptstraße, von links kommend
      ...head(svg, 172, 106, [S.mainRed, S.mainYellow, S.mainGreen], 0.78), // Hauptstraße, von rechts kommend
      ...head(svg, 74, 106, [S.sideRed, S.sideYellow, S.sideGreen], 0.78), // Nebenstraße von unten
      ...head(svg, 172, 6, [S.sideRed, S.sideYellow, S.sideGreen], 0.78), // Nebenstraße von oben
      ...head(svg, 148, 34, [S.pedRed, S.pedGreen], 0.6),
    ];
    const bank = new LampBank(lamps.map((a) => a.lamp), (i, [p = 0]) => lampOn(p, lamps[i]!.bit));
    return { svg, drive: () => 0xff, sample: (p, c) => bank.sample(p, c), render: () => bank.render() };
  },
};

const ampel3: DeviceDef = {
  id: 'ampel3', name: 'Ampel-3', group: 'Ampeln', ports: 1, width: 290,
  desc: 'Straßenkreuzung mit Haupt- und Nebenstraße; die Bedarfsmeldung erfolgt über in die Nebenstraße eingelassene Induktionsschleifen. '
    + 'Ausgänge (1 = Lampe an): D0 = Nebenstraße Kfz rot, D1 = Hauptstraße grün, D2 = Nebenstraße gelb, D3 = Hauptstraße gelb, D4 = Nebenstraße grün, D5 = Hauptstraße rot. '
    + 'Eingänge: D6 = Induktionsschleife 1, D7 = Induktionsschleife 2 (Schalter der Nebenstraße, 1 = Fahrzeug auf der Schleife).',
  create(onInput) {
    const logic = new Ampel3Logic();
    const svg = board(290, 1);
    const X = 80;
    pinRows(svg, dlabels(8, new Set([6, 7])), 40);
    el('rect', { x: X + 46, y: 4, width: 160, height: 152, rx: 4, class: 'dm-grass' }, svg);
    el('rect', { x: X + 46, y: 58, width: 160, height: 44, class: 'road' }, svg); // Hauptstraße
    el('rect', { x: X + 100, y: 4, width: 44, height: 152, class: 'road' }, svg); // Nebenstraße
    const loops = [0, 1].map((k) => {
      const r = el('rect', { x: X + 106 + k * 18, y: 112, width: 14, height: 30, rx: 2, class: 'dm-loop' }, svg);
      label(svg, X + 113 + k * 18, 150, String(k + 1), 'dev-tiny', 'middle');
      return r;
    });
    const S = AMPEL3;
    const lamps = [
      ...head(svg, X + 54, 8, [S.mainRed, S.mainYellow, S.mainGreen], 0.78), // Hauptstraße von links
      ...head(svg, X + 180, 106, [S.mainRed, S.mainYellow, S.mainGreen], 0.78), // Hauptstraße von rechts
      ...head(svg, X + 148, 8, [S.sideRed, S.sideYellow, S.sideGreen], 0.78), // Nebenstraße von oben
      ...head(svg, X + 76, 106, [S.sideRed, S.sideYellow, S.sideGreen], 0.78), // Nebenstraße von unten
    ];
    const bank = new LampBank(lamps.map((a) => a.lamp), (i, [p = 0]) => lampOn(p, lamps[i]!.bit));
    // Schalter der Induktionsschleifen (Eingänge D6/D7)
    const refresh = [0, 1].map((k) => toggleSwitch(svg, 46, rowY(6 + k), `S${k + 1}`, () => logic.loop[k]!, (v) => { logic.loop[k] = v; onInput(); }));
    return {
      svg,
      drive: () => logic.drive(),
      sample: (p, c) => bank.sample(p, c),
      render() {
        bank.render();
        loops.forEach((r, k) => r.classList.toggle('on', logic.loop[k]!));
        refresh.forEach((f) => f());
      },
    };
  },
};

export const AMPEL_DEVICES: readonly DeviceDef[] = [traffic, crossing, ampel3];
