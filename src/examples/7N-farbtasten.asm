; @title Farbtasten – Simon
; @desc Merkspiel "Simon" an P1: Das Gerät zeigt eine Farbfolge, die mit den Tasten nachgespielt werden muss. Jede Runde kommt eine Farbe dazu. Beliebige Taste startet; bei einem Fehler blinken alle Lampen.
; @group Bauteilebibliothek
; @mode int
; @io P1=farbtasten
;
; Farben-Tasten: P1.0 = Lampe rot, P1.1 = grün, P1.2 = gelb, P1.3 = blau (1 = an)
;                P1.4 = Taste rot, P1.5 = grün, P1.6 = gelb, P1.7 = blau (0 = gedrückt)
; Die Folge liegt ab 30h im internen RAM (max. 16 Schritte), R7 = Länge.
; Zufallsquelle: Timer 0 läuft frei, beim Anhängen einer Farbe zählen die unteren 2 Bit von TL0.

MAXLEN  EQU   16

        ORG   0
        MOV   TMOD,#01h
        SETB  TR0             ; Timer 0 läuft frei (Zufallszahlen)
start:  MOV   P1,#0F0h        ; alle Lampen aus, Tasten als Eingang
        LCALL warte_los       ; auf Tastendruck warten (startet das Spiel)
        MOV   R5,#5
        LCALL pause
        MOV   R7,#0           ; Folge leer
runde:  MOV   A,#30h          ; neue Farbe anhängen
        ADD   A,R7
        MOV   R0,A
        MOV   A,TL0
        ANL   A,#03h
        MOV   @R0,A
        INC   R7
        ; --- Folge vorspielen ---
        MOV   R1,#30h
        MOV   R6,#0
vor:    MOV   A,@R1
        LCALL lampe           ; A = Farbe → Lampenmaske
        ORL   A,#0F0h
        MOV   P1,A
        MOV   R5,#4           ; 0,4 s an
        LCALL pause
        MOV   P1,#0F0h
        MOV   R5,#2           ; 0,2 s Lücke
        LCALL pause
        INC   R1
        INC   R6
        MOV   A,R6
        XRL   A,R7
        JNZ   vor
        ; --- Eingabe prüfen ---
        MOV   R1,#30h
        MOV   R6,#0
ein:    LCALL warte_los       ; R2 = Index der gedrückten Taste
        MOV   A,@R1
        XRL   A,R2
        JNZ   fehler
        MOV   A,R2            ; Lampe leuchtet solange die Taste gedrückt ist
        LCALL lampe
        ORL   A,#0F0h
        MOV   P1,A
        LCALL warte_frei
        MOV   P1,#0F0h
        MOV   R5,#1
        LCALL pause
        INC   R1
        INC   R6
        MOV   A,R6
        XRL   A,R7
        JNZ   ein
        MOV   A,R7
        CJNE  A,#MAXLEN,weiter
        LJMP  gewonnen
weiter: MOV   R5,#6           ; kurze Pause vor der nächsten Runde
        LCALL pause
        LJMP  runde

fehler: MOV   R6,#3           ; dreimal alle Lampen blinken
fl:     MOV   P1,#0FFh
        MOV   R5,#3
        LCALL pause
        MOV   P1,#0F0h
        MOV   R5,#3
        LCALL pause
        DJNZ  R6,fl
        LJMP  start

gewonnen:
        MOV   R6,#6           ; Lauflicht als Siegesfanfare
gl:     MOV   R2,#0
gl2:    MOV   A,R2
        LCALL lampe
        ORL   A,#0F0h
        MOV   P1,A
        MOV   R5,#1
        LCALL pause
        INC   R2
        CJNE  R2,#4,gl2
        DJNZ  R6,gl
        LJMP  start

; Farbe A (0–3) → Lampenmaske (1, 2, 4, 8)
lampe:  MOV   DPTR,#masken
        MOVC  A,@A+DPTR
        RET
masken: DB   01h, 02h, 04h, 08h

; Wartet auf eine gedrückte Taste, R2 = Index (0–3)
warte_los:
        MOV   A,P1
        SWAP  A
        CPL   A
        ANL   A,#0Fh          ; Bit n = Taste n gedrückt
        JZ    warte_los
        MOV   R2,#0
wl:     RRC   A
        JC    wl_ok
        INC   R2
        SJMP  wl
wl_ok:  RET

; Wartet bis keine Taste mehr gedrückt ist (mit Entprellzeit)
warte_frei:
        MOV   A,P1
        ANL   A,#0F0h
        CJNE  A,#0F0h,warte_frei
        RET

; Pause: R5 × 100 ms
pause:  MOV   R3,#200
pw1:     MOV   R4,#250
pw2:     DJNZ  R4,pw2
        DJNZ  R3,pw1
        DJNZ  R5,pause
        RET
        END
