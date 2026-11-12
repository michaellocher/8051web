; @title Schwesternrufanlage (externes Modell)
; @desc Ruf aus Zimmer 1–3: Flurlampe, Anzeige im Schwesternzimmer und Summer. Summer mit S3 quittieren, Ruf mit der Anwesenheitstaste im Zimmer löschen (alle Taster Öffner).
; @group Externe Modelle
; @mode int
; @io P0=ext-schwest
;
; P0 → Ax:  .0–.2 P1.1–P1.3 Flurlampen   .3–.5 P2.1–P2.3 Anzeige Schwesternzimmer   .6 P0 Summer
; Ex → P1:  .0 S1.1 Ruf 1  .1 S2.1 Anwesend 1  .2 S1.2 Ruf 2  .3 S2.2 Anwesend 2  .4 S1.3 Ruf 3  .5 S2.3 Anwesend 3
;           .6 S3 Quittieren     Alle Taster sind Öffner: 0 = betätigt, 1 = in Ruhe (Drahtbruch = 0 = Ruf!)

L1      BIT   P0.0
L2      BIT   P0.1
L3      BIT   P0.2
A1      BIT   P0.3
A2      BIT   P0.4
A3      BIT   P0.5
SUMMER  BIT   P0.6
RUF1    BIT   P1.0
DA1     BIT   P1.1
RUF2    BIT   P1.2
DA2     BIT   P1.3
RUF3    BIT   P1.4
DA3     BIT   P1.5
QUIT    BIT   P1.6

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
loop:   JB    RUF1,z2         ; Zimmer 1: Ruftaste betätigt (Öffner → 0)?
        SETB  L1              ; Flurlampe und Anzeige an
        SETB  A1
        SETB  SUMMER
z2:     JB    RUF2,z3
        SETB  L2
        SETB  A2
        SETB  SUMMER
z3:     JB    RUF3,qt
        SETB  L3
        SETB  A3
        SETB  SUMMER
qt:     JB    QUIT,da         ; Quittiertaste betätigt → Summer aus
        CLR   SUMMER
da:     JB    DA1,d2          ; Schwester in Zimmer 1 → Ruf löschen
        CLR   L1
        CLR   A1
d2:     JB    DA2,d3
        CLR   L2
        CLR   A2
d3:     JB    DA3,loop
        CLR   L3
        CLR   A3
        SJMP  loop
        END
