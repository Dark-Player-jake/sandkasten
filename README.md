# Sandkasten

Falling-Sand-Sandbox im Browser mit kleinem Ökosystem: Pflanzen trinken Wasser und wachsen, Käfer fressen Pflanzen, vermehren sich und vererben ihr Tempo-Gen mit Mutation. Schnelle Käfer finden eher Futter, verhungern aber auch schneller. Wer sich durchsetzt, zeigt die Kurve rechts.

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
- „Ökosystem" legt eine Startszene an, „Regen" lässt es von oben nachregnen
- Speichern/Laden nutzt den Browser-Speicher (ein Platz)

## Tests

```bash
node --test
```

Prüft die Physik (Sand, Wasser, Öl auf Wasser, Feuer, Lava, Gas) und das Ökosystem (Fressen, Vermehren, Verhungern, Keimen).

## Aufbau

- `sim.mjs` – Simulation ohne DOM (Typ-, Lebens-, Farb- und Gen-Array, Update von unten nach oben mit wechselnder Richtung)
- `main.mjs` – Rendering über `ImageData`, Eingabe, Speichern, Statistik
