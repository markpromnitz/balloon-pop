import { COLOURS, PARITIES, PRESETS, validateConfig, totalBalloons, probability, winningProbability, winningFraction, pairWinProbability, pairWinFraction, drawOutcome, drawPair, displayColours } from "./model.mjs";

const $ = (id) => document.getElementById(id);
const titleCase = (text) => text[0].toUpperCase() + text.slice(1);
const number = new Intl.NumberFormat("en-AU");
function formatPercent(value, ordinaryDigits) {
  if (value === null) return "—";
  const amount = value * 100;
  if (amount > 0 && amount < .001) return `${amount.toExponential(2)}%`;
  const digits = amount < .1 ? 4 : amount < 1 ? 3 : ordinaryDigits;
  return `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: digits }).format(amount)}%`;
}
const percent = (value) => formatPercent(value, 1);
const pairPercent = (value) => formatPercent(value, 2);
const pointFormat = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const svgNS = "http://www.w3.org/2000/svg";

let config = { ...PRESETS[9] };
let chosenScenario = 10;
let trials = [];
let wins = 0;
let frequencies = Object.fromEntries(COLOURS.flatMap((colour) => PARITIES.map((parity) => [`${colour}-${parity}`, 0])));
let checkpoints = [];
let boardColours = [];
let pairRuns = { replace: { attempts: 0, wins: 0, last: null }, remove: { attempts: 0, wins: 0, last: null } };

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    const range = 2 ** 32;
    const limit = range - (range % max);
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function getCounts() {
  const keys = [...COLOURS, ...PARITIES];
  return Object.fromEntries(keys.map((key) => {
    const raw = $(`${key}-count`).value.trim();
    return [key, raw === "" ? NaN : Number(raw)];
  }));
}

function readSettings() {
  return { ...getCounts(), winColour: $("win-colour").value, winParity: $("win-parity").value };
}

function populateSettings(next) {
  for (const key of [...COLOURS, ...PARITIES]) $(`${key}-count`).value = next[key];
  $("win-colour").value = next.winColour;
  $("win-parity").value = next.winParity;
}

function setError(id, message) {
  const element = $(id);
  element.textContent = message;
  element.hidden = !message;
}

function resetData() {
  trials = [];
  wins = 0;
  frequencies = Object.fromEntries(COLOURS.flatMap((colour) => PARITIES.map((parity) => [`${colour}-${parity}`, 0])));
  checkpoints = [];
  $("last-outcome").textContent = "Waiting for an attempt…";
  $("last-verdict").textContent = "Your result will appear here.";
  renderResults();
}

function applyConfig(next, scenario) {
  const error = validateConfig(next);
  if (error) { setError("settings-error", `${error} The game below hasn't changed yet.`); return false; }
  setError("settings-error", "");
  config = { ...next };
  chosenScenario = scenario;
  $("scenario").value = String(scenario);
  populateSettings(config);
  $("prediction").value = "";
  renderBoard();
  renderOdds();
  resetData();
  resetPairData();
  $("action-status").textContent = scenario === "custom" ? "Custom game applied. A fresh experiment is ready." : `Scenario ${scenario} loaded. A fresh experiment is ready.`;
  return true;
}

