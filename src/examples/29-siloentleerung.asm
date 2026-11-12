; @title Siloentleerung (externes Modell)
; @desc Zwei Pumpen entleeren ein Silo nach Füllstand: P1 ab Mitte, P2 zusätzlich ab oben, beide aus unter dem unteren Sensor. Unplausible Sensorwerte lösen die Störlampe aus.
; @group Externe Modelle
; @mode int
; @io P0=ext-silo
;
; P0 → Ax:  .0 H1 Störung   .1 P1 Pumpe 1   .2 P2 Pumpe 2
; Ex → P1:  .0 S0 EIN   .1 S1 oben   .2 S2 Mitte   .3 S3 unten   (1 = Medium erreicht)
;
; Schalthysterese: P1 schaltet an, sobald S2 Medium meldet, und aus, wenn S3 trocken ist.
; P2 schaltet an bei S1 und aus, wenn S2 trocken ist.
; Plausibilität: S1 = 1 verlangt S2 = 1 und S3 = 1, S2 = 1 verlangt S3 = 1 (sonst Drahtbruch).
; Das Silo wird mit dem Handventil V1 im Modellfenster befüllt.

H1      BIT   P0.0
P1A     BIT   P0.1
P2A     BIT   P0.2
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
S3      BIT   P1.3

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
loop:   JNB   S0,aus          ; Anlage nicht freigegeben
        JNB   S1,pl1          ; --- Plausibilität
        JNB   S2,stoer
pl1:    JNB   S2,pl2
        JNB   S3,stoer
pl2:    CLR   H1
        JNB   S3,p1aus        ; --- Pumpe 1: an bei S2, aus bei S3 = 0
        JNB   S2,pumpe2
        SETB  P1A
        SJMP  pumpe2
p1aus:  CLR   P1A
pumpe2: JNB   S2,p2aus        ; --- Pumpe 2: an bei S1, aus bei S2 = 0
        JNB   S1,loop
        SETB  P2A
        SJMP  loop
p2aus:  CLR   P2A
        SJMP  loop
aus:    CLR   P1A             ; EIN-Schalter aus: alles aus
        CLR   P2A
        CLR   H1
        SJMP  loop
stoer:  SETB  H1              ; Störung: Meldelampe an
        SJMP  loop
        END
