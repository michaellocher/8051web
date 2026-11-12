; @title Lauflicht
; @desc Ein Licht wandert über die acht LEDs an Port 1.
; @mode int
; @io P1=leds
;
; Klassiker: Akku um ein Bit rotieren und an P1 ausgeben.

        ORG   0000h
start:  MOV   A,#00000001b    ; Startmuster
loop:   MOV   P1,A            ; LED-Muster ausgeben
        LCALL delay
        RL    A               ; ein Bit weiter nach links
        SJMP  loop

; Verzögerung ca. 100 ms bei 12 MHz (200 × 250 × 2 Zyklen)
delay:  MOV   R7,#200
d1:     MOV   R6,#250
d2:     DJNZ  R6,d2
        DJNZ  R7,d1
        RET

        END
