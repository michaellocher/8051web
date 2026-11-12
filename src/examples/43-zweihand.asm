; @title Zweihandverriegelung (externes Modell)
; @desc Die Presse (K1) fährt nur, wenn beide Taster innerhalb von 0,5 s gedrückt werden und bleiben. Wird ein Taster losgelassen, fährt der Stempel sofort zurück. Danach müssen beide Taster erst losgelassen werden.
; @group Externe Modelle
; @mode int
; @io P0=ext-zweihand
;
; P0 → Ax:  .0 K1 Presse (Stempel ab)
; Ex → P1:  .0 S1 Taster links  .1 S2 Taster rechts  .2 B1 unten  .3 B2 oben

K1      BIT   P0.0
S1      BIT   P1.0
S2      BIT   P1.1

        ORG   0
        MOV   P1,#0FFh
idle:   CLR   K1
        JB    S1,erst1        ; wer war zuerst da?
        JB    S2,erst2
        SJMP  idle
erst1:  MOV   R6,#0           ; Zeitfenster ca. 0,5 s (65536 Durchläufe)
        MOV   R7,#0
f1:     JNB   S1,loslass      ; erster Taster losgelassen → abbrechen
        JB    S2,pressen
        DJNZ  R7,f1
        DJNZ  R6,f1
        SJMP  loslass         ; Zeitfenster überschritten → nichts tun
erst2:  MOV   R6,#0
        MOV   R7,#0
f2:     JNB   S2,loslass
        JB    S1,pressen
        DJNZ  R7,f2
        DJNZ  R6,f2
        SJMP  loslass
pressen: SETB K1              ; Stempel fährt, solange beide gedrückt sind
halte:  JNB   S1,loslass
        JNB   S2,loslass
        SJMP  halte
loslass: CLR  K1              ; Stempel zurück, beide Taster müssen frei sein
l1:     JB    S1,l1
        JB    S2,l1
        SJMP  idle
        END
