; @title Keyboard spielt über den Tongeber
; @desc Die PC-Tasten A S D F G H J K (weiß) und W E T Z U (schwarz) spielen eine Oktave. Das Programm gibt den Code des Keyboards unverändert an den Tongeber weiter (Ton nur während des Laufs).
; @group Bauteilebibliothek
; @mode int
; @io P0=keyboard-ton
; @io P1=tongeber
;
; Keyboard an P0: D0–D3 = Note (C = 1 … C2 = 13), D4–D6 = 011 (Viertelnote); ohne Taste 00h
; Tongeber an P1: gleiches Datenformat

        ORG   0
        MOV   P0,#0FFh        ; Port 0 als Eingang
loop:   MOV   A,P0            ; Tastencode lesen
        MOV   P1,A            ; an den Tongeber ausgeben (00h = kein Ton)
        SJMP  loop
        END
