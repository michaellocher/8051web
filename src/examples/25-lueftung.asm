; @title Lüftungsüberwachung (externes Modell)
; @desc Vier Tunnellüfter: Die Ampel A1 zeigt grün bei ≥ 3 laufenden Lüftern, gelb bei 2, rot bei ≤ 1. Lüfter lassen sich über das Blitzsymbol ausfallen.
; @group Externe Modelle
; @mode int
; @io P0=ext-lueft
;
; P0 → Ax:  .0 Ampel rot   .1 Ampel gelb   .2 Ampel grün
; Ex → P1:  .0–.3 Drehzahlwächter S1–S4 (1 = Lüfter dreht)
;
; Das Programm zählt die Einsen in den unteren vier Bits (R1 = Zahl laufender Lüfter)
; und vergleicht sie mit 3 bzw. 2.

        ORG   0
        MOV   P1,#0FFh
loop:   MOV   A,P1
        ANL   A,#0Fh
        MOV   R0,#4           ; vier Bits prüfen
        MOV   R1,#0           ; Zähler laufender Lüfter
zaehl:  RRC   A               ; niedrigstes Bit → Carry
        JNC   weiter
        INC   R1
weiter: DJNZ  R0,zaehl
        MOV   A,R1
        CLR   C
        SUBB  A,#3            ; R1 >= 3 ?
        JNC   gruen
        MOV   A,R1
        CLR   C
        SUBB  A,#2            ; R1 >= 2 ?
        JNC   gelb
        MOV   P0,#01h         ; höchstens ein Lüfter: rot
        SJMP  loop
gelb:   MOV   P0,#02h
        SJMP  loop
gruen:  MOV   P0,#04h
        SJMP  loop
        END
