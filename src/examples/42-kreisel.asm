; @title Kreiselpumpe mit Durchflusswächter (externes Modell)
; @desc EIN (S1) startet die Pumpe, AUS (S0) stoppt sie. Der Durchflusssensor S2 liefert Impulse. Bleiben sie aus (Trockenlauf), wird die Pumpe abgeschaltet und H1 (Alarm) leuchtet bis AUS.
; @group Externe Modelle
; @mode int
; @io P0=ext-kreisel
;
; P0 → Ax:  .0 M1 Pumpe  .1 H1 Alarm
; Ex → P1:  .0 S0 AUS  .1 S1 EIN  .2 S2 Durchfluss-Impulse

M1      BIT   P0.0
H1      BIT   P0.1
S0      BIT   P1.0
S1      BIT   P1.1
S2      BIT   P1.2
LAST    BIT   20h.0           ; letzter Zustand von S2

        ORG   0
        MOV   P1,#0FFh
aus:    MOV   P0,#00h
warte:  JNB   S1,warte        ; auf EIN warten
        SETB  M1
        MOV   C,S2
        MOV   LAST,C
neu:    MOV   R6,#240         ; Zeitüberwachung (ca. 0,5 s) neu starten
        MOV   R7,#0
loop:   JB    S0,aus          ; AUS?
        MOV   C,S2            ; Flanke an S2?
        JNC   niedrig
        JB    LAST,weiter
        SETB  LAST
        SJMP  neu
niedrig:    JNB   LAST,weiter
        CLR   LAST
        SJMP  neu
weiter: DJNZ  R7,loop
        DJNZ  R6,loop
        ; keine Impulse mehr: Trockenlauf
        CLR   M1
        SETB  H1              ; Alarm
quit:   JNB   S0,quit         ; bis AUS gedrückt wird
        SJMP  aus
        END
