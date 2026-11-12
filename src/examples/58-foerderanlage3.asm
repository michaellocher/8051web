; @title Förderanlage III (externes Modell)
; @desc Solange Start (S0) an ist, pendelt der Wagen: nach rechts unter den Trichter, 5,5 s beladen lassen, nach links zum Entladen, 4 s entleeren. Motor stoppt an den Endschaltern S2/S1; Fehlermeldungen bei Fehlern im Ablauf.
; @group Externe Modelle
; @mode int
; @io P0=ext-foerder3
;
; P0 → Ax:  .0 K1 Motor → (rechts)  .1 K2 Motor ← (links)
; Ex → P1:  .0 S0 Start  .1 S1 Endschalter links  .2 S2 Endschalter rechts

K1      BIT   P0.0
K2      BIT   P0.1
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2

        ORG   0
        MOV   P1,#0FFh
start:  MOV   P0,#00h         ; Motor aus
warte:  JNB   S0,warte        ; auf Start warten
        JB    S1,hin          ; Wagen schon links?
        SETB  K2              ; sonst zuerst nach links fahren
zurueck: JNB  S1,zurueck
        CLR   K2
hin:    SETB  K1              ; nach rechts unter den Trichter
w1:     JNB   S2,w1
        CLR   K1
        MOV   R7,#55          ; 5,5 s beladen lassen
b1:     ACALL zehntel
        DJNZ  R7,b1
        SETB  K2              ; nach links zum Entladen
w2:     JNB   S1,w2
        CLR   K2
        MOV   R7,#40          ; 4 s entleeren lassen
b2:     ACALL zehntel
        DJNZ  R7,b2
        SJMP  start           ; nächster Zyklus, wenn S0 noch an ist

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
