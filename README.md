# Sandkasten

**A falling-sand sandbox in the browser with a tiny ecosystem.** Plants drink water, grow to their
full height, evaporate water and scatter seeds. Beetles look for plants, eat them and pass a speed
gene on to their offspring.

With the gentle rain (on by default in the ecosystem scene) the ecosystem usually survives for a
long time. Without rain it dries out and the beetles die.

No build step, no dependencies.

<!-- TODO before going public: add docs/screenshot.png and a live demo link (e.g. GitHub Pages). -->

> [!NOTE]
> The user interface is in German for now. Contributions for an English UI are welcome.

## Features

- 15 materials: sand, water, stone, wood, fire, oil, seed, beetle, lava, acid, ice, plant, steam,
  smoke, eraser.
- An ecosystem with heredity: beetle speed is passed on and changes over generations.
- An "ecosystem" button that sets up a starting scene and turns on gentle rain.
- Pause, single step, brush size, one save slot in the browser.

## Quick start

The app uses ES modules, so it has to be served over HTTP (opening `index.html` via `file://`
does not work):

```bash
git clone https://github.com/Dark-Player-jake/sandkasten.git
cd sandkasten
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- Left mouse button or finger paints, right mouse button erases.
- `1`–`0`, `Q`–`R`, `X` pick a material, `Space` pauses, `.` advances one step, `[` `]` change the
  brush size.

## Development

```bash
node --test
```

The tests cover the physics (sand, water, oil on water, fire including a single spark, lava, gas)
and the ecosystem (eating, breeding, germination, and a long run of the starting scene with rain
over 7,000 ticks, about 5 s).

| File | Purpose |
|---|---|
| `sim.mjs` | Simulation without DOM (type, life, color and gene arrays; bottom-up update with alternating direction) |
| `main.mjs` | Rendering via `ImageData`, input, saving, statistics |

## Contributing

Issues and pull requests are welcome. Please run `node --test` before you open a pull request and
keep the project free of dependencies and external resources.

## License

<!-- TODO: license not chosen yet (MIT proposed). Add a LICENSE file before making the repo public. -->
Not decided yet.
