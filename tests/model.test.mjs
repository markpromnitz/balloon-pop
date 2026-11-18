import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, validateConfig, winningProbability, winningFraction, pairWinProbability, pairWinFraction, drawOutcome, drawPair, probability } from "../model.mjs";

test("all ten scenario presets match the supplied sheet and have coherent totals", () => {
  assert.equal(PRESETS.length, 10);
  const expected = [
    [4, 6, 10, "red", "even"], [4, 6, 10, "blue", "even"],
    [4, 6, 10, "green", "even"], [4, 6, 10, "red", "odd"],
    [4, 6, 10, "blue", "odd"], [4, 6, 10, "green", "odd"],
    [8, 2, 10, "red", "even"], [2, 8, 10, "blue", "even"],
    [10, 2, 8, "green", "even"], [4, 6, 10, "blue", "odd"],
  ];
  PRESETS.forEach((preset, index) => {
    assert.equal(preset.number, index + 1);
    assert.deepEqual([preset.red, preset.blue, preset.green, preset.winColour, preset.winParity], expected[index]);
    assert.equal(preset.odd, 10);
    assert.equal(preset.even, 10);
    assert.equal(validateConfig(preset), "");
  });
});

test("scenario 10 gives 3/20 and the joint table sums to one", () => {
  const scenario = PRESETS[9];
  assert.equal(winningProbability(scenario), 0.15);
  assert.deepEqual(winningFraction(scenario), { numerator: 3, denominator: 20 });
  const total = ["red", "blue", "green"].reduce((sum, colour) =>
    sum + ["odd", "even"].reduce((part, parity) => part + probability(scenario, colour, parity), 0), 0);
  assert.equal(total, 1);
});

test("editable parity counts affect both theory and simulated outcomes", () => {
  const config = { red: 2, blue: 1, green: 1, odd: 3, even: 1, winColour: "red", winParity: "odd" };
  assert.equal(validateConfig(config), "");
  assert.equal(winningProbability(config), 0.375);
  assert.deepEqual(winningFraction(config), { numerator: 3, denominator: 8 });
  const values = [0, 2, 3, 3];
  const randomInt = () => values.shift();
  assert.deepEqual(drawOutcome(config, randomInt), { colour: "red", parity: "odd", win: true });
  assert.deepEqual(drawOutcome(config, randomInt), { colour: "green", parity: "even", win: false });
});

test("invalid count totals and fractional values are rejected", () => {
  assert.match(validateConfig({ ...PRESETS[9], even: 9 }), /totals/);
  assert.match(validateConfig({ ...PRESETS[9], red: 4.5 }), /whole-number/);
});

test("scenario 10 two-win chances distinguish replacement from removal", () => {
  const scenario = PRESETS[9];
  assert.deepEqual(pairWinFraction(scenario), { numerator: 9, denominator: 400 });
  assert.equal(pairWinProbability(scenario), 0.0225);
  assert.deepEqual(pairWinFraction(scenario, true), { numerator: 27, denominator: 1444 });
  assert.ok(Math.abs(pairWinProbability(scenario, true) - 0.01869806094) < 1e-9);
});

test("removing both resources changes the second toss and pools reset per pair", () => {
  const config = { red: 1, blue: 1, green: 0, odd: 1, even: 1, winColour: "red", winParity: "odd" };
  const alwaysFirst = () => 0;
  const withReplacement = drawPair(config, false, alwaysFirst);
  const withoutReplacement = drawPair(config, true, alwaysFirst);
  assert.equal(withReplacement.doubleWin, true);
  assert.equal(withoutReplacement.doubleWin, false);
  assert.deepEqual(withoutReplacement.second, { colour: "blue", parity: "even", win: false });
  assert.equal(drawPair(config, true, alwaysFirst).first.win, true);
  assert.deepEqual(pairWinFraction(config, true), { numerator: 0, denominator: 1 });
});

test("without-replacement pair is unavailable when only one balloon exists", () => {
  const config = { red: 1, blue: 0, green: 0, odd: 1, even: 0, winColour: "red", winParity: "odd" };
  assert.equal(validateConfig(config), "");
  assert.equal(pairWinFraction(config, true), null);
  assert.equal(pairWinProbability(config, true), null);
  assert.equal(drawPair(config, true, () => 0), null);
  assert.equal(pairWinProbability(config), 1);
});