function shuffleForDisplay(items) {
  const array = [...items];
  let seed = array.reduce((sum, colour, i) => sum + (COLOURS.indexOf(colour) + 1) * (i + 31), 753);
  for (let i = array.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderBoard() {
  boardColours = shuffleForDisplay(displayColours(config));
  const balloonPaints = ["#e95852", "#f7bb53", "#5bb3a6", "#83a5d5", "#e88a75"];
  const board = $("balloon-board");
  board.replaceChildren();
  boardColours.forEach((colour, i) => {
    const balloon = document.createElement("div");
    balloon.className = "balloon";
    balloon.style.setProperty("--balloon-color", balloonPaints[(i * 7 + Math.floor(i / 5)) % balloonPaints.length]);
    balloon.style.setProperty("--dot-color", `var(--${colour})`);
    balloon.style.setProperty("--lift", `${(i % 3 - 1) * 5}px`);
    balloon.style.setProperty("--tilt", `${((i * 7) % 13) - 6}deg`);
    balloon.innerHTML = '<span class="balloon-dot"></span>';
    board.append(balloon);
  });
  const count = totalBalloons(config);
  $("board-count").textContent = count > boardColours.length ? `${number.format(boardColours.length)} OF ${number.format(count)} SHOWN` : `${number.format(count)} BALLOONS`;
  board.setAttribute("aria-label", `${count} balloons: ${config.red} red dots, ${config.blue} blue dots, ${config.green} green dots`);
}

function popBalloon(colour) {
  if (reducedMotion.matches) return;
  const matching = [...$("balloon-board").children].filter((balloon, index) => boardColours[index] === colour);
  const balloon = matching.length ? matching[randomInt(matching.length)] : $("balloon-board").children[randomInt(boardColours.length)];
  if (!balloon) return;
  balloon.classList.remove("popping");
  void balloon.offsetWidth;
  balloon.classList.add("popping");
  window.setTimeout(() => balloon.classList.remove("popping"), 600);
}

function simpleFraction(colour, parity) {
  const total = totalBalloons(config);
  let a = config[colour] * config[parity];
  let b = total * total;
  let x = a, y = b;
  while (y) [x, y] = [y, x % y];
  a /= x; b /= x;
  return `${a}/${b}`;
}

function renderOdds() {
  const body = $("outcome-body");
  body.replaceChildren();
  COLOURS.forEach((colour) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.innerHTML = `<span class="colour-name"><i class="swatch ${colour}" aria-hidden="true"></i>${titleCase(colour)}</span>`;
    row.append(heading);
    PARITIES.forEach((parity) => {
      const cell = document.createElement("td");
      const isWin = colour === config.winColour && parity === config.winParity;
      if (isWin) cell.className = "winning-cell";
      cell.innerHTML = `<span class="cell-value"><strong>${percent(probability(config, colour, parity))}</strong><span>${simpleFraction(colour, parity)}${isWin ? " ★" : ""}</span></span>`;
      row.append(cell);
    });
    body.append(row);
  });
  const total = totalBalloons(config);
  const chance = winningProbability(config);
  const fraction = winningFraction(config);
  $("formula-target").textContent = `${titleCase(config.winColour)} dot + ${config.winParity} number`;
  $("theory-percent").textContent = percent(chance);
  $("formula-line").textContent = `${config[config.winColour]}/${total} × ${config[config.winParity]}/${total} = ${fraction.numerator}/${fraction.denominator}`;
  $("formula-words").textContent = `On average, about ${pointFormat.format(chance * 100)} wins in every 100 attempts.`;
  $("expected-percent").textContent = percent(chance);
  $("ticket-scenario").textContent = chosenScenario === "custom" ? "CUSTOM" : chosenScenario;
  $("summary-target").textContent = `${titleCase(config.winColour)} dot · ${titleCase(config.winParity)} number`;
  $("summary-mix").textContent = `${config.red} red · ${config.blue} blue · ${config.green} green`;
  $("summary-parity").textContent = `${config.odd} odd · ${config.even} even`;
  $("summary-theory").textContent = `${fraction.numerator}/${fraction.denominator} (${percent(chance)})`;
}

function runTrials(count, animate = false) {
  setError("run-error", "");
  const before = trials.length;
  const winsBefore = wins;
  const interval = Math.max(1, Math.ceil(count / 100));
  let last;
  for (let i = 0; i < count; i++) {
    const outcome = drawOutcome(config, randomInt);
    last = outcome;
    trials.push(outcome);
    frequencies[`${outcome.colour}-${outcome.parity}`]++;
    if (outcome.win) wins++;
    if (i === count - 1 || (i + 1) % interval === 0) checkpoints.push({ trial: trials.length, rate: wins / trials.length });
  }
  if (checkpoints.length > 300) {
    const lastCheckpoint = checkpoints[checkpoints.length - 1];
    checkpoints = checkpoints.filter((_, i) => i % 2 === 0);
    if (checkpoints[checkpoints.length - 1] !== lastCheckpoint) checkpoints.push(lastCheckpoint);
  }
  const tally = `${number.format(trials.length)} ${trials.length === 1 ? "attempt" : "attempts"}, ${number.format(wins)} ${wins === 1 ? "win" : "wins"} so far`;
  if (count === 1) {
    $("last-outcome").textContent = `${titleCase(last.colour)} dot · ${titleCase(last.parity)} number`;
    $("last-verdict").textContent = `${last.win ? "A winning pop!" : "Not a match this time."} (${tally})`;
  } else {
    const batchWins = wins - winsBefore;
    $("last-outcome").textContent = `${number.format(count)} attempts done`;
    $("last-verdict").textContent = `${number.format(batchWins)} ${batchWins === 1 ? "win" : "wins"} in this batch (${tally})`;
  }
  if (animate) popBalloon(last.colour);
  $("action-status").textContent = `${number.format(count)} ${count === 1 ? "attempt" : "attempts"} added (${number.format(before + count)} total).`;
  renderResults();
}

function renderResults() {
  const count = trials.length;
  const actual = count ? wins / count : null;
  const expected = winningProbability(config);
  $("trial-count").textContent = number.format(count);
  $("win-count").textContent = number.format(wins);
  $("loss-count").textContent = `${number.format(count - wins)} misses`;
  $("experimental-percent").textContent = actual === null ? "—" : percent(actual);
  $("experimental-fraction").textContent = actual === null ? "Make an attempt to see it" : `${number.format(wins)} / ${number.format(count)} wins`;
  const gap = actual === null ? null : Math.abs(actual - expected);
  const gapPoints = gap === null ? 0 : gap * 100;
  $("difference").textContent = actual === null ? "Compare after an attempt" : gapPoints < 0.05 ? "Matches the prediction so far" : `${pointFormat.format(gapPoints)} percentage ${pointFormat.format(gapPoints) === "1" ? "point" : "points"} ${actual > expected ? "above" : "below"} prediction`;
  $("summary-trials").textContent = `${number.format(count)} / ${number.format(wins)}`;
  $("summary-experiment").textContent = actual === null ? "—" : `${number.format(wins)}/${number.format(count)} (${percent(actual)})`;
  renderReflection();
  renderTrend();
  renderFrequencies();
}

function renderReflection() {
  const count = trials.length;
  const expected = winningProbability(config);
  const raw = $("prediction").value.trim();
  const guess = raw === "" ? NaN : Number(raw);
  const hasGuess = Number.isFinite(guess) && guess >= 0 && guess <= 100;
  const guessText = hasGuess ? `You predicted ${pointFormat.format(guess)} wins per 100 attempts. ` : "";
  if (!count) {
    $("reflection").textContent = hasGuess ? `${guessText}Pop some balloons to test it!` : "Make a prediction above, then pop some balloons to test it.";
    return;
  }
  const actual = wins / count;
  const parts = [];
  if (hasGuess) parts.push(`${guessText}The maths says ${pointFormat.format(expected * 100)}, and so far you're getting ${pointFormat.format(actual * 100)}.`);
  if (count < 100) {
    parts.push(`Only ${number.format(count)} ${count === 1 ? "attempt" : "attempts"} so far, and small samples can wobble a lot. Try 100 or more.`);
  } else {
    const range = 2 * Math.sqrt(expected * (1 - expected) / count) * 100;
    const inside = Math.abs(actual - expected) * 100 <= range;
    parts.push(`With ${number.format(count)} attempts, about 19 in 20 experiments land within ${pointFormat.format(range)} percentage points of the prediction. ${inside ? "Yours is inside that range, so your results support the maths." : "Yours is outside it. That's unusual but possible, so run more attempts and see if it settles."}`);
  }
  $("reflection").textContent = parts.join(" ");
}

function svgElement(name, attributes, textContent = "") {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (textContent) element.textContent = textContent;
  return element;
}

function renderTrend() {
  drawTrend($("trend-chart"));
}

// yMax zooms the vertical axis (1 = 0–100%) so small differences stay visible.
function drawTrend(chart, yMax = 1) {
  chart.replaceChildren();
  const left = 39, right = 585, top = 12, bottom = 185;
  const yFor = (rate) => bottom - Math.min(rate, yMax) / yMax * (bottom - top);
  for (const step of [0, .25, .5, .75, 1]) {
    const y = yFor(step * yMax);
    chart.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, stroke: "#e5e8df", "stroke-width": 1 }));
    chart.append(svgElement("text", { x: 30, y: y + 4, "text-anchor": "end", fill: "#7d9296", "font-size": 11 }, `${pointFormat.format(step * yMax * 100)}%`));
  }
  const expectedY = yFor(winningProbability(config));
  chart.append(svgElement("line", { x1: left, y1: expectedY, x2: right, y2: expectedY, stroke: "#93a9ac", "stroke-width": 2, "stroke-dasharray": "7 5" }));
  chart.append(svgElement("text", { x: left, y: 210, fill: "#7d9296", "font-size": 11 }, "0 attempts"));
  chart.append(svgElement("text", { x: right, y: 210, "text-anchor": "end", fill: "#7d9296", "font-size": 11 }, `${number.format(trials.length)} attempts`));
  chart.setAttribute("aria-label", "Running win rate compared with theoretical probability. No attempts yet.");
  if (!checkpoints.length) {
    chart.append(svgElement("text", { x: 310, y: 105, "text-anchor": "middle", fill: "#7d9296", "font-size": 14 }, "Your line appears after the first attempt"));
    return;
  }
  const maxTrial = trials.length;
  const points = checkpoints.map(({ trial, rate }) => `${left + trial / maxTrial * (right - left)},${yFor(rate)}`).join(" ");
  chart.append(svgElement("polyline", { points, fill: "none", stroke: "#df6250", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const last = checkpoints[checkpoints.length - 1];
  chart.setAttribute("aria-label", `Running win rate is ${percent(last.rate)} after ${number.format(trials.length)} attempts, compared with a theoretical ${percent(winningProbability(config))}.`);
  chart.append(svgElement("circle", { cx: right, cy: yFor(last.rate), r: 5, fill: "#df6250", stroke: "white", "stroke-width": 2 }));
}

function renderFrequencies() {
  const chart = $("frequency-chart");
  chart.replaceChildren();
  const maximum = Math.max(1, ...Object.values(frequencies));
  for (const colour of COLOURS) for (const parity of PARITIES) {
    const amount = frequencies[`${colour}-${parity}`];
    const row = document.createElement("div");
    row.className = "frequency-row";
    row.innerHTML = `<span>${titleCase(colour)} · ${titleCase(parity)}</span><span class="frequency-track"><span class="frequency-fill" style="width:${amount / maximum * 100}%;background:var(--${colour})"></span></span><strong>${number.format(amount)}</strong>`;
    chart.append(row);
  }
}

function selectedPairMode() {
  return document.querySelector('input[name="pair-mode"]:checked').value;
}

function resetPairData() {
  pairRuns = { replace: { attempts: 0, wins: 0, last: null }, remove: { attempts: 0, wins: 0, last: null } };
  renderPairMath();
  renderPairResults();
  $("pair-status").textContent = "Choose a method and run some pairs.";
}

function renderPairMath() {
  const total = totalBalloons(config);
  const colour = config[config.winColour];
  const parity = config[config.winParity];
  const first = winningProbability(config);
  const afterWin = total < 2 || first === 0 ? null : ((colour - 1) / (total - 1)) * ((parity - 1) / (total - 1));
  $("challenge-config").textContent = `${chosenScenario === "custom" ? "CUSTOM GAME" : `SCENARIO ${chosenScenario}`} · ${config.winColour.toUpperCase()} + ${config.winParity.toUpperCase()} · ${config.red} RED / ${config.blue} BLUE / ${config.green} GREEN · ${config.odd} ODD / ${config.even} EVEN`;
  $("replace-first").textContent = pairPercent(first);
  $("replace-second").textContent = pairPercent(first);
  $("replace-both").textContent = pairPercent(pairWinProbability(config));
  $("replace-formula").textContent = pairFormula("replace");
  $("remove-first").textContent = pairPercent(first);
  $("remove-second").textContent = pairPercent(afterWin);
  $("remove-both").textContent = pairPercent(pairWinProbability(config, true));
  $("remove-formula").textContent = pairFormula("remove");
  $("conditional-note").textContent = total < 2
    ? "*A no-replacement pair needs at least two balloons and two hidden numbers."
    : first === 0
      ? "*A first win is impossible with these counts, so two consecutive wins are impossible."
      : `*The second chance assumes the first attempt won. That leaves ${colour - 1} ${config.winColour} balloons and ${parity - 1} ${config.winParity} numbers among ${total - 1} of each.`;
  $("pair-insight").textContent = total < 2 || first === 0 ? "" : colour === total && parity === total
    ? "Both methods give the same chance here because every balloon and every number already wins."
    : `Why is without replacement lower? A win uses up one winning balloon and one winning number, so attempt two has only ${colour - 1} of ${total - 1} winning colours and ${parity - 1} of ${total - 1} winning numbers. That is a smaller share than ${colour} of ${total} and ${parity} of ${total}.`;
  renderPairObserved("replace");
  renderPairObserved("remove");
}

function renderPairObserved(mode) {
  const result = pairRuns[mode];
  $(mode === "replace" ? "replace-observed" : "remove-observed").textContent = result.attempts
    ? `Observed: ${number.format(result.wins)} double wins in ${number.format(result.attempts)} pairs (${pairPercent(result.wins / result.attempts)}).`
    : "Observed: no pairs run yet.";
}

function renderPairResults() {
  const mode = selectedPairMode();
  const result = pairRuns[mode];
  const impossible = mode === "remove" && totalBalloons(config) < 2;
  for (const id of ["pair-one", "pair-hundred", "pair-run-custom"]) $(id).disabled = impossible;
  setError("pair-run-error", impossible ? "Without replacement needs at least two balloons and two hidden numbers." : "");
  $("pair-last").textContent = result.last
    ? `${titleCase(result.last.first.colour)} ${result.last.first.parity} → ${titleCase(result.last.second.colour)} ${result.last.second.parity}${result.last.doubleWin ? " · double win!" : ""}`
    : "No pairs yet";
  $("pair-wins").textContent = `${number.format(result.wins)} / ${number.format(result.attempts)}`;
  $("pair-experimental").textContent = result.attempts ? pairPercent(result.wins / result.attempts) : "—";
  $("pair-theoretical").textContent = pairPercent(pairWinProbability(config, mode === "remove"));
  renderPairObserved(mode);
  renderPairCharts();
}

// A round axis maximum (1, 2, 5 × a power of ten) just above the largest bar.
function niceScale(maximum) {
  const targetScale = maximum > 0 ? maximum * 1.12 : .05;
  const magnitude = 10 ** Math.floor(Math.log10(targetScale));
  const normalized = targetScale / magnitude;
  return Math.min(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
}

// Chance of a second win after a first win; null when there is no second attempt to speak of.
function secondWinWithout() {
  const total = totalBalloons(config);
  const first = winningProbability(config);
  if (total < 2 || first === 0) return null;
  return ((config[config.winColour] - 1) / (total - 1)) * ((config[config.winParity] - 1) / (total - 1));
}

function pairFormula(mode) {
  const total = totalBalloons(config);
  const colour = config[config.winColour];
  const parity = config[config.winParity];
  const remove = mode === "remove";
  const fraction = pairWinFraction(config, remove);
  if (!fraction) return "At least two balloons and two hidden numbers are needed.";
  const [nextColour, nextParity, nextTotal] = remove ? [Math.max(0, colour - 1), Math.max(0, parity - 1), total - 1] : [colour, parity, total];
  return `${colour}/${total} × ${parity}/${total} × ${nextColour}/${nextTotal} × ${nextParity}/${nextTotal} = ${fraction.numerator}/${fraction.denominator}`;
}

function renderPairCharts() {
  const total = totalBalloons(config);
  const first = winningProbability(config);
  const colour = config[config.winColour];
  const parity = config[config.winParity];
  const secondWithout = total < 2 || first === 0 ? null : ((colour - 1) / (total - 1)) * ((parity - 1) / (total - 1));
  const observed = ["replace", "remove"].map((mode) => pairRuns[mode].attempts ? pairRuns[mode].wins / pairRuns[mode].attempts : 0);
  const maximum = Math.max(first, secondWithout ?? 0, ...observed);
  const scale = niceScale(maximum);
  for (const mode of ["replace", "remove"]) {
    const rows = $(mode === "replace" ? "replace-chart-rows" : "remove-chart-rows");
    rows.replaceChildren();
    $(mode === "replace" ? "replace-chart-scale" : "remove-chart-scale").textContent = pairPercent(scale);
    const run = pairRuns[mode];
    const values = [
      ["First win", first, "stage"],
      ["Second win*", mode === "replace" ? first : secondWithout, "stage"],
      ["Both wins", pairWinProbability(config, mode === "remove"), "both"],
      ["Simulated", run.attempts ? run.wins / run.attempts : null, "observed"],
    ];
    for (const [label, value, kind] of values) {
      const row = document.createElement("div");
      row.className = `pair-chart-row pair-chart-row-${kind}`;
      const labelEl = document.createElement("span");
      labelEl.className = "pair-chart-label";
      labelEl.textContent = label;
      const track = document.createElement("span");
      track.className = "pair-chart-track";
      track.setAttribute("aria-hidden", "true");
      const bar = document.createElement("span");
      bar.className = "pair-chart-bar";
      bar.style.width = `${value === null ? 0 : Math.min(100, value / scale * 100)}%`;
      track.append(bar);
      const amount = document.createElement("strong");
      amount.textContent = value === null && kind === "observed" ? "Run pairs" : pairPercent(value);
      row.append(labelEl, track, amount);
      rows.append(row);
    }
  }
}

function runPairs(count) {
  const mode = selectedPairMode();
  const result = pairRuns[mode];
  for (let i = 0; i < count; i++) {
    const pair = drawPair(config, mode === "remove", randomInt);
    if (!pair) return;
    result.last = pair;
    result.attempts++;
    if (pair.doubleWin) result.wins++;
  }
  renderPairResults();
  $("pair-status").textContent = `Added ${number.format(count)} ${count === 1 ? "pair" : "pairs"} ${mode === "remove" ? "without" : "with"} replacement. Each new pair starts with the original mix.`;
}

function summaryText() {
  const total = totalBalloons(config);
  const fraction = winningFraction(config);
  const experimental = trials.length ? `${wins}/${trials.length} (${percent(wins / trials.length)})` : "No attempts yet";
  const guess = $("prediction").value.trim();
  const lines = [
    "BALLOON POP — RESULTS TICKET",
    `Scenario: ${chosenScenario === "custom" ? "Custom" : chosenScenario}`,
    `Winning combination: ${titleCase(config.winColour)} dot and ${config.winParity} number`,
    `Balloons: ${total} (${config.red} red, ${config.blue} blue, ${config.green} green)`,
    `Hidden numbers: ${config.odd} odd, ${config.even} even`,
    `Theoretical probability: ${config[config.winColour]}/${total} × ${config[config.winParity]}/${total} = ${fraction.numerator}/${fraction.denominator} (${percent(winningProbability(config))})`,
    ...(guess === "" ? [] : [`My prediction: ${guess} wins per 100 attempts`]),
    `Attempts: ${trials.length}; wins: ${wins}; misses: ${trials.length - wins}`,
    `Experimental probability: ${experimental}`,
  ];
  for (const mode of ["replace", "remove"]) {
    const result = pairRuns[mode];
    if (result.attempts) lines.push(`Two in a row, ${mode === "remove" ? "without" : "with"} replacement: ${result.wins}/${result.attempts} pairs (${pairPercent(result.wins / result.attempts)} experimental; ${pairPercent(pairWinProbability(config, mode === "remove"))} theoretical)`);
  }
  return lines.join("\n");
}

// Everything the summary card needs, derived from the current game and results.
function summaryFigures() {
  const attempts = trials.length;
  const theory = winningProbability(config);
  const actual = attempts ? wins / attempts : null;
  const gapPoints = actual === null ? null : Math.abs(actual - theory) * 100;
  const range = attempts ? 2 * Math.sqrt(theory * (1 - theory) / attempts) * 100 : null;
  const raw = $("prediction").value.trim();
  const guess = raw === "" ? NaN : Number(raw);
  return { attempts, theory, actual, gapPoints, range, inside: attempts > 0 && gapPoints <= range, direction: actual > theory ? "above" : "below", guess: Number.isFinite(guess) && guess >= 0 && guess <= 100 ? guess : null };
}

const plural = (count, word, many = `${word}s`) => `${number.format(count)} ${count === 1 ? word : many}`;

function renderSummary() {
  const total = totalBalloons(config);
  const fraction = winningFraction(config);
  const { attempts, theory, actual, gapPoints, range, inside, direction, guess } = summaryFigures();
  const colourCount = config[config.winColour];
  const parityCount = config[config.winParity];
  const gapText = gapPoints < 0.05 ? "almost exactly the same as" : `${pointFormat.format(gapPoints)} percentage ${pointFormat.format(gapPoints) === "1" ? "point" : "points"} ${direction}`;

  $("sum-scenario").textContent = chosenScenario === "custom" ? "CUSTOM GAME" : `SCENARIO ${chosenScenario}`;
  $("sum-ticket").textContent = `${titleCase(config.winColour)} dot + ${config.winParity} number`;
  $("sum-setup").textContent = `${total} balloons: ${config.red} red · ${config.blue} blue · ${config.green} green  |  Numbers: ${config.odd} odd · ${config.even} even`;
  $("sum-date").textContent = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

  $("sum-theory").textContent = percent(theory);
  $("sum-formula").textContent = `P(${config.winColour} and ${config.winParity}) = P(${config.winColour}) × P(${config.winParity}) = ${colourCount}/${total} × ${parityCount}/${total} = ${fraction.numerator}/${fraction.denominator}`;
  $("sum-prediction").textContent = guess === null ? "" : `My prediction: ${pointFormat.format(guess)} wins in 100 attempts.`;

  const body = $("sum-table-body");
  body.replaceChildren();
  for (const colour of COLOURS) {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.innerHTML = `<i class="swatch ${colour}" aria-hidden="true"></i>${titleCase(colour)}`;
    row.append(heading);
    for (const parity of PARITIES) {
      const cell = document.createElement("td");
      const isWin = colour === config.winColour && parity === config.winParity;
      if (isWin) cell.className = "sum-win";
      const count = frequencies[`${colour}-${parity}`];
      const observed = attempts ? `${percent(count / attempts)} (${number.format(count)})` : "—";
      cell.innerHTML = `<strong>${percent(probability(config, colour, parity))}${isWin ? " ★" : ""}</strong><span>${observed}</span>`;
      row.append(cell);
    }
    body.append(row);
  }

  $("sum-exp").textContent = actual === null ? "—" : percent(actual);
  $("sum-exp-detail").textContent = actual === null ? "No attempts yet. Pop some balloons, then reopen this summary." : `${number.format(wins)} wins ÷ ${number.format(attempts)} attempts = ${number.format(wins)}/${number.format(attempts)}`;
  $("sum-attempts").textContent = attempts ? `${plural(attempts, "attempt")} · ${plural(wins, "win")} · ${plural(attempts - wins, "miss", "misses")}` : "";

  drawTrend($("sum-trend"), Math.min(1, Math.max(.1, Math.ceil(theory * 2.4 * 20) / 20)));

  const evaluation = [];
  if (!attempts) {
    evaluation.push("Run some attempts on the main page, then reopen this summary.");
  } else {
    evaluation.push(`Compare: theory ${percent(theory)}, experiment ${percent(actual)}. The experiment is ${gapText} the theory.`);
    evaluation.push(`Variability: with ${number.format(attempts)} attempts, about 19 in 20 experiments land within ±${pointFormat.format(range)} percentage points of the theory.`);
    evaluation.push(attempts < 100 ? "Simulation: too few attempts to judge well. Try 100 or more." : attempts < 1000 ? "Simulation: a decent sample. 1,000 or more attempts would be steadier." : "Simulation: a large sample, so this is a reliable test of the prediction.");
  }
  $("sum-eval").replaceChildren(...evaluation.map((text) => Object.assign(document.createElement("li"), { textContent: text })));

  $("sum-conclusion").textContent = !attempts
    ? "Your conclusion will appear here once you have some results."
    : `${guess === null ? "" : `I predicted ${pointFormat.format(guess)} wins in 100 attempts. `}The theoretical chance of winning is ${percent(theory)}. In ${plural(attempts, "attempt")} there ${wins === 1 ? "was" : "were"} ${plural(wins, "win")}, an experimental chance of ${percent(actual)}, which is ${gapText} the prediction. ${inside ? "That is within the variability we expect, so the predicted outcome looks accurate." : "That is further away than we usually expect, so I would run more attempts before deciding."} Chance always varies, so the experimental result is an estimate, and more attempts usually bring it closer to ${percent(theory)}.`;

  const pairLines = ["replace", "remove"].filter((mode) => pairRuns[mode].attempts).map((mode) => {
    const result = pairRuns[mode];
    return `${mode === "remove" ? "Without" : "With"} replacement: ${number.format(result.wins)} double wins in ${plural(result.attempts, "pair")} (${pairPercent(result.wins / result.attempts)}). Theory: ${pairPercent(pairWinProbability(config, mode === "remove"))}.`;
  });
  $("sum-pairs").hidden = !pairLines.length;
  $("sum-pairs-list").replaceChildren(...pairLines.map((text) => Object.assign(document.createElement("li"), { textContent: text })));

  const assumptions = [
    "Every balloon is equally likely to be popped, no matter how well you aim.",
    "A popped balloon is replaced by one that looks the same, so the chances stay the same each attempt.",
    config.odd === config.even ? `A hidden number is equally likely to be odd or even (${config.odd} of each).` : `A hidden number is odd or even in proportion to the counts (${config.odd} odd, ${config.even} even).`,
    "The dot colour and the number are chosen separately, like pulling one item from each of two bags.",
  ];
  $("sum-assume").replaceChildren(...assumptions.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
}

function openSummary() {
  renderSummary();
  const dialog = $("summary-dialog");
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

async function copySummary(statusId) {
  try {
    await navigator.clipboard.writeText(summaryText());
    $(statusId).textContent = "Results summary copied to the clipboard.";
  } catch {
    $(statusId).textContent = "Clipboard access is unavailable here. Take a screenshot of the summary instead.";
  }
}

const pointFormat2 = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

function pairMethodFigures(mode) {
  const remove = mode === "remove";
  const run = pairRuns[mode];
  const both = pairWinProbability(config, remove);
  const observed = run.attempts ? run.wins / run.attempts : null;
  const range = both !== null && run.attempts ? 2 * Math.sqrt(both * (1 - both) / run.attempts) : null;
  return {
    remove, run, both, observed, range,
    first: winningProbability(config),
    second: remove ? secondWinWithout() : winningProbability(config),
    inside: observed !== null && both !== null && Math.abs(observed - both) <= range,
    label: remove ? "without replacement" : "with replacement",
  };
}

function listItems(texts) {
  return texts.map((text) => Object.assign(document.createElement("li"), { textContent: text }));
}

function renderPairSummary() {
  const total = totalBalloons(config);
  const first = winningProbability(config);
  const methods = ["replace", "remove"].map(pairMethodFigures);
  const [withReplacement, without] = methods;
  const ratio = without.both !== null && withReplacement.both > 0 ? without.both / withReplacement.both : null;

  $("psum-scenario").textContent = `${chosenScenario === "custom" ? "CUSTOM GAME" : `SCENARIO ${chosenScenario}`} · TWO IN A ROW`;
  $("psum-ticket").textContent = `${titleCase(config.winColour)} dot + ${config.winParity} number, twice in a row`;
  $("psum-setup").textContent = `${total} balloons: ${config.red} red · ${config.blue} blue · ${config.green} green  |  Numbers: ${config.odd} odd · ${config.even} even`;
  $("psum-date").textContent = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

  // One card per method: step-by-step theory, then what the simulation gave.
  $("psum-methods").replaceChildren(...methods.map((method, index) => {
    const card = document.createElement("section");
    card.className = "sum-box";
    const observed = method.run.attempts
      ? `Simulated: ${number.format(method.run.wins)} double wins in ${plural(method.run.attempts, "pair")} = ${pairPercent(method.observed)}`
      : "Simulated: no pairs run yet. Run some in the two-in-a-row activity.";
    card.innerHTML = `<div class="sum-label"><span class="round-num">${index + 1}</span><span>${method.remove ? "WITHOUT REPLACEMENT · KEEP THEM OUT" : "WITH REPLACEMENT · PUT THEM BACK"}</span></div>
      <div class="sum-steps"><div><span>FIRST WIN</span><strong>${pairPercent(method.first)}</strong></div><i aria-hidden="true">×</i><div><span>SECOND WIN${method.remove ? "*" : ""}</span><strong>${pairPercent(method.second)}</strong></div><i aria-hidden="true">=</i><div><span>BOTH WIN</span><strong>${pairPercent(method.both)}</strong></div></div>
      <p class="sum-formula">${pairFormula(method.remove ? "remove" : "replace")}</p>
      <p class="sum-note sum-note-strong">${observed}</p>`;
    return card;
  }));
  $("psum-star-note").textContent = without.second === null
    ? ""
    : `*Second win is worked out assuming the first attempt won. That leaves ${config[config.winColour] - 1} winning-colour balloons and ${config[config.winParity] - 1} winning numbers among ${total - 1} of each.`;

  // Theory and simulation bars share one scale so they can be compared directly.
  const bars = [];
  for (const method of methods) {
    if (method.both !== null) bars.push([`${titleCase(method.label)}: theory`, method.both, "both"]);
    bars.push([`${titleCase(method.label)}: simulated`, method.observed, "observed"]);
  }
  const scale = niceScale(Math.max(0, ...bars.map(([, value]) => value ?? 0)));
  $("psum-scale").textContent = pairPercent(scale);
  $("psum-bars").replaceChildren(...bars.map(([label, value, kind]) => {
    const row = document.createElement("div");
    row.className = `pair-chart-row pair-chart-row-${kind}`;
    row.innerHTML = `<span class="pair-chart-label"></span><span class="pair-chart-track" aria-hidden="true"><span class="pair-chart-bar" style="width:${value === null ? 0 : Math.min(100, value / scale * 100)}%"></span></span><strong>${value === null ? "Run pairs" : pairPercent(value)}</strong>`;
    row.firstChild.textContent = label;
    return row;
  }));

  const evaluation = [];
  if (without.both !== null && ratio !== null) {
    evaluation.push(`Compare: without replacement is ${pointFormat2.format((withReplacement.both - without.both) * 100)} percentage points lower, about ${pointFormat.format(ratio * 100)}% as likely as with replacement.`);
  } else if (without.both === null) {
    evaluation.push("Without replacement needs at least two balloons, so only the with-replacement chance can be worked out.");
  }
  for (const method of methods) {
    if (!method.run.attempts) continue;
    evaluation.push(`${titleCase(method.label)}: simulated ${pairPercent(method.observed)} against ${pairPercent(method.both)} in theory. ${method.inside ? "That is within the expected variability." : "That is further away than usual, so run more pairs."}`);
  }
  const pairsRun = Math.max(withReplacement.run.attempts, without.run.attempts);
  if (!pairsRun) evaluation.push("Run some pairs in the activity, then reopen this summary to compare them with the theory.");
  else if ((withReplacement.both ?? 0) * pairsRun < 10) evaluation.push("Simulation: double wins are rare here, so only a few will turn up and results swing a lot. Try 1,000 or more pairs.");
  else evaluation.push(`Simulation: ${plural(pairsRun, "pair")} is a ${pairsRun < 1000 ? "decent start. 1,000 or more would be steadier" : "large sample, so this is a fairly reliable test"}.`);
  $("psum-eval").replaceChildren(...listItems(evaluation));

  const why = $("pair-insight").textContent;
  $("psum-why").textContent = first === 0
    ? "With these counts the winning ticket cannot win even once, so two in a row is impossible."
    : why || "Without replacement needs at least two balloons, so there is nothing to compare here.";

  const theorySentence = first === 0
    ? "With these counts the winning ticket cannot win even once, so winning twice in a row is impossible."
    : without.both === null
      ? `Theory says the chance of winning twice in a row with replacement is ${pairPercent(withReplacement.both)}.`
      : `Theory says the chance of winning twice in a row is ${pairPercent(withReplacement.both)} with replacement and ${pairPercent(without.both)} without replacement, so keeping the balloon and number out makes the second win less likely.`;
  const simulated = methods.filter((method) => method.run.attempts);
  const simSentence = simulated.length
    ? ` In the simulation, ${simulated.map((method) => `${method.label} gave ${number.format(method.run.wins)} double ${method.run.wins === 1 ? "win" : "wins"} in ${plural(method.run.attempts, "pair")} (${pairPercent(method.observed)})`).join(" and ")}. ${simulated.every((method) => method.inside) ? "These match the theory within the variability we expect, so the predicted outcomes look accurate." : "At least one is further from the theory than we usually expect, so I would run more pairs before deciding."}`
    : " Run some pairs to compare the simulation with this prediction.";
  $("psum-conclusion").textContent = `${theorySentence}${simSentence} Chance always varies, so simulated results are estimates, and more pairs usually bring them closer to the theory.`;

  $("psum-assume").replaceChildren(...listItems([
    "A pair is two attempts in a row. It only counts as a win if both attempts match the winning ticket.",
    "Before every new pair, both bags (colours and numbers) are refilled to their original counts.",
    "With replacement, the colour and number are put back before attempt two. Without replacement, they stay out.",
    "The dot colour and the number are chosen separately, like pulling one item from each of two bags.",
    "Every balloon is equally likely to be popped, no matter how well you aim.",
  ]));
}

function pairSummaryText() {
  const lines = [
    "BALLOON POP — TWO IN A ROW",
    `Scenario: ${chosenScenario === "custom" ? "Custom" : chosenScenario}`,
    `Winning ticket: ${titleCase(config.winColour)} dot and ${config.winParity} number, twice in a row`,
    `Balloons: ${totalBalloons(config)} (${config.red} red, ${config.blue} blue, ${config.green} green); numbers: ${config.odd} odd, ${config.even} even`,
  ];
  for (const mode of ["replace", "remove"]) {
    const method = pairMethodFigures(mode);
    lines.push(`${titleCase(method.label)}: theory ${pairPercent(method.both)} (${pairFormula(mode)})${method.run.attempts ? `; simulated ${method.run.wins}/${method.run.attempts} pairs (${pairPercent(method.observed)})` : "; no pairs run yet"}`);
  }
  lines.push($("psum-conclusion").textContent);
  return lines.join("\n");
}

function openPairSummary() {
  renderPairSummary();
  const dialog = $("pair-summary-dialog");
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function downloadCSV() {
  const rows = [["attempt", "dot_colour", "number_parity", "win"], ...trials.map((trial, i) => [i + 1, trial.colour, trial.parity, trial.win ? 1 : 0])];
  const csv = rows.map((row) => row.join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `balloon-pop-${chosenScenario === "custom" ? "custom" : `scenario-${chosenScenario}`}-results.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("action-status").textContent = `Downloaded ${number.format(trials.length)} attempt rows as CSV.`;
}

function wireSummaryDialog(dialog, prefix, buildText) {
  $(`${prefix}-close`).addEventListener("click", () => dialog.close());
  $(`${prefix}-print`).addEventListener("click", () => window.print());
  $(`${prefix}-copy`).addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const label = button.textContent;
    let copied = true;
    try { await navigator.clipboard.writeText(buildText()); } catch { copied = false; }
    button.textContent = copied ? "Copied ✓" : "Copy failed";
    window.setTimeout(() => { button.textContent = label; }, 1800);
  });
  // A click on the dimmed area outside the card closes the summary.
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}

function setup() {
  const select = $("scenario");
  for (const preset of PRESETS) {
    const option = document.createElement("option");
    option.value = String(preset.number);
    option.textContent = `Scenario ${preset.number} · ${titleCase(preset.winColour)} + ${preset.winParity} (${preset.red}/${preset.blue}/${preset.green})`;
    select.append(option);
  }
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom game";
  select.append(custom);
  select.addEventListener("change", () => {
    if (select.value === "custom") { applyConfig(readSettings(), "custom"); $("red-count").focus(); return; }
    applyConfig(PRESETS[Number(select.value) - 1], Number(select.value));
  });
  // Any edit starts a fresh custom game, so results from different settings are never mixed.
  const applyEdits = () => {
    const next = readSettings();
    const unchanged = [...COLOURS, ...PARITIES, "winColour", "winParity"].every((key) => next[key] === config[key]);
    if (unchanged) { setError("settings-error", ""); return; }
    applyConfig(next, "custom");
  };
  $("settings-form").addEventListener("change", applyEdits);
  $("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyEdits();
  });
  $("prediction").addEventListener("input", renderReflection);
  $("pop-one").addEventListener("click", () => runTrials(1, true));
  document.querySelectorAll(".batch-button").forEach((button) => button.addEventListener("click", () => runTrials(Number(button.dataset.tosses))));
  $("run-custom").addEventListener("click", () => {
    const raw = $("custom-count").value.trim();
    const count = raw ? Number(raw) : NaN;
    const error = !Number.isSafeInteger(count) || count < 1 || count > 10000 ? "Enter a whole number of attempts from 1 to 10,000." : "";
    setError("run-error", error);
    if (!error) runTrials(count, count === 1);
  });
  $("reset-run").addEventListener("click", () => { resetData(); $("action-status").textContent = "Experiment reset. Game settings are ready for a new run."; });
  document.querySelectorAll('input[name="pair-mode"]').forEach((input) => input.addEventListener("change", () => {
    renderPairResults();
    $("pair-status").textContent = `Showing ${selectedPairMode() === "remove" ? "without" : "with"} replacement results.`;
  }));
  $("pair-one").addEventListener("click", () => runPairs(1));
  $("pair-hundred").addEventListener("click", () => runPairs(100));
  $("pair-run-custom").addEventListener("click", () => {
    const raw = $("pair-custom-count").value.trim();
    const count = raw ? Number(raw) : NaN;
    const error = !Number.isSafeInteger(count) || count < 1 || count > 10000 ? "Enter a whole number of pairs from 1 to 10,000." : "";
    setError("pair-run-error", error);
    if (!error) runPairs(count);
  });
  $("pair-reset").addEventListener("click", resetPairData);
  $("download-csv").addEventListener("click", downloadCSV);
  $("copy-summary").addEventListener("click", () => copySummary("action-status"));
  const dialog = $("summary-dialog");
  document.querySelectorAll(".summary-open").forEach((button) => button.addEventListener("click", openSummary));
  wireSummaryDialog(dialog, "summary", summaryText);
  wireSummaryDialog($("pair-summary-dialog"), "pair-summary", pairSummaryText);
  $("pair-summary-open").addEventListener("click", openPairSummary);
  // The name typed on either card appears on both.
  for (const [from, to] of [["sum-name", "psum-name"], ["psum-name", "sum-name"]]) $(from).addEventListener("input", () => { $(to).value = $(from).value; });
  applyConfig(PRESETS[9], 10);
  $("action-status").textContent = "";
}

setup();
