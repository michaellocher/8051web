; @title 2 × 7-Segment MUX
; @desc Zweistelliger Zähler 00–99 auf zwei Ziffern, die sich die Segmentleitungen von P1 teilen. Die Ziffer wird über P3.7 (links) und P3.6 (rechts) freigegeben und alle 2 ms umgeschaltet.
; @group Bauteilebibliothek
; @mode int
; @io P1=2x7mux
;
; Segmente: P1.0 = DP, P1.1 = c, P1.2 = d, P1.3 = e, P1.4 = b, P1.5 = a, P1.6 = f, P1.7 = g (1 = leuchtet)
; Freigabe: P3.7 = linke Ziffer (Zehner), P3.6 = rechte Ziffer (Einer);  SETB = Display an, CLR = Display aus

LINKS   BIT   P3.7
RECHTS  BIT   P3.6

        ORG   0
        CLR   LINKS           ; nach dem Reset sind beide Ziffern freigegeben → ausschalten
        CLR   RECHTS
        MOV   R6,#0           ; Zehner
        MOV   R7,#0           ; Einer
        MOV   DPTR,#segtab
zaehl:  MOV   R2,#50          ; 50 × 4 ms = 0,2 s je Zählschritt
refr:   MOV   A,R6
        MOVC  A,@A+DPTR
        MOV   P1,A            ; Zehner ausgeben …
        SETB  LINKS           ; … und linke Ziffer einschalten
        LCALL ms2
        CLR   LINKS
        MOV   A,R7
        MOVC  A,@A+DPTR
        MOV   P1,A            ; Einer ausgeben …
        SETB  RECHTS          ; … und rechte Ziffer einschalten
        LCALL ms2
        CLR   RECHTS
        DJNZ  R2,refr
        INC   R7
        CJNE  R7,#10,zaehl
        MOV   R7,#0
        INC   R6
        CJNE  R6,#10,zaehl
        MOV   R6,#0
        SJMP  zaehl

; ca. 2 ms
ms2:    MOV   R0,#4
m1:     MOV   R3,#250
        DJNZ  R3,$
        DJNZ  R0,m1
        RET

;            0    1    2    3    4    5    6    7    8    9
segtab: DB   7Eh, 12h, 0BCh, 0B6h, 0D2h, 0E6h, 0EEh, 32h, 0FEh, 0F6h
        END
