; @title Würfel-2 – Decoder, Start und Reset
; @desc Würfel-2 an P1: Solange Start (D3) gedrückt ist, zählt das Programm 1–6 durch, beim Loslassen bleibt die Augenzahl stehen. Reset (D4) löscht den Würfel (Wert 0 = leer). Die LEDs D5–D7 zeigen: 6 gewürfelt, gerade, ungerade.
; @group Bauteilebibliothek
; @mode int
; @io P1=dice2
;
; Würfel-2: D0–D2 = Wert (0 und 7 = leer, 1–6 = Augen), D3 = Start, D4 = Reset (Eingänge, 1 = gedrückt),
;           D5–D7 = LEDs (Ausgänge, 1 = an): hier D5 = Sechs, D6 = gerade, D7 = ungerade

START   BIT   P1.3
RESET   BIT   P1.4

        ORG   0
        MOV   R0,#0           ; Augenzahl
        MOV   DPTR,#lampen
loop:   JNB   RESET,nreset
        MOV   R0,#0           ; Reset: Würfel löschen
        SJMP  zeige
nreset: JNB   START,zeige     ; nicht gedrückt: Wert halten
        INC   R0              ; rollen: 1 … 6
        CJNE  R0,#7,zeige
        MOV   R0,#1
zeige:  MOV   A,R0
        MOVC  A,@A+DPTR       ; LED-Bits für diesen Wert
        ORL   A,R0            ; Wert in D0–D2
        ORL   A,#18h          ; Tasten-Pins bleiben Eingang
        MOV   P1,A
        SJMP  loop

;            0     1    2    3    4    5    6
lampen: DB   00h, 80h, 40h, 80h, 40h, 80h, 60h
        END
