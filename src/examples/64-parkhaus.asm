; @title Parkhaus – Platzzähler mit INT0/INT1
; @desc Parkhaus mit 31 Plätzen an P1. Die Einfahrt-Taste (in, +) löst INT0 aus, die Ausfahrt-Taste (out, −) INT1. Die Interruptroutinen zählen die freien Plätze; das Programm zeigt sie an D0–D4 an, öffnet die Schranken kurz und schaltet die Ampel (grün = frei, rot = voll).
; @group Bauteilebibliothek
; @mode int
; @io P1=parkhaus
;
; Belegung P1 (alle Ausgänge):  D0–D4 = freie Plätze (binär 0–31)
;                               D5 = Einfahrt-Schranke (1 = auf)   D6 = Ausfahrt-Schranke (1 = auf)
;                               D7 = Ampel (1 = grün, 0 = rot)
; Interrupts:  INT0 (P3.2) = Einfahrt-Taste,  INT1 (P3.3) = Ausfahrt-Taste
;
; R7 = freie Plätze, R5/R6 = Restzeit der Einfahrt-/Ausfahrt-Schranke (in 20 ms)

        ORG   0
        LJMP  start
        ORG   03h
        LJMP  isr_ein         ; INT0
        ORG   13h
        LJMP  isr_aus         ; INT1

        ORG   30h
start:  MOV   R7,#31          ; Parkhaus ist leer
        MOV   R5,#0
        MOV   R6,#0
        SETB  IT0             ; Interrupts flankengesteuert
        SETB  IT1
        SETB  EX0
        SETB  EX1
        SETB  EA

loop:   LCALL anzeige
        LCALL pause20
        MOV   A,R5            ; Schranken nach Ablauf der Zeit wieder schließen
        JZ    l1
        DEC   R5
l1:     MOV   A,R6
        JZ    loop
        DEC   R6
        SJMP  loop

; Port-Ausgabe: freie Plätze, Schranken, Ampel
anzeige:
        MOV   A,R7
        JZ    a1
        ORL   A,#80h          ; Plätze frei: Ampel grün
a1:     MOV   B,A
        MOV   A,R5
        JZ    a2
        MOV   A,B
        ORL   A,#20h          ; Einfahrt-Schranke auf
        MOV   B,A
a2:     MOV   A,R6
        JZ    a3
        MOV   A,B
        ORL   A,#40h          ; Ausfahrt-Schranke auf
        MOV   B,A
a3:     MOV   P1,B
        RET

; Einfahrt: nur wenn ein Platz frei ist
isr_ein:
        PUSH  ACC
        MOV   A,R7
        JZ    ein_ende
        DEC   R7
        MOV   R5,#100         ; Schranke 2 s offen
ein_ende:     POP   ACC
        RETI

; Ausfahrt: nur wenn ein Auto im Parkhaus steht
isr_aus:
        PUSH  ACC
        MOV   A,R7
        CJNE  A,#31,aus_a
        SJMP  aus_b
aus_a:     INC   R7
        MOV   R6,#100
aus_b:     POP   ACC
        RETI

; ca. 20 ms
pause20:
        MOV   R3,#40
pz1:    MOV   R4,#250
        DJNZ  R4,$
        DJNZ  R3,pz1
        RET
        END
