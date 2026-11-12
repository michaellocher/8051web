; @title IC-Tester (4 Gattertypen)
; @desc Wählen Sie am IC-Tester ein IC (NAND, AND, OR oder EXOR) und tauschen Sie es mit der Wechsel-Taste „Error“ gegen eines mit defekten Gattern. Nach Start prüft das Programm alle vier Gatter mit der Wahrheitstabelle, zeigt defekte Gatter über Er1…Er4 an und meldet ein fehlerfreies IC mit OK.
; @group Bauteilebibliothek
; @mode int
; @io P0=ictester
;
; PORT-oben (P0):  D0 = A, D1 = B (Ausgänge, an allen Gattern)   D2–D5 = Y1–Y4 (Eingänge)   D6 = Er1, D7 = Er2
; PORT-unten (P1): D0 = Er3, D1 = Er4, D2 = OK   D3 = NAND, D4 = AND, D5 = OR, D6 = EXOR (Tasten, gewählte = 0)
;                  D7 = Start (0 = gedrückt)
; Wahrheitstabelle als Maske: Bit n = Ausgang bei Eingangskombination n (n = A + 2·B)
;   NAND = 07h   AND = 08h   OR = 0Eh   EXOR = 06h

START   BIT   P1.7

        ORG   0
        MOV   DPTR,#bits
        MOV   P0,#3Ch         ; A = B = 0, Y-Leitungen als Eingang, Er1/Er2 aus
        MOV   P1,#0F8h        ; Er3/Er4/OK aus, Tasten und Start als Eingang
warte:  JB    START,warte     ; auf Start warten
        MOV   P0,#3Ch         ; Anzeigen löschen
        MOV   P1,#0F8h
        MOV   A,P1            ; gewähltes IC aus den Tasten D3–D6 bestimmen
        ANL   A,#78h
        MOV   R3,#07h         ; NAND
        CJNE  A,#70h,typ1
        SJMP  pruefe
typ1:     MOV   R3,#08h         ; AND
        CJNE  A,#68h,typ2
        SJMP  pruefe
typ2:     MOV   R3,#0Eh         ; OR
        CJNE  A,#58h,typ3
        SJMP  pruefe
typ3:     MOV   R3,#06h         ; EXOR
pruefe: MOV   R2,#0           ; R2 = Fehlermaske (Bit 0 = Gatter 1 … Bit 3 = Gatter 4)
        MOV   R6,#0           ; R6 = Eingangskombination 0–3
kombi:  MOV   A,R6
        ORL   A,#3Ch          ; A und B ausgeben, Y-Leitungen auf 1 lassen
        MOV   P0,A
        MOV   A,R6
        MOVC  A,@A+DPTR       ; Maske Bit n
        ANL   A,R3            ; erwartetes Ergebnis für diese Kombination
        JZ    erw0
        MOV   B,#0Fh          ; erwartet: Y1–Y4 = 1
        SJMP  vergl
erw0:   MOV   B,#00h          ; erwartet: Y1–Y4 = 0
vergl:  MOV   A,P0            ; gemessene Y1–Y4 (D2–D5)
        RR    A
        RR    A
        ANL   A,#0Fh
        XRL   A,B             ; gesetztes Bit = Gatter weicht ab
        ORL   A,R2
        MOV   R2,A
        INC   R6
        CJNE  R6,#4,kombi
; Ergebnis anzeigen
        MOV   A,R2            ; Er1 = D6, Er2 = D7 an PORT-oben
        ANL   A,#03h
        RR    A
        RR    A
        ORL   A,#3Ch
        MOV   P0,A
        MOV   A,R2            ; Er3 = D0, Er4 = D1 an PORT-unten
        RR    A
        RR    A
        ANL   A,#03h
        MOV   R7,A
        MOV   A,R2
        JNZ   anz
        MOV   R7,#04h         ; kein Fehler: OK
anz:    MOV   A,R7
        ORL   A,#0F8h
        MOV   P1,A
los:    JNB   START,los       ; Start loslassen
        SJMP  warte

bits:   DB   01h, 02h, 04h, 08h
        END
