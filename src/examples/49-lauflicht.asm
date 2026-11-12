; @title Verkehrslauflicht (externes Modell)
; @desc Ist EIN (Ex.0) gesetzt, läuft das Licht von H1 nach H6 und wieder von vorn. Die Geschwindigkeit wird mit F1–F3 (Ex.1–3) gewählt: langsam 400 ms, mittel 200 ms, schnell 100 ms.
; @group Externe Modelle
; @mode int
; @io P0=ext-lauflicht
;
; P0 → Ax:  .0–.5 H1–H6
; Ex → P1:  .0 EIN  .1 F1 langsam  .2 F2 mittel  .3 F3 schnell

EIN     BIT   P1.0
F1      BIT   P1.1
F2      BIT   P1.2

        ORG   0
        MOV   P1,#0FFh
aus:    MOV   P0,#00h
        MOV   A,#01h          ; H1 zuerst
warte:  JNB   EIN,aus
        MOV   P0,A            ; aktuelle Leuchte an
        MOV   R4,#8           ; langsam: 8 × 50 ms
        JB    F1,los
        MOV   R4,#4           ; mittel
        JB    F2,los
        MOV   R4,#2           ; schnell
los:    ACALL ms50
        DJNZ  R4,los
        RL    A               ; nächste Leuchte
        CJNE  A,#40h,warte    ; hinter H6 → wieder H1
        MOV   A,#01h
        SJMP  warte

ms50:   MOV   R6,#98          ; ca. 50 ms
m1:     MOV   R7,#0
m0:     DJNZ  R7,m0
        DJNZ  R6,m1
        RET
        END
