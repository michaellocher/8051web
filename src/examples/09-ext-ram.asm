; @title Externer RAM
; @desc Quadratzahlen 0² … 15² werden mit MOVX in den externen RAM geschrieben und anschließend nacheinander an P1 ausgegeben.
; @mode ext
; @io P1=leds

        ORG   0
        MOV   DPTR,#0100h     ; Ziel im ext. RAM
        MOV   R0,#0
schreib:
        MOV   A,R0
        MOV   B,A
        MUL   AB              ; A = R0²
        MOVX  @DPTR,A
        INC   DPTR
        INC   R0
        CJNE  R0,#16,schreib

lesen:  MOV   DPTR,#0100h
        MOV   R0,#16
next:   MOVX  A,@DPTR
        MOV   P1,A
        LCALL warte
        INC   DPTR
        DJNZ  R0,next
        SJMP  lesen

; ca. 250 ms
warte:  MOV   R5,#5
w0:     MOV   R7,#200
w1:     MOV   R6,#250
        DJNZ  R6,$
        DJNZ  R7,w1
        DJNZ  R5,w0
        RET
        END
