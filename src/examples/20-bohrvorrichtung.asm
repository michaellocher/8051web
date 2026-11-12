; @title Bohrvorrichtung (externes Modell)
; @desc START (S1) → Werkstück spannen, Bohrer mit laufendem Motor absenken, anheben, lösen. Das Modellfenster öffnet sich automatisch.
; @group Externe Modelle
; @mode int
; @io P0=ext-bohr
;
; P0 → Ax:  .0 Y1 spannen   .1 Y2 lösen   .2 Y3 Bohrer ab   .3 Y4 Bohrer auf   .4 M1 Motor
; Ex → P1:  .0 S1 START  .1 S2 RESET  .2 B1 A eingefahren  .3 B2 A ausgefahren
;           .4 B3 Bohrer oben  .5 B4 Bohrer unten  .6 B5 Werkstück da

Y1      BIT   P0.0
Y2      BIT   P0.1
Y3      BIT   P0.2
Y4      BIT   P0.3
M1      BIT   P0.4
S1      BIT   P1.0
B1      BIT   P1.2
B2      BIT   P1.3
B3      BIT   P1.4
B4      BIT   P1.5
B5      BIT   P1.6

        ORG   0
        MOV   P0,#00h         ; alle Aktoren aus
        MOV   P1,#0FFh        ; P1 als Eingang
start:  JNB   S1,start        ; auf START warten
        JNB   B5,start        ; nur mit Werkstück
        SETB  Y1              ; spannen
w1:     JNB   B2,w1
        CLR   Y1
        SETB  M1              ; Motor an
        SETB  Y3              ; Bohrer ab
w2:     JNB   B4,w2
        CLR   Y3
        SETB  Y4              ; Bohrer auf
w3:     JNB   B3,w3
        CLR   Y4
        CLR   M1              ; Motor aus
        SETB  Y2              ; lösen
w4:     JNB   B1,w4
        CLR   Y2
        SJMP  start
        END
