# Entscheidungen

## E1: Browser-Spiel (Three.js) statt Unreal Engine – 2026-10-19

**Lage:** Der Nutzer besitzt Unreal Engine nicht und möchte trotzdem sofort eine spielbare Datei.
Umgebungstest der Cloud-Umgebung (ausgeführt):

| Prüfpunkt | Ergebnis |
|---|---|
| Dateien lesen/schreiben, Git | ja |
| GPU | nein (`nvidia-smi` nicht vorhanden) |
| Unreal Engine installiert | nein |
| Unreal installierbar | praktisch nein: Epic-Konto nötig, über 100 GB, kein Editor ohne GPU |
| Node.js, Headless-Chromium | ja (Node 22, Chromium mit Software-Rendering) |
| Screenshots erzeugen | ja (Playwright) |

**Entscheidung:** Abschnitt 12, Option 3 des Master-Prompts: echtes Webspiel in einer Web-Engine (Three.js r160).
Ergebnis ist eine einzelne HTML-Datei, die offline per Doppelklick läuft.

**Folgen:** Grafik deutlich einfacher als Unreal. Kein Code ist in Unreal wiederverwendbar,
das Spieldesign (Missionen, Fahndungsregeln, Fahrzeugwerte als Daten) aber schon.

**Alternativen:** Unreal-C++-Projekt nur als Text schreiben (ohne Engine weder kompilier- noch spielbar);
Pixel Streaming (Server mit GPU, laufende Kosten).

## E2: Arcade-Fahrphysik statt Physik-Engine

Eigene einfache Fahrphysik (Geschwindigkeit entlang der Fahrtrichtung, Lenkrate abhängig vom Tempo,
Kollision über Kreise gegen Boxen). Gut steuerbar mit Tastatur, kein Zusatzpaket nötig.

## E3: Speichern im Browser (localStorage)

Spielstände liegen im Browser-Speicher des Geräts. Versionsnummer und Migrationsgerüst vorhanden;
defekte Spielstände werden erkannt und nicht geladen.
