; @title Behälter – Zweipunkt-Füllstandsregelung
; @desc Der Behälter an P1 wird über Ventil-1 bis Sensor C gefüllt und danach über Ventil-2 bis unter Sensor A entleert, immer wieder.
; @group Bauteilebibliothek
; @mode int
; @io P1=behaelter
;
; Belegung P1:  D0 Ventil-1 (Füllen)   D1 Ventil-2 (Leeren)       (Ausgänge, 1 = offen)
;               D2 Sensor-A (unten)   D3 Sensor-B   D4 Sensor-C (oben)   (Eingänge, 1 = Flüssigkeit am Sensor)

V1      BIT   P1.0
V2      BIT   P1.1
SENS_A  BIT   P1.2
SENS_C  BIT   P1.4

        ORG   0
        MOV   P1,#1Ch         ; Ventile zu, Eingangsbits D2–D4 auf 1

fuellen:
        CLR   V2              ; Ablauf zu
        SETB  V1              ; Zulauf auf
f1:     JNB   SENS_C,f1       ; warten, bis Sensor C Flüssigkeit meldet
        CLR   V1              ; Zulauf zu

        MOV   R5,#20          ; 2 s warten
        LCALL pause

        SETB  V2              ; Ablauf auf
l1:     JB    SENS_A,l1       ; ablassen, solange Sensor A noch Flüssigkeit meldet
        CLR   V2              ; Ablauf zu
        SJMP  fuellen

; Pause: R5 x 100 ms
pause:  MOV   R7,#200
pa1:    MOV   R6,#250
pa2:    DJNZ  R6,pa2
        DJNZ  R7,pa1
        DJNZ  R5,pause
        RET
        END
