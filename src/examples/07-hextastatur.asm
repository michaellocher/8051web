; @title HEX-Tastatur
; @desc Die gedrückte Taste der HEX-Tastatur (P1) erscheint auf der 7-Segment-Anzeige (P2): Ziffern 0–F als Hex-Ziffer, die Rechentasten (/ * - + C =) als Strich.
; @mode int
; @io P1=hexkeys
; @io P2=7seg
;
; HEX-Tastatur: Code der Taste 00h–15h an P1.0–P1.7, FFh = keine Taste (Tastendruck wird gespeichert).
;               Tasten 0–F = 00h–0Fh, / = 10h, * = 11h, - = 12h, + = 13h, C = 14h, = = 15h
; 7-Segment:    P2.0–P2.6 = Segmente a–g, P2.7 = DP; Voreinstellung "0 - aktiv" (Segment leuchtet bei 0).

        ORG   0
        MOV   P1,#0FFh        ; P1 als Eingang
        MOV   P2,#0BFh        ; Strich "-" (Segment g) anzeigen
loop:   MOV   A,P1
        CJNE  A,#0FFh,taste   ; FFh = keine Taste gedrückt
        SJMP  loop
taste:  CJNE  A,#10h,vergl    ; Vergleich nur für das Carry
vergl:  JC    ziffer          ; Code < 10h → Hex-Ziffer
        MOV   A,#0BFh         ; Rechentaste → Strich
        SJMP  zeige
ziffer: MOV   DPTR,#segtab
        MOVC  A,@A+DPTR
        CPL   A               ; Anzeige ist bei 0 aktiv
zeige:  MOV   P2,A
        SJMP  loop

;            0    1    2    3    4    5    6    7
segtab: DB   3Fh, 06h, 5Bh, 4Fh, 66h, 6Dh, 7Dh, 07h
;            8    9    A    b    C    d    E    F
        DB   7Fh, 6Fh, 77h, 7Ch, 39h, 5Eh, 79h, 71h
        END
