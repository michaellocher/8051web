; @title Pumpensteuerung (externes Modell)
; @desc Mit Schalter S0 EIN pumpt P1 das Becken bei "oben" (S1) leer bis "unten" (S2) nicht mehr bedeckt ist (Trockenlaufschutz). Bei Motorschutz Q1 stoppt die Pumpe, H1 blinkt. Check (S3) = Leuchtentest. Zulaufventil V1 per Klick im Modellfenster öffnen.
; @group Externe Modelle
; @mode int
; @io P0=ext-pumpe
;
; P0 → Ax:  .0 P1 Pumpe  .1 H1 Betrieb/Störung
; Ex → P1:  .0 S0 EIN  .1 S1 Füllstand oben  .2 S2 Füllstand unten  .3 S3 Check  .4 Q1 Motorschutz
;
; Zweipunktregelung: Pumpe ein bei S1 (oben), aus wenn S2 (unten) nicht mehr erreicht wird.

PUMPE   BIT   P0.0
H1      BIT   P0.1
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
S3      BIT   P1.3
Q1      BIT   P1.4
LAEUFT  BIT   20h.0          ; Merker: Pumpe soll laufen

        ORG   0
        MOV   P1,#0FFh        ; P1 als Eingang
        MOV   P0,#00h
        CLR   LAEUFT
main:   JB    Q1,stoer        ; Motorschutz ausgelöst?
        JNB   S0,abschalt     ; Schalter AUS
        JB    S1,ein          ; oben erreicht → Pumpe ein
        JNB   S2,abschalt     ; unten unterschritten → Pumpe aus
        SJMP  ausgabe
ein:    SETB  LAEUFT
        SJMP  ausgabe
abschalt: CLR LAEUFT
ausgabe: MOV  C,LAEUFT
        MOV   PUMPE,C
        ORL   C,S3            ; Leuchtentest: H1 auch bei Taster Check
        MOV   H1,C
        SJMP  main

stoer:  CLR   LAEUFT          ; Pumpe sofort aus, H1 blinkt
        CLR   PUMPE
        CPL   H1
        MOV   R7,#3           ; 0,3 s
st1:    ACALL zehntel
        DJNZ  R7,st1
        SJMP  main

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
