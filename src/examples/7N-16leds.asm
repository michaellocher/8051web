; @title 16 LEDs (oben/unten)
; @desc Lauflicht über alle 16 LEDs: erst PORT-oben (P0), dann PORT-unten (P1), im Ring-Layout einmal im Kreis herum. 1 = rote LED, 0 = weiße LED. Mit dem Knopf „?“ am Modell lässt sich das Layout umschalten.
; @group Bauteilebibliothek
; @mode int
; @io P0=leds16
;
; PORT-oben (P0): D0–D7 = LED 0–7 (im Ring von links über oben nach rechts)
; PORT-unten (P1): D0–D7 = LED 0–7 (im Ring von rechts über unten nach links)

        ORG   0
start:  MOV   A,#1
        MOV   R2,#8
l1:     MOV   P0,A            ; eine rote LED wandert über PORT-oben
        MOV   P1,#00h
        LCALL pause
        RL    A
        DJNZ  R2,l1
        MOV   A,#1
        MOV   R2,#8
l2:     MOV   P0,#00h         ; … und weiter über PORT-unten
        MOV   P1,A
        LCALL pause
        RL    A
        DJNZ  R2,l2
        SJMP  start

; Pause 100 ms
pause:  MOV   R5,#100
pw1:    MOV   R3,#200
        DJNZ  R3,$
        DJNZ  R5,pw1
        RET
        END
