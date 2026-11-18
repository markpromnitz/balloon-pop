# Balloon Pop · The Probability Carnival

A static classroom tool for exploring theoretical and experimental probability through a balloon-pop game. Open it with any static HTTP server; no build step, account, or backend is needed.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. GitHub Pages can publish directly from the repository root on the chosen branch.

## How the model works

Scenario 10 is the default: 20 balloons with 4 red, 6 blue, and 10 green dots; 10 odd and 10 even hidden numbers; and a blue-dot/odd-number winning ticket. Scenarios 1–10 are available in the selector. Colour counts, parity counts, and the winning ticket can be edited and applied as a custom game.

Each attempt selects a dot colour according to the colour counts and independently selects odd or even according to the parity counts. The balloon is replaced, so the probabilities stay the same from attempt to attempt. For the selected winning colour `C` and parity `Q`:

```text
P(win) = (count(C) / total balloons) × (count(Q) / total balloons)
Experimental P(win) = observed wins / completed attempts
```

The source sheet specifies the marginal counts but does not state which colour is paired with which hidden number on a fixed board. Independent selection is the modelling assumption used for both the theoretical calculation and the simulator. The balloon board is a visual illustration; when a custom game has more than 40 balloons, it shows a proportional sample while the calculations use the full entered counts.

## Summary card

The **Summary** button (top bar, results section and record section) opens a single screenshot-ready card: the winning ticket and game setup, a name and date line, the theoretical prediction with its working, a table of all six outcomes (theory against what happened), the experimental result, a win-rate graph, a short evaluation (difference, expected variability, how good the simulation is), an auto-written conclusion, and the assumptions. Two-in-a-row results appear on the card once pairs have been run. The card has Copy as text and Print / save PDF buttons for screens too short to capture it in one go.

## Optional activity: two wins in a row

Open **Can you win twice in a row?** beneath the main results. One experiment is a pair of two consecutive attempts; both must match the selected winning combination. The activity compares two rules using the same editable game settings:

- **With replacement:** restore both pools before the second attempt, then independently redraw a dot colour and number parity. If `C` is the winning colour count, `Q` is the winning parity count, and `N` is the total, `P(two wins) = (C/N × Q/N)²`.
- **Without replacement:** remove the selected balloon and hidden number before the second attempt. `P(two wins) = (C/N × Q/N) × ((C−1)/(N−1) × (Q−1)/(N−1))`, for `N ≥ 2`. The second factors are conditional on the first attempt having won.

Scenario 10 gives `9/400 = 2.25%` with replacement and `27/1444 ≈ 1.87%` without replacement. Each new pair experiment starts with the original counts, and the two modes keep separate observed results. Without replacement requires at least two balloons. If the winning colour or parity has fewer than two entries, two wins without replacement are impossible.

Each mode has a labelled bar graph for the first win, the conditional second win, the full two-win chance, and the simulated rate. Both graphs share a percentage scale that adjusts to the current settings and results, so they can be compared directly. The current scenario and counts appear immediately above them.

The two-bag model (one bag of dot colours, one of odd/even numbers) matches the classwork calculations and keeps the maths simple for students: each attempt pulls one item from each bag. Without replacement removes the pulled colour and number before attempt two. A real board with a fixed colour–number pairing behind each balloon would need the count of each colour–parity combination for an exact answer; this tool deliberately doesn't model that.

## Files

- `index.html` — page structure
- `styles.css` — responsive carnival styling
- `favicon.svg` — local balloon icon
- `model.mjs` — presets, validation, probability, and random outcome model
- `app.mjs` — interactions, visualizations, and export

Local reference images and the working plan are in `planning/`, which is excluded from Git by `.gitignore` as requested.
