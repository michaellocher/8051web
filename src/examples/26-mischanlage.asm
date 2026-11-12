; @title Mischanlage (externes Modell)
; @desc START dosiert zwei Komponenten nacheinander in den Mischbehälter (halb voll, dann voll); Schalter S2 wählt, welches Silo zuerst dran ist.
; @group Externe Modelle
; @mode int
; @io P0=ext-misch
;
; P0 → Ax:  .0 H1 Silo A leer   .1 H2 Silo B leer   .2 Y1 Ventil Silo A   .3 Y2 Ventil Silo B
; Ex → P1:  .0 S1 START   .1 S2 Wahl (0 = A zuerst, 1 = B zuerst)   .2 B1 Silo A leer   .3 B2 Silo B leer
;           .4 B3 Behälter halb voll   .5 B4 Behälter voll
;
; Ablauf: Erste Komponente bis B3 (halb), zweite bis B4 (voll). Wird ein Silo leer, bricht das
; Programm ab (Ventile zu). START wird ignoriert, solange der Behälter nicht leer ist.

H1      BIT   P0.0
H2      BIT   P0.1
Y1      BIT   P0.2
Y2      BIT   P0.3
S1      BIT   P1.0
S2      BIT   P1.1
B1      BIT   P1.2
B2      BIT   P1.3
B3      BIT   P1.4
B4      BIT   P1.5

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
warte:  ACALL anz             ; Leermeldungen aktualisieren
        JNB   S1,warte        ; auf START warten
        JB    B3,warte        ; Behälter schon (halb) voll → nicht starten
        JB    S2,bzu          ; Schalter: B zuerst?
; --- A zuerst
        SETB  Y1
a1:     ACALL anz
        JB    B1,fehler       ; Silo A leer → Abbruch
        JNB   B3,a1           ; bis halb voll
        CLR   Y1
        SETB  Y2
a2:     ACALL anz
        JB    B2,fehler
        JNB   B4,a2           ; bis voll
        CLR   Y2
        SJMP  ende
; --- B zuerst
bzu:    SETB  Y2
bw1:    ACALL anz
        JB    B2,fehler
        JNB   B3,bw1
        CLR   Y2
        SETB  Y1
bw2:    ACALL anz
        JB    B1,fehler
        JNB   B4,bw2
        CLR   Y1
ende:   ACALL anz
        JB    S1,ende         ; START loslassen
        SJMP  warte
fehler: CLR   Y1              ; Ventile zu, Lampe zeigt das leere Silo
        CLR   Y2
        SJMP  ende

anz:    MOV   C,B1            ; H1 = Silo A leer
        MOV   H1,C
        MOV   C,B2            ; H2 = Silo B leer
        MOV   H2,C
        RET
        END
