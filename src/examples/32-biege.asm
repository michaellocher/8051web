; @title Biegevorrichtung (externes Modell)
; @desc START (S0): A spannt das Blech, B biegt den Rand nach unten, A und B fahren zurück, C wirft das Teil aus und fährt zurück. Mit „Neues Blech einlegen“ geht es weiter.
; @group Externe Modelle
; @mode int
; @io P0=ext-biege
;
; P0 → Ax:  .0 Y1 A aus  .1 Y2 A ein  .2 Y3 B aus  .3 Y4 B ein  .4 Y5 C aus  .5 Y6 C ein
; Ex → P1:  .0 S0 START  .1 S1 STOP  .2 B1 A ein  .3 B2 A aus  .4 B3 B ein  .5 B4 B aus
;           .6 B5 C ein  .7 B6 C aus

Y1      BIT   P0.0
Y2      BIT   P0.1
Y3      BIT   P0.2
Y4      BIT   P0.3
Y5      BIT   P0.4
Y6      BIT   P0.5
TSTART  BIT   P1.0
TSTOP   BIT   P1.1
AEIN    BIT   P1.2
AAUS    BIT   P1.3
BEIN    BIT   P1.4
BAUS    BIT   P1.5
CEIN    BIT   P1.6
CAUS    BIT   P1.7

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  Y2              ; Grundstellung: alle Zylinder einfahren
        SETB  Y4
        SETB  Y6
g1:     JNB   AEIN,g1
        JNB   BEIN,g1
        JNB   CEIN,g1
        CLR   Y2
        CLR   Y4
        CLR   Y6
start:  JNB   TSTART,start    ; auf START warten
        SETB  Y1              ; 1. Blech spannen
w1:     JNB   AAUS,w1
        CLR   Y1
        SETB  Y3              ; 2. biegen
w2:     JNB   BAUS,w2
        CLR   Y3
        SETB  Y4              ; 3. Stempel hoch
w3:     JNB   BEIN,w3
        CLR   Y4
        SETB  Y2              ; 4. Niederhalter hoch
w4:     JNB   AEIN,w4
        CLR   Y2
        SETB  Y5              ; 5. Teil auswerfen
w5:     JNB   CAUS,w5
        CLR   Y5
        SETB  Y6              ; 6. Auswerfer zurück
w6:     JNB   CEIN,w6
        CLR   Y6
        SJMP  start
        END
