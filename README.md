# Velmar – Open-World-Prototyp

Ein spielbarer Prototyp eines Open-World-Spiels in der fiktiven Hafenstadt **Velmar**.
Eigene Stadt, Figuren, Fahrzeuge, Texte und Töne (keine Inhalte aus GTA oder anderen Spielen).

## Spielen

1. `dist/Velmar.html` herunterladen.
2. Doppelklick → öffnet sich im Browser (Chrome, Edge, Firefox, Safari). Keine Installation, kein Internet nötig.

Steuerung: W/A/S/D oder Pfeiltasten · Shift sprinten · Leertaste Handbremse · F einsteigen/aussteigen ·
H Hupe · L Licht · C Kamera · Esc Pause. Gamepad und Touch (Handy/Tablet) werden unterstützt.

## Inhalt

- Stadt mit Wohnvierteln, Innenstadt mit Hochhaus, Park, Hafen mit Containern, Wasserkante
- Zu Fuß gehen, 3 Fahrzeugtypen (Pico, Falkner GT, Kastor) plus Streifenwagen, ein- und aussteigen
- Fußgänger (5 Varianten, laufen, fliehen) und Verkehr (fährt Straßennetz ab, hält vor Hindernissen)
- Polizei: Fahndungsstufe 0–3, Zeugen, Verfolgung, Festnahme, Abhängen per Sichtkontakt-Timer
- 3 Missionen: „Ankunft“, „Eilige Lieferung“ (Zeitlimit), „Hafennacht“ (Polizei abhängen)
- HUD mit Minikarte, Zielpfeil, Geld, Gesundheit, Tempo; Haupt- und Pausemenü, Einstellungen
- Speichern/Laden: 3 Slots + Autosave nach jeder Mission (im Browser gespeichert)

## Warum nicht Unreal Engine?

Siehe `Docs/ENTSCHEIDUNGEN.md`. Kurz: In der Cloud-Umgebung gibt es keine Unreal Engine und keine GPU,
und der Nutzer hat Unreal nicht installiert. Deshalb wurde der Weg „Webspiel mit Three.js“ aus
Abschnitt 12 des Master-Prompts gewählt.

## Entwicklung

```
node scripts/build.mjs        # baut dist/Velmar.html aus web/src + web/vendor
node tests/smoke.mjs          # automatischer Test im Headless-Chromium (Playwright nötig)
```
