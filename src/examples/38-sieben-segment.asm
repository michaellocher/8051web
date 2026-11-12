; @title Sieben-Segment-Anzeige (externes Modell)
; @desc Die vier BCD-Schalter (Ex.0–3) werden gelesen und über eine Tabelle (MOVC) in das Segmentmuster A–G (Ax.0–6) umgesetzt. Werte 10–15 erscheinen als A, b, C, d, E, F.
; @group Externe Modelle
; @mode int
; @io P0=ext-sieben
;
; P0 → Ax:  .0 A  .1 B  .2 C  .3 D  .4 E  .5 F  .6 G   (1 = Segment leuchtet)
; Ex → P1:  .0 S1 (1)  .1 S2 (2)  .2 S3 (4)  .3 S4 (8)

        ORG   0
        MOV   P1,#0FFh        ; P1 als Eingang
        MOV   DPTR,#tabelle   ; Anfang der Segmenttabelle
lies:   MOV   A,P1            ; Schalter lesen
        ANL   A,#0Fh          ; nur die vier BCD-Bits
        MOVC  A,@A+DPTR       ; Segmentmuster aus der Tabelle holen
        MOV   P0,A            ; an die Anzeige ausgeben
        SJMP  lies

;           0    1    2    3    4    5    6    7
tabelle: DB 3Fh, 06h, 5Bh, 4Fh, 66h, 6Dh, 7Dh, 07h
;           8    9    A    b    C    d    E    F
        DB  7Fh, 6Fh, 77h, 7Ch, 39h, 5Eh, 79h, 71h
        END
