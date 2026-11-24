# Sandkasten

Falling-Sand-Sandbox im Browser mit kleinem Ökosystem: Pflanzen trinken Wasser, wachsen bis zu ihrer Endhöhe, verdunsten Wasser und streuen Samen. Käfer suchen Pflanzen, fressen die Triebe (Wurzeln bleiben), vermehren sich und vererben ihr Tempo-Gen mit Mutation. Schnelle Käfer sehen weiter, verbrauchen aber mehr Energie. Das Mittel des Tempo-Gens steht rechts, die Kurve zeigt Käfer und Pflanzen.

Mit dem sanften Regen (startet automatisch) hält sich das Ökosystem meist über lange Zeit; ohne Regen trocknet es aus und die Käfer sterben. Gemessen über 20.000 Ticks: mit Regen überleben die Käfer in den meisten Startszenen, und das Gen-Mittel wandert deutlich (z. B. 128 → 78 oder → 171).

15 Materialien: Sand, Wasser, Stein, Holz, Feuer, Öl, Samen, Käfer, Lava, Säure, Eis, Pflanze, Dampf, Rauch, Radierer.

## Starten

Kein Build, keine Abhängigkeiten. Wegen der ES-Module nicht per `file://` öffnen:

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Bedienung

- Linke Maustaste / Finger malt, rechte Maustaste radiert
- `1`–`0`, `Q`–`R`, `X` wählen das Material, `Leertaste` pausiert, `.` macht einen Einzelschritt, `[` `]` ändern den Pinsel
- „Ökosystem" legt eine Startszene an und schaltet sanften Regen ein, „Regen" schaltet ihn um
- Speichern/Laden nutzt den Browser-Speicher (ein Platz)

## Tests

```bash
node --test
```

Prüft die Physik (Sand, Wasser, Öl auf Wasser, Feuer inkl. Einzelfunke, Lava, Gas) und das Ökosystem (Fressen, Vermehren, Keimen, Langzeitlauf der Startszene mit Regen über 7000 Ticks, ca. 5 s).

## Aufbau

- `sim.mjs` – Simulation ohne DOM (Typ-, Lebens-, Farb- und Gen-Array, Update von unten nach oben mit wechselnder Richtung)
- `main.mjs` – Rendering über `ImageData`, Eingabe, Speichern, Statistik
