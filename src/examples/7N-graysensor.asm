; @title GRAY-Sensor
; @desc Der GRAY-Geber (P1) liefert Gray-Code. Das Programm wandelt ihn in eine Dualzahl um und zeigt sie als Hex-Ziffer auf der 7-Segment-Anzeige (P2); der rohe Gray-Code liegt auf den LEDs (P0).
; @group Bauteilebibliothek
; @mode int
; @io P0=leds
; @io P1=graysensor
; @io P2=7seg
;
; GRAY-Geber: P1.0–P1.3 = Gray-Code der Stellung (0–F; weiß = 1, äußerster Ring = P1.0), P1.4–P1.7 unbenutzt.
; 7-Segment:  P2.0–P2.6 = Segmente a–g, Voreinstellung "0 - aktiv".
; Umwandlung Gray → Dual:  t = g XOR (g >> 1);   b = t XOR (t >> 2)
; Den Zeiger mit dem Mausrad drehen (oder mit der Maus ziehen, Pfeiltasten).

        ORG   0
        MOV   P1,#0FFh        ; alle Pins als Eingang
loop:   MOV   A,P1
        ANL   A,#0Fh          ; nur die vier Spuren
        MOV   P0,A            ; Gray-Code auf die LEDs
        MOV   R0,A            ; g merken
        CLR   C
        RRC   A               ; g >> 1
        XRL   A,R0            ; t = g XOR (g >> 1)
        MOV   R0,A
        CLR   C
        RRC   A
        CLR   C
        RRC   A               ; t >> 2
        XRL   A,R0            ; b = t XOR (t >> 2)
        MOV   DPTR,#segtab
        MOVC  A,@A+DPTR
        CPL   A               ; Anzeige ist bei 0 aktiv
        MOV   P2,A
        SJMP  loop

;            0    1    2    3    4    5    6    7
segtab: DB   3Fh, 06h, 5Bh, 4Fh, 66h, 6Dh, 7Dh, 07h
;            8    9    A    b    C    d    E    F
        DB   7Fh, 6Fh, 77h, 7Ch, 39h, 5Eh, 79h, 71h
        END
