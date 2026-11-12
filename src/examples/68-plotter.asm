; @title xy-Plotter – Quadrat mit Diagonalen
; @desc Der Plotter (P1) setzt sich zurück, zeichnet ein schwarzes Quadrat, eine rote und eine blaue Diagonale und ein kleines grünes Quadrat. Jeder Schritt ist ein Impuls (steigende Flanke) auf D0–D3.
; @group Bauteilebibliothek
; @mode int
; @io P1=plotter
;
; Belegung P1 (alle Ausgänge, high-aktiv):
;   D0 x+1   D1 x-1   D2 y+1   D3 y-1   (je Impuls 0 -> 1 ein Pixel)
;   D4 Stift (0 = oben, 1 = unten)   D5/D6 Farbe (00 schwarz, 10 rot, 01 blau, 11 grün)
;   D7 Reset auf Position 0,0 (löscht auch die Arbeitsfläche)
;
; R7 = Stift- und Farbbits (ohne Schrittbits), R3 = Schrittzähler

        ORG   0
        MOV   P1,#80h         ; Reset: Position 0,0, Fläche löschen
        MOV   R7,#00h         ; Stift oben, schwarz
        MOV   P1,R7

        ; zum Startpunkt (10, 10) fahren
        MOV   R3,#10
s1:     LCALL xp
        DJNZ  R3,s1
        MOV   R3,#10
s2:     LCALL yp
        DJNZ  R3,s2

        ; schwarzes Quadrat, Kantenlänge 60
        MOV   R7,#10h         ; Stift senken
        MOV   P1,R7
        MOV   R3,#60
q1:     LCALL xp
        DJNZ  R3,q1
        MOV   R3,#60
q2:     LCALL yp
        DJNZ  R3,q2
        MOV   R3,#60
q3:     LCALL xm
        DJNZ  R3,q3
        MOV   R3,#60
q4:     LCALL ym
        DJNZ  R3,q4

        ; rote Diagonale von (10,10) nach (70,70)
        MOV   R7,#30h         ; Stift unten, rot
        MOV   P1,R7
        MOV   R3,#60
d1:     LCALL dp
        DJNZ  R3,d1
        ; Stift heben, nach (70,10) fahren
        MOV   R7,#20h
        MOV   P1,R7
        MOV   R3,#60
d2:     LCALL ym
        DJNZ  R3,d2
        ; blaue Diagonale von (70,10) nach (10,70)
        MOV   R7,#50h         ; Stift unten, blau
        MOV   P1,R7
        MOV   R3,#60
d3:     LCALL dm
        DJNZ  R3,d3
        ; Stift heben, nach (30,30) fahren
        MOV   R7,#40h
        MOV   P1,R7
        MOV   R3,#20
d4:     LCALL xp
        DJNZ  R3,d4
        MOV   R3,#40
d5:     LCALL ym
        DJNZ  R3,d5
        ; grünes Quadrat, Kantenlänge 20
        MOV   R7,#70h
        MOV   P1,R7
        MOV   R3,#20
g1:     LCALL xp
        DJNZ  R3,g1
        MOV   R3,#20
g2:     LCALL yp
        DJNZ  R3,g2
        MOV   R3,#20
g3:     LCALL xm
        DJNZ  R3,g3
        MOV   R3,#20
g4:     LCALL ym
        DJNZ  R3,g4
        MOV   R7,#00h         ; Stift hoch
        MOV   P1,R7
        SJMP  $

; Einzelschritte: Schrittbit setzen (steigende Flanke), danach zurücknehmen
xp:     MOV   A,R7
        ORL   A,#01h          ; x+1
        SJMP  schritt
xm:     MOV   A,R7
        ORL   A,#02h          ; x-1
        SJMP  schritt
yp:     MOV   A,R7
        ORL   A,#04h          ; y+1
        SJMP  schritt
ym:     MOV   A,R7
        ORL   A,#08h          ; y-1
        SJMP  schritt
dp:     MOV   A,R7
        ORL   A,#05h          ; x+1 und y+1
        SJMP  schritt
dm:     MOV   A,R7
        ORL   A,#06h          ; x-1 und y+1
schritt:
        MOV   P1,A
        MOV   P1,R7
        RET
        END
