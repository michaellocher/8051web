; @title Matrix-Tastatur
; @desc Die Matrix-Tastatur (P1) wird zeilenweise abgefragt. Die zuletzt gefundene Taste erscheint auf der 2×7-Segment-Anzeige (P0, * = A, # = B); die Tasten lassen sich mit Klick betätigen und rasten ein ("X").
; @group Bauteilebibliothek
; @mode int
; @io P0=2x7bcd
; @io P1=matrix
;
; Matrix-Tastatur: Zeilen Y1–Y4 = P1.3–P1.6 (Ausgänge, nacheinander auf 0), Spalten X1–X3 = P1.0–P1.2 (Eingänge, auf 1 setzen)
; Tastennummer = Zeile · 3 + Spalte + 1 (1…9), * = 0Ah, 0 = 0, # = 0Bh

        ORG   0
        MOV   R7,#0FFh        ; noch keine Taste
        MOV   P0,#0
scan:   MOV   R0,#0           ; Zeilenzähler
        MOV   R1,#0F7h        ; Muster: P1.3 = 0 (Y1)
zeile:  MOV   A,R1
        ORL   A,#87h          ; P1.0–P1.2 (Spalten) und P1.7 auf 1
        MOV   P1,A
        NOP
        MOV   A,P1
        ANL   A,#07h          ; Spaltensignale
        CJNE  A,#07h,gefunden ; eine Spalte 0 → Taste gedrückt
weiter: MOV   A,R1
        SETB  C
        RLC   A               ; nächste Zeile auf 0
        MOV   R1,A
        INC   R0
        CJNE  R0,#4,zeile
        SJMP  scan
gefunden:
        MOV   R2,#0           ; Spaltennummer ermitteln
        JNB   ACC.0,spalte
        INC   R2
        JNB   ACC.1,spalte
        INC   R2
spalte: MOV   A,R0            ; Zeile · 3
        MOV   B,#3
        MUL   AB
        ADD   A,R2
        INC   A               ; Taste 1…12 (10 = *, 11 = 0, 12 = #)
        CJNE  A,#11,nicht0
        CLR   A               ; "0"
        SJMP  anz
nicht0: CJNE  A,#12,anz
        MOV   A,#0Bh          ; "#"
anz:    MOV   P0,A
        SJMP  weiter
        END
