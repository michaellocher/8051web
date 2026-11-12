; @title Generatorüberwachung (externes Modell)
; @desc Vier Motoren (2/3/5/7 kW) am Generator, höchstens 10 kW zulässig. Bei Überlast leuchtet die Warnlampe H1. Motorschalter im Modellfenster bedienen.
; @group Externe Modelle
; @mode int
; @io P0=ext-gener
;
; P0 → Ax:  .0 H1 Warnlampe Überlast
; Ex → P1:  .0 S1 M1 (2 kW) dreht   .1 S2 M2 (3 kW)   .2 S3 M3 (5 kW)   .3 S4 M4 (7 kW)
;
; Überlast (> 10 kW) gibt es nur, wenn M4 (7 kW) läuft und dazu
;   M3 (5 kW)  oder  M2 und M1 (3 + 2 kW).
; Logische Gleichung:  H1 = S4 AND ( S3 OR ( S2 AND S1 ) )

H1      BIT   P0.0
S1      BIT   P1.0
S2      BIT   P1.1
S3      BIT   P1.2
S4      BIT   P1.3

        ORG   0
        MOV   P0,#00h         ; Lampe aus
        MOV   P1,#0FFh        ; P1 als Eingang
loop:   JNB   S4,aus          ; ohne M4 nie Überlast
        JB    S3,an           ; M4 + M3 = 12 kW
        JNB   S2,aus
        JB    S1,an           ; M4 + M2 + M1 = 12 kW
aus:    CLR   H1
        SJMP  loop
an:     SETB  H1
        SJMP  loop
        END
