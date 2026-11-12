; @title Tastatur (ASCII)
; @desc Die PC-Tastatur (P1) liefert ASCII-Zeichen mit Strobe. Der Code der zuletzt gedrückten Taste erscheint binär auf den LEDs (P2), die Anzahl der Zeichen als BCD-Zahl auf P0.
; @group Bauteilebibliothek
; @mode int
; @io P0=2x7bcd
; @io P1=keyboard
; @io P2=leds
;
; Tastatur: P1.0–P1.6 = ASCII-Code, P1.7 = Strobe (0 = Zeichen bereit).
; Das Zeichen wird gelesen und mit einem Low-Impuls an P1.7 quittiert (CLR/SETB);
; danach liefert die Tastatur das nächste Zeichen aus ihrem Puffer.

STROBE  BIT   P1.7

        ORG   0
        MOV   R7,#0           ; Zeichenzähler (BCD)
        MOV   P0,#0
        MOV   P2,#0
        MOV   P1,#0FFh        ; alle Leitungen als Eingang
warte:  JB    STROBE,warte    ; auf Zeichen warten
        MOV   A,P1
        ANL   A,#7Fh          ; ASCII-Code (7 Bit)
        MOV   P2,A            ; Code auf die LEDs
        CLR   STROBE          ; quittieren …
        SETB  STROBE          ; … und wieder freigeben
        MOV   A,R7
        ADD   A,#1
        DA    A
        MOV   R7,A
        MOV   P0,A
        SJMP  warte
        END
