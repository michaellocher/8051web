; @title Klebedüse mit Vorwahlzeit (externes Modell)
; @desc Erkennt der Sensor S1 einen Karton, öffnet die Düse Y1 für (Vorwahl B1 × 0,2 s). Die Vorwahl 0…7 liegt an Ex.1–Ex.3 und wird mit den Pfeiltasten am Modell eingestellt.
; @group Externe Modelle
; @mode int
; @io P0=ext-klebeduese
;
; P0 → Ax:  .0 Y1 Düse
; Ex → P1:  .0 S1 Karton da  .1–.3 B1 Vorwahl 0…7

Y1      BIT   P0.0
S1      BIT   P1.0

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
warte:  JNB   S1,warte        ; auf Karton warten
        MOV   A,P1            ; Vorwahl einlesen: Ex.1–3 → 0…7
        ANL   A,#0Eh
        RR    A
        MOV   R2,A
        JZ    fertig          ; Vorwahl 0 → nicht kleben
        SETB  Y1              ; Düse auf
zeit:   ACALL ms100           ; 2 × 100 ms = 0,2 s je Einheit
        ACALL ms100
        DJNZ  R2,zeit
        CLR   Y1              ; Düse zu
fertig: JB    S1,fertig       ; warten bis Karton vorbei
        SJMP  warte

ms100:  MOV   R6,#195         ; ca. 100 ms
m1:     MOV   R7,#0
m0:     DJNZ  R7,m0
        DJNZ  R6,m1
        RET
        END
