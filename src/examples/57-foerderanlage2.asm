; @title Förderanlage II (externes Modell)
; @desc Zwei Zubringerbänder M1/M2 fördern auf das Sammelband M3. Hand (A/M = 0): jedes Band einzeln, M1/M2 nur bei laufendem M3. Automatik (A/M = 1): S5 startet M3, nach 3 s M2, nach 5 s M1; S6 stoppt M1/M2 sofort und M3 nach 6 s. NOT-AUS (S7) stoppt alles, H1 blinkt.
; @group Externe Modelle
; @mode int
; @io P0=ext-foerder2
;
; P0 → Ax:  .0 M1  .1 M2  .2 M3  .3 H1 RUN  .4 H2 Automatik
; Ex → P1:  .0 S1 Start M1  .1 S2 Stop M1  .2 S3 Start M2  .3 S4 Stop M2  .4 S5 Start M3  .5 S6 Stop M3
;           .6 S7 NOT-AUS  .7 S8 Hand/Automatik

M1      BIT   P0.0
M2      BIT   P0.1
M3      BIT   P0.2
H1      BIT   P0.3
H2      BIT   P0.4
S1      BIT   P1.0
S2      BIT   P1.1
S3      BIT   P1.2
S4      BIT   P1.3
S5      BIT   P1.4
S6      BIT   P1.5
S7      BIT   P1.6
S8      BIT   P1.7
AUTOLF  BIT   20h.0          ; Automatikablauf läuft
CM1     BIT   20h.1          ; Befehlsmerker Motoren
CM2     BIT   20h.2
CM3     BIT   20h.3

        ORG   0
        MOV   P1,#0FFh
        MOV   P0,#00h
        CLR   AUTOLF
        CLR   CM1
        CLR   CM2
        CLR   CM3
        MOV   R2,#0           ; Hochlaufzähler Automatik (0,1 s)
        MOV   R3,#0           ; Nachlaufzähler M3
takt:   ACALL zehntel         ; Programmtakt 0,1 s
        JNB   S7,kein
        LJMP  notaus          ; NOT-AUS hat Vorrang
kein:
        MOV   C,S8            ; H2 zeigt Automatik
        MOV   H2,C
        JB    S8,auto
        ; ---- Handbetrieb ----
        CLR   AUTOLF
        MOV   R2,#0
        MOV   R3,#0
        JNB   S5,hb1
        SETB  CM3             ; M3 ein
hb1:     JNB   S1,hb2
        JNB   CM3,hb2          ; M1 nur bei laufendem M3
        SETB  CM1
hb2:     JNB   S3,hb3
        JNB   CM3,hb3          ; M2 nur bei laufendem M3
        SETB  CM2
hb3:     JNB   S2,hb4
        CLR   CM1
hb4:     JNB   S4,hb5
        CLR   CM2
hb5:     JNB   S6,anz
        JB    CM1,anz         ; M3 nur stoppen, wenn M1 und M2 stehen
        JB    CM2,anz
        CLR   CM3
        SJMP  anz
        ; ---- Automatik ----
auto:   JNB   S5,a1
        SETB  AUTOLF
a1:     JNB   S6,a2
        CLR   AUTOLF
a2:     JNB   AUTOLF,astop
        SETB  CM3             ; M3 zuerst
        MOV   R3,#60          ; Nachlauf 6 s
        MOV   A,R2
        CJNE  A,#60,ainc
        SJMP  a3
ainc:   INC   R2
a3:     MOV   A,R2
        CLR   C
        SUBB  A,#30           ; nach 3 s: M2
        JC    anz
        SETB  CM2
        MOV   A,R2
        CLR   C
        SUBB  A,#50           ; nach 5 s: M1
        JC    anz
        SETB  CM1
        SJMP  anz
astop:  CLR   CM1             ; zuerst M1 und M2 aus
        CLR   CM2
        MOV   R2,#0
        MOV   A,R3            ; M3 läuft leer nach
        JZ    a5
        DEC   R3
        SJMP  anz
a5:     CLR   CM3
anz:    MOV   C,CM1           ; Befehle ausgeben
        MOV   M1,C
        MOV   C,CM2
        MOV   M2,C
        MOV   C,CM3
        MOV   M3,C
        ORL   C,CM1
        ORL   C,CM2
        MOV   H1,C            ; RUN, wenn irgendein Band läuft
        LJMP  takt

notaus: CLR   CM1             ; NOT-AUS: alles aus, H1 blinkt
        CLR   CM2
        CLR   CM3
        CLR   AUTOLF
        MOV   R2,#0
        MOV   R3,#0
        CLR   M1
        CLR   M2
        CLR   M3
        CPL   H1
        LJMP  takt

zehntel: MOV  R6,#200         ; ca. 0,1 s
zh1:    MOV   R5,#250
zh2:    DJNZ  R5,zh2
        DJNZ  R6,zh1
        RET
        END
