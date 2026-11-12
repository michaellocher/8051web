; @title Garagentorsteuerung (externes Modell)
; @desc Schlüsselschalter S1 oder Handtaster S2 wirken als Impuls: Tor zu → öffnen, offen → schließen, während der Fahrt → anhalten. Beim Schließen öffnet die Lichtschranke Se3 das Tor wieder. Die Warnleuchte H1 leuchtet während der Fahrt.
; @group Externe Modelle
; @mode int
; @io P0=ext-garagentor
;
; P0 → Ax:  .0 M1 Tor hoch  .1 M2 Tor runter  .2 H1 Warnleuchte
; Ex → P1:  .0 S1 Schlüsselschalter  .1 S2 Handtaster  .2 Se1 oben  .3 Se2 unten  .4 Se3 Lichtschranke

M1      BIT   P0.0
M2      BIT   P0.1
H1      BIT   P0.2
S1      BIT   P1.0
S2      BIT   P1.1
SE1     BIT   P1.2
SE2     BIT   P1.3
SE3     BIT   P1.4
LASTUP  BIT   20h.0          ; letzte Fahrtrichtung war „hoch"

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
idle:   JB    S1,cmd
        JB    S2,cmd
        SJMP  idle
cmd:    JB    SE1,runter      ; offen → schließen
        JB    SE2,hoch        ; zu → öffnen
        JB    LASTUP,runter      ; in der Mitte: Richtung umkehren
        SJMP  hoch
frei:   JB    S1,frei         ; Taster loslassen
        JB    S2,frei
        RET

hoch:   ACALL frei
        SETB  LASTUP
        CLR   M2
        SETB  M1
        SETB  H1
a1:     JB    SE1,ende
        JB    S1,stopp
        JB    S2,stopp
        SJMP  a1

runter: ACALL frei
        CLR    LASTUP
        CLR   M1
        SETB  M2
        SETB  H1
b1:     JB    SE3,hoch        ; Hindernis → sofort wieder hoch
        JB    SE2,ende
        JB    S1,stopp
        JB    S2,stopp
        SJMP  b1

stopp:  ACALL frei
ende:   CLR   M1
        CLR   M2
        CLR   H1
        SJMP  idle
        END
