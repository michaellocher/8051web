; @title 4 × 7-Segment (Daten + Select)
; @desc Vierstelliger Dezimalzähler 0000–9999 im Multiplexbetrieb: Segmentdaten an P1 (PORT-unten), Stellenwahl an P0 (PORT-oben, low-aktiv). Jede Stelle leuchtet 1 ms, alle 100 ms wird weitergezählt.
; @group Bauteilebibliothek
; @mode int
; @io P0=4x7mux
;
; PORT-oben (P0, Select, low-aktiv): .0 = Stelle ganz rechts (Einer) … .3 = Stelle ganz links (Tausender), 0 = Anzeige an
; PORT-unten (P1, Daten): .0 = a, .1 = b, .2 = c, .3 = d, .4 = e, .5 = f, .6 = g, .7 = dp
; Die Ziffern liegen im RAM: 30h = Einer, 31h = Zehner, 32h = Hunderter, 33h = Tausender

        ORG   0
        MOV   30h,#0
        MOV   31h,#0
        MOV   32h,#0
        MOV   33h,#0
        MOV   DPTR,#segtab
        MOV   R7,#25          ; 25 Durchläufe × 4 ms = 100 ms je Zählschritt
loop:   MOV   R0,#30h         ; erste Stelle
        MOV   R2,#0FEh        ; Select-Muster: Stelle 0 aktiv (Bit = 0)
scan:   MOV   P0,#0FFh        ; erst alle Stellen sperren,
        MOV   A,@R0
        MOVC  A,@A+DPTR       ; Segmentmuster der Ziffer
        MOV   P1,A            ; dann Daten ausgeben,
        MOV   P0,R2           ; dann die Stelle aktivieren
        LCALL ms
        MOV   A,R2
        RL    A               ; nächste Stelle
        MOV   R2,A
        INC   R0
        CJNE  R0,#34h,scan
        DJNZ  R7,loop
        MOV   R7,#25
zaehl:  MOV   R0,#30h         ; Dezimalzähler um 1 erhöhen
z1:     INC   @R0
        CJNE  @R0,#10,fertig
        MOV   @R0,#0          ; Überlauf einer Stelle: Übertrag
        INC   R0
        CJNE  R0,#34h,z1
fertig: SJMP  loop

; 1 ms warten
ms:     MOV   R3,#250
        DJNZ  R3,$
        MOV   R3,#250
        DJNZ  R3,$
        RET

segtab: DB   3Fh, 06h, 5Bh, 4Fh, 66h, 6Dh, 7Dh, 07h, 7Fh, 6Fh
        END
