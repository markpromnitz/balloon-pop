export const COLOURS = ["red", "blue", "green"];
export const PARITIES = ["odd", "even"];

const standard = { red: 4, blue: 6, green: 10, odd: 10, even: 10 };

export const PRESETS = [
  { number: 1, ...standard, winColour: "red", winParity: "even" },
  { number: 2, ...standard, winColour: "blue", winParity: "even" },
  { number: 3, ...standard, winColour: "green", winParity: "even" },
  { number: 4, ...standard, winColour: "red", winParity: "odd" },
  { number: 5, ...standard, winColour: "blue", winParity: "odd" },
  { number: 6, ...standard, winColour: "green", winParity: "odd" },
  { number: 7, red: 8, blue: 2, green: 10, odd: 10, even: 10, winColour: "red", winParity: "even" },
  { number: 8, red: 2, blue: 8, green: 10, odd: 10, even: 10, winColour: "blue", winParity: "even" },
  { number: 9, red: 10, blue: 2, green: 8, odd: 10, even: 10, winColour: "green", winParity: "even" },
  { number: 10, ...standard, winColour: "blue", winParity: "odd" },
];

export function validateConfig(config) {
  const counts = [...COLOURS, ...PARITIES];
  if (counts.some((key) => !Number.isSafeInteger(config[key]) || config[key] < 0)) {
    return "Enter whole-number counts of zero or more for every colour and parity.";
  }
  const balloons = COLOURS.reduce((sum, key) => sum + config[key], 0);
  const numbers = PARITIES.reduce((sum, key) => sum + config[key], 0);
  if (balloons < 1) return "Add at least one balloon.";
  if (balloons > 1000) return "Use at most 1,000 balloons for this simulation.";
  if (balloons !== numbers) return `Colour counts total ${balloons}, but odd and even counts total ${numbers}. Make the totals equal.`;
  if (!COLOURS.includes(config.winColour) || !PARITIES.includes(config.winParity)) {
    return "Choose a winning dot colour and number parity.";
  }
  return "";
}

export function totalBalloons(config) {
  return COLOURS.reduce((sum, key) => sum + config[key], 0);
}

export function probability(config, colour, parity) {
  const total = totalBalloons(config);
  return (config[colour] / total) * (config[parity] / total);
}

export function winningProbability(config) {
  return probability(config, config.winColour, config.winParity);
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function winningFraction(config) {
  const total = totalBalloons(config);
  const numerator = config[config.winColour] * config[config.winParity];
  const denominator = total * total;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function pairWinFraction(config, withoutReplacement = false) {
  const total = totalBalloons(config);
  if (withoutReplacement && total < 2) return null;
  const colour = config[config.winColour];
  const parity = config[config.winParity];
  const numerator = withoutReplacement
    ? colour * parity * Math.max(0, colour - 1) * Math.max(0, parity - 1)
    : colour * colour * parity * parity;
  const denominator = withoutReplacement
    ? total * total * (total - 1) * (total - 1)
    : total ** 4;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function pairWinProbability(config, withoutReplacement = false) {
  const fraction = pairWinFraction(config, withoutReplacement);
  return fraction ? fraction.numerator / fraction.denominator : null;
}

// randomInt(max) must return an integer from 0 through max - 1.
export function drawOutcome(config, randomInt) {
  const total = totalBalloons(config);
  const colourIndex = randomInt(total);
  let cursor = 0;
  let colour = COLOURS[COLOURS.length - 1];
  for (const candidate of COLOURS) {
    cursor += config[candidate];
    if (colourIndex < cursor) {
      colour = candidate;
      break;
    }
  }
  const parity = randomInt(total) < config.odd ? "odd" : "even";
  return { colour, parity, win: colour === config.winColour && parity === config.winParity };
}

// One independent experiment is exactly two tosses. Pools reset before the next pair.
export function drawPair(config, withoutReplacement, randomInt) {
  if (withoutReplacement && totalBalloons(config) < 2) return null;
  const first = drawOutcome(config, randomInt);
  let secondConfig = config;
  if (withoutReplacement) {
    secondConfig = { ...config, [first.colour]: config[first.colour] - 1, [first.parity]: config[first.parity] - 1 };
  }
  const second = drawOutcome(secondConfig, randomInt);
  return { first, second, doubleWin: first.win && second.win };
}

export function displayColours(config, limit = 40) {
  const total = totalBalloons(config);
  const count = Math.min(total, limit);
  if (count === total) return COLOURS.flatMap((colour) => Array(config[colour]).fill(colour));
  const allocation = COLOURS.map((colour) => {
    const exact = config[colour] * count / total;
    return { colour, count: Math.floor(exact), remainder: exact % 1 };
  });
  let remaining = count - allocation.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocation].sort((a, b) => b.remainder - a.remainder)) {
    if (remaining-- <= 0) break;
    item.count++;
  }
  return allocation.flatMap(({ colour, count: amount }) => Array(amount).fill(colour));
}
