; @title Abfüllanlage (externes Modell)
; @desc Hauptschalter an: Das Magazin setzt eine Flasche aufs Band, das Band hält am Füllplatz, das Silo-Ventil füllt 2 s lang, das Band läuft weiter. Ist das Silo leer, leuchtet die Lampe P, bis es nachgefüllt wird.
; @group Externe Modelle
; @mode int
; @io P0=ext-abfuell
;
; P0 → Ax:  .0 Y2 Flasche freigeben  .1 Y1 Silo-Ventil  .2 M Bandmotor  .7 P Lampe „Silo leer“
; Ex → P1:  .0 S1 Hauptschalter  .1 S2 Lichtschranke Füllplatz  .2 S3 Silo-Füllstand (1 = gefüllt)

Y2      BIT   P0.0
Y1      BIT   P0.1
MOTOR   BIT   P0.2
LEER    BIT   P0.7
SCHALT  BIT   P1.0
LS      BIT   P1.1
SILO    BIT   P1.2

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
aus:    CLR   MOTOR           ; Anlage aus
        CLR   Y1
        JNB   SCHALT,aus      ; auf Hauptschalter warten
zyk:    JNB   SCHALT,aus
        JNB   SILO,keinpr      ; Silo leer?
        CLR   LEER
        SETB  MOTOR           ; Band läuft
        SETB  Y2              ; Flasche aufs Band setzen
        LCALL ms100
        LCALL ms100
        CLR   Y2
warte:  JNB   SCHALT,aus
        JNB   LS,warte        ; auf Flasche am Füllplatz warten
        CLR   MOTOR           ; Band anhalten
        SETB  Y1              ; füllen (2 s)
        MOV   R5,#20
fuell:  LCALL ms100
        DJNZ  R5,fuell
        CLR   Y1
        SETB  MOTOR           ; Flasche weiterfahren
frei:   JB    LS,frei         ; warten, bis sie den Füllplatz verlassen hat
        SJMP  zyk
keinpr: CLR   MOTOR           ; Silo leer: Lampe an, warten bis nachgefüllt
        SETB  LEER
lw:     JB    SILO,zyk
        SJMP  lw

; ca. 100 ms warten
ms100:  MOV   R7,#200
m1:     MOV   R6,#250
m2:     DJNZ  R6,m2
        DJNZ  R7,m1
        RET
        END
