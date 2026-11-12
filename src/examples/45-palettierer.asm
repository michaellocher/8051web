; @title Palettierungsanlage (externes Modell)
; @desc Nach START läuft das Band. Jeden Karton am Anschlag schiebt Zylinder 1 in den Lagenschacht; ist die Lage voll (3 Kartons), schiebt Zylinder 2 sie auf die Palette. Bei voller Palette (4 Lagen) stoppt die Anlage. Kartons mit dem Knopf „Karton auflegen" nachlegen.
; @group Externe Modelle
; @mode int
; @io P0=ext-palettierer
;
; P0 → Ax:  .0 1Y1 Z1 aus  .1 1Y2 Z1 ein  .2 2Y1 Z2 aus  .3 2Y2 Z2 ein  .4 M1 Band
; Ex → P1:  .0 S1 START  .1 S2 Karton da  .2 1S1 Z1 ein  .3 1S2 Z1 aus
;           .4 2S1 Z2 ein  .5 2S2 Z2 aus  .6 S3 Lage voll  .7 S4 Palette voll

Y1A     BIT   P0.0
Y1E     BIT   P0.1
Y2A     BIT   P0.2
Y2E     BIT   P0.3
M1      BIT   P0.4
START   BIT   P1.0
KARTON  BIT   P1.1
Z1EIN   BIT   P1.2
Z1AUS   BIT   P1.3
Z2EIN   BIT   P1.4
Z2AUS   BIT   P1.5
LAGE    BIT   P1.6
VOLL    BIT   P1.7

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  Y1E             ; Grundstellung: beide Zylinder ein
        SETB  Y2E
w0:     JNB   Z1EIN,w0
        JNB   Z2EIN,w0
        CLR   Y1E
        CLR   Y2E
warte:  JNB   START,warte
        SETB  M1              ; Band läuft
zyk:    JB    VOLL,ende       ; Palette voll → fertig
        JNB   KARTON,zyk      ; auf Karton warten
        SETB  Y1A             ; Karton in den Schacht schieben
a1:     JNB   Z1AUS,a1
        CLR   Y1A
        SETB  Y1E
e1:     JNB   Z1EIN,e1
        CLR   Y1E
        JNB   LAGE,zyk        ; Lage noch nicht voll
        SETB  Y2A             ; Lage auf die Palette schieben
a2:     JNB   Z2AUS,a2
        CLR   Y2A
        SETB  Y2E
e2:     JNB   Z2EIN,e2
        CLR   Y2E
        SJMP  zyk
ende:   CLR   M1              ; Palette voll: Band aus
fin:    SJMP  fin
        END
