; @title Förderanlage (externes Modell)
; @desc Drei Förderbänder starten entgegen dem Materialfluss (M3, M2, M1) und werden mit Verriegelung abgeschaltet. NOT-AUS (Öffner) stoppt alles und löst den Alarm aus.
; @group Externe Modelle
; @mode int
; @io P0=ext-foerder
;
; P0 → Ax:  .0 M1 Band 1   .1 M2 Band 2   .2 M3 Band 3   .3 H1 Alarm
; Ex → P1:  .0 S1 Start 1  .1 S2 Aus 1  .2 S3 Start 2  .3 S4 Aus 2  .4 S5 Start 3  .5 S6 Aus 3  .6 S7 NOT-AUS
;           Start-Taster: Schließer (1 = gedrückt).  Aus-Taster und NOT-AUS: Öffner (0 = betätigt!)
;
; Verriegelung gegen Materialstau: Band 2 darf nur laufen, wenn Band 3 läuft; Band 1 nur, wenn Band 2 läuft.
; Fällt ein Band aus (Aus-Taster), werden alle Bänder davor ebenfalls abgeschaltet.

M1      BIT   P0.0
M2      BIT   P0.1
M3      BIT   P0.2
ALARM   BIT   P0.3
S1      BIT   P1.0
S2      BIT   P1.1
S3      BIT   P1.2
S4      BIT   P1.3
S5      BIT   P1.4
S6      BIT   P1.5
S7      BIT   P1.6

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
loop:   JNB   S7,notaus       ; NOT-AUS (Öffner): 0 = betätigt
        CLR   ALARM
; --- Band 3 (Abgabe)
        JNB   S6,off3         ; Aus-Taster (Öffner)
        JNB   S5,b2           ; Start-Taster nicht gedrückt
        SETB  M3
        SJMP  b2
off3:   CLR   M3
; --- Band 2: nur mit laufendem Band 3
b2:     JNB   M3,off2
        JNB   S4,off2
        JNB   S3,b1
        SETB  M2
        SJMP  b1
off2:   CLR   M2
; --- Band 1 (Trichter): nur mit laufendem Band 2
b1:     JNB   M2,off1
        JNB   S2,off1
        JNB   S1,loop
        SETB  M1
        SJMP  loop
off1:   CLR   M1
        SJMP  loop
notaus: MOV   P0,#08h         ; alle Motoren aus, Alarm an
        SJMP  loop
        END
