; @title Rolltreppe (externes Modell)
; @desc EIN (S0) = Dauerbetrieb, AUS (S1) stoppt. Die Lichtschranke S4 startet die Rolltreppe automatisch für 15 s Nachlaufzeit. STOP (S2/S3) und Motorschutz Q1 schalten sofort ab (H2).
; @group Externe Modelle
; @mode int
; @io P0=ext-rolltreppe
;
; P0 → Ax:  .0 K1 Motor  .1 H1 Betrieb  .2 H2 Stop/Störung
; Ex → P1:  .0 S0 EIN  .1 S1 AUS  .2 S2 STOP unten  .3 S3 STOP oben  .4 S4 Lichtschranke  .5 Q1 Motorschutz

K1      BIT   P0.0
H1      BIT   P0.1
H2      BIT   P0.2
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
S3      BIT   P1.3
S4      BIT   P1.4
Q1      BIT   P1.5
DAUER   BIT   20h.0          ; Dauerbetrieb eingeschaltet

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
        CLR   DAUER
        MOV   R2,#0           ; Nachlaufzeit in 0,1 s
takt:   ACALL zehntel         ; Programmtakt 0,1 s
        JB    Q1,stoer
        JB    S2,halt
        JB    S3,halt
        CLR   H2
        JB    S1,aus
        JNB   S0,sa1
        SETB  DAUER           ; EIN: Dauerbetrieb
sa1:     JNB   S4,sa2
        MOV   R2,#150         ; Fahrgast erkannt: 15 s Nachlauf
sa2:     MOV   A,R2
        JZ    sa3
        DEC   R2
        SJMP  fahren
sa3:     JNB   DAUER,stehen
fahren: SETB  K1
        SETB  H1
        SJMP  takt
stehen: CLR   K1
        CLR   H1
        SJMP  takt

halt:   SETB  H2              ; STOP: sofort aus, Wiedereinschalten nur mit EIN
        SJMP  aus2
stoer:  CPL   H2              ; Motorschutz: aus, H2 blinkt
aus2:   CLR   DAUER
        MOV   R2,#0
        CLR   K1
        CLR   H1
        SJMP  takt
aus:    CLR   DAUER           ; AUS
        MOV   R2,#0
        CLR   K1
        CLR   H1
        SJMP  takt

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
