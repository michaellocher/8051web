; @title Fallmagazin (externes Modell)
; @desc Mit der Vorwahl-Ziffer (Ex.0–3) wird die Stückzahl eingestellt. START: Der Zylinder schiebt so viele Teile aus dem Schacht in den Behälter; die Lichtschranke zählt mit. Ist das Magazin leer, bricht das Programm ab.
; @group Externe Modelle
; @mode int
; @io P0=ext-fall
;
; P0 → Ax:  .0 Y1 Zylinder ausfahren
; Ex → P1:  .0–.3 S0 Vorwahl (BCD)  .4 S1 START  .5 S2 RESET  .6 S3 STOP  .7 B1 Lichtschranke
; Ergebnis: R5 = Anzahl ausgeschobener Teile

Y1      BIT   P0.0
TSTART  BIT   P1.4
TSTOP   BIT   P1.6
LS      BIT   P1.7

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
neu:    JNB   TSTART,neu      ; auf START warten
        MOV   A,P1            ; Vorwahl lesen (untere 4 Bit)
        ANL   A,#0Fh
        JZ    neu             ; 0 Teile → nichts tun
        MOV   R2,A            ; R2 = noch auszuschiebende Teile
        MOV   R5,#0
stoss:  SETB  Y1              ; Teil ausschieben
        MOV   R0,#8
zw1:    MOV   R4,#0
zw2:    MOV   R3,#250
w1:     JB    LS,teil         ; Lichtschranke: Teil ist gefallen
        JB    TSTOP,abbr
        DJNZ  R3,w1
        DJNZ  R4,zw2
        DJNZ  R0,zw1          ; ca. 3 s Zeitüberwachung
        SJMP  abbr            ; kein Teil → Magazin leer
teil:   JB    LS,teil         ; warten, bis das Teil durch ist
        CLR   Y1              ; Zylinder zurück
        INC   R5
        LCALL pause           ; Zylinder einfahren und nächstes Teil fallen lassen
        DJNZ  R2,nochm
        SJMP  abbr
nochm:  LJMP  stoss           ; nächstes Teil
abbr:   CLR   Y1
        LCALL pause
ende:   JB    TSTART,ende     ; START erst loslassen
        SJMP  neu

; ca. 1 s warten (R7, R6, R1)
pause:  MOV   R1,#10
pw0:     MOV   R7,#200
pw1:     MOV   R6,#250
pw2:     DJNZ  R6,pw2
        DJNZ  R7,pw1
        DJNZ  R1,pw0
        RET
        END
