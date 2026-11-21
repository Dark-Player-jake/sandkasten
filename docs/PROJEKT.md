# sandkasten – Projektsteckbrief

- **Zielgruppe:** Leute, die gern herumprobieren; kurze Spielsessions am Rechner oder Handy.
- **Kernaktion:** Material auf die Fläche streuen und zusehen, wie es reagiert.
- **Nicht-Ziele:** Kein Missions-/Levelsystem, kein Multiplayer, keine Online-Speicherstände.

## Architekturentscheidungen

Typisierte Arrays (Typ, Leben, Farbton, Gen), Update von unten nach oben mit wechselnder Richtung und `moved`-Flag gegen Doppelbewegung. Reine ES-Module, kein Build.

## Risiken

Performance auf schwachen Handys (320×180 Zellen pro Frame); Ökosystem-Balance nur grob abgestimmt.

## MVP / Erfolgstest

Entstanden in der Nachtschicht 21./22.11.2026. Erfolgstest: `node --test` grün und die Kernaktion im Browser ohne Konsolenfehler bedienbar (per Playwright geprüft). Was Menschen noch prüfen müssen, steht in der Projekt-Memory `nachtschicht-2026-11-21`.
