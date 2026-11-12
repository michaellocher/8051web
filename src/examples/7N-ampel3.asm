; @title Ampel-3 – Kreuzung mit Induktionsschleifen
; @desc Ampel-3 an P1: Die Hauptstraße hat grün, bis eine Induktionsschleife der Nebenstraße (D6 oder D7, Schalter) belegt ist. Dann schaltet die Kreuzung über gelb und rot auf Grün für die Nebenstraße um und bleibt dort, solange noch eine Schleife belegt ist (mindestens 4 s).
; @group Bauteilebibliothek
; @mode int
; @io P1=ampel3
;
; Ampel-3 (1 = Lampe an):  D0 Nebenstraße rot    D2 Nebenstraße gelb    D4 Nebenstraße grün
;                          D5 Hauptstraße rot    D3 Hauptstraße gelb    D1 Hauptstraße grün
; Eingänge:  D6 = Induktionsschleife 1,  D7 = Induktionsschleife 2  (Schalter der Nebenstraße, 1 = Fahrzeug)

        ORG   0
        MOV   P1,#0C3h        ; Hauptstraße grün, Nebenstraße rot; D6/D7 auf 1 (Eingänge)

haupt:  JB    P1.6,umschalt   ; Bedarf der Nebenstraße?
        JB    P1.7,umschalt
        SJMP  haupt

umschalt:
        MOV   P1,#0C9h        ; Hauptstraße gelb
        MOV   R5,#20
        LCALL pause
        MOV   P1,#0E1h        ; alles rot
        MOV   R5,#10
        LCALL pause
        MOV   P1,#0E5h        ; Nebenstraße rot-gelb
        MOV   R5,#10
        LCALL pause
        MOV   P1,#0F0h        ; Nebenstraße grün
        MOV   R5,#40          ; mindestens 4 s
        LCALL pause
halten: JB    P1.6,halten     ; solange noch ein Fahrzeug auf einer Schleife steht
        JB    P1.7,halten
        MOV   P1,#0E4h        ; Nebenstraße gelb
        MOV   R5,#20
        LCALL pause
        MOV   P1,#0E1h        ; alles rot
        MOV   R5,#10
        LCALL pause
        MOV   P1,#0E9h        ; Hauptstraße rot-gelb
        MOV   R5,#10
        LCALL pause
        MOV   P1,#0C3h        ; Hauptstraße grün
        MOV   R5,#50          ; mindestens 5 s Grün
        LCALL pause
        SJMP  haupt

; Pause: R5 x 100 ms
pause:  MOV   R7,#200
ps1:    MOV   R6,#250
ps2:    DJNZ  R6,ps2
        DJNZ  R7,ps1
        DJNZ  R5,pause
        RET
        END
