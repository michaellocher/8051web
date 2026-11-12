; @title Würfel-3 – Doppelwürfel
; @desc Würfel-3 an P1: Zwei Würfel werden direkt über D0–D7 angesteuert. Der linke Würfel (D4–D7) zählt alle 0,3 s weiter, der rechte (D0–D3) nach jedem Durchlauf des linken – so erscheinen nacheinander alle 36 Kombinationen.
; @group Bauteilebibliothek
; @mode int
; @io P1=dice3
;
; Würfel-3: Jedes Bit schaltet zwei gegenüberliegende Augen (alle Ausgänge, 1 = an):
;   rechter Würfel:  D0 = Mitte,  D1 = oben rechts + unten links,  D2 = Mitte links + Mitte rechts,  D3 = oben links + unten rechts
;   linker Würfel:   D4 = Mitte,  D5 = oben rechts + unten links,  D6 = Mitte links + Mitte rechts,  D7 = oben links + unten rechts
; Augenzahlen (Bits D3..D0 bzw. D7..D4):  1 = 0001, 2 = 1000, 3 = 1001, 4 = 1010, 5 = 1011, 6 = 1110

        ORG   0
        MOV   R0,#0           ; Index linker Würfel (0–5)
        MOV   R1,#0           ; Index rechter Würfel
        MOV   DPTR,#augen
loop:   MOV   A,R0
        MOVC  A,@A+DPTR
        SWAP  A               ; linker Würfel nach D4–D7
        MOV   B,A
        MOV   A,R1
        MOVC  A,@A+DPTR       ; rechter Würfel in D0–D3
        ORL   A,B
        MOV   P1,A
        MOV   R5,#3           ; 0,3 s
        LCALL pause
        INC   R0
        CJNE  R0,#6,loop
        MOV   R0,#0
        INC   R1
        CJNE  R1,#6,loop
        MOV   R1,#0
        SJMP  loop

;       1    2    3    4    5    6
augen:  DB    01h, 08h, 09h, 0Ah, 0Bh, 0Eh

; Pause: R5 x 100 ms
pause:  MOV   R7,#200
ps1:    MOV   R6,#250
ps2:    DJNZ  R6,ps2
        DJNZ  R7,ps1
        DJNZ  R5,pause
        RET
        END
