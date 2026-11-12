; @title Aufzug-1 – Lastenaufzug
; @desc Lastenaufzug an P1: Die Taste „up“ fährt den Wagen bis zum oberen Positionssensor, „dn“ bis zum unteren Positionssensor. Dort schaltet der Motor ab.
; @group Bauteilebibliothek
; @mode int
; @io P1=aufzug1
;
; Belegung P1:  D0 Motoranschluss 1   D1 Motoranschluss 2    (Ausgänge; 10 = aufwärts, 01 = abwärts, 00/11 = aus)
;               D2 Positionssensor unten   D3 Positionssensor oben
;               D4 Bedientaste aufwärts    D5 Bedientaste abwärts   (Eingänge, 1 = aktiv / gedrückt)

UNTEN   BIT   P1.2
OBEN    BIT   P1.3
TAUP    BIT   P1.4
TADN    BIT   P1.5
MOT1    BIT   P1.0
MOT2    BIT   P1.1

        ORG   0
        MOV   P1,#3Ch         ; Motor aus, Eingangsbits D2–D5 auf 1

warte:  JB    TAUP,hoch
        JB    TADN,runter
        SJMP  warte

hoch:   JB    OBEN,warte      ; schon oben
        CLR   MOT2
        SETB  MOT1            ; Motor aufwärts
h1:     JNB   OBEN,h1         ; fahren, bis der obere Sensor anspricht
        CLR   MOT1            ; Motor aus
        SJMP  warte

runter: JB    UNTEN,warte     ; schon unten
        CLR   MOT1
        SETB  MOT2            ; Motor abwärts
rr1:     JNB   UNTEN,rr1
        CLR   MOT2
        SJMP  warte
        END
