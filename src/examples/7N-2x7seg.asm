; @title 2 × 7-Segment (direkt)
; @desc Zweistelliger Zähler 00–99. Jede Ziffer hängt an einem eigenen Port: Zehner an P0, Einer an P1 (ohne Multiplex).
; @group Bauteilebibliothek
; @mode int
; @io P0=2x7seg
;
; PORT-oben (P0) = linke Ziffer, PORT-unten (P1) = rechte Ziffer. Belegung je Port nach dem Handbuch:
;   D0 = dp, D1 = c, D2 = d, D3 = e, D4 = b, D5 = a, D6 = f, D7 = g   (1 = Segment leuchtet)

        ORG   0
        MOV   R6,#0           ; Zehner
        MOV   R7,#0           ; Einer
        MOV   DPTR,#segtab
zeige:  MOV   A,R6
        MOVC  A,@A+DPTR
        MOV   P0,A
        MOV   A,R7
        MOVC  A,@A+DPTR
        MOV   P1,A
        MOV   R5,#2           ; 0,2 s
        LCALL pause
        INC   R7
        CJNE  R7,#10,zeige
        MOV   R7,#0
        INC   R6
        CJNE  R6,#10,zeige
        MOV   R6,#0
        SJMP  zeige

; Pause: R5 × 100 ms
pause:  MOV   R2,#200
pw1:     MOV   R3,#250
pw2:     DJNZ  R3,pw2
        DJNZ  R2,pw1
        DJNZ  R5,pause
        RET

segtab: DB   7Eh, 12h, 0BCh, 0B6h, 0D2h, 0E6h, 0EEh, 32h, 0FEh, 0F6h   ; Ziffern 0–9
        END
