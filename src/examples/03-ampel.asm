; @title Ampel-1 – Fußgängerüberweg
; @desc Ampel-1 an P1: Ablauf einer Fußgängerampel an einer Straße. Kfz-Ampel (D0 grün, D1 gelb, D2 rot) und Fußgängerampel (D3 grün, D4 rot) werden reihum geschaltet.
; @mode int
; @io P1=traffic
;
; Belegung P1 (alle Ausgänge, 1 = Lampe an):
;   D0 Kfz grün   D1 Kfz gelb   D2 Kfz rot   D3 Fußgänger grün   D4 Fußgänger rot

        ORG   0
start:  MOV   P1,#00010001b   ; Kfz grün, Fußgänger rot
        MOV   R5,#50          ; 5 s
        LCALL pause
        MOV   P1,#00010010b   ; Kfz gelb
        MOV   R5,#15
        LCALL pause
        MOV   P1,#00010100b   ; Kfz rot, Fußgänger rot
        MOV   R5,#10
        LCALL pause
        MOV   P1,#00001100b   ; Kfz rot, Fußgänger grün
        MOV   R5,#40
        LCALL pause
        MOV   P1,#00010100b   ; Fußgänger wieder rot
        MOV   R5,#10
        LCALL pause
        MOV   P1,#00010110b   ; Kfz rot-gelb
        MOV   R5,#10
        LCALL pause
        SJMP  start

; Pause: R5 × 100 ms
pause:  MOV   R7,#200
ps1:    MOV   R6,#250
ps2:    DJNZ  R6,ps2
        DJNZ  R7,ps1
        DJNZ  R5,pause
        RET
        END
