import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, validateConfig, winningProbability, winningFraction, drawOutcome, probability } from "../model.mjs";

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
