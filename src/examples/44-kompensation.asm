; @title Blindleistungskompensation (externes Modell)
; @desc Regelt die Kondensatorstufen C1–C4: Ist die Last induktiv, wird eine Stufe zugeschaltet, bei Überkompensation eine abgeschaltet. Zwischen den Schaltvorgängen werden ca. 2,5 s gewartet, damit die Kondensatoren entladen sind.
; @group Externe Modelle
; @mode int
; @io P0=ext-kompensation
;
; P0 → Ax:  .0–.3 K1–K4 Schütze der Stufen C1–C4
; Ex → P1:  .0 S1 "+"  .1 S2 "−"  .2 L induktiv  .3 C kapazitiv

IND     BIT   P1.2
CAP     BIT   P1.3

        ORG   0
        MOV   P1,#0FFh
        MOV   R2,#00h         ; Stufenmuster (Thermometercode)
        MOV   P0,R2
loop:   JB    IND,mehr        ; Blindleistung zu hoch → Stufe zu
        JB    CAP,weniger     ; überkompensiert → Stufe ab
        SJMP  loop
mehr:   MOV   A,R2
        SETB  C
        RLC   A               ; neue 1 von rechts schieben
        ANL   A,#0Fh
        SJMP  setzen
weniger: MOV  A,R2
        CLR   C
        RRC   A               ; höchste Stufe ab
setzen: MOV   R2,A
        MOV   P0,A
        MOV   R3,#5           ; Sperrzeit ca. 2,5 s
w:      ACALL pause
        DJNZ  R3,w
        SJMP  loop

pause:  MOV   R5,#4           ; ca. 0,5 s
q2:     MOV   R6,#0
q1:     MOV   R7,#0
q0:     DJNZ  R7,q0
        DJNZ  R6,q1
        DJNZ  R5,q2
        RET
        END
