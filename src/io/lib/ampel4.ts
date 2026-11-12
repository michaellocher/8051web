/**
 * Ampel 4 (2-Port-Modell, Ansicht): Kreuzung, Hauptstraße von oben nach unten, Nebenstraße quer,
 * Fußgängerüberwege über beide Straßen, zwei Ruftasten und ein Tag-/Nacht-Schalter.
 */
import { Integrator, board, el, pushButton, rowY, setLit, toggleSwitch, trafficLight, wire, type DeviceDef } from '../kit.ts';
import { label } from './b2util.ts';
import { Ampel4, lampOn, type LampName } from './ampel4.logic.ts';

export const ampel4: DeviceDef = {
  id: 'ampel4',
  name: 'Ampel 4 (Kreuzung)',
  group: '2-Port-Modelle',
  ports: 2,
  width: 250,
  desc: 'Straßenkreuzung mit Ampeln für die Hauptstraße (von oben nach unten) und die Nebenstraße mit Fußgängerüberwegen, zwei Fußgänger-Ruftasten und Tag-/Nacht-Schalter. '
    + 'PORT-oben: D0 = Ruftaste-1, D1 = Ruftaste-2, D2 = Tag-/Nacht-Schalter (Ruftaste gedrückt = 0, Tag = 1), D3 = Hauptstraße Kfz rot, D4 = Hauptstraße Kfz gelb. '
    + 'PORT-unten: D0 = Hauptstraße Kfz grün, D1 = Fußgänger-Hauptstraße rot, D2 = Fußgänger-Hauptstraße grün, D3 = Nebenstraße Kfz rot, D4 = Nebenstraße Kfz gelb, '
    + 'D5 = Nebenstraße Kfz grün, D6 = Fußgänger-Nebenstraße rot, D7 = Fußgänger-Nebenstraße grün.',
  create(onInput) {
    const logic = new Ampel4();
    const svg = board(250, 2);
    // Anschlüsse: 0–2 Eingänge (Pfeil zum Port), 3–4 Ausgänge, unten 8 Ausgänge
    for (let i = 0; i < 5; i++) wire(svg, i, 40, i < 3);
    for (let i = 9; i < 17; i++) wire(svg, i, 40);
    const names = ['', '', '', 'H rot', 'H gelb'];
    const namesB = ['H grün', 'FH rot', 'FH grün', 'N rot', 'N gelb', 'N grün', 'FN rot', 'FN grün'];
    names.forEach((n, i) => { if (n) label(svg, 3, rowY(i) - 3, n); });
    namesB.forEach((n, i) => label(svg, 3, rowY(9 + i) - 3, n));
    pushButton(svg, 52, rowY(0) - 8, 64, 16, 'RUF-1', (d) => { logic.ruf1 = d; onInput(); });
    pushButton(svg, 52, rowY(1) - 8, 64, 16, 'RUF-2', (d) => { logic.ruf2 = d; onInput(); });
    toggleSwitch(svg, 52, rowY(2), 'T/N', () => logic.day, (v) => { logic.day = v; onInput(); });
    label(svg, 160, rowY(2) + 4, '1 = Tag', 'dev-tiny');

    // Szene: Hauptstraße senkrecht, Nebenstraße waagerecht
    const sx = 52, sy = 76, sw = 194, sh = 260;
    el('rect', { x: sx, y: sy, width: sw, height: sh, rx: 4, class: 'ampel-grass' }, svg);
    const mx = 150, my = 206, rw = 48; // Mitte der Kreuzung, Straßenbreite
    el('rect', { x: mx - rw / 2, y: sy, width: rw, height: sh, class: 'road' }, svg);
    el('rect', { x: sx, y: my - rw / 2, width: sw, height: rw, class: 'road' }, svg);
    for (let y = sy + 4; y < sy + sh; y += 16) if (Math.abs(y - my) > rw / 2 + 12) el('rect', { x: mx - 1, y, width: 2, height: 8, class: 'zebra' }, svg);
    for (let x = sx + 4; x < sx + sw; x += 16) if (Math.abs(x - mx) > rw / 2 + 2 && (x < mx + rw / 2 + 4 || x > mx + rw / 2 + 34)) el('rect', { x, y: my - 1, width: 8, height: 2, class: 'zebra' }, svg);
    // Fußgängerüberwege: über die Hauptstraße (Nordarm), über die Nebenstraße (Ostarm)
    for (let i = 0; i < 6; i++) {
      el('rect', { x: mx - rw / 2 + 2 + i * 7.6, y: my - rw / 2 - 26, width: 4.5, height: 14, class: 'zebra' }, svg);
      el('rect', { x: mx + rw / 2 + 12, y: my - rw / 2 + 2 + i * 7.6, width: 14, height: 4.5, class: 'zebra' }, svg);
    }
    // Ampeln
    const lamps: { el: SVGElement; name: LampName }[] = [];
    const light = (x: number, y: number, kind: 'kfz' | 'ped', set: readonly LampName[]) => {
      trafficLight(svg, x, y, kind === 'kfz' ? 3 : 2, 0.78).forEach((e, k) => lamps.push({ el: e, name: set[k]! }));
    };
    const mainKfz = ['mainR', 'mainY', 'mainG'] as const, sideKfz = ['sideR', 'sideY', 'sideG'] as const;
    light(104, 84, 'kfz', mainKfz); // Haupt, Nordzufahrt
    light(180, 244, 'kfz', mainKfz); // Haupt, Südzufahrt
    light(72, 128, 'kfz', sideKfz); // Neben, Westzufahrt
    light(222, 236, 'kfz', sideKfz); // Neben, Ostzufahrt
    light(106, 140, 'ped', ['pmR', 'pmG']); // Fußgänger über die Hauptstraße (beide Enden des Überwegs)
    light(178, 140, 'ped', ['pmR', 'pmG']);
    light(204, 146, 'ped', ['psR', 'psG']); // Fußgänger über die Nebenstraße
    light(204, 232, 'ped', ['psR', 'psG']);
    label(svg, sx + sw - 4, sy + 11, 'Hauptstraße', 'dev-tiny', 'end');
    label(svg, sx + 4, my + rw / 2 + 12, 'Nebenstraße', 'dev-tiny');

    const names2 = lamps.map((l) => l.name);
    let pins: readonly number[] = [];
    const integ = new Integrator(lamps.length);
    const on = (i: number) => lampOn(names2[i]!, pins);
    return {
      svg,
      drive: (i) => logic.drive(i),
      sample(p, c) { pins = p; integ.tick(c); for (let i = 0; i < lamps.length; i++) integ.add(i, on(i), c); },
      render() { integ.resolve(on).forEach((v, i) => setLit(lamps[i]!.el, v)); },
    };
  },
};
