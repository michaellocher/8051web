; @title Waggonbeladung (externes Modell)
; @desc Start (S1): bei Waggon in Position, nicht voll und Silo nicht leer laufen Fluidisierung P1 und Gebläse P2, nach 2 s die Zellenradschleuse P3 bis der Waggon voll ist (S4); P2 läuft 3 s nach. Abbruch bei leerem Silo oder fehlendem Waggon. Waggons mit S6/S7, Silo mit S8 bedienen.
; @group Externe Modelle
; @mode int
; @io P0=ext-waggon
;
; P0 → Ax:  .0 P1 Fluidisierung  .1 P2 Fördergebläse  .2 P3 Zellenradschleuse
; Ex → P1:  .0 S1 Start  .1 S2 Silo nicht leer  .2 S3 Silo voll  .3 S4 Waggon voll  .4 S5 Waggon in Position
;           .5 S6 Leerwaggon ein  .6 S7 Vollwaggon aus  .7 S8 Silo füllen

FLUID   BIT   P0.0
GEBLAE  BIT   P0.1
ZELLE   BIT   P0.2
S1      BIT   P1.0
S2      BIT   P1.1
S4      BIT   P1.3
S5      BIT   P1.4
S6      BIT   P1.5
S7      BIT   P1.6

        ORG   0
        MOV   P1,#0FFh
start:  MOV   P0,#00h         ; alles aus
warte:  JNB   S1,warte        ; auf Start warten
        JNB   S5,warte        ; Waggon in Position?
        JB    S4,warte        ; Waggon noch leer?
        JB    S6,warte        ; kein Waggon in Bewegung
        JB    S7,warte
        JNB   S2,warte        ; Silo nicht leer?
        SETB  FLUID           ; Fluidisierung und Gebläse zuerst
        SETB  GEBLAE
        MOV   R7,#20          ; 2 s Vorlauf
vor:    ACALL zehntel
        DJNZ  R7,vor
        SETB  ZELLE           ; Schleuse dosiert
fuell:  JB    S4,fertig       ; Waggon voll
        JNB   S2,abbruch      ; Silo leer
        JNB   S5,abbruch      ; Waggon nicht mehr in Position
        SJMP  fuell
abbruch: CLR  ZELLE           ; Schleuse sofort aus
        SJMP  nach
fertig: CLR   ZELLE
nach:   MOV   R7,#30          ; Gebläse 3 s nachlaufen: Leitung leerblasen
nl:     ACALL zehntel
        DJNZ  R7,nl
        CLR   GEBLAE
        CLR   FLUID
ende:   JB    S1,ende         ; Start erst wieder nach Loslassen
        SJMP  start

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
