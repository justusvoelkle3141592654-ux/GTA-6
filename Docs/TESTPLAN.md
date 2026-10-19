# Testplan

## Automatisch (`node tests/smoke.mjs`)

Läuft im Headless-Chromium mit Software-Rendering. Stand 2026-10-19: **25/25 bestanden**, keine Browser-Fehler.

Geprüft: Spielstart, Laufen, Einsteigen, Fahren, alle 3 Missionen (per Teleport durchgespielt), Zeitlimit,
Fahndungsstufe nach Abholung, Polizeiverfolgung, Versteck gesperrt solange gesucht, Fahndungsende per Timer,
Speichern/Laden, defekter Spielstand ohne Absturz, Pausemenü, 60 s Dauerlauf mit Fahren, Kartenrand am Wasser.

Zusätzlich manuell per Skript beobachtet: Verkehr fährt ohne Stau (Ø ca. 10,5 m/s, 0 stehende Fahrzeuge
über 30 s), Polizei erreicht und verhaftet einen stehenden Spieler (ca. 20 s bei Stufe 2).

## Manuell (vom Menschen auf echter Hardware)

| # | Schritt | Erwartet | Status |
|---|---|---|---|
| 1 | Datei per Doppelklick öffnen | Hauptmenü erscheint | offen |
| 2 | Mission 1–3 normal durchspielen (ohne Teleport) | alle erfüllbar | offen |
| 3 | Mit Gamepad fahren | Lenken, Gas, Bremse, Einsteigen gehen | offen |
| 4 | Auf Handy im Querformat spielen | Touch-Tasten funktionieren | offen |
| 5 | FPS mit F3 ablesen | flüssig (Ziel ≥ 60 FPS auf PC) | offen |
| 6 | Speichern, Browser schließen, laden | gleicher Stand | offen |

Nicht geprüft: Spielgefühl, Leistung auf echter GPU, Gamepad, echte Touch-Geräte.
