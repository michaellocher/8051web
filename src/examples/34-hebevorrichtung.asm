; @title Hebevorrichtung (externes Modell)
; @desc Kiste am Hubtisch (B0): A hebt sie nach oben, B schiebt sie auf das obere Band, B und A fahren zurück. Danach wartet der Ablauf auf die nächste Kiste.
; @group Externe Modelle
; @mode int
; @io P0=ext-hebe
;
; P0 → Ax:  .0 Y1 A aus (heben)  .1 Y2 B aus (schieben)
; Ex → P1:  .0 B0 Kiste da  .1 B1 A unten  .2 B2 A oben  .3 B3 B ein  .4 B4 B aus  .5 S1 RESET

Y1      BIT   P0.0
Y2      BIT   P0.1
B0      BIT   P1.0
B1      BIT   P1.1
B2      BIT   P1.2
B3      BIT   P1.3
B4      BIT   P1.4

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
warte:  JNB   B0,warte        ; auf Kiste am Hubtisch warten
        SETB  Y1              ; heben
w1:     JNB   B2,w1
        SETB  Y2              ; auf das obere Band schieben
w2:     JNB   B4,w2
        CLR   Y2              ; Schieber zurück
w3:     JNB   B3,w3
        CLR   Y1              ; Hubtisch ab
w4:     JNB   B1,w4
        SJMP  warte
        END
