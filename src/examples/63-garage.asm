; @title Garage – Tor mit Fernbedienung
; @desc Garagentor an P1: Ein Druck auf die Fernbedienungstaste (D0) fährt das Tor auf bzw. zu, ein Druck während der Fahrt hält es an. Die Endschalter D1 (unten) und D2 (oben) stoppen den Motor.
; @group Bauteilebibliothek
; @mode int
; @io P1=garage
;
; Belegung P1:  D0 Fernbedienungstaste (Eingang, 1 = gedrückt)
;               D1 Endschalter unten   D2 Endschalter oben   (Eingänge, 1 = betätigt)
;               D3/D4 Tormotor (Ausgänge): 10 = Tor hoch, 01 = Tor runter, 00/11 = aus
;
; Beim Überfahren eines Endschalters ertönt ein Warnton (hier: Motor sofort aus, kein Warnton).

TASTE   BIT   P1.0
UNTEN   BIT   P1.1
OBEN    BIT   P1.2
HOCH    BIT   P1.3
RUNTER  BIT   P1.4

        ORG   0
        MOV   P1,#07h         ; Motor aus, Eingänge D0–D2 auf 1

warte:  JNB   TASTE,warte     ; auf die Fernbedienung warten
los:    JB    TASTE,los       ; Taste loslassen
        JB    OBEN,schliessen ; Tor ganz offen -> schließen
        ; sonst (zu oder halb offen) -> öffnen

oeffnen:
        CLR   RUNTER
        SETB  HOCH            ; Tor hoch
o1:     JB    OBEN,aus        ; Endschalter oben erreicht
        JB    TASTE,aus       ; Taste: Tor anhalten
        SJMP  o1

schliessen:
        CLR   HOCH
        SETB  RUNTER          ; Tor runter
s1:     JB    UNTEN,aus       ; Endschalter unten erreicht
        JB    TASTE,aus
        SJMP  s1

aus:    CLR   HOCH
        CLR   RUNTER          ; Motor aus
l2:     JB    TASTE,l2        ; Taste loslassen
        SJMP  warte
        END
