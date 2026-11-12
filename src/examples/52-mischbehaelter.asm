; @title Mischbehälter (externes Modell)
; @desc START (S1): Komponente 1 (20 Impulse) und Komponente 2 (30 Impulse) erst grob+fein, dann nur fein dosieren, rühren und heizen bis Maximaltemperatur, 5 s nachrühren, entleeren. Alarm bei Überfüllung; S2 entleert von Hand.
; @group Externe Modelle
; @mode int
; @io P0=ext-mischer
;
; P0 → Ax:  .0 V1.1 grob  .1 V1.2 fein  .2 V2.1 grob  .3 V2.2 fein  .4 V3 Ablass  .5 H Heizung  .6 M Rührwerk  .7 H1 Alarm
; Ex → P1:  .0 QI1 Impulse K1  .1 QI2 Impulse K2  .2 TIS Temp. max  .3 LIS1 nicht leer  .4 LIS2 voll
;           .5 S1 START  .6 S2 Hand

V11     BIT   P0.0
V12     BIT   P0.1
V21     BIT   P0.2
V22     BIT   P0.3
V3      BIT   P0.4
HEIZ    BIT   P0.5
RUEHR   BIT   P0.6
ALARM   BIT   P0.7
QI1     BIT   P1.0
QI2     BIT   P1.1
TIS     BIT   P1.2
LIS1    BIT   P1.3
LIS2    BIT   P1.4
S1      BIT   P1.5
S2      BIT   P1.6
FLG1    BIT   20h.0           ; Flankenmerker QI1
FLG2    BIT   20h.1           ; Flankenmerker QI2

        ORG   0
        MOV   P1,#0FFh
start:  MOV   P0,#00h         ; alles aus
        JB    S2,entleer      ; Hand: Behälter entleeren
        JNB   S1,start
        ; Komponente 1: 15 Impulse grob+fein, dann bis 20 Impulse nur fein
        MOV   R2,#0
        SETB  V11
        SETB  V12
k1a:    JB    LIS2,stoer
        ACALL zaehl1
        CJNE  R2,#15,k1a
        CLR   V11
k1b:    JB    LIS2,stoer
        ACALL zaehl1
        CJNE  R2,#20,k1b
        CLR   V12
        ; Komponente 2: 22 Impulse grob+fein, dann bis 30 Impulse nur fein
        MOV   R2,#0
        SETB  V21
        SETB  V22
k2a:    JB    LIS2,stoer
        ACALL zaehl2
        CJNE  R2,#22,k2a
        CLR   V21
k2b:    JB    LIS2,stoer
        ACALL zaehl2
        CJNE  R2,#30,k2b
        CLR   V22
        ; Rühren und Heizen bis Maximaltemperatur
        SETB  RUEHR
        SETB  HEIZ
aufheiz: JNB  LIS1,stoer      ; Heizung nie ohne Füllung
        JNB   TIS,aufheiz
        CLR   HEIZ
        MOV   R7,#50          ; 5 s nachrühren
nach:   ACALL zehntel
        DJNZ  R7,nach
        CLR   RUEHR
entleer: SETB V3              ; entleeren bis Behälter leer
en1:    JB    LIS1,en1
        MOV   R7,#10          ; 1 s nachlaufen lassen (Rest ablassen)
en2:    ACALL zehntel
        DJNZ  R7,en2
        CLR   V3
        SJMP  start

stoer:  MOV   P0,#00h         ; alles aus, Alarm an
        SETB  ALARM
al1:    JNB   S2,al1          ; Hand-Taster: entleeren und quittieren
        SETB  V3
al2:    JB    LIS1,al2
        SJMP  start

zaehl1: JB    QI1,z1h         ; Zähler R2 += 1 bei steigender Flanke von QI1
        CLR   FLG1
        RET
z1h:    JB    FLG1,z1e
        SETB  FLG1
        INC   R2
z1e:    RET

zaehl2: JB    QI2,z2h
        CLR   FLG2
        RET
z2h:    JB    FLG2,z2e
        SETB  FLG2
        INC   R2
z2e:    RET

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
