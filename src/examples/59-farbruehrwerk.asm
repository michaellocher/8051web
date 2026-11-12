; @title Farbrührwerk (externes Modell)
; @desc Automatik: EIN (S1) füllt Farbe bis voll (S3), rührt 6 s, lässt über V1 ab bis leer (S4). AUS (S2) bricht ab. Motorschutz F1/F2: alles aus, H1 an, Quittieren mit S2 nach Rücksetzen. MANU: S1 = Pumpe (Tipp), S2 = Ablassen (Tipp), Rührwerk läuft bei vollem Behälter.
; @group Externe Modelle
; @mode int
; @io P0=ext-farbe
;
; P0 → Ax:  .0 K1 Pumpe  .1 K2 Rührwerk  .2 V1 Ablassventil  .3 H1 Störung  .4 H2 Automatik
; Ex → P1:  .0 S1 EIN  .1 S2 AUS  .2 S3 voll  .3 S4 nicht leer  .4 F1 Motorschutz Pumpe
;           .5 F2 Motorschutz Rührwerk  .6 S5 MANU

K1      BIT   P0.0
K2      BIT   P0.1
V1      BIT   P0.2
H1      BIT   P0.3
H2      BIT   P0.4
S1      BIT   P1.0
S2      BIT   P1.1
S3      BIT   P1.2
S4      BIT   P1.3
MS1     BIT   P1.4
MS2     BIT   P1.5
S5      BIT   P1.6

        ORG   0
        MOV   P1,#0FFh
start:  MOV   P0,#00h         ; alles aus
        JB    MS1,stoer
        JB    MS2,stoer
        JB    S5,hand
        SETB  H2              ; Automatik
        JNB   S1,start
        ; ---- Automatik: füllen ----
        SETB  K1
fuell:  JB    S2,abbr
        JB    MS1,stoer
        JNB   S3,fuell        ; bis Behälter voll
        CLR   K1
        SETB  K2              ; rühren
        MOV   R7,#60          ; 6 s
ruehr:  ACALL zehntel
        JB    S2,abbr
        JB    MS2,stoer
        DJNZ  R7,ruehr
        CLR   K2
        SETB  V1              ; ablassen
leer:   JB    S2,abbr
        JB    S4,leer         ; bis Behälter leer
        MOV   R7,#20          ; 2 s Rest ablaufen lassen
rest:   ACALL zehntel
        DJNZ  R7,rest
        SJMP  start

abbr:   MOV   P0,#00h         ; AUS: alles stoppen
ab1:    JB    S2,ab1
        SJMP  start

stoer:  MOV   P0,#08h         ; Störung: alles aus, H1 an
st1:    JB    MS1,st1         ; warten, bis Motorschutz zurückgesetzt ist
        JB    MS2,st1
        JNB   S2,st1          ; Quittieren mit S2
st2:    JB    S2,st2
        SJMP  start

hand:   MOV   P0,#00h         ; Handbetrieb
hloop:  JB    MS1,stoer
        JB    MS2,stoer
        JNB   S5,start
        MOV   C,S1            ; Pumpe: S1 gedrückt und nicht voll
        ANL   C,/S3
        MOV   K1,C
        MOV   C,S2            ; Ablassen: S2 gedrückt und nicht leer
        ANL   C,S4
        MOV   V1,C
        MOV   C,S3            ; Rühren bei vollem Behälter
        MOV   K2,C
        SJMP  hloop

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
