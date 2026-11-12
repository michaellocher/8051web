; @title Absauganlage (externes Modell)
; @desc EIN (S1) startet die Absaugung: Zellenradschleuse M2 zuerst, nach 2 s Ventilator M1. Läuft die Maschine (S0), wird abgesaugt; nach Maschinenende/AUS (S2) läuft M1 4 s und M2 7 s nach. Motorschutz Q1/Q2: alles aus, H3 blinkt.
; @group Externe Modelle
; @mode int
; @io P0=ext-absaug
;
; P0 → Ax:  .0 M1 Ventilator  .1 M2 Zellenradschleuse  .2 H1 M1 läuft  .3 H2 M2 läuft  .4 H3 Störung
; Ex → P1:  .0 S0 Maschine EIN  .1 S1 EIN  .2 S2 AUS  .3 S3 Check  .4 Q1 Motorschutz M1  .5 Q2 Motorschutz M2

M1      BIT   P0.0
M2      BIT   P0.1
H1      BIT   P0.2
H2      BIT   P0.3
H3      BIT   P0.4
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
S3      BIT   P1.3
Q1      BIT   P1.4
Q2      BIT   P1.5
LAUF    BIT   20h.0          ; Merker: Absaugung angefordert (durch S1 gesetzt, durch S2 gelöscht)

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
        CLR   LAUF
        MOV   R2,#0           ; Nachlaufzähler M1 (0,1 s)
        MOV   R3,#0           ; Nachlaufzähler M2
        MOV   R4,#0           ; Vorlaufzähler: M2 läuft schon so lange
takt:   ACALL zehntel         ; Programmtakt 0,1 s
        JB    Q1,stoer
        JB    Q2,stoer
        CLR   H3
        JNB   S1,mk1
        SETB  LAUF
mk1:     JNB   S2,mk2
        CLR   LAUF
mk2:     MOV   C,LAUF          ; Anforderung = Merker oder Maschine läuft
        ORL   C,S0
        JC    anf
        LJMP  aus
anf:    SETB  M2              ; Austrag zuerst
        MOV   R2,#40
        MOV   R3,#70
        CJNE  R4,#20,hoch     ; nach 2 s Vorlauf
        SETB  M1              ; Ventilator ein
        SJMP  ende
hoch:   INC   R4
        SJMP  ende
aus:    MOV   R4,#0           ; keine Anforderung: Nachlauf
        MOV   A,R2
        JZ    a1
        DEC   R2
        SJMP  a2
a1:     CLR   M1
a2:     MOV   A,R3
        JZ    a3
        DEC   R3
        SJMP  ende
a3:     CLR   M2
ende:   MOV   C,M1            ; Meldeleuchten zeigen Betrieb
        MOV   H1,C
        MOV   C,M2
        MOV   H2,C
        JNB   S3,takt
        SETB  H1              ; Check: Leuchtentest
        SETB  H2
        SETB  H3
        SJMP  takt

stoer:  CLR   M1              ; Störung: alles aus, H3 blinkt
        CLR   M2
        CLR   LAUF
        MOV   R2,#0
        MOV   R3,#0
        MOV   R4,#0
        CLR   H1
        CLR   H2
        CPL   H3
        SJMP  takt

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
