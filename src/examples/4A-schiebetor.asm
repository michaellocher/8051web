; @title Schiebetorsteuerung (externes Modell)
; @desc Öffnen (S4) und Schließen (S2) fahren das Tor bis zum Endschalter, STOP (S1) hält an. Wird beim Schließen die Lichtschranke S6 unterbrochen, öffnet das Tor sofort wieder. H3 blinkt bei Bewegung.
; @group Externe Modelle
; @mode int
; @io P0=ext-schiebetor
;
; P0 → Ax:  .0 H1 offen  .1 H2 zu  .2 H3 Warnleuchte  .3 K1 schließen  .4 K2 öffnen
; Ex → P1:  .0 S1 STOP  .1 S2 Schließen  .2 S3 zu  .3 S4 Öffnen  .4 S5 offen  .5 S6 Lichtschranke

H1      BIT   P0.0
H2      BIT   P0.1
H3      BIT   P0.2
K1      BIT   P0.3
K2      BIT   P0.4
S1      BIT   P1.0
S2      BIT   P1.1
S3      BIT   P1.2
S4      BIT   P1.3
S5      BIT   P1.4
S6      BIT   P1.5

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
main:   MOV   C,S5            ; Lampen H1/H2 zeigen die Endlagen
        MOV   H1,C
        MOV   C,S3
        MOV   H2,C
        JB    S1,main
        JB    S4,oeffnen
        JB    S2,schliess
        SJMP  main

oeffnen: CLR  K1
        SETB  K2
        SETB  H3
o1:     JB    S1,halt
        JB    S5,fertig
        SJMP  o1

schliess: JB  S6,main         ; Durchfahrt blockiert: nicht schließen
        CLR   K2
        SETB  K1
        SETB  H3
c1:     JB    S1,halt
        JB    S6,hindern      ; Hindernis → wieder öffnen
        JB    S3,fertig
        SJMP  c1

hindern: CLR  K1
        SJMP  oeffnen

halt:   CLR   K1
        CLR   K2
        CLR   H3
hk:     JB    S1,hk
        SJMP  main
fertig: CLR   K1
        CLR   K2
        CLR   H3
        SJMP  main
        END
