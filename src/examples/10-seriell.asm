; @title Serielle Schnittstelle
; @desc Sendet einen Gruß über die serielle Schnittstelle und schickt danach jedes empfangene Zeichen zurück (Echo). Öffne das Terminal!
; @mode int
; @terminal
;
; Mode 1, 9600 Baud (Timer 1 im Auto-Reload-Modus)

        ORG   0
        MOV   SCON,#50h       ; Mode 1, Empfänger an
        MOV   TMOD,#20h       ; Timer 1, Mode 2
        MOV   TH1,#0FDh       ; 9600 Baud @ 11,0592 MHz
        SETB  TR1
        MOV   DPTR,#gruss
send:   CLR   A
        MOVC  A,@A+DPTR
        JZ    echo
        LCALL tx
        INC   DPTR
        SJMP  send

echo:   JNB   RI,echo         ; auf Zeichen warten
        MOV   A,SBUF
        CLR   RI
        LCALL tx
        SJMP  echo

tx:     MOV   SBUF,A
        JNB   TI,$            ; warten bis gesendet
        CLR   TI
        RET

gruss:  DB    'Hallo vom 8051!', 13, 10, 0
        END
