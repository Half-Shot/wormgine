export const TurnStartText = [
    "GO GO GO $WormName of $TeamName",
    "Look who's up, it's $WormName!",
    "Let's see if $WormName has what it takes."
];

export const TurnEndTextFall = [
    "Better dial 999, $WormName had a fall!",
    "Accidental or insurance fraud? Either way, $TeamName is not cashing in this round.",
    "Ouch, that's gotta hurt...their self esteem."
];

export const TurnEndTextMiss = [
    "Did $WormName forget their glasses?",
    "Absolutely no idea what was meant to happen there...",
    "$TeamName looking to disprove the the old saying about monkeys and typewriters",
    "$TeamName may be entering their pacifist arc."
];

export const TeamKilledText = [
    "$TeamName has bitten the dusty dusty dirt",
    "$TeamName is pushing up the daises",
    "With $WormName gone, $TeamName is no more",
    "BREAKING NEWS: $TeamName is history",
];

export const TeamWinnerText = [
    "$TeamName has won. This calls for a celebration!",
];

export const GameDrawText = [
    "Oh what, a draw? How boring",
    "You could have at least let the other team win? This sucks"
];


export const TurnEndTextOther = [
    "The developer failed to write a description here. How terrible!",
];

export const WeaponTimerText = [
    "Timer adjusted to $Time seconds.",
];

export const WormDeathSinking = [
    "$WormName went for a one way scuba dive.",
    "$WormName is fish bait now.",
    "$WormName discovered that they do not have gills.",
    "Sadly, $WormName did not return for air."
];

export const WormDeathGeneric = [
    "$WormName is providing to the funeral industry now.",
]

export function templateRandomText(options: string[], parameters: Record<string, string> = {}) {
    let chooseOption = options[Math.floor(Math.random()*options.length)];
    for (const [key, value] of Object.entries(parameters)) {
        chooseOption = chooseOption.replaceAll("$" + key, value);
    }
    return chooseOption;
}