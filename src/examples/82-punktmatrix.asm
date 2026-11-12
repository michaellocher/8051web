; @title Punktmatrix: Laufschrift HALLO
; @desc Die Buchstaben H, A, L, L, O erscheinen nacheinander auf der 7×5-Punktmatrix. Die Spalten werden einzeln gesendet; das Modell speichert die Spaltendaten, bis sie überschrieben werden.
; @group Bauteilebibliothek
; @mode int
; @io P0=dotmatrix
;
; PORT-oben (P0): D0–D4 = Spalten C1–C5, low-aktiv (0 = Spalte aktiv)
; PORT-unten (P1): D0–D6 = Zeilen R1–R7, high-aktiv (D0 = oberste Zeile)
; Ein Punkt leuchtet, wenn Zeile = 1 und Spalte = 0. Reihenfolge je Spalte (siehe Handbuch):
;   1. alle Spalten sperren (P0 = FFh)   2. Zeilendaten ausgeben   3. aktuelle Spalte aktivieren

        ORG   0
        MOV   DPTR,#msg
        MOV   R6,#0           ; Index in die Nachricht
nachr:  MOV   A,R6
        MOVC  A,@A+DPTR       ; Zeichenoffset in der Schrifttabelle
        CJNE  A,#0FFh,zeige
        MOV   R6,#0           ; Ende: von vorn
        SJMP  nachr
zeige:  MOV   R4,A
        MOV   R2,#0           ; Spalte 0–4
        MOV   R3,#0FEh        ; Spaltenmuster: C1 aktiv
spalte: MOV   P0,#0FFh        ; 1. Spalten sperren
        MOV   DPTR,#font
        MOV   A,R4
        ADD   A,R2
        MOVC  A,@A+DPTR
        MOV   P1,A            ; 2. Zeilen neu beschreiben
        MOV   P0,R3           ; 3. aktuelle Spalte aktivieren
        MOV   A,R3
        RL    A
        MOV   R3,A
        INC   R2
        CJNE  R2,#5,spalte
        MOV   P0,#0FFh        ; Spalten sperren: Anzeige bleibt stehen
        MOV   DPTR,#msg
        LCALL pause
        INC   R6
        SJMP  nachr

; Pause ca. 0,5 s
pause:  MOV   R5,#5
pq1:     MOV   R2,#200
pq2:     MOV   R3,#250
        DJNZ  R3,$
        DJNZ  R2,pq2
        DJNZ  R5,pq1
        RET

; Zeichen: je 5 Spaltenbytes (Bit 0 = oberste Zeile)
font:   DB   7Fh, 08h, 08h, 08h, 7Fh   ; H  (Offset 0)
        DB   7Eh, 11h, 11h, 11h, 7Eh   ; A  (5)
        DB   7Fh, 40h, 40h, 40h, 40h   ; L  (10)
        DB   3Eh, 41h, 41h, 41h, 3Eh   ; O  (15)
        DB   00h, 00h, 00h, 00h, 00h   ; Leerzeichen (20)
msg:    DB   0, 20, 5, 20, 10, 20, 10, 20, 15, 20, 20, 0FFh
        END
