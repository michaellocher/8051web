; @title Ampel 4 (Kreuzung mit Fußgängern)
; @desc Hauptstraße (oben–unten) hat Grün, bis ein Fußgänger RUF-1 oder RUF-2 drückt. Nachts (T/N = 0) blinken die gelben Ampeln. Wie im Original-Screenshot an P4/P5 im Modus ext. ROM/RAM.
; @group Bauteilebibliothek
; @mode ext
; @io P4=ampel4
;
; PORT-oben (P4):  D0 = Ruftaste-1, D1 = Ruftaste-2, D2 = Tag-/Nacht-Schalter (Eingänge, Ruf gedrückt = 0, Tag = 1)
;                  D3 = Haupt Kfz rot, D4 = Haupt Kfz gelb
; PORT-unten (P5): D0 = Haupt Kfz grün, D1 = Fußgänger-Haupt rot, D2 = Fußgänger-Haupt grün,
;                  D3 = Neben Kfz rot, D4 = Neben Kfz gelb, D5 = Neben Kfz grün,
;                  D6 = Fußgänger-Neben rot, D7 = Fußgänger-Neben grün

RUF1    BIT   P4.0
RUF2    BIT   P4.1
TAG     BIT   P4.2
ANFORD  BIT   20h.0           ; gespeicherte Anforderung

        ORG   0
        MOV   SP,#30h
        CLR   ANFORD
haupt:  MOV   P4,#07h         ; Haupt grün, Neben rot, Fußgänger über Nebenstraße grün
        MOV   P5,#8Bh
        MOV   R5,#40          ; mindestens 4 s
hwait:  LCALL tasten
        JNB   TAG,nachtsp
        LCALL pause100
        DJNZ  R5,hwait
hfrei:  LCALL tasten
        JNB   TAG,nachtsp
        JNB   ANFORD,hfrei    ; Hauptstraße bleibt grün bis zur Anforderung
        MOV   P4,#17h         ; Haupt gelb
        MOV   P5,#4Ah
        MOV   R5,#10
        LCALL warte
        MOV   P4,#0Fh         ; alles rot
        MOV   P5,#4Ah
        MOV   R5,#10
        LCALL warte
        MOV   P4,#0Fh         ; Neben rot-gelb
        MOV   P5,#5Ah
        MOV   R5,#10
        LCALL warte
        MOV   P4,#0Fh         ; Neben grün, Fußgänger über Hauptstraße grün
        MOV   P5,#64h
        CLR   ANFORD
        MOV   R5,#50
        LCALL warte
        MOV   P4,#0Fh         ; Neben gelb
        MOV   P5,#52h
        MOV   R5,#10
        LCALL warte
        MOV   P4,#0Fh         ; alles rot
        MOV   P5,#4Ah
        MOV   R5,#10
        LCALL warte
        MOV   P4,#1Fh         ; Haupt rot-gelb
        MOV   P5,#4Ah
        MOV   R5,#10
        LCALL warte
        SJMP  haupt
nachtsp:
        LJMP  nacht

; Nachtbetrieb: Gelb blinken, bis wieder Tag ist
nacht:  MOV   P4,#17h
        MOV   P5,#10h
        MOV   R5,#5
        LCALL warte
        MOV   P4,#07h
        MOV   P5,#00h
        MOV   R5,#5
        LCALL warte
        JNB   TAG,nacht
        LJMP  haupt

; Anforderungstaster abfragen
tasten: JB    RUF1,t2
        SETB  ANFORD
t2:     JB    RUF2,tende
        SETB  ANFORD
tende:  RET

; R5 × 100 ms warten, dabei Taster weiter abfragen
warte:  LCALL tasten
        LCALL pause100
        DJNZ  R5,warte
        RET

pause100:
        MOV   R7,#200
pw1:    MOV   R6,#250
        DJNZ  R6,$
        DJNZ  R7,pw1
        RET
        END
