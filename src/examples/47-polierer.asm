; @title Poliermaschine (externes Modell)
; @desc START (S1): Polierscheibe an, Schlitten fährt einmal nach rechts und zurück nach links, Scheibe aus. STOP oder Übertemperatur (S5/S7) schalten alles ab und melden Störung (H2) bis STOP.
; @group Externe Modelle
; @mode int
; @io P0=ext-polierer
;
; P0 → Ax:  .0 H1 Betrieb  .1 H2 Störung  .2 M1R rechts  .3 M1L links  .4 M2 Polierscheibe
; Ex → P1:  .0 S1 START  .1 S2 STOP  .2 S3 links  .3 S4 rechts  .4 S5 M2 heiß  .5 S6 Mitte
;           .6 S7 M1 heiß  .7 S8 Werkstück da

H1      BIT   P0.0
H2      BIT   P0.1
M1R     BIT   P0.2
M1L     BIT   P0.3
M2      BIT   P0.4
START   BIT   P1.0
STOPP   BIT   P1.1
LINKS   BIT   P1.2
RECHTS  BIT   P1.3
HEISS2  BIT   P1.4
HEISS1  BIT   P1.6
WERK    BIT   P1.7

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
warte:  JNB   START,warte
        JNB   WERK,warte      ; nur mit Werkstück
        JNB   LINKS,warte     ; Schlitten muss links stehen
        SETB  H1
        SETB  M2              ; Polierscheibe an
        ACALL pause           ; Hochlaufzeit
        ACALL pause
        SETB  M1R             ; nach rechts
hin:    ACALL pruefe
        JNB   RECHTS,hin
        CLR   M1R
        SETB  M1L             ; zurück nach links
zur:    ACALL pruefe
        JNB   LINKS,zur
        CLR   M1L
        CLR   M2
        CLR   H1
        SJMP  warte2
warte2: JB    START,warte2    ; erst START loslassen
        SJMP  warte

; Schutz: STOP oder Übertemperatur → alles aus, Störung bis STOP
pruefe: JB    STOPP,fehler
        JB    HEISS1,fehler
        JB    HEISS2,fehler
        RET
fehler: POP   ACC             ; Rücksprungadresse verwerfen
        POP   ACC
        MOV   P0,#02h         ; alles aus, nur H2 (Störung)
f1:     JB    STOPP,f1        ; STOP muss erst losgelassen sein
f2:     JNB   STOPP,f2        ; dann STOP als Quittierung
f3:     JB    STOPP,f3
        SJMP  warte

pause:  MOV   R5,#4           ; ca. 0,5 s
q2:     MOV   R6,#0
q1:     MOV   R7,#0
q0:     DJNZ  R7,q0
        DJNZ  R6,q1
        DJNZ  R5,q2
        RET
        END
