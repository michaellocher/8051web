; @title Tongeber: Alle meine Entchen
; @desc Spielt die Melodie „Alle meine Entchen“ über den Tongeber (Ton nur während des Laufs). Jedes Byte der Tabelle enthält Note (D0–D3) und Länge (D4–D6); das Programm wartet die Notenlänge ab.
; @group Bauteilebibliothek
; @mode int
; @io P1=tongeber
;
; Tongeber an P1: D0–D3 = Note (0 = Pause, 1 = C1, 3 = D1, 5 = E1, 6 = F1, 8 = G1, 10 = A1, 12 = H1, 13 = C2)
;                 D4–D6 = Länge (1 = 1/16, 2 = 1/8, 3 = 1/4, 4 = 1/2, 5 = ganze Note)
; Beispiele: 31h = C1 als Viertelnote, 40h = halbe Pause
; Eine ganze Note dauert 2 s, eine Viertelnote 0,5 s.

        ORG   0
        MOV   DPTR,#melodie
        MOV   R6,#0
spiel:  MOV   A,R6
        MOVC  A,@A+DPTR
        CJNE  A,#0FFh,note
        MOV   R5,#8           ; Ende: 1 s Pause, dann von vorn
        LCALL pause125
        MOV   R6,#0
        SJMP  spiel
note:   MOV   P1,A            ; Ton starten
        SWAP  A
        ANL   A,#07h          ; Längencode 1–5
        MOV   DPTR,#dauer
        MOVC  A,@A+DPTR       ; Dauer in Einheiten zu 125 ms
        MOV   R5,A
        MOV   DPTR,#melodie
        LCALL pause125
        INC   R6
        SJMP  spiel

; R5 × 125 ms warten
pause125:
        MOV   R2,#250
pa1:    MOV   R3,#250
        DJNZ  R3,$
        DJNZ  R2,pa1
        DJNZ  R5,pause125
        RET

dauer:  DB   0, 1, 2, 4, 8, 16
; Alle meine Entchen (C = 1, D = 3, E = 5, F = 6, G = 8, A = 10)
melodie:
        DB   31h, 33h, 35h, 36h, 48h, 48h        ; C D E F G G
        DB   3Ah, 3Ah, 3Ah, 3Ah, 58h             ; A A A A G
        DB   36h, 36h, 36h, 36h, 45h, 45h        ; F F F F E E
        DB   33h, 33h, 33h, 33h, 51h             ; D D D D C
        DB   0FFh
        END
