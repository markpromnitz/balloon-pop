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
  $("last-outcome").textContent = "Waiting for a toss…";
  $("last-verdict").textContent = "Your result will appear here.";
  renderResults();
}

function applyConfig(next, scenario) {
  const error = validateConfig(next);
  if (error) { setError("settings-error", error); return false; }
  setError("settings-error", "");
  config = { ...next };
  chosenScenario = scenario;
  $("scenario").value = String(scenario);
  populateSettings(config);
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
  $("formula-words").textContent = `About ${number.format(Math.round(chance * 100))} wins in 100 tosses on average.`;
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
  $("last-outcome").textContent = `${titleCase(last.colour)} dot · ${titleCase(last.parity)} number`;
  $("last-verdict").textContent = last.win ? "A winning pop!" : "Not a match this time.";
  if (animate) popBalloon(last.colour);
  $("action-status").textContent = `${number.format(count)} ${count === 1 ? "toss" : "tosses"} added (${number.format(before + count)} total).`;
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
  $("experimental-fraction").textContent = actual === null ? "Start tossing to see it" : `${number.format(wins)} / ${number.format(count)} wins`;
  const gap = actual === null ? null : Math.abs(actual - expected);
  $("difference").textContent = actual === null ? "Compare after a toss" : gap < .00001 ? "Matches prediction so far" : `${percent(gap)} ${actual > expected ? "above" : "below"} prediction`;
  $("summary-trials").textContent = `${number.format(count)} / ${number.format(wins)}`;
  $("summary-experiment").textContent = actual === null ? "—" : `${number.format(wins)}/${number.format(count)} (${percent(actual)})`;
  renderTrend();
  renderFrequencies();
}

function svgElement(name, attributes, textContent = "") {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (textContent) element.textContent = textContent;
  return element;
}

