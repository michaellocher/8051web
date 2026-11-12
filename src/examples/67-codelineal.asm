; @title Codelineal – Gray-Code lesen
; @desc Der Schlitten des Codelineals (P1) wird nacheinander auf die Positionen 12, 3, 15 und 0 gefahren. Das Programm liest den Gray-Code (D0–D3), wandelt ihn in eine Binärzahl um und stoppt den Motor beim Ziel. Schalte das Lineal auf „Dual“ und „real“, um die Abtastfehler zu sehen.
; @group Bauteilebibliothek
; @mode int
; @io P1=codelineal
;
; Belegung P1:  D0–D3 = Lichtschranken der Spuren (Eingänge, 1 = hell)
;               D4/D5 = Motor (Ausgänge): D4 = 1 und D5 = 0 → rechts, D4 = 0 und D5 = 1 → links, gleiche Pegel = Halt
;
; R2 = Zielposition, R3 = Index in der Zieltabelle

        ORG   0
        MOV   R3,#0
neu:    MOV   P1,#0Fh         ; Motor aus, Eingangsbits D0–D3 auf 1
        MOV   DPTR,#ziele
        MOV   A,R3
        MOVC  A,@A+DPTR
        CJNE  A,#0FFh,ok      ; Tabellenende?
        MOV   R3,#0
        SJMP  neu
ok:     MOV   R2,A
        INC   R3

regeln: MOV   A,P1
        ANL   A,#0Fh          ; Gray-Code der vier Spuren
        LCALL gray2bin        ; A = Position
        CJNE  A,02h,ungleich  ; mit dem Ziel R2 vergleichen
        MOV   P1,#0Fh         ; Ziel erreicht: Motor aus
        MOV   R5,#10          ; 1 s warten
        LCALL pause
        SJMP  neu
ungleich:
        JC    rechts          ; Position < Ziel -> nach rechts
        MOV   P1,#2Fh         ; Motor links (D5 = 1)
        SJMP  regeln
rechts: MOV   P1,#1Fh         ; Motor rechts (D4 = 1)
        SJMP  regeln

; Gray-Code in A -> Binärzahl in A:  b = g XOR (g>>1) XOR (g>>2) XOR (g>>3)
gray2bin:
        MOV   R1,A            ; Ergebnis beginnt mit g
        MOV   R0,#3
g1:     CLR   C
        RRC   A               ; A = A >> 1
        XRL   01h,A           ; R1 = R1 XOR A
        DJNZ  R0,g1
        MOV   A,R1
        RET

ziele:  DB    12, 3, 15, 0, 0FFh

; Pause: R5 x 100 ms
pause:  MOV   R7,#200
pa1:    MOV   R6,#250
pa2:    DJNZ  R6,pa2
        DJNZ  R7,pa1
        DJNZ  R5,pause
        RET
        END
