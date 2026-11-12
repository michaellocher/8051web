; @title Timer-Interrupt
; @desc Timer 0 erzeugt alle 50 ms einen Interrupt; jede halbe Sekunde zählt P1 binär hoch.
; @mode int
; @io P1=leds
;
; Zeigt Interrupt-Vektor, TMOD/TCON/IE und das Nachladen von TH0/TL0.

RELOAD  EQU   -50000          ; 50 000 Zyklen = 50 ms @ 12 MHz

        ORG   0000h
        LJMP  main
        ORG   000Bh           ; Vektor Timer 0
        LJMP  t0isr

        ORG   0030h
main:   MOV   TMOD,#01h       ; Timer 0, Mode 1 (16 Bit)
        MOV   TH0,#HIGH RELOAD
        MOV   TL0,#LOW RELOAD
        MOV   R7,#10
        MOV   P1,#0
        SETB  ET0             ; Timer-0-Interrupt freigeben
        SETB  EA              ; globale Freigabe
        SETB  TR0             ; Timer starten
        SJMP  $               ; Hauptprogramm tut nichts

t0isr:  MOV   TH0,#HIGH RELOAD
        MOV   TL0,#LOW RELOAD
        DJNZ  R7,fertig
        MOV   R7,#10
        INC   P1
fertig: RETI
        END
