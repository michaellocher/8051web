; @title Ampel-2 – Kreuzung mit Fußgängerüberwegen
; @desc Ampel-2 an P1: Eine Kreuzung mit Hauptstraße (links–rechts), Nebenstraße (oben–unten) und Fußgängerampel läuft einen festen Phasenplan ab. Die Fußgänger bekommen grün, wenn beide Straßen rot haben.
; @group Bauteilebibliothek
; @mode int
; @io P1=crossing
;
; Ampel-2 (alle Ausgänge, 1 = Lampe an):
;   D0 Nebenstraße rot   D1 Nebenstraße gelb   D2 Nebenstraße grün
;   D3 Hauptstraße rot   D4 Hauptstraße gelb   D5 Hauptstraße grün
;   D6 Fußgänger rot     D7 Fußgänger grün
; Die Phasentabelle enthält je Phase das Lampenmuster und die Dauer in 100 ms.

        ORG   0
        MOV   DPTR,#tabelle
start:  MOV   R7,#0           ; Phasennummer
phase:  MOV   A,R7
        RL    A               ; ×2: Tabelle hat Muster + Dauer
        MOV   R2,A
        MOVC  A,@A+DPTR
        MOV   P1,A
        MOV   A,R2
        INC   A
        MOVC  A,@A+DPTR
        MOV   R5,A
        LCALL pause           ; Dauer in 100 ms
        INC   R7
        CJNE  R7,#8,phase
        SJMP  start

; Pause: R5 x 100 ms
pause:  MOV   R4,#200
ps1:    MOV   R3,#250
ps2:    DJNZ  R3,ps2
        DJNZ  R4,ps1
        DJNZ  R5,pause
        RET

;              Muster  Dauer
tabelle:
        DB   61h, 50      ; 0: Haupt grün, Neben rot, Fußgänger rot
        DB   51h, 15      ; 1: Haupt gelb
        DB   89h, 40      ; 2: alles rot, Fußgänger grün
        DB   4Bh, 10      ; 3: Neben rot-gelb
        DB   4Ch, 50      ; 4: Neben grün
        DB   4Ah, 15      ; 5: Neben gelb
        DB   89h, 40      ; 6: alles rot, Fußgänger grün
        DB   59h, 10      ; 7: Haupt rot-gelb
        END
