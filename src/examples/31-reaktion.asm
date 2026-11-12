; @title Reaktionstest (externes Modell)
; @desc Zeit-Freigabe (S1) drücken: P1 „Achtung“ leuchtet, nach einer Zufallszeit kommt P2 „Bremsen!“. Timer 0 misst die Zeit bis zum Bremspedal (S2) in ms (Ergebnis in R6:R7). Fehlstart wird erkannt.
; @group Externe Modelle
; @mode int
; @io P0=ext-reaktion
;
; P0 → Ax:  .0 P1 Achtung – Zeit läuft  .1 P2 Bremsen!
; Ex → P1:  .0 S0 Reset  .1 S1 Zeit-Freigabe  .2 S2 Bremspedal  .3 S3 Schwierigkeitsgrad (1 = schwer)
;
; Zeitbasis: Timer 0 (Mode 1) zählt 1000 Zyklen = 1 ms (Nachladewert 0FC20h
; gleicht die Zyklen für das Nachladen aus). Timer 1 läuft frei und liefert den Zufall.
; Ergebnis: R6:R7 = Reaktionszeit in ms, 0FFFFh = Fehlstart, 0FFFEh = zu langsam.

LAMPE1  BIT   P0.0            ; Achtung
LAMPE2  BIT   P0.1            ; Bremsen!
RESETT  BIT   P1.0
FREI    BIT   P1.1
BREMSE  BIT   P1.2
SCHWER  BIT   P1.3

        ORG   0
        MOV   TMOD,#11h       ; Timer 0 und 1 als 16-Bit-Zähler
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  TR0
        SETB  TR1             ; Zufallszähler läuft frei
neu:    CLR   LAMPE1
        CLR   LAMPE2
        JB    FREI,neu        ; erst loslassen (kein Dauerstart)
warte:  JNB   FREI,warte      ; auf Zeit-Freigabe warten
        SETB  LAMPE1          ; "Achtung"
        MOV   A,TL1           ; Zufallszahl aus Timer 1
        JB    SCHWER,schw
        ANL   A,#07h          ; leicht: 1,0 … 2,75 s
        ADD   A,#4
        SJMP  setz
schw:   ANL   A,#0Fh          ; schwer: 0,25 … 4,0 s
        INC   A
setz:   MOV   R5,A            ; Wartezeit in Einheiten à 250 ms
        LCALL tneu
einh:   MOV   R4,#250
msw:    JB    BREMSE,fehl     ; zu früh gebremst?
        JNB   TF0,msw
        LCALL tneu
        DJNZ  R4,msw
        DJNZ  R5,einh
        SETB  LAMPE2          ; Signal "Bremsen!"
        MOV   R6,#0           ; Zähler Reaktionszeit löschen
        MOV   R7,#0
        LCALL tneu
messen: JB    BREMSE,fertig
        JNB   TF0,messen
        LCALL tneu
        INC   R7              ; 16-Bit-Zähler erhöhen
        MOV   A,R7
        JNZ   mpruef
        INC   R6
mpruef: MOV   A,R6
        CJNE  A,#4,messen     ; nach 1024 ms aufgeben
        MOV   R6,#0FFh
        MOV   R7,#0FEh
        SJMP  ende
fehl:   MOV   R6,#0FFh        ; Fehlstart
        MOV   R7,#0FFh
        SJMP  ende
fertig: NOP
ende:   CLR   LAMPE1
        CLR   LAMPE2
war:    JB    BREMSE,war      ; Bremspedal loslassen
        SJMP  neu

; Timer 0 neu starten: 1 ms
tneu:   CLR   TF0
        MOV   TH0,#0FCh
        MOV   TL0,#20h
        RET
        END
