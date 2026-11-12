; @title Spielwiese (externes Modell)
; @desc Schalter S01–S04 steuern die Lampen H01–H04, die Taster T01–T04 die Motoren M01/M02 und Ventile V01/V02. Das Modellfenster öffnet sich automatisch.
; @group Externe Modelle
; @mode int
; @io P0=ext-spiel
;
; P0 → Ax:  .0–.3 H01–H04 Lampen   .4 M01   .5 M02   .6 V01   .7 V02
; Ex → P1:  .0–.3 S01–S04 Schalter   .4–.7 T01–T04 Taster
;
; Die Belegung ist so gewählt, dass jeder Eingang direkt zum gleichnamigen Ausgang gehört:
; Schalter i → Lampe i, Taster i → Motor/Ventil i.

        ORG   0
        MOV   P1,#0FFh        ; P1 als Eingang
loop:   MOV   A,P1            ; alle acht Eingänge lesen
        MOV   P0,A            ; und 1:1 auf die Ausgänge geben
        SJMP  loop
        END
