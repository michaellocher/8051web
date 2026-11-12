; @title Schrittmotor
; @desc Schrittmotor an P1 im Halbschrittbetrieb. Schalter an P2: S1 (P2.1) = 1 → Motor läuft, S0 (P2.0) = Drehrichtung (1 = Rechtslauf).
; @mode int
; @io P1=stepper
; @io P2=switches
;
; Belegung P1: D0–D3 = Spulen (Ausgänge). Halbschritt-Folge (D3..D0): Ah, 2h, 6h, 4h, 5h, 1h, 9h, 8h
; (Rechtslauf vorwärts, Linkslauf rückwärts; jeder zweite Zustand ist ein Vollschritt: Ah, 6h, 5h, 9h)

        ORG   0
        MOV   R0,#0
loop:   JNB   P2.1,loop       ; Motor gestoppt?
        JB    P2.0,rechts
        DEC   R0
        SJMP  ausgabe
rechts: INC   R0
ausgabe:
        MOV   A,R0
        ANL   A,#07h
        MOV   DPTR,#schritte
        MOVC  A,@A+DPTR
        MOV   P1,A
        LCALL warte
        SJMP  loop

; Halbschritt-Folge (D3..D0)
schritte:
        DB    0Ah, 02h, 06h, 04h, 05h, 01h, 09h, 08h

; ca. 40 ms
warte:  MOV   R7,#80
w1:     MOV   R6,#250
        DJNZ  R6,$
        DJNZ  R7,w1
        RET
        END
