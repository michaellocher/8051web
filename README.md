# 8051webXL

Browser-Neuauflage des Schul-Simulators **8051winXL** (SimSoft): 8051-Mikrocontroller simulieren, Befehle zyklusweise verfolgen, I/O-Geräte und Anlagenmodelle anschließen – mit der Oberfläche und Logik des Originals, aufgefrischt für 2027.

Grundlage für Funktionsumfang, Pinbelegungen und Befehlssatz ist das Original-Handbuch (CHM-Hilfe aus dem 8051winXL-Setup) und die Datei „Modell-Rechner-Befehlssatz.doc“.

## Start

```sh
npm install
npm run dev        # Vite-Dev-Server auf http://localhost:4321
npm test           # Tests (node --test, natives TypeScript in Node 26)
npm run typecheck
npm run build      # Typecheck + statische Seite in dist/
npm run preview    # gebaute Seite ansehen
```

Ein Server ist nicht nötig: Der Simulator läuft komplett im Browser. `dist/` lässt sich auf jedem Static-Host ausliefern (relative Pfade).
Direktlinks auf Beispiele: `?example=01-lauflicht`.

Live: https://michaellocher.github.io/8051web/ – jeder Push auf `main` baut und veröffentlicht die Seite über GitHub Pages (`.github/workflows/pages.yml`).

## Funktionen

- **Drei Oberflächen** wie im Original: int. ROM/RAM, ext. ROM/RAM (Adress-Latch, P0/P2 als Bus) und Modell-Rechner mit Bussystem und dem reduzierten Original-Befehlssatz (62 Befehlsformen).
- **Vier Simulationsarten:** Zyklusmodus „Befehl holen“ mit animiertem Datentransport, Einzelschritt, RUN, Turbo-Run (Echtzeit).
- **8051-Kern:** alle 255 Befehle, Timer 0/1 (Mode 0–3), 5 Interruptquellen mit 2 Prioritäten, UART, quasi-bidirektionale Ports P0–P5 (REG/PIN).
- **Werkzeugleiste des Originals:** Laden, AutoLade, Optionen (Oberfläche, Sprung über C-Head, Stop nach jeder Animation, Geschwindigkeit), Datei ver-/entschlüsseln (Lehrer-/Schülermodus, AES-256-GCM), Codepasswort, ASM-Datei anzeigen, Download ins Zielsystem (Web Serial), Bildschirm drucken/kopieren, Fenster ordnen.
- **Weitere Originalfunktionen:** bis zu 50 Haltepunkte, Speicherfenster für int. RAM/SFR mit Namensansicht, Interrupt-RESET, Gerätebelegung je Programm.
- **Bauteilebibliothek** nach Handbuch: Schalter, Tasten, HEX-/Matrix-Tastatur, Farben-Tasten, GRAY-Geber/-Aktor, LEDs, 7-Segment-Varianten, ICM7212, NSOW, LCD (HD44780), Ampel 1–4, Würfel 1–3, Aufzug 1/2, Garage, Parkhaus, Schrittmotor, Behälter, Prozess, XY-Plotter, Codelineal, 16 LEDs, Punktmatrix, Tongeber, Keyboard, IC-Tester, Speiseaufzug.
- **40 externe Anlagenmodelle** (Modellpaket 1 und 2) an P0 (Ax) / P1 (Ex) mit eigenem Modellfenster – eigene Zeichnungen, Funktion nach den Szenarien des Originals.
- **Ergänzungen der Web-Ausgabe:** eingebauter Assembler mit Editor, über 80 Beispielprogramme mit Lösungen, serielles Terminal, Hell/Dunkel, Direktlinks.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Markup aller Panels und Dialoge |
| `src/core/` | DOM-freier Kern: CPU, Opcode-Tabelle mit deutschen Beschreibungen, Disassembler, Assembler, Intel-HEX, Passwortschutz |
| `src/io/` | Bauteilebibliothek (`lib/`, gegliedert nach den Handbuch-Gruppen) und externe Modelle (`external/`); Logik jeweils in `*.logic.ts` |
| `src/ui/` | Oberflächensteuerung, Code-/Speicheransichten, Fenster, Datentransport-Animation |
| `src/examples/` | Beispielprogramme; Kopfzeilen `; @mode`, `; @io P1=leds` stellen Oberfläche und Geräte ein |
| `tests/` | `node --test`-Suite |

## Offene Punkte

- Der Atmel-Sondermodus „89C51x“ des Upload-Dialogs ist nicht umgesetzt.
- Wo das Handbuch schweigt (z. B. aktive Pegel einzelner Eingänge, Laufzeiten, Grenzwerte), steht die gewählte Annahme in der Gerätebeschreibung.
- Lizenz-Anmeldung des Originals entfällt; der Lehrer-/Schülermodus wird über das Codepasswort je Datei abgebildet.