function renderTrend() {
  const chart = $("trend-chart");
  chart.replaceChildren();
  const left = 39, right = 585, top = 12, bottom = 185;
  for (const value of [0, .25, .5, .75, 1]) {
    const y = bottom - value * (bottom - top);
    chart.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, stroke: "#e5e8df", "stroke-width": 1 }));
    chart.append(svgElement("text", { x: 30, y: y + 4, "text-anchor": "end", fill: "#7d9296", "font-size": 11 }, `${value * 100}%`));
  }
  const expectedY = bottom - winningProbability(config) * (bottom - top);
  chart.append(svgElement("line", { x1: left, y1: expectedY, x2: right, y2: expectedY, stroke: "#93a9ac", "stroke-width": 2, "stroke-dasharray": "7 5" }));
  chart.append(svgElement("text", { x: left, y: 210, fill: "#7d9296", "font-size": 11 }, "0 tosses"));
  chart.append(svgElement("text", { x: right, y: 210, "text-anchor": "end", fill: "#7d9296", "font-size": 11 }, `${number.format(trials.length)} tosses`));
  if (!checkpoints.length) {
    chart.append(svgElement("text", { x: 310, y: 105, "text-anchor": "middle", fill: "#7d9296", "font-size": 14 }, "Your line appears after the first toss"));
    return;
  }
  const maxTrial = trials.length;
  const points = checkpoints.map(({ trial, rate }) => `${left + trial / maxTrial * (right - left)},${bottom - rate * (bottom - top)}`).join(" ");
  chart.append(svgElement("polyline", { points, fill: "none", stroke: "#df6250", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const last = checkpoints[checkpoints.length - 1];
  chart.append(svgElement("circle", { cx: right, cy: bottom - last.rate * (bottom - top), r: 5, fill: "#df6250", stroke: "white", "stroke-width": 2 }));
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
  const replaceFraction = pairWinFraction(config);
  const removeFraction = pairWinFraction(config, true);
  $("challenge-config").textContent = `${chosenScenario === "custom" ? "CUSTOM GAME" : `SCENARIO ${chosenScenario}`} · ${config.winColour.toUpperCase()} + ${config.winParity.toUpperCase()} · ${config.red} RED / ${config.blue} BLUE / ${config.green} GREEN · ${config.odd} ODD / ${config.even} EVEN`;
  $("replace-first").textContent = pairPercent(first);
  $("replace-second").textContent = pairPercent(first);
  $("replace-both").textContent = pairPercent(pairWinProbability(config));
  $("replace-formula").textContent = `${colour}/${total} × ${parity}/${total} × ${colour}/${total} × ${parity}/${total} = ${replaceFraction.numerator}/${replaceFraction.denominator}`;
  $("remove-first").textContent = pairPercent(first);
  $("remove-second").textContent = pairPercent(afterWin);
  $("remove-both").textContent = pairPercent(pairWinProbability(config, true));
  $("remove-formula").textContent = removeFraction
    ? `${colour}/${total} × ${parity}/${total} × ${Math.max(0, colour - 1)}/${total - 1} × ${Math.max(0, parity - 1)}/${total - 1} = ${removeFraction.numerator}/${removeFraction.denominator}`
    : "At least two balloons and two hidden numbers are needed.";
  $("conditional-note").textContent = total < 2
    ? "*A no-replacement pair needs at least two balloons and two hidden numbers."
    : first === 0
      ? "*A first win is impossible with these counts, so two consecutive wins are impossible."
      : `*The second chance assumes the first toss won. That leaves ${colour - 1} ${config.winColour} balloons and ${parity - 1} ${config.winParity} numbers among ${total - 1} of each.`;
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

function renderPairCharts() {
  const total = totalBalloons(config);
  const first = winningProbability(config);
  const colour = config[config.winColour];
  const parity = config[config.winParity];
  const secondWithout = total < 2 || first === 0 ? null : ((colour - 1) / (total - 1)) * ((parity - 1) / (total - 1));
  const observed = ["replace", "remove"].map((mode) => pairRuns[mode].attempts ? pairRuns[mode].wins / pairRuns[mode].attempts : 0);
  const maximum = Math.max(first, secondWithout ?? 0, ...observed);
  const targetScale = maximum > 0 ? maximum * 1.12 : .05;
  const magnitude = 10 ** Math.floor(Math.log10(targetScale));
  const normalized = targetScale / magnitude;
  const scale = Math.min(1, (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude);
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
  const experimental = trials.length ? `${wins}/${trials.length} (${percent(wins / trials.length)})` : "No tosses yet";
  const lines = [
    "BALLOON POP — RESULTS TICKET",
    `Scenario: ${chosenScenario === "custom" ? "Custom" : chosenScenario}`,
    `Winning combination: ${titleCase(config.winColour)} dot and ${config.winParity} number`,
    `Balloons: ${total} (${config.red} red, ${config.blue} blue, ${config.green} green)`,
    `Hidden numbers: ${config.odd} odd, ${config.even} even`,
    `Theoretical probability: ${config[config.winColour]}/${total} × ${config[config.winParity]}/${total} = ${fraction.numerator}/${fraction.denominator} (${percent(winningProbability(config))})`,
    `Trials: ${trials.length}; wins: ${wins}; misses: ${trials.length - wins}`,
    `Experimental probability: ${experimental}`,
  ];
  for (const mode of ["replace", "remove"]) {
    const result = pairRuns[mode];
    if (result.attempts) lines.push(`Two in a row, ${mode === "remove" ? "without" : "with"} replacement: ${result.wins}/${result.attempts} pairs (${pairPercent(result.wins / result.attempts)} experimental; ${pairPercent(pairWinProbability(config, mode === "remove"))} theoretical)`);
  }
  return lines.join("\n");
}

function downloadCSV() {
  const rows = [["trial", "dot_colour", "number_parity", "win"], ...trials.map((trial, i) => [i + 1, trial.colour, trial.parity, trial.win ? 1 : 0])];
  const csv = rows.map((row) => row.join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `balloon-pop-${chosenScenario === "custom" ? "custom" : `scenario-${chosenScenario}`}-results.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("action-status").textContent = `Downloaded ${number.format(trials.length)} trial rows as CSV.`;
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
    if (select.value === "custom") { $("red-count").focus(); return; }
    applyConfig(PRESETS[Number(select.value) - 1], Number(select.value));
  });
  $("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyConfig(readSettings(), "custom");
  });
  $("pop-one").addEventListener("click", () => runTrials(1, true));
  document.querySelectorAll(".batch-button").forEach((button) => button.addEventListener("click", () => runTrials(Number(button.dataset.tosses))));
  $("run-custom").addEventListener("click", () => {
    const raw = $("custom-count").value.trim();
    const count = raw ? Number(raw) : NaN;
    const error = !Number.isSafeInteger(count) || count < 1 || count > 10000 ? "Enter a whole number of tosses from 1 to 10,000." : "";
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
  $("copy-summary").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      $("action-status").textContent = "Results summary copied to the clipboard.";
    } catch {
      $("action-status").textContent = "Clipboard access is unavailable here. You can screenshot the ticket or download the CSV.";
    }
  });
  applyConfig(PRESETS[9], 10);
  $("action-status").textContent = "";
}

setup();
