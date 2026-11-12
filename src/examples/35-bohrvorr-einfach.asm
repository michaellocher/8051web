; @title Einfache Bohrvorrichtung (externes Modell)
; @desc START (S1): Zylinder Z1 fährt das Werkstück unter den Bohrer, bei laufendem Motor senkt Z2 den Bohrer ab und wieder hoch, danach fährt Z1 zurück. Mit „Werkstück einlegen“ geht es weiter.
; @group Externe Modelle
; @mode int
; @io P0=ext-bohr2
;
; P0 → Ax:  .0 Z1 vor  .1 Z1 zurück  .2 Z2 ab  .3 Z2 auf  .4 M1 Bohrmotor
; Ex → P1:  .0 S1 START  .1 S2 RESET  .2 GIS1 Z1 hinten  .3 GIS2 Z1 vorn  .4 GIS3 Z2 oben  .5 GIS4 Z2 unten

Z1VOR   BIT   P0.0
Z1ZUR   BIT   P0.1
Z2AB    BIT   P0.2
Z2AUF   BIT   P0.3
M1      BIT   P0.4
TSTART  BIT   P1.0
GIS1    BIT   P1.2
GIS2    BIT   P1.3
GIS3    BIT   P1.4
GIS4    BIT   P1.5

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  Z1ZUR           ; Grundstellung: Z1 hinten, Z2 oben
        SETB  Z2AUF
g1:     JNB   GIS1,g1
        JNB   GIS3,g1
        CLR   Z1ZUR
        CLR   Z2AUF
start:  JNB   TSTART,start    ; auf START warten
        SETB  Z1VOR           ; Werkstück unter den Bohrer fahren
w1:     JNB   GIS2,w1
        CLR   Z1VOR
        SETB  M1              ; Bohrmotor an
        SETB  Z2AB            ; Bohrer senken
w2:     JNB   GIS4,w2
        CLR   Z2AB
        SETB  Z2AUF           ; Bohrer heben
w3:     JNB   GIS3,w3
        CLR   Z2AUF
        CLR   M1              ; Motor aus
        SETB  Z1ZUR           ; Werkstück zurückfahren
w4:     JNB   GIS1,w4
        CLR   Z1ZUR
        SJMP  start
        END
