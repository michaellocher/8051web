; @title Aufzug-2 – Personenaufzug
; @desc Personenaufzug für 3 Stockwerke an P1: Die Kabine fährt von C über B nach A und wieder zurück, hält an jedem Stockwerk 2 s und zeigt es mit der Meldelampe A, B bzw. C an. Die Istwertgeber D5–D7 melden die Ankunft.
; @group Bauteilebibliothek
; @mode int
; @io P1=aufzug2
;
; Belegung P1:  D0 Meldelampe A   D1 Meldelampe B   D2 Meldelampe C
;               D3 Motoranschluss 1   D4 Motoranschluss 2   (10 = aufwärts, 01 = abwärts, 00/11 = aus)
;               D5 Istwertgeber A (oben)   D6 Istwertgeber B   D7 Istwertgeber C (unten)   (Eingänge, 1 = Kabine am Stockwerk)
;
; Die Eingangsbits D5–D7 müssen beim Schreiben auf 1 stehen (E0h).

        ORG   0
        MOV   P1,#0E4h        ; Kabine steht in C: Lampe C an, Motor aus
loop:   MOV   R5,#20
        LCALL pause
        MOV   P1,#0E8h        ; aufwärts
        JNB   P1.6,$          ; bis Stockwerk B
        MOV   P1,#0E2h        ; Halt, Lampe B
        MOV   R5,#20
        LCALL pause
        MOV   P1,#0E8h        ; aufwärts
        JNB   P1.5,$          ; bis Stockwerk A
        MOV   P1,#0E1h        ; Halt, Lampe A
        MOV   R5,#20
        LCALL pause
        MOV   P1,#0F0h        ; abwärts
        JNB   P1.6,$          ; bis Stockwerk B
        MOV   P1,#0E2h
        MOV   R5,#20
        LCALL pause
        MOV   P1,#0F0h        ; abwärts
        JNB   P1.7,$          ; bis Stockwerk C
        MOV   P1,#0E4h
        SJMP  loop

; Pause: R5 x 100 ms
pause:  MOV   R7,#200
pa1:    MOV   R6,#250
pa2:    DJNZ  R6,pa2
        DJNZ  R7,pa1
        DJNZ  R5,pause
        RET
        END
