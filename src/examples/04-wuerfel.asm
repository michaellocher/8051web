; @title Würfel-1 – Würfeln mit dem Schiebeschalter
; @desc Würfel-1 an P2: Solange der Schiebeschalter (D7) rechts steht (1), rollt der Würfel; schiebt man ihn zurück, bleibt die Augenzahl stehen.
; @mode int
; @io P2=dice
;
; Belegung P2:  D0–D6 = Leuchtpunkte (Ausgänge, 1 = an):
;                 D0 oben links   D4 oben rechts
;                 D1 Mitte links  D3 Mitte  D5 Mitte rechts
;                 D2 unten links  D6 unten rechts
;               D7 = Schiebeschalter (Eingang, 1 = rechts)

        ORG   0
        MOV   R0,#0
loop:   JNB   P2.7,zeige      ; Schalter links: Augenzahl halten
        INC   R0
        CJNE  R0,#6,zeige
        MOV   R0,#0
zeige:  MOV   A,R0
        MOV   DPTR,#augen
        MOVC  A,@A+DPTR       ; Bitmuster aus Tabelle holen
        ORL   A,#80h          ; D7 bleibt Eingang (auf 1 gesetzt)
        MOV   P2,A
        SJMP  loop

;       1    2    3    4    5    6
augen:  DB    08h, 41h, 49h, 55h, 5Dh, 77h
        END
