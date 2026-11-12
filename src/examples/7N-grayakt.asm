; @title GRAY-Aktor
; @desc Der Motor mit Positionsmeldung (P1) fährt nacheinander alle 16 Stellungen im Rechtslauf an. Das Programm liest den Gray-Code der Zeigerposition und schaltet den Motor ab, sobald die Sollstellung erreicht ist.
; @group Bauteilebibliothek
; @mode int
; @io P1=grayakt
;
; GRAY-Aktor: P1.0–P1.3 = Gray-Code der Zeigerposition (Eingänge, vorher auf 1 setzen)
;             P1.4 = 1, P1.5 = 0: Rechtslauf;  P1.4 = 0, P1.5 = 1: Linkslauf;  00 und 11: Motor aus
; Dual → Gray:  g = b XOR (b >> 1)

RECHTS  EQU   0DFh            ; D4 = 1, D5 = 0, Gray-Eingänge (D0–D3) und D6/D7 auf 1
STOPP   EQU   0CFh            ; D4 = 0, D5 = 0 → Motor aus

        ORG   0
        MOV   P1,#STOPP
        MOV   R7,#1           ; Sollstellung (dual), Start bei Stellung 0
next:   MOV   A,R7
        CLR   C
        RRC   A               ; b >> 1
        XRL   A,R7            ; Gray-Code der Sollstellung
        MOV   R6,A
        MOV   P1,#RECHTS      ; Motor an
fahre:  MOV   A,P1
        ANL   A,#0Fh          ; Gray-Code der Zeigerposition
        CJNE  A,6,fahre       ; noch nicht am Ziel (R6 = Bank 0, Adresse 6)
        MOV   P1,#STOPP       ; Ziel erreicht → Motor aus
        MOV   R5,#4           ; 0,4 s Pause
        LCALL pause
        INC   R7
        MOV   A,R7
        ANL   A,#0Fh          ; nach F wieder 0
        MOV   R7,A
        SJMP  next

; Pause: R5 × 100 ms
pause:  MOV   R3,#200
pw1:    MOV   R4,#250
pw2:    DJNZ  R4,pw2
        DJNZ  R3,pw1
        DJNZ  R5,pause
        RET
        END
