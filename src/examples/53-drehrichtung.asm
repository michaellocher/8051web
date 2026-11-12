; @title Drehrichtungserkennung (externes Modell)
; @desc Mit S0 läuft die Scheibe. Bei steigender Flanke von B1 entscheidet B2 über die Richtung: B2 noch 0 = Rechtslauf (H1), B2 schon 1 = Linkslauf (H2). Drehrichtung im Modellfenster umschaltbar.
; @group Externe Modelle
; @mode int
; @io P0=ext-drehrichtung
;
; P0 → Ax:  .0 H1 rechts (↻)  .1 H2 links (↺)
; Ex → P1:  .0 S0 EIN  .1 B1 Sensor 1  .2 B2 Sensor 2

H1      BIT   P0.0
H2      BIT   P0.1
S0      BIT   P1.0
B1      BIT   P1.1
B2      BIT   P1.2

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
warte0: JNB   S0,aus
        JB    B1,warte0       ; erst abwarten, bis B1 frei ist
warte1: JNB   S0,aus
        JNB   B1,warte1       ; steigende Flanke von B1 abwarten
        JB    B2,links        ; B2 schon aktiv → Fahne kam von B2
        SETB  H1              ; sonst Rechtslauf
        CLR   H2
        SJMP  warte0
links:  SETB  H2
        CLR   H1
        SJMP  warte0
aus:    CLR   H1              ; Antrieb aus: Anzeige löschen
        CLR   H2
        SJMP  warte0
        END
