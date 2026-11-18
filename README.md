# Balloon Pop · The Probability Carnival

A static classroom tool for exploring theoretical and experimental probability through a balloon-pop game. Open it with any static HTTP server; no build step, account, or backend is needed.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. GitHub Pages can publish directly from the repository root on the chosen branch.

## How the model works

Scenario 10 is the default: 20 balloons with 4 red, 6 blue, and 10 green dots; 10 odd and 10 even hidden numbers; and a blue-dot/odd-number winning ticket. Scenarios 1–10 are available in the selector. Colour counts, parity counts, and the winning ticket can be edited and applied as a custom game.

Each toss selects a dot colour according to the colour counts and independently selects odd or even according to the parity counts. The balloon is replaced, so the probabilities stay the same from toss to toss. For the selected winning colour `C` and parity `Q`:

```text
P(win) = (count(C) / total balloons) × (count(Q) / total balloons)
Experimental P(win) = observed wins / completed tosses
```

The source sheet specifies the marginal counts but does not state which colour is paired with which hidden number on a fixed board. Independent selection is the modelling assumption used for both the theoretical calculation and the simulator. The balloon board is a visual illustration; when a custom game has more than 40 balloons, it shows a proportional sample while the calculations use the full entered counts.

## Files

- `index.html` — page structure
- `styles.css` — responsive carnival styling
- `favicon.svg` — local balloon icon
- `model.mjs` — presets, validation, probability, and random outcome model
- `app.mjs` — interactions, visualizations, and export

Local reference images and the working plan are in `planning/`, which is excluded from Git by `.gitignore` as requested.
