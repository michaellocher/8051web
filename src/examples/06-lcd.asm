; @title LCD-Anzeige
; @desc Text auf einem HD44780-LCD (2×16) im 4-Bit-Modus an P2.
; @mode int
; @io P2=lcd
;
; Belegung P2:  .0–.3 D4–D7   .4 R/W   .6 E   .7 RS

RS      BIT   P2.7
EN      BIT   P2.6

        ORG   0
        MOV   SP,#30h
        LCALL lcdinit
        MOV   DPTR,#zeile1
        LCALL puts
        MOV   A,#0C0h         ; Cursor an den Anfang von Zeile 2
        LCALL lcdcmd
        MOV   DPTR,#zeile2
        LCALL puts
        SJMP  $

lcdinit:
        LCALL warte
        MOV   A,#03h          ; 3× "8-Bit-Modus" (Reset-Sequenz)
        LCALL nibcmd
        LCALL warte
        MOV   A,#03h
        LCALL nibcmd
        MOV   A,#03h
        LCALL nibcmd
        MOV   A,#02h          ; auf 4-Bit-Modus umschalten
        LCALL nibcmd
        MOV   A,#28h          ; 4 Bit, 2 Zeilen, 5×8 Punkte
        LCALL lcdcmd
        MOV   A,#0Ch          ; Anzeige an, Cursor aus
        LCALL lcdcmd
        MOV   A,#06h          ; Cursor nach rechts
        LCALL lcdcmd
        MOV   A,#01h          ; Anzeige löschen
        LCALL lcdcmd
        LCALL warte
        RET

lcdcmd: CLR   RS
        SJMP  lcdbyte
lcddat: SETB  RS
lcdbyte:
        PUSH  ACC
        SWAP  A
        LCALL nibble          ; High-Nibble zuerst
        POP   ACC
        LCALL nibble          ; dann Low-Nibble
        MOV   R6,#50          ; ca. 100 µs warten
        DJNZ  R6,$
        RET

nibcmd: CLR   RS
nibble: ANL   A,#0Fh
        ANL   P2,#0E0h        ; D4–D7 und R/W löschen, RS behalten
        ORL   P2,A
        SETB  EN              ; Übernahme mit fallender Flanke an E
        CLR   EN
        RET

puts:   CLR   A
        MOVC  A,@A+DPTR
        JZ    putsend
        LCALL lcddat
        INC   DPTR
        SJMP  puts
putsend:
        RET

; ca. 5 ms
warte:  MOV   R7,#10
w1:     MOV   R6,#250
        DJNZ  R6,$
        DJNZ  R7,w1
        RET

zeile1: DB    'Hallo 8051!', 0
zeile2: DB    'Web-Edition 2027', 0
        END
