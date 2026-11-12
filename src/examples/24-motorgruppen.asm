; @title Motorgruppenüberwachung (externes Modell)
; @desc Zwei Gruppen mit je drei Motoren: Steht ein Motor, leuchtet die Störlampe der Gruppe, bis die Störung behoben und mit S0 quittiert ist.
; @group Externe Modelle
; @mode int
; @io P0=ext-motgrp
;
; P0 → Ax:  .0 H1 Störung Gruppe 1   .1 H2 Störung Gruppe 2
; Ex → P1:  .0–.2 Drehzahlwächter Gruppe 1 (1 = dreht)   .3–.5 Gruppe 2   .6 S0 Quittieren
;
; Eine Störmeldung wird gespeichert (die Lampe bleibt, auch wenn der Motor wieder läuft) und lässt
; sich nur löschen, wenn alle Motoren der Gruppe laufen und S0 gedrückt wird.

H1      BIT   P0.0
H2      BIT   P0.1
S0      BIT   P1.6

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
loop:   MOV   A,P1            ; --- Gruppe 1 (Ex.0–Ex.2)
        ANL   A,#07h
        CJNE  A,#07h,f1       ; nicht alle drei laufen → Störung
        JNB   S0,g2           ; alle laufen: Quittierung?
        CLR   H1
        SJMP  g2
f1:     SETB  H1
g2:     MOV   A,P1            ; --- Gruppe 2 (Ex.3–Ex.5)
        ANL   A,#38h
        CJNE  A,#38h,f2
        JNB   S0,loop
        CLR   H2
        SJMP  loop
f2:     SETB  H2
        SJMP  loop
        END
