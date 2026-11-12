; @title Sortieranlage (externes Modell)
; @desc Drei Teilegrößen werden über vier Lichtschranken vermessen: kleine schiebt Z1 ab, mittlere Z2, große laufen bis zum Bandende.
; @group Externe Modelle
; @mode int
; @io P0=ext-sort2
;
; P0 → Ax:  .0 Z1 (kleine Teile)   .1 Z2 (mittlere Teile)
; Ex → P1:  .0 S1  .1 S2  .2 S3  .3 S4 Lichtschranken (1 = unterbrochen)
;
; Teillängen: klein 20 px, mittel 40 px, groß 80 px; Lichtschranken 25 px Abstand.
;   S1 und S2 gleichzeitig  → mindestens mittel
;   S1 und S4 gleichzeitig  → groß
; Z1 steht bei 400 px, Z2 bei 560 px; das Band läuft mit 90 px/s.

Z1      BIT   P0.0
Z2      BIT   P0.1
S1      BIT   P1.0
S2      BIT   P1.1
S4      BIT   P1.3
MITTEL  BIT   20h.0
GROSS   BIT   20h.1

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
neu:    JNB   S1,neu          ; auf ein Teil warten
        CLR   MITTEL
        CLR   GROSS
mess:   JNB   S2,m2
        SETB  MITTEL          ; S1 und S2 zugleich
m2:     JNB   S4,m3
        SETB  GROSS           ; S1 und S4 zugleich
m3:     JB    S1,mess         ; bis das Teil S1 verlassen hat
        JB    GROSS,neu       ; große Teile laufen durch
        JB    MITTEL,mitt
; --- kleines Teil → Z1 (Ankunft nach ca. 2,5 s)
        MOV   R5,#18
        ACALL warte
        SETB  Z1
        MOV   R5,#15
        ACALL warte
        CLR   Z1
        SJMP  neu
; --- mittleres Teil → Z2 (Ankunft nach ca. 4,3 s)
mitt:   MOV   R5,#35
        ACALL warte
        SETB  Z2
        MOV   R5,#15
        ACALL warte
        CLR   Z2
        SJMP  neu

; Wartet R5 × 100 ms
warte:  MOV   R6,#200
w1:     MOV   R7,#248
w2:     DJNZ  R7,w2
        DJNZ  R6,w1
        DJNZ  R5,warte
        RET
        END
