; @title Einfache Sortieranlage (externes Modell)
; @desc Kleine Teile werden per Zylinder Z1 aufs Seitenband geschoben, große laufen bis zum Bandende. Erkennung über die Länge (Lichtschranken S1/S2 gleichzeitig unterbrochen).
; @group Externe Modelle
; @mode int
; @io P0=ext-sort1
;
; P0 → Ax:  .0 Z1 Zylinder (Teil ausschieben)
; Ex → P1:  .0 S1  .1 S2  .2 S3 Lichtschranken (1 = unterbrochen)
;
; Band 90 px/s, Lichtschranken 25 px auseinander, Z1 bei 500 px. Ein kleines Teil (20 px) ist nie
; vor S1 und S2 zugleich, ein großes (80 px) schon. Sobald das Teil S1 verlassen hat, braucht
; ein kleines Teil noch rund 4 s bis Z1: nach 3,2 s wird Z1 ausgefahren und 1,5 s gehalten.

Z1      BIT   P0.0
S1      BIT   P1.0
S2      BIT   P1.1
GROSS   BIT   20h.0

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
neu:    JNB   S1,neu          ; auf ein Teil warten
        CLR   GROSS
mess:   JNB   S2,m2           ; S1 und S2 zugleich → großes Teil
        SETB  GROSS
m2:     JB    S1,mess         ; bis das Teil S1 verlassen hat
        JB    GROSS,neu       ; große Teile durchlaufen lassen
        MOV   R5,#32          ; 3,2 s warten
        ACALL warte
        SETB  Z1              ; kleines Teil ausschieben
        MOV   R5,#15
        ACALL warte
        CLR   Z1
        SJMP  neu

; Wartet R5 × 100 ms
warte:  MOV   R6,#200
w1:     MOV   R7,#248
w2:     DJNZ  R7,w2
        DJNZ  R6,w1
        DJNZ  R5,warte
        RET
        END
