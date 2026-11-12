; @title Farbsensor
; @desc Die Scheibe (P1) dreht sich vor dem Farbsensor. Steht ein Feld mittig, zeigt die 7-Segment-Anzeige (P2) seine Farbe: r = rot, b = blau, S = schwarz, - = grau. Mit Klick auf ein Feld lässt sich seine Farbe ändern.
; @group Bauteilebibliothek
; @mode int
; @io P1=farbsensor
; @io P2=7seg
;
; Farbsensor: P1.0–P1.1 = Farbcode (0 grau, 1 rot, 2 blau, 3 schwarz), P1.2 = Feld steht mittig (Eingänge)
;             P1.4 = Motor links, P1.5 = Motor rechts, P1.6 = Sensorlampe (Ausgänge)

MITTE   BIT   P1.2

        ORG   0
        MOV   P1,#0EFh        ; Lampe an, Motor rechts an, Motor links aus
loop:   JNB   MITTE,loop      ; auf ein Feld in der Mitte warten
        MOV   A,P1
        ANL   A,#03h          ; Farbcode
        MOV   DPTR,#farben
        MOVC  A,@A+DPTR
        CPL   A               ; 7-Segment ist bei 0 aktiv
        MOV   P2,A
warte:  JB    MITTE,warte     ; Feld verlassen lassen
        SJMP  loop

;            grau  rot  blau schwarz
farben: DB   40h,  50h,  7Ch,  6Dh   ; - r b S
        END
