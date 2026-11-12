; @title ICM7212-Anzeige
; @desc Vierstellige Anzeige mit ICM7212-Decoder (P1): erst erscheint "1234", danach läuft ein vierstelliger BCD-Zähler. Bei Daten über 9 ertönt ein Warnton.
; @group Bauteilebibliothek
; @mode int
; @io P1=icm7212
;
; ICM7212: P1.0–P1.3 = Daten (BCD), P1.4–P1.7 = Stellenwahl (jeweils 1 = Daten in diese Stelle speichern):
;          P1.4 Einer, P1.5 Zehner, P1.6 Hunderter, P1.7 Tausender;  1111 = alle Stellen, 0000 = keine Änderung
; Jedes Beschreiben des Ports übernimmt die Daten (kein Schreibimpuls); die Anzeige behält die Werte.

        ORG   0
        MOV   P1,#0F0h        ; alle Stellen löschen (Daten 0)
        MOV   P1,#81h         ; Tausender: 1
        MOV   P1,#42h         ; Hunderter: 2
        MOV   P1,#23h         ; Zehner:    3
        MOV   P1,#14h         ; Einer:     4
        MOV   P1,#00h         ; keine Änderung
        MOV   R5,#20          ; 2 s anzeigen
        LCALL pause
        MOV   30h,#0          ; Zähler: 30h = Einer … 33h = Tausender
        MOV   31h,#0
        MOV   32h,#0
        MOV   33h,#0
zeige:  MOV   R0,#30h
        MOV   R2,#10h         ; Stellenwahl: 10h = Einer, 20h = Zehner, …
st:     MOV   A,@R0           ; Ziffer
        ORL   A,R2            ; Stelle wählen
        MOV   P1,A
        INC   R0
        MOV   A,R2
        ADD   A,ACC           ; nächste Stelle (Wert verdoppeln, nach Tausender: Überlauf → 0)
        MOV   R2,A
        JNZ   st
        MOV   P1,#00h
        MOV   R5,#1           ; 100 ms
        LCALL pause
        MOV   R0,#30h         ; Zähler um 1 erhöhen (BCD)
inc:    INC   @R0
        CJNE  @R0,#10,zeige
        MOV   @R0,#0
        INC   R0
        CJNE  R0,#34h,inc
        SJMP  zeige

; Pause: R5 × 100 ms
pause:  MOV   R6,#200
pw1:    MOV   R4,#250
pw2:    DJNZ  R4,pw2
        DJNZ  R6,pw1
        DJNZ  R5,pause
        RET
        END
