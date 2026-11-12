; @title Zähler (Modell-Rechner)
; @desc BCD-Zähler auf der 7-Segment-Anzeige an P0. Schalter S0 = aufwärts, S1 = abwärts, S2 = auf Null setzen (aktiv bei 0).
; @mode model
; @io P0=bcd7seg
;
; Läuft mit dem reduzierten Befehlssatz des Modell-Rechners
; (keine Unterprogramme, kein Stack – die Pause steht deshalb direkt in der Schleife).

        ORG   0
        MOV   P0,#0E0h        ; P0.5..P0.7 als Eingänge (High), Anzeige 0
        MOV   R2,#0
loop:   JB    P0.7,noclr      ; S2 = 0 → Zähler löschen
        MOV   R2,#0
noclr:  JB    P0.5,noup       ; S0 = 0 → aufwärts zählen
        INC   R2
        CJNE  R2,#10,show
        MOV   R2,#0
        SJMP  show
noup:   JB    P0.6,show       ; S1 = 0 → abwärts zählen
        DEC   R2
        CJNE  R2,#0FFh,show
        MOV   R2,#9
show:   MOV   A,R2
        ORL   A,#0E0h         ; Eingangs-Bits auf High lassen!
        MOV   P0,A
; Pause ca. 200 ms
        MOV   R1,#200
d1:     MOV   B,#250
d2:     DJNZ  B,d2
        DJNZ  R1,d1
        SJMP  loop
        END
