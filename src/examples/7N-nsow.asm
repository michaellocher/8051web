; @title NSOW-Display
; @desc Das NSOW-Display (P1) zeigt nacheinander alle 16 Himmelsrichtungen von N bis NNW (je bis zu drei Zeichen).
; @group Bauteilebibliothek
; @mode int
; @io P1=nsow
;
; NSOW-Display: P1.0–P1.2 = mittleres Zeichen (1 N, 2 S, 3 O, 4 W)
;               P1.3–P1.5 = linkes Zeichen (wie das mittlere)
;               P1.6–P1.7 = rechtes Zeichen (1 O, 2 W)
; Beispiel: NNO = links N (08h) + Mitte N (01h) + rechts O (40h) = 49h

        ORG   0
start:  MOV   R0,#0
next:   MOV   A,R0
        MOV   DPTR,#richt
        MOVC  A,@A+DPTR
        MOV   P1,A
        MOV   R5,#5           ; 0,5 s
        LCALL pause
        INC   R0
        CJNE  R0,#16,next
        SJMP  start

; Pause: R5 × 100 ms
pause:  MOV   R6,#200
pw1:    MOV   R4,#250
pw2:    DJNZ  R4,pw2
        DJNZ  R6,pw1
        DJNZ  R5,pause
        RET

;            N    NNO  NO   ONO  O    OSO  SO   SSO
richt:  DB   01h, 49h, 41h, 59h, 03h, 5Ah, 42h, 52h
;            S    SSW  SW   WSW  W    WNW  NW   NNW
        DB   02h, 92h, 82h, 0A2h, 04h, 0A1h, 81h, 89h
        END
