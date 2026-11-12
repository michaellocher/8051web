; @title Zweitanksystem (externes Modell)
; @desc EIN (S0) startet die Anlage: Becken 1 füllen, bei Bedarf nach Becken 2 umpumpen, Entnahme per Taster S2. Überlauf und Leerlauf vermeiden. AUS (S1) stoppt.
; @group Externe Modelle
; @mode int
; @io P0=ext-zweitank
;
; P0 → Ax:  .0 V1 Zulauf  .1 V2 Becken1→2  .2 V3 Entnahme  .3 H1 Anlage EIN
; Ex → P1:  .0 S0 EIN  .1 S1 AUS  .2 S2 Entnahme  .3 S3 B1 voll  .4 S4 B1 nicht leer
;           .5 S5 B2 voll  .6 S6 B2 nicht leer

V1      BIT   P0.0
V2      BIT   P0.1
V3      BIT   P0.2
H1      BIT   P0.3
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
S3      BIT   P1.3
S4      BIT   P1.4
S5      BIT   P1.5
S6      BIT   P1.6

        ORG   0
        MOV   P1,#0FFh        ; P1 als Eingang
aus:    MOV   P0,#00h         ; alles zu, Anlage aus
warte:  JNB   S0,warte        ; auf EIN warten
        SETB  H1              ; Anlage EIN
loop:   JB    S1,aus          ; AUS gedrückt?
        MOV   C,S3            ; V1: füllen, solange Becken 1 nicht voll
        CPL   C
        MOV   V1,C
        MOV   C,S4            ; V2: umpumpen, wenn B1 nicht leer
        ANL   C,/S5           ;     und B2 noch nicht voll
        MOV   V2,C
        MOV   C,S2            ; V3: nur auf Anforderung (S2)
        ANL   C,S6            ;     und wenn B2 nicht leer
        MOV   V3,C
        SJMP  loop
        END
