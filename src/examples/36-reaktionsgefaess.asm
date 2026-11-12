; @title Reaktionsgefäß (externes Modell)
; @desc Anfahren: Rührwerk und Heizung an, bis T ≥ 100 °C. Im Normalbetrieb wird die Temperatur gehalten; bei zu hoher Temperatur kühlt V1, bei zu hohem Druck öffnet V2 – jeweils mit Alarm. Die Störungstasten im Bild lösen Grenzwertverletzungen aus.
; @group Externe Modelle
; @mode int
; @io P0=ext-reakgef
;
; P0 → Ax:  .0 P1 Normalbetrieb  .1 P2 Anfahren  .2 P3 Alarm  .3 V1 Kühlzulauf  .4 V2 Druckablass
;           .5 Q Heizung  .6 M Rührwerk
; Ex → P1:  .0 S1 p zu hoch  .1 S2 p zu niedrig  .2 S3 T zu hoch  .3 S4 T zu niedrig

LNORM   BIT   P0.0
LANF    BIT   P0.1
LALARM  BIT   P0.2
V1      BIT   P0.3
V2      BIT   P0.4
QHEIZ   BIT   P0.5
MRUEHR  BIT   P0.6
SPHOCH  BIT   P1.0
SPNIED  BIT   P1.1
STHOCH  BIT   P1.2
STNIED  BIT   P1.3

        ORG   0
        MOV   P0,#00h
        MOV   P1,#0FFh
        SETB  MRUEHR          ; Anfahren: Rühren und Heizen
        SETB  LANF
anf:    SETB  QHEIZ
        JB    STNIED,anf      ; bis T ≥ 100 °C
        CLR   LANF
        SETB  LNORM           ; Normalbetrieb
reg:    JB    STHOCH,kuehl    ; Temperatur zu hoch?
        CLR   V1
        MOV   C,STNIED        ; Heizung nur bei T < 100 °C
        MOV   QHEIZ,C
        SJMP  druck
kuehl:  CLR   QHEIZ           ; Heizung aus, Kühlzulauf auf
        SETB  V1
druck:  JB    SPHOCH,ablass   ; Druck zu hoch?
        CLR   V2
        SJMP  alarm
ablass: SETB  V2              ; Dampf ablassen
alarm:  MOV   C,STHOCH        ; Alarm bei zu hoher Temperatur
        ORL   C,SPHOCH        ; oder zu hohem Druck
        MOV   LALARM,C
        SJMP  reg
        END
