; @title Mehrfachschaltstellen (externes Modell)
; @desc Motor M1 wird von vier Schaltstellen bedient: jede Betätigung eines Schalters schaltet ihn um (Parität der Schalterstellungen).
; @group Externe Modelle
; @mode int
; @io P0=ext-mfs
;
; P0 → Ax:  .0 M1 Motor
; Ex → P1:  .0 S1  .1 S2  .2 S3  .3 S4 (Wippschalter)
;
; Der Motor läuft, wenn eine ungerade Zahl der Schalter in Stellung 1 steht. Genau das liefert das
; Paritätsbit P im PSW: P = 1, wenn der Akku eine ungerade Zahl von Einsen enthält.

M1      BIT   P0.0

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh        ; P1 als Eingang
loop:   MOV   A,P1            ; Schalterstellungen lesen
        ANL   A,#0Fh          ; nur S1..S4 (Ex.0–Ex.3)
        MOV   C,P             ; Parität → Carry
        MOV   M1,C            ; Carry → Motor
        SJMP  loop
        END
