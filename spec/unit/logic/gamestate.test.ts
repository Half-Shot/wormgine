import { test, expect, describe } from "@jest/globals";
import { TeamDefinition, TeamGroup, WormIdentity } from "../../../src/logic/teams";
import { GameRules, GameState } from "../../../src/logic/gamestate";
import { GameWorld } from "../../../src/world";
import { DefaultWeaponSchema } from "../../../src/weapons/schema";

const DEAD_WORM: WormIdentity = {
  name: "fishbait",
  health: 0,
  maxHealth: 100,
}

const RED_TEAM: TeamDefinition = {
  name: "Lovely Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Diabolical Steve",
    health: 25,
    maxHealth: 100,
  }, {
    name: "Generous Greggory",
    health: 25,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "red",
}

const RED_TEAM_2: TeamDefinition = {
  name: "Passed over Reds",
  group: TeamGroup.Red,
  worms: [{
    name: "Unlucky dave",
    health: 100,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "red2",
}

const BLUE_TEAM: TeamDefinition = {
  name: "Melodramatic Blues",
  group: TeamGroup.Blue,
  worms: [{
    name: "Swansong Stella",
    health: 75,
    maxHealth: 100,
  }],
  ammo: {},
  playerUserId: null,
  uuid: "blue",
}

const DefaultRules: GameRules = {
  winWhenOneGroupRemains: true,
  wormHealth: 100,
  ammoSchema: DefaultWeaponSchema,
  roundDurationMs: 45000,
};

/**
 * Mock a complete test round.
 * @param gameState 
 * @returns 
 */
function completeRound(gameState: GameState) {
  const round = gameState.advanceRound();
  gameState.beginRound();
  gameState.playerMoved();
  gameState.markAsFinished();
  // Don't return toast.
  delete round.toast;
  return round;
}

describe('GameState', () => {
  test('requires at least one team', () => {
    expect(() => new GameState([], {} as GameWorld, DefaultRules)).toThrow();
  });
  test('should be able to get active teams', () => {
    const gameState = new GameState([RED_TEAM, { ...BLUE_TEAM, worms: [DEAD_WORM] }], {} as GameWorld, DefaultRules);
    const teams = gameState.getActiveTeams();
    expect(teams).toHaveLength(1);
  });
  test('should advance round to the next team', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM], {} as GameWorld, DefaultRules);
    const [redTeam, blueTeam] = gameState.getActiveTeams();
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
  });
  test('should advance round to the next team, skipping over the same group', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], {} as GameWorld, DefaultRules);
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
  });
  test('should advance round to the next team, should ensure that all teams within the same group get to play', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], {} as GameWorld, DefaultRules);
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam2, nextWorm: redTeam2.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: blueTeam, nextWorm: blueTeam.worms[0] });
    expect(completeRound(gameState)).toEqual({ nextTeam: redTeam, nextWorm: redTeam.worms[1] });
  });
  test('should detect a win when only one group has active worms', () => {
    const gameState = new GameState([RED_TEAM, RED_TEAM_2, BLUE_TEAM], {} as GameWorld, { winWhenOneGroupRemains: true, wormHealth: 100, ammoSchema: DefaultWeaponSchema });
    const [redTeam, redTeam2, blueTeam] = gameState.getActiveTeams();
    completeRound(gameState);
    // Kill the blues.
    blueTeam.worms[0].setHealth(0);
    // expect(gameState.advanceRound()).toEqual({ winningTeams: [redTeam, redTeam2] });
  });

  test('should handle the first round', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM], {} as GameWorld, DefaultRules);
    gameState.advanceRound();
    expect(gameState.iteration).toEqual(1);
    // Not in preround yet.
    expect(gameState.isPreRound).toEqual(false);
    gameState.beginRound();
    expect(gameState.isPreRound).toEqual(true);
    expect(gameState.remainingRoundTime).toEqual(5000);
  });

  test('should handle the player moving during preround', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM], {} as GameWorld, DefaultRules);
    gameState.advanceRound();
    expect(gameState.iteration).toEqual(1);
    gameState.beginRound();
    gameState.playerMoved();
    expect(gameState.isPreRound).toEqual(false);
    expect(gameState.paused).toEqual(false);
    expect(gameState.remainingRoundTime).toEqual(DefaultRules.roundDurationMs);
  });

  test('should handle preround timing out', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM], {} as GameWorld, DefaultRules);
    gameState.advanceRound();
    expect(gameState.iteration).toEqual(1);
    gameState.beginRound();
    for (let index = 0; index < 5; index++) {
      gameState.update({ deltaMS: 1000 });
    }
    expect(gameState.remainingRoundTime).toEqual(DefaultRules.roundDurationMs);
    expect(gameState.isPreRound).toEqual(false);
    expect(gameState.paused).toEqual(false);
  });

  test('should handle round finishing due to timeout', () => {
    const gameState = new GameState([RED_TEAM, BLUE_TEAM], {} as GameWorld, DefaultRules);
    const [_redTeam, blueTeam] = gameState.getActiveTeams();
    gameState.advanceRound();
    expect(gameState.iteration).toEqual(1);
    gameState.beginRound();
    for (let index = 0; index < 5; index++) {
      gameState.update({ deltaMS: 1000 });
    }
    expect(gameState.remainingRoundTime).toEqual(DefaultRules.roundDurationMs);
    expect(gameState.isPreRound).toEqual(false);
    expect(gameState.paused).toEqual(false);
    for (let index = 0; index < 45; index++) {
      gameState.update({ deltaMS: 1000 });
    }
    expect(gameState.remainingRoundTime).toEqual(0);
    const state = gameState.advanceRound();
    if ('winningTeams' in state) {
      throw Error('Unexpected win');
    }
    const { nextTeam, nextWorm } = state;
    expect(nextTeam).toEqual(blueTeam);
    expect(nextWorm).toEqual(blueTeam.worms[0]);
  });

});
