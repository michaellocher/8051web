; @title Speiseaufzug
; @desc Ein Tastendruck ruft den Aufzug: „aufwärts“ schickt ihn nach oben, „abwärts“ nach unten. Dort öffnet die Tür, schließt nach 3 s wieder und wartet auf den nächsten Ruf. Eine Lichtschranke (INT0/INT1 am Modell) öffnet die Tür beim Schließen erneut.
; @group Bauteilebibliothek
; @mode int
; @io P0=speiseaufzug
;
; PORT-oben (P0, Eingänge, 0 = aktiv):  .0 Taste auf (oben)  .1 Taste ab (oben)  .2 A Tor oben auf  .3 B Tor oben zu
;                                       .4 C Tor unten auf  .5 D Tor unten zu  .6 E Aufzug oben  .7 F Aufzug unten
; PORT-unten (P1, Ausgänge):            .0 H Aufzug ab  .1 I Aufzug auf  .2 J Tür oben zu  .3 K Tür oben auf
;                                       .4 L Tür unten zu  .5 M Tür unten auf
;                                       .6 Taste auf (unten)  .7 Taste ab (unten) – Eingänge, daher stets 1
; Lichtschranken lösen INT0 (oben) bzw. INT1 (unten) aus; beide setzen das Merkerbit LS.

LS        BIT   20h.0
TASTE_O_AUF BIT P0.0
TASTE_O_AB  BIT P0.1
TASTE_U_AUF BIT P1.6
TASTE_U_AB  BIT P1.7
TOR_O_AUF   BIT P0.2
TOR_O_ZU    BIT P0.3
TOR_U_AUF   BIT P0.4
TOR_U_ZU    BIT P0.5
AUFZ_OBEN   BIT P0.6
AUFZ_UNTEN  BIT P0.7
M_AB        BIT P1.0
M_AUF       BIT P1.1
M_O_ZU      BIT P1.2
M_O_AUF     BIT P1.3
M_U_ZU      BIT P1.4
M_U_AUF     BIT P1.5

        ORG   0
        LJMP  start
        ORG   03h             ; INT0: Lichtschranke oben
        SETB  LS
        RETI
        ORG   13h             ; INT1: Lichtschranke unten
        SETB  LS
        RETI

        ORG   30h
start:  MOV   SP,#40h
        MOV   P0,#0FFh        ; Eingänge
        MOV   P1,#0C0h        ; alle Motoren aus, Tasten als Eingang
        SETB  IT0             ; flankengesteuerte Interrupts
        SETB  IT1
        SETB  EX0
        SETB  EX1
        SETB  EA
; Referenzfahrt: Türen schließen, Aufzug nach unten
        LCALL tuer_o_zu
        LCALL tuer_u_zu
        JNB   AUFZ_UNTEN,warte
        SETB  M_AB
        JB    AUFZ_UNTEN,$
        CLR   M_AB

warte:  JNB   TASTE_O_AUF,nach_o
        JNB   TASTE_U_AUF,nach_o
        JNB   TASTE_O_AB,nach_u
        JNB   TASTE_U_AB,nach_u
        SJMP  warte

; Aufzug nach oben, Tür oben öffnen, 3 s warten, schließen
nach_o: JNB   AUFZ_OBEN,warte   ; schon oben
        SETB  M_AUF
        JB    AUFZ_OBEN,$
        CLR   M_AUF
        LCALL tuer_o_auf
        MOV   R5,#30
        LCALL pause100
        LCALL tuer_o_zu
        SJMP  warte

; Aufzug nach unten, Tür unten öffnen, 3 s warten, schließen
nach_u: JNB   AUFZ_UNTEN,warte  ; schon unten
        SETB  M_AB
        JB    AUFZ_UNTEN,$
        CLR   M_AB
        LCALL tuer_u_auf
        MOV   R5,#30
        LCALL pause100
        LCALL tuer_u_zu
        SJMP  warte

tuer_o_auf:
        CLR   M_O_ZU
        SETB  M_O_AUF
        JB    TOR_O_AUF,$
        CLR   M_O_AUF
        RET
tuer_u_auf:
        CLR   M_U_ZU
        SETB  M_U_AUF
        JB    TOR_U_AUF,$
        CLR   M_U_AUF
        RET

; Tür schließen; unterbricht die Lichtschranke, öffnet die Tür kurz wieder
tuer_o_zu:
        CLR   LS
        CLR   M_O_AUF
        SETB  M_O_ZU
tz1:    JNB   LS,tz2
        LCALL tuer_o_auf
        MOV   R5,#20
        LCALL pause100
        CLR   LS
        CLR   M_O_AUF
        SETB  M_O_ZU
tz2:    JB    TOR_O_ZU,tz1
        CLR   M_O_ZU
        RET
tuer_u_zu:
        CLR   LS
        CLR   M_U_AUF
        SETB  M_U_ZU
tu1:    JNB   LS,tu2
        LCALL tuer_u_auf
        MOV   R5,#20
        LCALL pause100
        CLR   LS
        CLR   M_U_AUF
        SETB  M_U_ZU
tu2:    JB    TOR_U_ZU,tu1
        CLR   M_U_ZU
        RET

; R5 × 100 ms warten
pause100:
        MOV   R2,#200
pw1:    MOV   R3,#250
        DJNZ  R3,$
        DJNZ  R2,pw1
        DJNZ  R5,pause100
        RET
        END
