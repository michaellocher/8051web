; @title Prozess – Mischen mit Demultiplexer und Multiplexer
; @desc Mischanlage an P1: Behälter links (Flüssigkeit 1) und rechts (Flüssigkeit 2) werden gefüllt, in den Mischbehälter umgefüllt, 5 s gerührt und abgelassen. Die Aktoren werden über den Demultiplexer angesteuert, die Sensoren über den Multiplexer abgefragt.
; @group Bauteilebibliothek
; @mode int
; @io P1=prozess
;
; Belegung P1:  D0–D2 = Adresse des Demultiplexers DX (Ausgang 0–5)
;               D3    = EN (Freigabe): nur dann ist der adressierte Ausgang High
;               D4–D6 = Adresse des Multiplexers MUX (Eingang 0–5 = Sensor A–F)
;               D7    = Multiplexer-Ausgang (Eingang, 1 = Sensor nass)
; Ausgänge von DX:  0 Ventil 0 (Zulauf links)   1 Ventil 1 (Zulauf rechts)
;                   2 Ventil 2 (links -> Mischbehälter)   3 Ventil 3 (rechts -> Mischbehälter)
;                   4 Rührmotor   5 Ventil 5 (Ablauf)
; Eingänge von MUX: 0 A, 1 B (links unten/oben)   2 C, 3 D (rechts)   4 E, 5 F (Mischbehälter)
;
; Da DX immer nur einen Ausgang aktiv schaltet, bedient die Routine "scan" die in R2 gewählten
; Aktoren (Bit i = Ausgang i) reihum; Ventile und Motor sind träge genug, um dabei durchzulaufen.

        ORG   0
        MOV   P1,#80h         ; alles aus, D7 = Eingang

ansatz: ; 1. Behälter links bis Sensor B füllen (Ventil 0)
fl:     MOV   R2,#01h
        LCALL scan
        MOV   R3,#1           ; Sensor B
        LCALL lies
        JNC   fl
        ; 2. Behälter rechts bis Sensor D füllen (Ventil 1)
fr:     MOV   R2,#02h
        LCALL scan
        MOV   R3,#3           ; Sensor D
        LCALL lies
        JNC   fr
        ; 3. beide Behälter in den Mischbehälter entleeren (Ventile 2 und 3) bis Sensor F
um:     MOV   R2,#0Ch
        LCALL scan
        MOV   R3,#5           ; Sensor F
        LCALL lies
        JNC   um
        ; 4. 5 s rühren (Motor, Ausgang 4)
        MOV   R2,#10h
        MOV   R6,#50
ru:     LCALL warte100
        DJNZ  R6,ru
        ; 5. Mischbehälter ablassen (Ventil 5) bis Sensor E trocken, dann 2 s Nachlauf
ablauf:     MOV   R2,#20h
        LCALL scan
        MOV   R3,#4           ; Sensor E
        LCALL lies
        JC    ablauf
        MOV   R6,#20
ablauf2:    LCALL warte100
        DJNZ  R6,ablauf2
        MOV   R2,#0
        SJMP  ansatz

; Aktoren aus R2 reihum ansteuern: Ausgang i = Adresse i bei EN = 1
scan:   MOV   R0,#0
        MOV   A,R2
        MOV   R1,A
sc1:    MOV   A,R1
        RRC   A
        MOV   R1,A
        JNC   sc2
        MOV   A,R0
        ORL   A,#88h          ; EN = 1, D7 bleibt Eingang
        MOV   P1,A
        MOV   R4,#50
        DJNZ  R4,$            ; ca. 100 µs
sc2:    INC   R0
        CJNE  R0,#6,sc1
        MOV   P1,#80h         ; EN = 0
        RET

; Sensor R3 (0–5) über den Multiplexer lesen: C = 1, wenn nass
lies:   MOV   A,R3
        SWAP  A               ; Adresse nach D4–D6
        ORL   A,#80h          ; D7 = Eingang
        MOV   P1,A
        MOV   C,P1.7
        RET

; ca. 100 ms lang die Aktoren in R2 bedienen
warte100:
        MOV   R5,#100
w1:     LCALL scan
        MOV   R7,#80
        DJNZ  R7,$            ; ca. 160 µs
        DJNZ  R5,w1
        RET
        END
