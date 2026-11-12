; @title Verpackungsrollenbahn (externes Modell)
; @desc START (S1) aktiviert die Anlage. Ein Paket auf dem Hubtisch wird angehoben, vom Schieber auf die obere Rollenbahn geschoben, danach fahren Schieber und Hubtisch zurück. Pakete mit dem Knopf „Paket auflegen" nachlegen.
; @group Externe Modelle
; @mode int
; @io P0=ext-rollenbahn
;
; P0 → Ax:  .0 1Y1 heben  .1 1Y2 senken  .2 2Y1 Schieber aus  .3 2Y2 Schieber ein
; Ex → P1:  .0 S1 START  .1 S2 Paket da  .2 1S1 unten  .3 1S2 oben  .4 2S1 Schieber ein  .5 2S2 Schieber aus

HEBEN   BIT   P0.0
SENKEN  BIT   P0.1
SCHAUS  BIT   P0.2
SCHEIN  BIT   P0.3
START   BIT   P1.0
PAKET   BIT   P1.1
UNTEN   BIT   P1.2
OBEN    BIT   P1.3
SEIN    BIT   P1.4
SAUS    BIT   P1.5

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  SENKEN          ; Grundstellung herstellen
        SETB  SCHEIN
g0:     JNB   UNTEN,g0
        JNB   SEIN,g0
        CLR   SENKEN
        CLR   SCHEIN
warte:  JNB   START,warte
zyk:    JNB   PAKET,zyk       ; auf Paket warten
        SETB  HEBEN           ; Hubtisch hoch
h1:     JNB   OBEN,h1
        CLR   HEBEN
        SETB  SCHAUS          ; Paket hinüberschieben
s1:     JNB   SAUS,s1
        CLR   SCHAUS
        SETB  SCHEIN          ; Schieber zurück
s2:     JNB   SEIN,s2
        CLR   SCHEIN
        SETB  SENKEN          ; Hubtisch runter
h2:     JNB   UNTEN,h2
        CLR   SENKEN
        SJMP  zyk
        END
